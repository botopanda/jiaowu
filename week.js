/* ══════════════════════════════════════════════════════════════
   教务「课表与排课」的周视图
   · 横着是一周 7 天，竖着是时间；一节课按开始、结束时间画成一块
   · 同一时间有好几节课，并排显示
   · 点空白处：直接在那天、那个钟点排课（时间自动填好）
   · 「全部 / 按学生 / 按老师」筛选和月视图共用
   ══════════════════════════════════════════════════════════════ */
const WK_HH = 46;   // 一小时多高（像素）
const wkMon = d => { const wd = (pd(d).getDay() + 6) % 7; return addDay(d, -wd); };   // 那一周的周一
const wkHM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function pgWeek(){
  const mon = S.week || (S.week = wkMon(TODAY)), days = Array.from({length: 7}, (_, i) => addDay(mon, i));
  let ls = DB.lessons.filter(l => l.date >= days[0] && l.date <= days[6]);
  if (S.calType==='s' && S.calId) ls = ls.filter(l => course(l.course_id).student_id===S.calId);
  if (S.calType==='t' && S.calId) ls = ls.filter(l => course(l.course_id).teacher_id===S.calId);
  const who = c => S.calType==='s' ? tea(c.teacher_id).name : S.calType==='t' ? stu(c.student_id).name : `${stu(c.student_id).name}·${tea(c.teacher_id).name.replace('老师','')}`;
  // 显示的钟点范围：至少 9 点到 22 点，有更早更晚的课就放宽
  const h0 = Math.min(9, ...ls.map(l => Math.floor(mins(l.start) / 60))), h1 = Math.max(22, ...ls.map(l => Math.ceil(mins(l.end) / 60)));
  const colH = (h1 - h0) * WK_HH, y = m => (m - h0 * 60) / 60 * WK_HH;
  // 同一时间重叠的课并排：按开始时间分组，组内一条一条排「道」
  const place = dl => {
    const out = [], sorted = dl.slice().sort((a, b) => a.start.localeCompare(b.start));
    let grp = [], grpEnd = -1;
    const flush = () => { const lanes = []; grp.forEach(l => { let k = lanes.findIndex(e => e <= mins(l.start)); if (k < 0) { k = lanes.length; lanes.push(0); } lanes[k] = mins(l.end); out.push([l, k]); });
      out.slice(-grp.length).forEach(x => x.push(lanes.length)); grp = []; };
    sorted.forEach(l => { if (grp.length && mins(l.start) >= grpEnd) flush(); grp.push(l); grpEnd = Math.max(grpEnd, mins(l.end)); });
    if (grp.length) flush();
    return out;
  };
  const block = ([l, k, n]) => { const c = course(l.course_id), top = y(mins(l.start)), h = Math.max(22, y(mins(l.end)) - top - 2);
    return `<button class="wk-l ${l.status!=='scheduled'?'leave':''} ${isPend(l)?'pend':''}" style="--hc:${slotHue(l.start)};top:${top}px;height:${h}px;left:calc(${k} * 100% / ${n});width:calc(100% / ${n} - 3px)" data-act="lesson" data-v="${l.id}" title="${esc(`${l.start}–${l.end} ${who(c)} ${c.subject}${l.kind?'·'+l.kind:''}${l.topic?'\n本节：'+l.topic:''}`)}">
      <span class="t">${l.start}${l.makeup?'<b class="mk">补</b>':''}${fbMark(l)}</span><span class="w">${esc(who(c))}</span>${h > 40 ? `<span class="s">${esc(c.subject)}${l.kind?'·'+esc(l.kind):''}</span>` : ''}</button>`; };
  const whoList = S.calType==='s' ? DB.students : S.calType==='t' ? DB.teachers : [];
  const hours = ls.filter(l => l.status!=='leave').reduce((a, l) => a + dur(l), 0);
  const range = `${+days[0].slice(5,7)}月${+days[0].slice(8)}日–${days[6].slice(5,7)===days[0].slice(5,7) ? '' : +days[6].slice(5,7)+'月'}${+days[6].slice(8)}日`;
  const title = S.calType==='s' && S.calId ? stu(S.calId).name : S.calType==='t' && S.calId ? tea(S.calId).name : '全部课程';
  return `<div class="ph"><h2>课表与排课</h2>${isAdmin()?`<button class="btn pri" data-act="add-lesson" ${DB.courses.length?'':'disabled title="先在学生档案里添加课程"'}>＋ 排课</button>`:'<span class="tag mute">只读</span>'}</div>${scopeNote()}
  <div class="cal-bar">
    <button class="btn sm" data-act="wk-go" data-v="-7" aria-label="上一周">‹</button><span class="mon">${range}</span><button class="btn sm" data-act="wk-go" data-v="7" aria-label="下一周">›</button>
    <button class="btn sm" data-act="wk-go" data-v="0">本周</button>
    ${calViewSeg()}
    <div class="seg">${[['all','全部'],['s','按学生'],['t','按老师']].map(([k,t])=>`<button class="${S.calType===k?'on':''}" data-act="caltype" data-v="${k}">${t}</button>`).join('')}</div>
    ${whoList.length ? `<select id="cal-who" data-change="calwho"><option value="">选择${S.calType==='s'?'学生':'老师'}…</option>${whoList.map(x=>`<option value="${x.id}" ${S.calId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:''}
  </div>
  <div class="row"><h3 style="font-size:16px">${esc(range)}｜${esc(title)}</h3><span class="muted xs">共 ${ls.length} 节 · ${+hours.toFixed(1)} 小时 · 北京时间 · ${slotLegend()}${isAdmin()?' · <b>点空白处直接排课</b>':''}</span></div>
  <div class="wk-wrap"><div class="wk-grid">
    <div class="wk-hd wk-corner"></div>${days.map((d, i) => `<div class="wk-hd ${d===TODAY?'today':''} ${i>=5?'we':''}">周${WD[pd(d).getDay()]}<b>${+d.slice(8)}</b></div>`).join('')}
    <div class="wk-times" style="height:${colH}px">${Array.from({length: h1 - h0}, (_, i) => `<span style="top:${i * WK_HH}px">${h0 + i}:00</span>`).join('')}</div>
    ${days.map(d => `<div class="wk-col ${d===TODAY?'today':''}" style="height:${colH}px" ${isAdmin()?`data-act="wk-slot" data-v="${d}"`:''}>${place(ls.filter(l => l.date===d)).map(block).join('')}</div>`).join('')}
  </div></div>`;
}
// 「月 / 周」切换（月视图、周视图共用）
const calViewSeg = () => `<div class="seg" role="group" aria-label="看法">${[['month','月'],['week','周']].map(([k,t])=>`<button class="${(S.calView||'month')===k?'on':''}" data-act="cal-view" data-v="${k}">${t}</button>`).join('')}</div>`;

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v;
  if (k === 'cal-view') {
    S.calView = v;
    if (v === 'week') S.week = wkMon(S.month === TODAY.slice(0, 7) ? TODAY : `${S.month}-01`);
    else if (S.week) S.month = S.week.slice(0, 7);
    render();
  }
  if (k === 'wk-go') { S.week = v === '0' ? wkMon(TODAY) : addDay(S.week || wkMon(TODAY), Number(v)); S.month = S.week.slice(0, 7); render(); }
  if (k === 'wk-slot') {   // 点空白处：按点到的位置算钟点（半小时一格），默认排 2 小时
    const h0 = +(a.parentElement.querySelector('.wk-times span')?.textContent.split(':')[0] || 9);
    let m = h0 * 60 + Math.floor((e.clientY - a.getBoundingClientRect().top) / WK_HH * 2) * 30;
    m = Math.max(0, Math.min(m, 22 * 60));
    S.alPre = {d: v, s: wkHM(m), e: wkHM(Math.min(m + 120, 23 * 60 + 30))};
    addLessonModal();
  }
});
