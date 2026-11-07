/* ══════════════════════════════════════════════════════════════
   考试日程（2026-11-08，数据库第 45 步）
   · 考试记在「升学与出愿」对应的目标学校里：一次结果 / 笔试 / 面试 / 结果 各一天，每场能写时间、备注
   · 教务：课表上点「考」看详情、修改、删除；「＋ 加考试」或排课弹窗顶上切到「加考试」
   · 学生、家长、任课老师：课表上能看到（显示在 app.js 的 schedule / agenda，周视图在 week.js）
   ══════════════════════════════════════════════════════════════ */

// 排课弹窗和加考试弹窗顶上的切换
const exSwitch = on => `<div class="seg ex-sw" role="group" aria-label="排课还是加考试">
  <button type="button" class="${on==='lesson'?'on':''}" ${on==='lesson'?'':'data-act="ex-to-lesson"'}>排课</button>
  <button type="button" class="${on==='exam'?'on':''}" ${on==='exam'?'':'data-act="ex-new" data-v="al"'}>加考试</button></div>`;

const exTarget = tid => (DB.targets||[]).find(x => x.id===tid);
const exKeyLabel = k => (EXAM_KEYS.find(x => x[0]===k) || [k,k])[1];
// 这所学校的整条考试日程：一次结果 11/25 → 面试 12/5 → 最终结果 1/7
const exChain = (t, hi) => EXAM_KEYS.filter(([k]) => t[k]).sort((a,b) => t[a[0]].localeCompare(t[b[0]]))
  .map(([k]) => `<span class="${t[k]===hi?'ex-hi':''}">${exLabel(t,k)} ${sMD(t[k])}</span>`).join(' → ');

/* ───────── 详情：点课表上的「考」 ───────── */
function examModal(tid, date){
  const t = exTarget(tid); if (!t) { closeModal(); return; }
  const items = examsOf(t.student_id).filter(e => e.tid===tid && e.date===date);
  if (!items.length) { closeModal(); return; }
  lastModal = () => examModal(tid, date);
  openModal(`${mHead(`<b class="exk">考</b> ${esc(stu(t.student_id).name)} · ${fmtMD(date)}`)}
  <div><b style="font-family:var(--f-disp);font-size:15px">${esc(t.school)}</b>${t.exam_way?`<div class="muted small">${esc(t.exam_way)}</div>`:''}</div>
  <div class="list">${items.map(e => `<div class="li"><div class="grow"><b>${e.label}</b>${e.time?` <span class="num">${esc(e.time)}</span>`:''}${e.note?`<div class="small" style="white-space:pre-wrap">${esc(e.note)}</div>`:''}</div>
    ${isAdmin()?`<button class="btn sm" data-act="ex-edit" data-v="${tid}|${e.kind}">修改</button><button class="btn sm danger" data-act="ex-del" data-v="${tid}|${e.kind}">删除</button>`:''}</div>`).join('')}</div>
  <div class="small"><span class="muted">这所学校的日程</span> ${exChain(t, date)}</div>
  ${t.next_step?`<div class="small"><span class="muted">下一步</span> ${esc(t.next_step)}</div>`:''}
  ${isAdmin()?`<div class="row"><button class="btn sm" data-act="ex-new" data-v="${date}|${t.student_id}|${tid}">＋ 这所学校再加一场</button><button class="btn sm" data-act="student-tab" data-v="${t.student_id}|target">去「升学与出愿」看这所</button></div>
  <div class="muted xs">删除只删这一场的日期、时间、备注，这所学校还留在「升学与出愿」里。</div>`:''}`);
}

