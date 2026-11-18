/* ══════════════════════════════════════════════════════════════
   上课链接（腾讯会议）
   2026-11-18 第 50 步：每位老师一个 → 同一天改成第 51 步：每门课一个
   （一门课＝一位学生＋一位老师＋一个科目；一位老师带好几个学生、好几种课，每门课的会议可能不一样）
   · 老师：「我的学生」里每张学生卡片上「上课链接」点「填写」；可以把腾讯会议的整段邀请直接粘贴进来，自动挑出链接和会议号
   · 教务：学生页「课程」里每门课旁边「链接」
   · 学生：首页「下一节课」、课表里当天的课、「我的 → 我的老师」、电脑左侧都有「进入腾讯会议」（按那门课的链接）
   · 家长：只显示「有上课链接」，没有按钮
   ══════════════════════════════════════════════════════════════ */

// 只认 https:// 开头的链接（数据库也会挡一次）；x 是一门课
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

// 一门课的上课链接一行：已填就给按钮，没填写「还没填」；能改的人后面多一个「填写 / 修改」
function meetCourseRow(c, canEdit){
  return `${meetBtn(c, {empty: '<span class="muted">还没填</span>'})}${canEdit ? ` <button class="btn sm" data-act="mt-open" data-v="${c.id}">${meetOk(c) ? '修改' : '填写'}</button>` : ''}`;
}

// 填写弹窗（老师、教务共用）
function meetModal(cid){
  const c = course(cid); if (!c) return;
  openModal(`${mHead(`${esc(stu(c.student_id).name)} · ${esc(c.subject)} · 上课链接`)}
  <div class="muted xs">${esc(tea(c.teacher_id).name)}老师给${esc(stu(c.student_id).name)}上「${esc(c.subject)}」用的会议。学生在自己的页面上点「进入腾讯会议」就能进来；只有这位学生和家长看得到。<br>建议用一个固定不变的会议（例如腾讯会议的「周期性会议」或「个人会议室」），就不用每节课换。可以把腾讯会议的整段邀请直接粘贴进来，会自动挑出链接和会议号。</div>
  <label class="field"><span>会议链接</span><input type="text" id="mt-url" inputmode="url" autocomplete="off" value="${esc(c.meet_url || '')}" placeholder="https://meeting.tencent.com/…（整段邀请直接粘贴也行）"></label>
  <label class="field"><span>会议号 / 密码（可以不填）</span><input type="text" id="mt-note" autocomplete="off" maxlength="120" value="${esc(c.meet_note || '')}" placeholder="例：会议号 123 456 789，密码 1234"></label>
  <div class="row"><button class="btn pri" data-act="mt-save" data-v="${c.id}">保存</button>${meetOk(c) ? `${meetBtn(c, {label: '打开试试', withNote: false})}<button class="btn sm danger" data-act="mt-clear" data-v="${c.id}">清空</button>` : ''}</div>`);
}

// 老师「我的」最上面：提醒还有几门课没填（填写在「我的学生」里）
function meetSelfCard(t){
  const cs = DB.courses.filter(c => c.teacher_id === t.id && c.active !== false), n = cs.filter(c => !meetOk(c)).length;
  if (!cs.length) return '';
  return `<section class="card meet-card"><div class="row"><h3 style="font-size:16px;margin-right:auto">${MEET_IC}上课链接</h3>${n ? `<span class="tag warn">${n} 门课还没填</span>` : '<span class="tag ok">都填好了</span>'}</div>
  <div class="muted xs">每个学生、每门课各填一个腾讯会议链接，学生点一下就能进来。在「我的学生」里每张学生卡片上填。</div>
  ${n ? `<div><button class="btn pri sm" data-act="tab" data-v="b">去「我的学生」填</button></div>` : ''}</section>`;
}

// 教务「老师档案」卡片：这位老师的课填了几门
function meetTeacherSummary(t){
  const cs = DB.courses.filter(c => c.teacher_id === t.id && c.active !== false), n = cs.filter(meetOk).length;
  return cs.length ? (n === cs.length ? `<span class="tag ok">${n} 门课都填了</span>` : `<span class="${n ? '' : 'muted'}">${n} / ${cs.length} 门课已填</span> <span class="muted xs">（在学生页「课程」里填）</span>`) : '—';
}

// 学生「我的」里：我的老师和每门课的上课链接
function meetTeacherList(s){
  const cs = DB.courses.filter(c => c.student_id === s.id && c.active !== false);
  if (!cs.length) return '';
  return `<h3 class="sh-sec" id="m-teacher">${PRO() ? '孩子的老师' : '我的老师'}</h3>
  <div class="sx-list meet-list">${cs.map(c => `<div class="meet-row"><div class="grow"><b>${esc(tName(c.teacher_id))}</b> <span class="muted small">${esc(c.subject)}</span></div>${PRO() ? (meetOk(c) ? '<span class="muted xs">有上课链接</span>' : '') : meetBtn(c, {empty: '<span class="muted xs">老师还没填上课链接</span>'})}</div>`).join('')}</div>`;
}

// 电脑左侧「我的老师」：这位老师每门课一个小按钮
function meetSideBtns(sid, tid){
  if (PRO()) return '';
  const cs = DB.courses.filter(c => c.student_id === sid && c.teacher_id === tid && c.active !== false && meetOk(c));
  return cs.map(c => meetBtn(c, {label: (cs.length > 1 ? esc(c.subject) + ' · ' : '') + '腾讯会议 ›', withNote: false})).join('');
}

// 粘贴整段邀请：自动拆开填好
document.addEventListener('paste', e => {
  if (e.target?.id !== 'mt-url') return;
  const txt = e.clipboardData?.getData('text') || '', m = meetParse(txt);
  if (!m.url || txt.trim() === m.url) return;
  e.preventDefault(); e.target.value = m.url;
  const n = document.getElementById('mt-note'); if (n && !n.value.trim() && m.note) n.value = m.note;
});

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (k === 'mt-open') meetModal(v);
  if (k === 'mt-save' || k === 'mt-clear') {
    let url = k === 'mt-clear' ? '' : val('mt-url').trim(), note = k === 'mt-clear' ? '' : val('mt-note').trim();
    if (url && !/^https:\/\//.test(url)) { const m = meetParse(url); if (m.url) { url = m.url; if (!note) note = m.note; } }   // 手机上粘贴整段邀请时也拆开
    if (url && !/^https:\/\/[^\s<>"'`]+$/.test(url)) { toast('会议链接要以 https:// 开头，请直接复制腾讯会议里的会议链接', true); return; }
    if (k === 'mt-clear' && !confirm('清空这门课的上课链接？学生那边的「进入腾讯会议」按钮会消失。')) return;
    try { await act('course_meet_save', {cid: v, url, note}, url ? '已保存，学生那边能看到「进入腾讯会议」了' : '已清空'); closeModal(); } catch (err) {}
  }
});
