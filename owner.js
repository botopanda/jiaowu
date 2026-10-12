/* ══════════════════════════════════════════════════════════════
   总管理：两本账（Project K / Panda）
   · 只有总管理的链接会用到这里的东西；潘、金、普通教务的数据库根本不会给「Panda」学生
   · 右上角切换「全部 / Project K / Panda」，切换只是筛选显示，本机记住
   ══════════════════════════════════════════════════════════════ */
let DB_ALL = null;
try { S.book = localStorage.getItem('jw_book') || 'all'; } catch(e) { S.book = 'all'; }
const isOwner = () => !!(DB_ALL ? DB_ALL.me : DB.me)?.owner;
const curBook = () => isOwner() && S.book === 'mine' ? 'mine' : 'K';     // 工资结算记在哪本账
const isMine = s => !!(s && s.private);
const ownerUI = () => isOwner() && S.book !== 'K';   // Project K 视图要和潘、金看到的一模一样，总管理的小标签、按钮都藏起来

// 按当前选的账本筛选数据（全部 / Project K / Panda）
function bookView(all){
  if (!all.me.owner || S.book === 'all') return all;
  const want = S.book === 'mine';
  const sids = new Set(all.students.filter(s => !!s.private === want).map(s => s.id));
  const courses = all.courses.filter(c => sids.has(c.student_id)), cids = new Set(courses.map(c => c.id));
  const lessons = all.lessons.filter(l => cids.has(l.course_id)), lids = new Set(lessons.map(l => l.id));
  const usedT = new Set(courses.map(c => c.teacher_id));
  // 老师归属：K / mine(Panda) / both。Project K 看不到只教 Panda 的老师；Panda 看不到只教 Project K 的老师
  const teachers = all.teachers.filter(t => usedT.has(t.id) || (want ? t.book !== 'K' : t.book !== 'mine'));
  const tids = new Set(teachers.map(t => t.id));
  return {...all,
    students: all.students.filter(s => sids.has(s.id)), courses, lessons,
    teachers,
    feedbacks: all.feedbacks.filter(f => lids.has(f.lesson_id)),
    requests: all.requests.filter(q => lids.has(q.lesson_id)),
    plans: all.plans.filter(m => cids.has(m.course_id)),
    notes: all.notes.filter(n => sids.has(n.student_id)),
    scores: (all.scores||[]).filter(x => sids.has(x.student_id)),
    targets: (all.targets||[]).filter(x => sids.has(x.student_id)),
    reviews: (all.reviews||[]).filter(x => sids.has(x.student_id)),
    followups: (all.followups||[]).filter(x => sids.has(x.student_id)),
    files: (all.files||[]).filter(x => sids.has(x.student_id)),
    changes: (all.changes||[]).filter(x => cids.has(x.course_id)),
    pay: (all.pay||[]).filter(x => (x.book || 'K') === (want ? 'mine' : 'K')),
    people: (all.people||[]).filter(x => want
      // Panda：自己、Panda 学生和家长、Panda 老师的完整链接
      ? (x.owner || (x.student_id && sids.has(x.student_id)) || (x.teacher_id && x.full_view && tids.has(x.teacher_id)))
      // Project K：和潘、金看到的一样——没有总管理、没有完整链接、没有 Panda 学生和 Panda 老师
      : (!x.owner && !x.full_view && (!x.student_id || sids.has(x.student_id)) && (!x.teacher_id || tids.has(x.teacher_id)))),
  };
}
function bookSwitch(){
  return `<div class="seg book-seg" role="group" aria-label="账本">${[['all','全部'],['K','Project K'],['mine','Panda']].map(([k, t]) =>
    `<button class="${S.book===k?'on':''}" data-act="book" data-v="${k}">${t}</button>`).join('')}</div>`;
}