/* ───────── 加考试 / 修改一场 ───────── */
// o = {date, sid, tid, kind}；有 tid 和 kind ＝修改那一场
function examForm(o={}){
  const t = o.tid ? exTarget(o.tid) : null, editing = !!(t && o.kind);
  const sid = t ? t.student_id : (o.sid || (S.calType==='s' && S.calId) || '');
  const studs = DB.students.filter(s => s.active!==false || s.id===sid).slice().sort((x, y) => pyCmp(x.name, y.name));
  const inf = editing ? ((t.exam_info||{})[o.kind] || {}) : {};
  const kind = o.kind || 'written_date';
  lastModal = null;
  openModal(`${mHead(editing ? '修改考试' : '加考试')}
  ${editing || o.tid ? '' : exSwitch('exam')}
  <div class="muted xs">考试记在这位学生「升学与出愿」对应的学校里，课表上用红色「考」显示，不算课。学生、家长和任课老师都能看到，备注也能看到。</div>
  <div class="fields">
    <label class="field"><span>日期</span><input type="date" id="ex-d" value="${esc(o.date||TODAY)}" data-change="ex-warn"></label>
    <label class="field"><span>学生</span><select id="ex-stu" data-change="ex-stu" ${t?'disabled':''}><option value="">选择学生…</option>${studs.map(s => `<option value="${s.id}" ${s.id===sid?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
  </div>
  <div class="field"><span>学校</span><select id="ex-tg" data-change="ex-tg" ${t?'disabled':''}>${exTgOpts(sid, o.tid)}</select>
    <div id="ex-new-box" style="display:flex;flex-direction:column;gap:4px;margin-top:4px" hidden>
      <input type="text" id="ex-school" maxlength="200" list="dl-ex-prog" placeholder="打字搜院校库，或直接写学校名（例：東京工芸大学 留学生Ⅰ期）">
      <datalist id="dl-ex-prog"></datalist>
      <span class="muted xs" id="ex-prog-tip">院校库里有的会自动关联；没有的照写也行。新学校先记成「目标」，之后可以在「升学与出愿」里改。</span></div></div>
  <div class="field"><span>这天是</span><div class="seg" role="group" aria-label="考试类型">${EXAM_KEYS.map(([k,l]) => `<button type="button" class="${k===kind?'on':''}" data-act="ex-kind" data-v="${k}">${l}</button>`).join('')}</div>
    <input type="hidden" id="ex-k" value="${kind}"><input type="hidden" id="ex-old" value="${editing?o.kind:''}"></div>
  <div id="ex-warn" class="xs" style="color:var(--warn)"></div>
  <div class="fields">
    <label class="field"><span>时间（可以不填）</span><input type="text" id="ex-time" maxlength="40" value="${esc(inf.time||'')}" placeholder="例：9:30–11:30"></label>
    <label class="field" style="flex:2"><span>备注（可以不填）</span><input type="text" id="ex-note" maxlength="300" value="${esc(inf.note||'')}" placeholder="例：要带漫画原稿；面试 12/22 或 12/23，12/20 公布"></label>
  </div>
  <div class="row"><button class="btn pri" data-act="ex-save" data-v="${editing?`${o.tid}|${o.kind}`:''}">保存</button>${editing?`<button class="btn sm" data-act="exam" data-v="${o.tid}|${t[o.kind]}">返回</button>`:''}</div>`);
  exTgChanged();
}
function exTgOpts(sid, tid){
  if (!sid) return '<option value="">先选学生…</option>';
  const ts = targetsOf(sid);
  return ts.map(t => `<option value="${t.id}" ${t.id===tid?'selected':''}>${esc(t.school)}</option>`).join('')
    + `<option value="__new" ${!ts.length?'selected':''}>＋ 新学校…</option>`;
}
// 选了「新学校」：显示输入框，顺便把院校库读进来给输入框做提示
async function exTgChanged(){
  const box = document.getElementById('ex-new-box'); if (!box) return;
  const isNew = val('ex-tg')==='__new';
  box.hidden = !isNew;
  exWarn();
  if (!isNew) return;
  try {
    const list = await progLoad(), dl = document.getElementById('dl-ex-prog');
    if (dl) dl.innerHTML = list.map(p => `<option value="${esc(exProgText(p))}"></option>`).join('');
  } catch(e) { const tip = document.getElementById('ex-prog-tip'); if (tip) tip.textContent = '院校库暂时读不出来，直接写学校名就行。'; }
}
const exProgText = p => `${p.school}／${progName(p)}`;
// 这所学校这种考试原来已经有别的日子：提醒保存后会改成这天（一所学校每种只记一天）
function exWarn(){
  const box = document.getElementById('ex-warn'); if (!box) return;
  const t = exTarget(val('ex-tg')), k = val('ex-k'), old = val('ex-old'), d = val('ex-d');
  box.textContent = t && t[k] && t[k]!==d && k!==old
    ? `这所学校的「${exLabel(t,k)}」原来是 ${sMD(t[k])}，保存后改成 ${d ? sMD(d) : '这天'}。一所学校每种只记一天；另有一天的话，写在备注里。` : '';
}

async function exSave(v){
  const d = {kind: val('ex-k'), date: val('ex-d'), time: val('ex-time').trim(), note: val('ex-note').trim()};
  if (!d.date) { toast('请填日期', true); return; }
  if (v) { const [tid, old] = v.split('|'); d.target_id = tid; d.old_kind = old; }
  else {
    const tg = val('ex-tg');
    if (!val('ex-stu')) { toast('请选学生', true); return; }
    if (tg && tg!=='__new') d.target_id = tg;
    else {
      d.student_id = val('ex-stu'); d.school = val('ex-school').trim();
      if (!d.school) { toast('请选或填写学校', true); return; }
      const p = (PROG||[]).find(x => exProgText(x)===d.school); if (p) d.program_id = p.id;
    }
  }
  const tid = await act('exam_set', {d}, '考试已保存');
  if (S.page==='calendar' && !d.date.startsWith(S.month)) { S.month = d.date.slice(0,7); if (S.calView==='week' && typeof wkMon==='function') S.week = wkMon(d.date); render(); }
  examModal(tid, d.date);
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  try {
    if (k==='exam') { const [tid, d] = v.split('|'); examModal(tid, d); }
    if (k==='ex-new') {
      if (v==='al') examForm({date: val('al-d') || TODAY, sid: val('al-stu')});          // 排课弹窗顶上切过来：带上日期和学生
      else if (v) { const [d, sid, tid] = v.split('|'); examForm({date: d, sid, tid}); }  // 详情里「这所学校再加一场」，周视图考试栏点空白（只有日期）
      else examForm({date: S.page==='calendar' && !TODAY.startsWith(S.month) ? `${S.month}-01` : TODAY});
    }
    if (k==='ex-to-lesson') { S.alPre = {d: val('ex-d') || TODAY, s: '18:00', e: '20:00'}; addLessonModal(); }
    if (k==='ex-kind') {
      document.getElementById('ex-k').value = v;
      a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b===a));
      exWarn();
    }
    if (k==='ex-edit') { const [tid, kd] = v.split('|'), t = exTarget(tid); if (t) examForm({tid, kind: kd, date: t[kd]}); }
    if (k==='ex-save') await exSave(v);
    if (k==='ex-del') {
      const [tid, kd] = v.split('|'), t = exTarget(tid); if (!t) return;
      const d = t[kd];
      if (!confirm(`删除 ${stu(t.student_id).name}「${t.school}」${sMD(d)} 的${exLabel(t,kd)}？\n这所学校还会留在「升学与出愿」里。`)) return;
      await act('exam_clear', {xid: tid, kd}, '已删除这一场');
      examModal(tid, d);
    }
  } catch(err) { /* act() 已经提示过 */ }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change;
  if (k==='ex-stu') { const sel = document.getElementById('ex-tg'); if (sel) sel.innerHTML = exTgOpts(el.value); exTgChanged(); }
  if (k==='ex-tg') exTgChanged();
  if (k==='ex-warn') exWarn();
});
