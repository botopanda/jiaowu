/* ══════════════════════════════════════════════════════════════
   总管理：两本账（Project K / 我的）
   · 只有总管理的链接会用到这里的东西；潘、金、普通教务的数据库根本不会给「我的」学生
   · 右上角切换「全部 / Project K / 我的」，切换只是筛选显示，本机记住
   ══════════════════════════════════════════════════════════════ */
let DB_ALL = null;
try { S.book = localStorage.getItem('jw_book') || 'all'; } catch(e) { S.book = 'all'; }
const isOwner = () => !!(DB_ALL ? DB_ALL.me : DB.me)?.owner;
const curBook = () => isOwner() && S.book === 'mine' ? 'mine' : 'K';     // 工资结算记在哪本账
const isMine = s => !!(s && s.private);

// 按当前选的账本筛选数据（全部 / Project K / 我的）
function bookView(all){
  if (!all.me.owner || S.book === 'all') return all;
  const want = S.book === 'mine';
  const sids = new Set(all.students.filter(s => !!s.private === want).map(s => s.id));
  const courses = all.courses.filter(c => sids.has(c.student_id)), cids = new Set(courses.map(c => c.id));
  const lessons = all.lessons.filter(l => cids.has(l.course_id)), lids = new Set(lessons.map(l => l.id));
  const usedT = new Set(courses.map(c => c.teacher_id));
  return {...all,
    students: all.students.filter(s => sids.has(s.id)), courses, lessons,
    teachers: all.teachers.filter(t => usedT.has(t.id) || (want ? t.book !== 'K' : t.book !== 'mine')),   // 老师归属：K / mine / both
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
    people: (all.people||[]).filter(x => !x.student_id || sids.has(x.student_id)),
  };
}
function bookSwitch(){
  return `<div class="seg book-seg" role="group" aria-label="账本">${[['all','全部'],['K','Project K'],['mine','我的']].map(([k, t]) =>
    `<button class="${S.book===k?'on':''}" data-act="book" data-v="${k}">${t}</button>`).join('')}</div>`;
}

// 撞课提醒：同一位老师、同一时间，Project K 和「我的」两边都排了课（潘、金那边不会被挡，所以要总管理来调）
function ownerClashes(){
  if (!isOwner() || !DB_ALL) return [];
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
    return `${esc(s.name)}${s.private ? ' <span class="tag gold">我的</span>' : ''} ${l.start}–${l.end}`; };
  return ownerTeacherWarn() + `<section class="card" style="border-left:4px solid var(--seal)"><h3>撞课提醒 <span class="muted xs" style="font-weight:400">两本账之间的撞课，潘老师、金老师那边看不到，需要你来调</span></h3>
    <div class="list">${xs.map(([a, b]) => { const c = DB_ALL.courses.find(x => x.id === a.course_id);
      return `<div class="li"><span class="tag seal">撞课</span><div class="grow"><b>${esc((DB_ALL.teachers.find(t => t.id === c.teacher_id) || {}).name || '')}</b> · ${fmtMD(a.date)}<br><span class="small">${nm(a)} ／ ${nm(b)}</span></div>
        <button class="btn sm" data-act="lesson" data-v="${isMine(DB_ALL.students.find(s => s.id === c.student_id)) ? a.id : b.id}">调我的这节</button></div>`; }).join('')}</div></section>`;
}

// 学生 / 老师表单里的「归属」（只有总管理看得到）
const ownerStudentField = s => isOwner() ? `<label class="field"><span>归属（只有你看得到这一项）</span><select id="sf-book"><option value="K" ${s.private?'':'selected'}>Project K（潘老师、金老师能看到）</option><option value="mine" ${s.private || (!s.id && S.book==='mine') ? 'selected' : ''}>我的（只有我能看到）</option></select></label>` : '';
const T_BOOK = [['K','Project K（只教 Project K 的学生）'],['mine','我的（只教我的学生，潘老师、金老师看不到）'],['both','两边都教']];
const ownerTeacherField = t => { if (!isOwner()) return ''; const cur = t.id ? (t.book || 'K') : (S.book === 'mine' ? 'mine' : 'K');
  return `<label class="field"><span>归属（只有你看得到这一项）</span><select id="tf-book">${T_BOOK.map(([k, l]) => `<option value="${k}" ${k===cur?'selected':''}>${l}</option>`).join('')}</select></label>`; };
const tBookTag = t => !isOwner() ? '' : t.book === 'mine' ? '<span class="tag gold">我的</span>' : t.book === 'both' ? '<span class="tag blue">两边都教</span>' : '';
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
// 归属「我的」的老师却排了 Project K 学生的课 → 潘、金那边会看到这位老师，提醒一下
function ownerTeacherWarn(){
  if (!isOwner() || !DB_ALL) return '';
  const priv = new Set(DB_ALL.students.filter(s => s.private).map(s => s.id));
  const xs = DB_ALL.teachers.filter(t => t.book === 'mine' && DB_ALL.courses.some(c => c.teacher_id === t.id && !priv.has(c.student_id)));
  return xs.length ? `<div class="note warn">${xs.map(t => `<b>${esc(t.name)}</b>`).join('、')} 归属是「我的」，但也在教 Project K 的学生，所以潘老师、金老师那边能看到这位老师（看不到你的学生）。如果是两边都教，建议把归属改成「两边都教」。</div>` : '';
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.dataset.act !== 'book') return;
  S.book = a.dataset.v; try { localStorage.setItem('jw_book', S.book); } catch(err) {}
  DB = bookView(DB_ALL); render();
});