// 撞课提醒：同一位老师、同一时间，Project K 和「Panda」两边都排了课（潘、金那边不会被挡，所以要总管理来调）
function ownerClashes(){
  if (!ownerUI() || !DB_ALL) return [];
  const priv = new Set(DB_ALL.students.filter(s => s.private).map(s => s.id));
  const cs = new Map(DB_ALL.courses.map(c => [c.id, c]));
  const ls = DB_ALL.lessons.filter(l => l.status === 'scheduled' && l.date >= TODAY);
  const out = [];
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
    const a = ls[i], b = ls[j]; if (a.date !== b.date) continue;
    const ca = cs.get(a.course_id), cb = cs.get(b.course_id);
    if (!ca || !cb || ca.teacher_id !== cb.teacher_id) continue;
    if (priv.has(ca.student_id) === priv.has(cb.student_id)) continue;   // 同一本账的撞课系统本来就会挡
    if (a.start < b.end && b.start < a.end) out.push([a, b]);
  }
  return out;
}
function ownerClashBlock(){
  const xs = ownerClashes(); if (!xs.length) return ownerTeacherWarn();
  const nm = l => { const c = DB_ALL.courses.find(x => x.id === l.course_id), s = DB_ALL.students.find(x => x.id === c.student_id);
    return `${esc(s.name)}${s.private ? ' <span class="tag gold">Panda</span>' : ''} ${l.start}–${l.end}`; };
  return ownerTeacherWarn() + `<section class="card" style="border-left:4px solid var(--seal)"><h3>撞课提醒 <span class="muted xs" style="font-weight:400">两本账之间的撞课，潘老师、金老师那边看不到，需要你来调</span></h3>
    <div class="list">${xs.map(([a, b]) => { const c = DB_ALL.courses.find(x => x.id === a.course_id);
      return `<div class="li"><span class="tag seal">撞课</span><div class="grow"><b>${esc((DB_ALL.teachers.find(t => t.id === c.teacher_id) || {}).name || '')}</b> · ${fmtMD(a.date)}<br><span class="small">${nm(a)} ／ ${nm(b)}</span></div>
        <button class="btn sm" data-act="lesson" data-v="${isMine(DB_ALL.students.find(s => s.id === c.student_id)) ? a.id : b.id}">调 Panda 这节</button></div>`; }).join('')}</div></section>`;
}

// 学生 / 老师表单里的「归属」（只有总管理看得到）
const ownerStudentField = s => isOwner() ? `<label class="field"><span>归属（只有你看得到这一项）</span><select id="sf-book"><option value="K" ${s.private?'':'selected'}>Project K（潘老师、金老师能看到）</option><option value="mine" ${s.private || (!s.id && S.book==='mine') ? 'selected' : ''}>Panda（只有我能看到）</option></select></label>` : '';
const T_BOOK = [['K','Project K（只教 Project K 的学生）'],['mine','Panda（只教 Panda 的学生，潘老师、金老师看不到）'],['both','两边都教']];
const ownerTeacherField = t => { if (!isOwner()) return ''; const cur = t.id ? (t.book || 'K') : (S.book === 'mine' ? 'mine' : 'K');
  return `<label class="field"><span>归属（只有你看得到这一项）</span><select id="tf-book">${T_BOOK.map(([k, l]) => `<option value="${k}" ${k===cur?'selected':''}>${l}</option>`).join('')}</select></label>`; };
const tBookTag = t => !ownerUI() ? '' : t.book === 'mine' ? '<span class="tag gold">Panda</span>' : t.book === 'both' ? '<span class="tag blue">两边都教</span>' : '';
async function ownerAfterSave(kind, id, before){
  if (!isOwner()) return;
  if (kind === 'teacher') {
    const bk = val('tf-book'); if ((before || 'K') === bk) return;
    await rpc('owner_set_teacher_book', {tid: id, bk});
  } else {
    const want = val('sf-book') === 'mine'; if (!!before === want) return;
    await rpc('owner_set_private', {kind, xid: id, on_: want});
  }
  await load(); render();
}
// 归属「Panda」的老师却排了 Project K 学生的课 → 潘、金那边会看到这位老师，提醒一下
function ownerTeacherWarn(){
  if (!ownerUI() || !DB_ALL) return '';
  const priv = new Set(DB_ALL.students.filter(s => s.private).map(s => s.id));
  const xs = DB_ALL.teachers.filter(t => t.book === 'mine' && DB_ALL.courses.some(c => c.teacher_id === t.id && !priv.has(c.student_id)));
  return xs.length ? `<div class="note warn">${xs.map(t => `<b>${esc(t.name)}</b>`).join('、')} 归属是「Panda」，但也在教 Project K 的学生，所以潘老师、金老师那边能看到这位老师（看不到你的学生）。如果是两边都教，建议把归属改成「两边都教」。</div>` : '';
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.dataset.act !== 'book') return;
  S.book = a.dataset.v; try { localStorage.setItem('jw_book', S.book); } catch(err) {}
  DB = bookView(DB_ALL); render();
});

