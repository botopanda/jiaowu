/* ══════════════════════════════════════════════════════════════
   上课链接（腾讯会议）
   2026-11-18：每位老师一个（第 50 步）→ 每门课一个（第 51 步）→ 每节课一个（第 52 步，现在这样）
   老师的腾讯会议往往每节课都不一样（一周几节课很难共用一个会议，个人会议室也不一定愿意给学生用）
   · 老师：点课表里那节课，窗口里「上课链接」点「填写」。会先帮他填好这门课上一节课用的链接，一样就直接保存。
     可以勾「以后每周 X 的课也用这个链接」（每周固定的周期性会议用）。课表页上面会提醒「接下来有几节课还没填」
   · 教务：同一个窗口里也能替老师填；老师档案卡片上看接下来 7 天填了几节
   · 学生：首页「下一节课」、课表里今天和以后的每节课都有「进入腾讯会议」（按那一节课的链接）
   · 家长：不给按钮
   ══════════════════════════════════════════════════════════════ */

// 只认 https:// 开头的链接（数据库也会挡一次）；x 是一节课
const meetOk = x => !!(x && typeof x.meet_url === 'string' && /^https:\/\/[^\s<>"'`]+$/.test(x.meet_url));
const meetName = x => /tencent|voovmeeting/i.test(x.meet_url || '') ? '腾讯会议' : '上课链接';
const MEET_IC = '<svg class="meet-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>';
// 「进入腾讯会议」按钮（新窗口打开）；withNote：后面带上会议号 / 密码
function meetBtn(x, o = {}){
  if (!meetOk(x)) return o.empty || '';
  return `<span class="meet-wrap"><a class="btn gold ${o.big ? '' : 'sm'} meet-go" href="${esc(x.meet_url)}" target="_blank" rel="noopener noreferrer">${MEET_IC}${o.label || '进入' + meetName(x)}</a>${o.withNote !== false && x.meet_note ? `<span class="muted xs meet-note">${esc(x.meet_note)}</span>` : ''}</span>`;
}

// 粘贴整段腾讯会议邀请：挑出链接、会议号、密码
function meetParse(txt){
  const s = String(txt || '');
  const url = (s.match(/https:\/\/[^\s<>"'`，。、；）)】]+/) || [''])[0];
  const no = (s.match(/(?:#腾讯会议|会议号|会议 ?ID|Meeting ID)[：:\s]*(\d[\d\s-]{6,16}\d)/i) || [])[1];
  const pw = (s.match(/(?:会议密码|入会密码|密码)[：:\s]*([A-Za-z0-9]{3,12})/) || [])[1];
  return {url, note: [no ? `会议号 ${no.replace(/\s+/g, ' ').trim()}` : '', pw ? `密码 ${pw}` : ''].filter(Boolean).join('，')};
}

const wdName = d => '周' + WD[pd(d).getDay()];
// 这门课最近一节填过链接的课（先找这节之前最近的，没有就找之后最近的）——填写时先帮老师填上
function meetPrev(l){
  const ls = DB.lessons.filter(x => x.course_id === l.course_id && x.id !== l.id && meetOk(x));
  const before = ls.filter(x => x.date <= l.date).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const after = ls.filter(x => x.date > l.date).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return before[0] || after[0] || null;
}
// 以后同一门课、同一个星期几、还没填链接的课
const meetSameWd = l => DB.lessons.filter(x => x.course_id === l.course_id && x.date > l.date && pd(x.date).getDay() === pd(l.date).getDay() && x.status === 'scheduled' && !meetOk(x));
// 老师：接下来 14 天还没填链接的课
const meetTodo = tid => DB.lessons.filter(l => course(l.course_id)?.teacher_id === tid && l.status === 'scheduled' && l.date >= TODAY && dBetween(TODAY, l.date) <= 14 && !meetOk(l));

// 课的窗口里一行（老师、教务）
function meetLessonRow(l){
  return `<dt>上课链接</dt><dd>${meetBtn(l, {empty: '<span class="muted">还没填</span>'})}${canSched() && l.status === 'scheduled' ? ` <button class="btn sm" data-act="mt-open" data-v="${l.id}">${meetOk(l) ? '修改' : '填写'}</button>` : ''}</dd>`;
}

// 填写弹窗
let mtFrom = 'lesson';
function meetModal(lid){
  const l = L(lid); if (!l) return;
  const c = course(l.course_id), prev = meetOk(l) ? null : meetPrev(l), src = meetOk(l) ? l : (prev || {}), more = meetSameWd(l).length;
  openModal(`${mHead(`${esc(stu(c.student_id).name)} · ${esc(c.subject)} · 上课链接`)}
  <div class="small"><b>${fmtMD(l.date)} ${l.start}–${l.end}</b> <span class="bj-tag">北京时间</span> <span class="muted">${esc(tea(c.teacher_id).name)}老师</span></div>
  ${prev ? `<div class="note">已经先帮你填好了 ${sMD(prev.date)} 那节课用的链接。这节课还是这个会议，直接点「保存」；换了会议，换成新的再保存。</div>` : ''}
  <label class="field"><span>会议链接</span><input type="text" id="mt-url" inputmode="url" autocomplete="off" value="${esc(src.meet_url || '')}" placeholder="https://meeting.tencent.com/…（整段邀请直接粘贴也行）"></label>
  <label class="field"><span>会议号 / 密码（可以不填）</span><input type="text" id="mt-note" autocomplete="off" maxlength="120" value="${esc(src.meet_note || '')}" placeholder="例：会议号 123 456 789，密码 1234"></label>
  ${more ? `<label class="meet-wd"><input type="checkbox" id="mt-wd" class="chk"><span>以后每${wdName(l.date)}的「${esc(c.subject)}」课也用这个链接<span class="muted xs" style="display:block">还没填链接的还有 ${more} 节；适合每周固定时间的周期性会议</span></span></label>` : ''}
  <div class="muted xs">可以把腾讯会议的整段邀请直接粘贴进来，会自动挑出链接和会议号。学生在自己的页面上点「进入腾讯会议」就能进来。</div>
  <div class="row"><button class="btn pri" data-act="mt-save" data-v="${l.id}">保存</button>${meetOk(src) ? meetBtn(src, {label: '打开试试', withNote: false}) : ''}${meetOk(l) ? `<button class="btn sm danger" data-act="mt-clear" data-v="${l.id}">清空</button>` : ''}<button class="btn sm" data-act="mt-back" data-v="${l.id}" style="margin-left:auto">返回</button></div>`);
}

// 老师课表页上面：接下来 14 天还有几节课没填链接
function meetTodoNote(t){
  const n = meetTodo(t.id).length;
  return n ? `<div class="note row" style="justify-content:space-between">${MEET_IC}<span style="flex:1">接下来 14 天有 ${n} 节课还没填上课链接</span><button class="btn sm" data-act="mt-todo">去填</button></div>` : '';
}
function meetTodoModal(){
  const ls = meetTodo(ME().teacher_id);
  if (!ls.length) { closeModal(); toast('接下来 14 天的课都填好链接了'); return; }
  openModal(`${mHead('还没填上课链接的课')}
  <div class="muted xs">点「填写」，一节一节填。会先帮你填好这门课上一节课用的链接，一样就直接保存。</div>
  <div class="list">${ls.map(l => { const c = course(l.course_id); return `<div class="li"><div class="grow"><b>${sMD(l.date)} ${wdName(l.date)}</b> <span class="num">${l.start}–${l.end}</span> · ${esc(stu(c.student_id).name)} ${subjTag(c.subject)}</div><button class="btn pri sm" data-act="mt-open" data-v="${l.id}" data-from="todo">填写</button></div>`; }).join('')}</div>`);
}

// 教务「老师档案」卡片：接下来 7 天的课填了几节
function meetTeacherSummary(t){
  const ls = DB.lessons.filter(l => course(l.course_id)?.teacher_id === t.id && l.status === 'scheduled' && l.date >= TODAY && dBetween(TODAY, l.date) <= 7), n = ls.filter(meetOk).length;
  return ls.length ? (n === ls.length ? `<span class="tag ok">接下来 7 天 ${n} 节都填了</span>` : `<span class="${n ? '' : 'muted'}">接下来 7 天 ${n} / ${ls.length} 节已填</span>`) : '<span class="muted">接下来 7 天没有课</span>';
}

// 「排课」「申请排课」窗口里：上课链接（可以不填）。默认只填进第一节，勾上就重复的几节都用（第 53 步）
function meetAddFields(){
  return `<div class="fields"><label class="field"><span>上课链接（可以不填）</span><input type="text" id="al-url" inputmode="url" autocomplete="off" placeholder="https://meeting.tencent.com/…（整段邀请直接粘贴也行）"></label><label class="field"><span>会议号 / 密码（可以不填）</span><input type="text" id="al-mnote" autocomplete="off" maxlength="120" placeholder="例：会议号 123 456 789，密码 1234"></label></div>
  <label class="meet-wd" id="al-wd-row" hidden><input type="checkbox" id="al-wd" class="chk"><span>重复的几节都用这个链接<span class="muted xs" style="display:block">不勾就只填第一节，其他几节之后点开那节课再填；每周固定时间的周期性会议可以勾上</span></span></label>`;
}
// 填了链接、又真的排出好几节时，才显示「重复的几节都用」
const meetAddMany = () => (typeof lessonDates === 'function' && val('al-d') ? lessonDates(val('al-d'), val('al-rep')).length : (val('al-rep') === '1' ? 1 : 2)) > 1;
function meetAddSync(){
  const r = document.getElementById('al-wd-row'); if (!r) return;
  r.hidden = !(val('al-url').trim() && meetAddMany());
}
document.addEventListener('input', e => { if (e.target?.id === 'al-url') meetAddSync(); });
document.addEventListener('change', e => { if (['al-rep', 'al-url', 'al-d'].includes(e.target?.id)) meetAddSync(); });
// 提交时取出来：{} = 没填；null = 填得不对（已经提示过）
function meetAddVals(){
  let url = val('al-url').trim(), note = val('al-mnote').trim();
  if (!url) return {};
  if (!/^https:\/\//.test(url)) { const m = meetParse(url); if (m.url) { url = m.url; if (!note) note = m.note; } }   // 手机上粘贴整段邀请时也拆开
  if (url.length > 300 || !/^https:\/\/[^\s<>"'`]+$/.test(url)) { toast('上课链接要以 https:// 开头，请直接复制腾讯会议里的会议链接（不填也可以）', true); return null; }
  return {murl: url, ...(note ? {mnote: note} : {}), ...(document.getElementById('al-wd')?.checked && meetAddMany() ? {mall: true} : {})};
}

// 以前按老师 / 按课填的地方，现在不用了（留着名字，旧的调用处不会报错）
const meetSelfCard = () => '', meetTeacherList = () => '', meetSideBtns = () => '', meetCourseRow = () => '';

// 粘贴整段邀请：自动拆开填好
document.addEventListener('paste', e => {
  const id = e.target?.id; if (id !== 'mt-url' && id !== 'al-url') return;
  const txt = e.clipboardData?.getData('text') || '', m = meetParse(txt);
  if (!m.url || txt.trim() === m.url) return;
  e.preventDefault(); e.target.value = m.url;
  const n = document.getElementById(id === 'mt-url' ? 'mt-note' : 'al-mnote'); if (n && m.note) n.value = m.note;
  meetAddSync();
});

const meetBack = lid => mtFrom === 'todo' ? meetTodoModal() : lessonModal(lid);
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (k === 'mt-open') { mtFrom = a.dataset.from || 'lesson'; meetModal(v); }
  if (k === 'mt-todo') { mtFrom = 'todo'; meetTodoModal(); }
  if (k === 'mt-back') meetBack(v);
  if (k === 'mt-save' || k === 'mt-clear') {
    let url = k === 'mt-clear' ? '' : val('mt-url').trim(), note = k === 'mt-clear' ? '' : val('mt-note').trim();
    if (url && !/^https:\/\//.test(url)) { const m = meetParse(url); if (m.url) { url = m.url; if (!note) note = m.note; } }   // 手机上粘贴整段邀请时也拆开
    if (k === 'mt-save' && !url) { toast('请填会议链接（不要这节课的链接，点「清空」）', true); return; }
    if (url && !/^https:\/\/[^\s<>"'`]+$/.test(url)) { toast('会议链接要以 https:// 开头，请直接复制腾讯会议里的会议链接', true); return; }
    if (k === 'mt-clear' && !confirm('清空这节课的上课链接？学生那边这节课的「进入腾讯会议」按钮会消失。')) return;
    const wd = !!document.getElementById('mt-wd')?.checked;
    try {
      await act('lesson_meet_save', {lid: v, url, note, same_wd: wd}, n => !url ? '已清空' : n > 1 ? `已保存，另外 ${n - 1} 节${wdName(L(v).date)}的课也填上了` : '已保存，学生那边能看到「进入腾讯会议」了');
      meetBack(v);
    } catch (err) {}
  }
});