/* ───────── 老师链接：一位老师一行（总管理在「全部 / Panda」里看） ─────────
   两边都教的老师有两条链接：老师自己用的完整链接，和一条只给潘、金看的普通链接（总管理这边不显示）。
   切换归属时，数据库会自动处理这两条链接，老师自己的链接永远不变。 */
const T_BOOK_TAG = {K: ['mute', '只属于 Project K'], mine: ['gold', '只属于 Panda'], both: ['blue', '两边都教 · 完整链接']};
// 只给潘、金看的那条普通链接（两边都教的老师才有）
const ownerShadow = p => ownerUI() && p.role === 'teacher' && (tea(p.teacher_id) || {}).book === 'both' && !p.full_view;
// 老师自己用的那条链接
function teacherRealLink(t){
  const ls = (DB.people || []).filter(x => x.role === 'teacher' && x.teacher_id === t.id && x.active);
  return ownerUI() && t.book !== 'K' ? (ls.find(x => x.full_view) || ls[0]) : (ls.find(x => !x.full_view) || ls[0]);
}
const ownerLinkTag = p => { if (!ownerUI() || p.role !== 'teacher') return ''; const [c, l] = T_BOOK_TAG[(tea(p.teacher_id) || {}).book || 'K']; return ` <span class="tag ${c}">${l}</span>`; };
const ownerLinkToggle = p => ownerUI() && p.role === 'teacher'
  ? `<select class="t-book-sel" data-tid="${p.teacher_id}" aria-label="老师归属">${[['K','只属于 Project K'],['mine','只属于 Panda'],['both','两边都教']].map(([k, l]) => `<option value="${k}" ${((tea(p.teacher_id) || {}).book || 'K') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '';
const ownerFullLinkBtn = t => '';
document.addEventListener('change', async e => {
  const el = e.target; if (!el.classList || !el.classList.contains('t-book-sel')) return;
  const tid = el.dataset.tid, bk = el.value, t = tea(tid);
  const msg = {K: `${t.name} 改成只属于 Project K。老师原来的链接不变，以后只看得到 Project K 的学生`,
               mine: `${t.name} 改成只属于 Panda。老师原来的链接不变，潘老师、金老师那边看不到这位老师了`,
               both: `${t.name} 改成两边都教。老师原来的链接不变，现在两边的学生都看得到；潘老师、金老师那边看到的是一条只看 Project K 的链接`}[bk];
  try { await act('owner_set_teacher_book', {tid, bk}, msg); } catch(err) { render(); }
});
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  try {
    if (a.dataset.act === 'link-full') {
      const [pid, on] = a.dataset.v.split('|');
      if (on === '0' && !confirm('改成普通链接后，这位老师用这条链接就看不到你的学生了，潘老师、金老师也能看到这条链接。确定吗？')) return;
      await act('admin_link_update', {pid, d: {full: on === '1'}}, on === '1' ? '已改成完整链接，潘老师、金老师看不到它了' : '已改成普通链接');
    }
    if (a.dataset.act === 'link-normal-new') {
      const t = tea(a.dataset.v);
      await act('admin_link_create', {d: {name: t.name, role: 'teacher', teacher_id: t.id, full: false}}, `已给 ${t.name} 补了一条普通链接，潘老师、金老师那边能看到了`);
    }
    if (a.dataset.act === 'link-full-new') {
      const t = tea(a.dataset.v);
      const nk = await act('admin_link_create', {d: {name: t.name, role: 'teacher', teacher_id: t.id, full: true}});
      copyText(linkOf(nk), `已生成 ${t.name} 的完整链接并复制。发给老师时告诉他「以这条为准」`);
    }
  } catch(err) { /* act() 已经提示过 */ }
});
