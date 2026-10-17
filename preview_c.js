/* 效果图预览（家长概况/月报/月历减色/周视图），不在加载清单里 */
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

function pgCalendar(){
  if (S.calView==='week' && typeof pgWeek==='function') return pgWeek();   // 周视图在 week.js
  const [y,m] = S.month.split('-').map(Number);
  const first = new Date(y,m-1,1), last = new Date(y,m,0).getDate(), lead = (first.getDay()+6)%7;
  let ls = DB.lessons.filter(l => l.date.startsWith(S.month));
  if (S.calType==='s' && S.calId) ls = ls.filter(l => course(l.course_id).student_id===S.calId);
  if (S.calType==='t' && S.calId) ls = ls.filter(l => course(l.course_id).teacher_id===S.calId);
  const chip = l => { const c = course(l.course_id);
    const who = S.calType==='s' ? tea(c.teacher_id).name : S.calType==='t' ? stu(c.student_id).name : `${stu(c.student_id).name}·${tea(c.teacher_id).name.replace('老师','')}`;
    return `<button class="lc ${l.status!=='scheduled'?'leave':''} ${isPend(l)?'pend':''} ${l.moved?'moved':''}" style="--hc:${slotHue(l.start)}" data-act="lesson" data-v="${l.id}" ${l.topic?`title="本节：${esc(l.topic)}"`:''}><span class="t">${l.start}</span>${l.makeup?'<b class="mk">补</b>':''}${fbMark(l)} ${esc(who)}<br>${esc(c.subject)}${l.kind?'·'+esc(l.kind):''}${l.status==='leave'?' 请假':l.status==='cancelled'?' 取消':''}</button>`; };
  let cells = ['一','二','三','四','五','六','日'].map((d,i) => `<div class="hd ${i>=5?'we':''}">${d}</div>`).join('');
  for (let i=0;i<lead;i++) cells += `<div class="day off"></div>`;
  for (let d=1; d<=last; d++){ const dd=`${S.month}-${pad(d)}`; cells += `<div class="day ${dd===TODAY?'today':''}"><span class="dn">${d}</span>${ls.filter(l=>l.date===dd).map(chip).join('')}</div>`; }
  for (let i=0;i<(7-(lead+last)%7)%7;i++) cells += `<div class="day off"></div>`;
  const byD = {}; ls.forEach(l => (byD[l.date] ??= []).push(l));
  const agenda = Object.keys(byD).sort().map(d => `<div class="dg ${d===TODAY?'today':''}">${fmtMD(d)}</div>` + byD[d].map(chip).join('')).join('') || '<div class="empty">这个月没有课</div>';
  const who = S.calType==='s' ? DB.students : S.calType==='t' ? DB.teachers : [];
  const title = S.calType==='s' && S.calId ? `${y}年${m}月｜${stu(S.calId).name}` : S.calType==='t' && S.calId ? `${y}年${m}月｜${tea(S.calId).name}` : `${y}年${m}月｜全部课程`;
  const hours = ls.filter(l=>l.status!=='leave').reduce((a,l)=>a+dur(l),0);
  return `<div class="ph"><h2>课表与排课</h2>${isAdmin()?`<button class="btn pri" data-act="add-lesson" ${DB.courses.length?'':'disabled title="先在学生档案里添加课程"'}>＋ 排课</button>`:'<span class="tag mute">只读</span>'}</div>${scopeNote()}
  <div class="cal-bar">
    <button class="btn sm" data-act="month" data-v="-1" aria-label="上个月">‹</button><span class="mon">${S.month.replace('-','.')}</span><button class="btn sm" data-act="month" data-v="1" aria-label="下个月">›</button>
    <button class="btn sm" data-act="month" data-v="0">本月</button>
    ${typeof calViewSeg==='function' ? calViewSeg() : ''}
    <div class="seg">${[['all','全部'],['s','按学生'],['t','按老师']].map(([k,t])=>`<button class="${S.calType===k?'on':''}" data-act="caltype" data-v="${k}">${t}</button>`).join('')}</div>
    ${who.length ? `<select id="cal-who" data-change="calwho"><option value="">选择${S.calType==='s'?'学生':'老师'}…</option>${who.map(x=>`<option value="${x.id}" ${S.calId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:''}
  </div>
  <div class="row"><h3 style="font-size:16px">${esc(title)}</h3><span class="muted xs">共 ${ls.length} 节 · ${hours} 小时 · 北京时间 · 划线＝请假 · 「调」＝调过课 · ${slotLegend()}</span>${S.calType==='s' && S.calId ? `<span style="margin-left:auto">${sxBtn(S.calId)}</span>` : ''}</div>
  <div class="cal">${cells}</div><div class="agenda">${agenda}</div>`;
}


function pOverview(s){
  const ym = TODAY.slice(0,7), m = +ym.slice(5), st = monthStats(s.id, ym);
  const leaves = lsOfS(s.id).filter(l=>l.date.startsWith(ym) && l.status==='leave' && l.date<TODAY);
  return `<div class="sh-hi"><h2>${esc(s.name)} 的学习情况</h2><span class="muted small">${fmtMD(TODAY)}</span></div>
  <section class="card po-stats"><div class="row"><h3 class="sh-h" style="margin-right:auto">${m} 月到目前</h3>${typeof mrBtn==='function' ? mrBtn(s.id) : ''}</div>
    ${st.req ? `<div class="bst"><div><b>${st.actual}/${st.req}</b><small>出勤</small></div><div><b style="${st.leave?'color:var(--seal)':''}">${st.leave}</b><small>请假</small></div><div><b>${st.hwOk}%</b><small>作业完成</small></div></div>`
      : '<div class="sh-empty">这个月还没有上完的课。</div>'}
    ${leaves.map(l=>`<div class="small" style="margin-top:6px"><span class="tag seal">请假</span> ${fmtMD(l.date)} ${esc(course(l.course_id).subject)} · ${esc(l.note)}</div>`).join('')}</section>
  <div class="grid2 sh-grid"><div class="sh-col">${sWeek(s, 'c')}${sLastFb(s, 'b')}</div>
    <div class="sh-col">${sCkCard(s, 'f')}${sCountdown(s, 'd')}<section class="card"><h3 class="sh-h">${m} 月学习计划</h3>${mpView(s.id, ym)}</section></div></div>`;
}

function addLessonModal(){
  const isT = ME().role==='teacher';
  const my = DB.courses.filter(c => c.active && (!isT || c.teacher_id===ME().teacher_id));
  if (isT && !my.length){ toast('你还没有分配学生，请联系教务老师', true); return; }
  const studs = (isT ? DB.students.filter(s => my.some(c => c.student_id===s.id)) : DB.students.filter(s => s.active!==false)).slice().sort((x, y) => pyCmp(x.name, y.name));
  const teas = isT ? [tea(ME().teacher_id)] : DB.teachers.filter(t => t.active!==false).slice().sort((x, y) => pyCmp(x.name, y.name));
  const preS = S.calType==='s' ? S.calId : '', preT = isT ? ME().teacher_id : (S.calType==='t' ? S.calId : '');
  // 老师在月历上点了哪天，日期就默认填那天（和月历下面显示的那天一致）
  const pre = S.alPre; S.alPre = null;   // 周视图点空白处带来的 {日期, 开始, 结束}
  const ym = S.pMonth || TODAY.slice(0,7), preD = pre ? pre.d : isT && PV==='cal' ? (S.pDay && S.pDay.startsWith(ym) ? S.pDay : (TODAY.startsWith(ym) ? TODAY : `${ym}-01`)) : TODAY;
  openModal(`${mHead(isT ? '申请排课' : '排课')}
  <div class="fields">
    <label class="field"><span>学生</span><select id="al-stu" data-change="al-pick"><option value="">选择学生…</option>${studs.map(x => `<option value="${x.id}" ${x.id===preS?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="field"><span>老师</span><select id="al-tea" data-change="al-pick" ${isT?'disabled':''}>${isT?'':'<option value="">选择老师…</option>'}${teas.map(t => `<option value="${t.id}" ${t.id===preT?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
  </div>
  <div class="fields">
    <label class="field"><span>科目</span><select id="al-subj" data-change="al-pick">${alSubjOpts(preT)}</select>
      <input type="text" id="al-subj-x" placeholder="写科目名称，例：电影" data-change="al-pick" hidden style="margin-top:4px"></label>
    <div class="field"><span>课程</span><div class="row" style="flex-wrap:nowrap"><select id="al-kind" style="flex:1">${alKindOpts(preT)}</select>
      <button type="button" class="mk-btn" data-act="al-mk" aria-pressed="false" title="补课：按一下变蓝，再按一下取消">补</button><input type="hidden" id="al-mk" value="0"></div></div>
  </div>
  <div id="al-note"></div>
  <div class="fields"><label class="field"><span>第一节日期</span><input type="date" id="al-d" value="${preD}"></label><label class="field"><span>开始（${tzName(myTz())}）</span><input type="time" id="al-s" value="${pre ? pre.s : '18:00'}"></label><label class="field"><span>结束</span><input type="time" id="al-e" value="${pre ? pre.e : '20:00'}"></label></div>
  <div class="fields"><label class="field"><span>重复</span><select id="al-rep"><option value="month">每周同一时间，到这个月底</option><option value="1">只排这一节</option><option value="4">每周同一时间，共 4 周</option><option value="8">每周同一时间，共 8 周</option></select></label></div>
  <label class="field"><span>本节内容（可以不填）</span><input type="text" id="al-topic" maxlength="200" placeholder="例：第3节｜两点透视"></label>
  <div class="muted xs">和这位老师已有的课时间重叠的，会自动跳过。每周重复排的课，本节内容只写进第一节，其他几节之后点开那节课再填。</div>
  <div class="row"><button class="btn pri" data-act="save-lesson">${isT ? '提交排课申请' : '排课'}</button></div>`);
  alPick();
}

function studentModal(id, tab){
  lastModal = () => studentModal(id, tab);
  const s = stu(id), cs = DB.courses.filter(c=>c.student_id===id); tab = tab || 'info';
  const ym = TODAY.slice(0,7), nx = ymShift(ym,1), pv = ymShift(ym,-1);
  // 左侧菜单按用途分组
  const groups = [['基本',[['info','概况与课程'],['profile','档案资料'],['note','私下备注']]],
    ['学习',[['mp','月计划'],['fb','反馈'],['score','成绩']]],
    ['升学',[['target','大学与出愿'],['fu','跟进记录'],['review','月度回访']]],
    ['给家长看',[['pfview','家长看到的档案'],['board','跟进看板']]]];
  let body = '';
  if (tab==='pfview') body = `<div class="hint" style="margin:0">这就是学生和家长在自己链接「档案」里看到的页面，照 Excel 第一页的顺序。</div>${profilePage(s)}`;
  else if (tab==='board') body = boardView(id);
  else if (['profile','score','target','review','fu'].includes(tab)) body = studentTrackTab(id, tab);
  else if (tab==='info'){
    const ps = personOf('student','student_id',id), pp = personOf('parent','student_id',id);
    body = `<div class="grid2"><dl class="kv">${s.code?`<dt>编号</dt><dd class="num">${esc(s.code)}</dd>`:''}<dt>方向</dt><dd>${esc(s.track||'—')}（${s.grad?'大学院':'学部'}）</dd><dt>所在地</dt><dd>${esc(s.loc||'—')}</dd><dt>负责教务</dt><dd>${esc(s.staff||'—')}</dd>${s.memo?`<dt>教务备注</dt><dd>${esc(s.memo)}</dd>`:''}</dl>
      <div class="row" style="align-content:flex-start">${isTop()?`<button class="btn sm" data-act="student-form" data-v="${id}">编辑资料</button>`:''}<button class="btn sm" data-act="stu-cal" data-v="${id}">看课表</button>${typeof mrBtn==='function' ? mrBtn(id) : ''}
      ${ps?`<button class="btn sm" data-act="copy-link" data-v="${ps.key}">复制学生链接</button>`:''}${pp?`<button class="btn sm" data-act="copy-link" data-v="${pp.key}">复制家长链接</button>`:''}</div></div>
      <b>课程</b><div class="list">${cs.map(c=>`<div class="li small"><span class="grow">${esc(tea(c.teacher_id).name)} ${subjTag(c.subject)}${c.active?'':' <span class="tag mute">已停</span>'}</span>${isTop()?`<span class="num">${rateTxt(c)}</span>`:''}${isAdmin()?`<button class="btn sm" data-act="course-edit" data-v="${c.id}">改</button>`:''}</div>`).join('')||'<div class="muted small">还没有课程</div>'}</div>
      ${isAdmin()?`<details class="card" ${cs.length?'':'open'}><summary><b>＋ 添加课程</b> <span class="muted xs">（这位学生跟哪位老师上什么课）</span></summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${DB.teachers.length?`<div class="fields"><label class="field"><span>老师</span><select id="cf-t">${DB.teachers.filter(t=>t.active).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        ${subjField('cf-subj', '')}${isTop()?`<label class="field"><span>老师单价（每小时）</span><div class="row" style="flex-wrap:nowrap"><input type="number" id="cf-rate" step="10" min="0" value="0" style="flex:1;min-width:0">${curSel('cf-cur','CNY')}</div></label>`:''}</div>${isTop()?'':'<div class="muted xs">课时单价由教务·管理设置。</div>'}
        <div class="row"><button class="btn pri sm" data-act="add-course" data-v="${id}">添加课程</button></div>`:'<div class="muted small">先到「老师档案」里添加老师。</div>'}</div></details>`:''}
      ${isTop()?`<div class="row" id="stu-del-row" style="margin-top:6px"><button class="btn danger sm" data-act="stu-del-ask" data-v="${id}">删除这位学生</button></div>`:''}`;
  } else if (tab==='mp') {
    const editable = cs.filter(c=>c.active);
    const edit = m => `<section class="card" style="display:flex;flex-direction:column;gap:8px"><b>${ymLabel(m)}计划</b>${editable.map(c=>`<label class="field"><span>${esc(c.subject)} · ${esc(tea(c.teacher_id).name)}${DB.plans.find(p=>p.course_id===c.id&&p.ym===m)?.updated_by?` <span class="xs">（${esc(DB.plans.find(p=>p.course_id===c.id&&p.ym===m).updated_by)} 写）</span>`:''}</span><textarea id="mp-${m}-${c.id}" style="min-height:52px" placeholder="这个月这门课要完成什么">${esc(planText(c.id,m))}</textarea></label>${typeof mpTools==='function' ? mpTools(m, c.id) : ''}`).join('')||'<div class="muted small">还没有课程</div>'}
      ${editable.length?`<div class="row"><button class="btn pri sm" data-act="mp-save" data-v="${id}|${m}">保存${+m.slice(5)}月计划</button></div>`:''}</section>`;
    body = `<div class="hint" style="margin:0">每门课每月写一句，学生和家长能看到。任课老师也可以在自己的链接里写。进度快了慢了，下个月重新写就行。</div>${edit(ym)}${edit(nx)}<section class="card"><b>${ymLabel(pv)}计划</b>${mpView(id,pv)}</section>`;
  } else if (tab==='fb') body = fbOfS(id).slice().reverse().slice(0,6).map(f=>fbCard(f)).join('') || '<div class="empty">还没有反馈</div>';
  else body = `<div class="note">私下备注只有老师和教务能看到，学生和家长看不到。</div>${DB.notes.filter(n=>n.student_id===id).slice().reverse().map(n=>`<div class="card small"><div class="row"><b>${esc(n.author)}</b> <span class="muted">${sMD(n.created_at.slice(0,10))}</span><button class="btn sm" style="margin-left:auto" data-act="note-del" data-v="${n.id}">删除</button></div><p style="margin:4px 0 0;white-space:pre-wrap">${esc(n.text)}</p></div>`).join('')||'<div class="empty">暂无备注</div>'}
    <textarea id="note-new" placeholder="写一条备注"></textarea><div class="row"><button class="btn sm" data-act="note-add" data-v="${id}">添加备注</button></div>`;
  openModal(`${mHead(`${esc(s.name)} <span class="muted small" style="font-family:var(--f-body)">${esc(s.track||'')}</span>`)}
  <div class="sm-wrap"><nav class="sm-nav" aria-label="学生档案菜单">${groups.map(([g,items])=>`<div class="sm-grp">${g}</div>${items.map(([k,t])=>`<button class="nav ${tab===k?'on':''}" data-act="stu-tab" data-v="${id}|${k}">${t}</button>`).join('')}`).join('')}</nav>
  <div class="sm-body">${body}</div></div>`, 'xl');
}

function sWeek(s, tab = 'b'){
  const end = addDay(TODAY, 6);
  const ls = lsOfS(s.id).filter(l => l.status === 'scheduled' && l.date >= TODAY && l.date <= end);
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">本周课程</h3><button class="btn sm" data-act="tab" data-v="${tab}">看课表 ›</button></div>
    ${ls.length ? `<div class="wk">${ls.map(l => { const c = course(l.course_id);
      return `<div class="wk-row ${l.date === TODAY ? 'today' : ''} ${l.date === TODAY && l.end <= nowJST() ? 'past' : ''}"><span class="wk-d">${dayWord(l.date)}</span><span class="num">${timeFor(l, s.tz)}</span><span class="grow">${subjTag(c.subject)}${l.kind ? `<span class="muted xs"> · ${esc(l.kind)}</span>` : ''}${l.topic ? `<span class="wk-topic">${esc(l.topic)}</span>` : ''}</span><span class="muted small">${esc(tea(c.teacher_id).name)}</span></div>`; }).join('')}</div>`
      : `<div class="sh-empty">${sUp(s).length ? '这 7 天没有课。' : '还没有排课，老师排好后会显示在这里。'}</div>`}</section>`;
}

function sCkCard(s, tab = 'f'){
  if (typeof ckListsOf === 'undefined') return '';
  const ls = ckListsOf(s.id); if (!ls.length) return '';
  const st = ckStat({items: ls.flatMap(l => l.items)});
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">通关进度</h3><button class="btn sm" data-act="tab" data-v="${tab}">去看 ›</button></div>
    <div class="ck-bar" style="max-width:none;margin-top:6px"><i style="width:${st.pct}%"></i></div>
    <div class="small" style="margin-top:6px">已通关 <span class="ck-frac">${st.pass} / ${st.n}</span> 关${st.cur ? `<span class="muted"> · 现在：${esc(st.cur.stage)} · ${esc(st.cur.name)}</span>` : ''}</div></section>`;
}

function sLastFb(s, tab = 'd'){
  const fs = fbOfS(s.id), f = fs[fs.length - 1];
  if (!f) return `<section class="card"><h3 class="sh-h">最近的老师反馈</h3><div class="sh-empty">上完第一节课后，老师写的反馈会出现在这里。</div></section>`;
  const l = L(f.lesson_id), c = course(l.course_id), txt = String(f.content || '');
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">最近的老师反馈</h3><button class="btn sm" data-act="tab" data-v="${tab}">全部 ›</button></div>
    <div class="small"><span class="muted">${fmtMD(l.date)}</span> ${subjTag(c.subject)} <span class="muted">${esc(tea(c.teacher_id).name)}</span></div>
    <div style="margin-top:4px">${esc(txt.slice(0, 70))}${txt.length > 70 ? '…' : ''}</div>
    ${f.hw ? `<div class="small" style="margin-top:4px"><span class="muted">作业：</span>${esc(f.hw)}</div>` : ''}</section>`;
}

function sCountdown(s, tab = 'e'){
  const ev = targetsOf(s.id).map(t => ({t, nx: nextEventOf(t)})).filter(x => x.nx).sort((a, b) => a.nx.days - b.nx.days).slice(0, 3);
  if (!ev.length) return '';
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">出愿倒计时</h3><button class="btn sm" data-act="tab" data-v="${tab}">全部目标 ›</button></div>
    <div class="cd-list">${ev.map(({t, nx}) => `<div class="cd-i"><div class="cd-n ${nx.days <= 14 ? 'hot' : ''}"><b>${nx.days}</b><small>天</small></div>
      <div class="grow"><b>${esc(t.school)}</b><div class="muted xs">${nx.label} · ${fmtMD(nx.date)}</div></div></div>`).join('')}</div></section>`;
}


/* ══════════════════════════════════════════════════════════════
   学习月报（一张竖版长图，发微信给家长）
   · 这个月：上了几节、几小时、请假、作业完成
   · 每门课：老师怎么说（课堂表现）＋ 这个月的状态标签
   · 通关进度（美术生）、接下来的出愿 / 考试、下个月计划
   · 只用教务审核过的反馈（家长本来就只看得到审核过的）
   ══════════════════════════════════════════════════════════════ */
const SX_HUE = {'--h1':'#b8953a','--h2':'#6f8452','--h3':'#4f7396','--h4':'#a0645a','--h5':'#86679a','--h6':'#5f8a86','--h7':'#c4762f','--h8':'#5d6db5','--h9':'#8c8a3a'};
const sxHue = subj => SX_HUE[(hue(subj).match(/--h\d/) || ['--h1'])[0]];
// 按宽度把一段话折成几行，最多 max 行（超出的最后一行加「……」）
function sxWrap(g, txt, w, max){
  const out = []; let line = '', cut = false;
  for (const ch of String(txt || '').replace(/\s*\n\s*/g, ' ')) {
    if (g.measureText(line + ch).width > w) { out.push(line); line = ch; if (out.length === max) { cut = true; break; } } else line += ch;
  }
  if (!cut && line) out.push(line);
  if (cut) out[max - 1] = sxFit(g, out[max - 1] + '……', w);
  return out;
}
const mrBtn = sid => `<button class="btn sm" data-act="mr" data-v="${sid}">月报图片</button>`;

async function mrCanvas(sid, ym){
  const s = stu(sid), [y, m] = ym.split('-').map(Number), st = monthStats(sid, ym);
  const done = lsOfS(sid).filter(l => l.date.startsWith(ym) && l.date < TODAY && isDone(l)), hrs = +done.reduce((a, l) => a + realH(l), 0).toFixed(1);
  const fbs = fbOfS(sid).filter(f => f.status === 'approved' && L(f.lesson_id).date.startsWith(ym));
  const W = 750, P = 32, F = getComputedStyle(document.body).fontFamily || 'sans-serif', font = (px, b) => `${b ? 600 : 400} ${px}px ${F}`;
  const k = 2, cv = document.createElement('canvas'); cv.width = W * k; cv.height = 4000 * k;
  const g = cv.getContext('2d'); g.scale(k, k); g.textBaseline = 'alphabetic';
  g.fillStyle = SX_C.bg; g.fillRect(0, 0, W, 4000);
  const card = (x, yy, w, h) => { g.fillStyle = SX_C.card; sxRound(g, x, yy, w, h, 12); g.fill(); g.strokeStyle = SX_C.line; g.lineWidth = 1; sxRound(g, x + .5, yy + .5, w - 1, h - 1, 12); g.stroke(); };
  const h3 = (t, yy) => { g.fillStyle = SX_C.ink; g.font = font(17, true); g.fillText(t, P, yy); return yy + 14; };

  // 标题
  const logo = await sxLogo();
  if (logo) { g.save(); sxRound(g, W - P - 26, 34, 26, 26, 6); g.clip(); g.drawImage(logo, W - P - 26, 34, 26, 26); g.restore(); }
  g.textAlign = 'right'; g.fillStyle = SX_C.muted; g.font = font(13); g.fillText('学生教务管理系统', W - P - (logo ? 34 : 0), 52); g.textAlign = 'left';
  g.fillStyle = SX_C.ink; g.font = font(30, true); g.fillText(s.name, P, 64);
  g.fillStyle = SX_C.gold; g.font = font(17, true); g.fillText(`${y} 年 ${m} 月 · 学习月报`, P, 94);
  let yy = 122;

  // 四个数字
  const tiles = [[`${st.actual}/${st.req}`, '上课（节）'], [String(hrs), '上课时长（小时）'], [String(st.leave), '请假（次）'], [`${st.hwOk}%`, '作业完成']];
  const tw = (W - P * 2 - 30) / 4;
  tiles.forEach(([n, lb], i) => { const x = P + i * (tw + 10); card(x, yy, tw, 84);
    g.textAlign = 'center'; g.fillStyle = i === 2 && st.leave ? SX_C.seal : SX_C.ink; g.font = font(28, true); g.fillText(n, x + tw / 2, yy + 44);
    g.fillStyle = SX_C.muted; g.font = font(12.5); g.fillText(lb, x + tw / 2, yy + 68); g.textAlign = 'left'; });
  yy += 84 + 34;

  // 每门课：老师怎么说
  const byC = {}; fbs.forEach(f => (byC[L(f.lesson_id).course_id] ??= []).push(f));
  const cids = Object.keys(byC);
  yy = h3('老师怎么说', yy);
  if (!cids.length) { g.fillStyle = SX_C.muted; g.font = font(14); g.fillText('这个月还没有审核过的课后反馈。', P, yy + 18); yy += 40; }
  cids.forEach(cid => {
    const c = course(cid), fs = byC[cid], last = fs[fs.length - 1], tags = [...new Set(fs.flatMap(f => f.tags || []))].slice(0, 6);
    g.font = font(14.5); const say = sxWrap(g, last.perf || last.content, W - P * 2 - 36, 3);
    const h = 18 + 22 + 10 + say.length * 24 + (tags.length ? 38 : 6) + 12;
    card(P, yy, W - P * 2, h);
    let cy = yy + 18 + 16;
    g.fillStyle = sxHue(c.subject); sxRound(g, P + 18, cy - 12, 12, 12, 3); g.fill();
    g.fillStyle = SX_C.ink; g.font = font(16, true); g.fillText(c.subject, P + 38, cy);
    const sw = g.measureText(c.subject).width; g.fillStyle = SX_C.muted; g.font = font(13.5); g.fillText(`${tea(c.teacher_id).name} 老师 · 这个月 ${fs.length} 节`, P + 46 + sw, cy);
    cy += 32; g.fillStyle = SX_C.ink; g.font = font(14.5); say.forEach(t => { g.fillText(t, P + 18, cy); cy += 24; });
    if (tags.length) { let tx = P + 18; cy += 4; g.font = font(12.5);
      tags.forEach(t => { const w = g.measureText(t).width + 18; g.fillStyle = '#f7efd9'; sxRound(g, tx, cy - 15, w, 22, 11); g.fill(); g.fillStyle = '#8c6d1f'; g.fillText(t, tx + 9, cy); tx += w + 6; }); }
    yy += h + 12;
  });
  yy += 18;

  // 通关进度（有点检表才有）
  const cks = typeof ckListsOf === 'function' ? ckListsOf(sid) : [];
  if (cks.length) {
    const items = cks.flatMap(l => l.items), cst = ckStat({items}), newly = items.filter(i => i.level >= 3 && String(i.passed_on || '').startsWith(ym)).length;
    yy = h3('通关进度', yy); card(P, yy, W - P * 2, 86);
    g.fillStyle = SX_C.off; sxRound(g, P + 18, yy + 22, W - P * 2 - 36, 12, 6); g.fill();
    g.fillStyle = '#2a8a5e'; sxRound(g, P + 18, yy + 22, Math.max(12, (W - P * 2 - 36) * cst.pct / 100), 12, 6); g.fill();
    g.fillStyle = SX_C.ink; g.font = font(15, true); const pt = `已通关 ${cst.pass} / ${cst.n} 关`; g.fillText(pt, P + 18, yy + 62);
    const ptw = g.measureText(pt).width;
    g.fillStyle = SX_C.muted; g.font = font(13.5);
    g.fillText(sxFit(g, [newly ? `这个月新通关 ${newly} 关` : '', cst.cur ? `现在：${cst.cur.stage} · ${cst.cur.name}` : ''].filter(Boolean).join(' · '), W - P * 2 - 36 - ptw - 16), P + 18 + ptw + 16, yy + 62);
    yy += 86 + 30;
  }

  // 接下来：出愿 / 考试（60 天内）＋ 下个月计划
  const ev = targetsOf(sid).map(t => ({t, nx: nextEventOf(t)})).filter(x => x.nx && x.nx.days <= 60).sort((a, b) => a.nx.days - b.nx.days).slice(0, 3);
  const nm = ymShift(ym, 1), plans = DB.courses.filter(c => c.student_id === sid && c.active).map(c => [c, planText(c.id, nm)]).filter(x => x[1]);
  if (ev.length || plans.length) {
    yy = h3('接下来', yy);
    g.font = font(14); const planLines = plans.map(([c, t]) => [c, sxWrap(g, t, W - P * 2 - 130, 2)]);
    const h = 16 + ev.length * 30 + (ev.length && plans.length ? 10 : 0) + planLines.reduce((a, [, ls]) => a + ls.length * 22 + 8, 0) + 10;
    card(P, yy, W - P * 2, h); let cy = yy + 16 + 18;
    ev.forEach(({t, nx}) => { g.fillStyle = nx.days <= 14 ? SX_C.seal : SX_C.gold; g.font = font(15, true); g.fillText(`还有 ${nx.days} 天`, P + 18, cy);
      g.fillStyle = SX_C.ink; g.font = font(14.5); g.fillText(sxFit(g, `${t.school} · ${nx.label} ${+nx.date.slice(5,7)}/${+nx.date.slice(8)}`, W - P * 2 - 130), P + 112, cy); cy += 30; });
    if (ev.length && plans.length) cy += 10;
    planLines.forEach(([c, ls]) => { g.fillStyle = SX_C.muted; g.font = font(13.5); g.fillText(sxFit(g, `${+nm.slice(5)}月 ${c.subject}`, 88), P + 18, cy);
      g.fillStyle = SX_C.ink; g.font = font(14); ls.forEach(t => { g.fillText(t, P + 112, cy); cy += 22; }); cy += 8; });
    yy += h + 30;
  }

  // 底部
  g.fillStyle = SX_C.muted; g.font = font(12.5); g.fillText('时间都是北京时间', P, yy); g.textAlign = 'right'; g.fillText(`${TODAY} 生成`, W - P, yy); g.textAlign = 'left';
  const H = yy + 26, out = document.createElement('canvas'); out.width = W * k; out.height = H * k;
  out.getContext('2d').drawImage(cv, 0, 0, W * k, H * k, 0, 0, W * k, H * k);
  return out;
}

let MR = null;   // 弹窗里正在看的 {学生, 月份}
async function mrOpen(sid, ym){
  MR = {sid, ym}; document.body.classList.add('busy');
  try {
    const url = (await mrCanvas(sid, ym)).toDataURL('image/png'), s = stu(sid), [y, m] = ym.split('-').map(Number);
    openModal(`<div class="row" style="justify-content:space-between;align-items:center"><h3 style="font-size:17px;margin:0">学习月报</h3>
        <span class="row"><button class="btn sm" data-act="mr-m" data-v="-1" aria-label="上个月">‹</button><b class="num">${y}.${pad(m)}</b><button class="btn sm" data-act="mr-m" data-v="1" aria-label="下个月" ${ym >= TODAY.slice(0, 7) ? 'disabled' : ''}>›</button></span></div>
      <div class="muted small" style="margin-top:6px">手机上：<b>长按图片</b>保存或直接发给家长。电脑上：点「下载图片」。只用了教务审核过的反馈。</div>
      <img src="${url}" alt="${esc(s.name)} ${y}年${m}月学习月报" style="display:block;width:100%;max-width:420px;height:auto;margin:10px auto;border:1px solid var(--line);border-radius:8px">
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">关闭</button><a class="btn pri" href="${url}" download="${esc(s.name)}_${y}年${m}月学习月报.png">下载图片</a></div>`, true);
  } catch(err) { toast('月报没生成出来：' + err.message, true); }
  finally { document.body.classList.remove('busy'); }
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v;
  // 每月 1–7 号默认看上个月（这个月才刚开始）
  if (k === 'mr') mrOpen(v, +TODAY.slice(8) <= 7 ? ymShift(TODAY.slice(0, 7), -1) : TODAY.slice(0, 7));
  if (k === 'mr-m' && MR) mrOpen(MR.sid, ymShift(MR.ym, Number(v)));
});

(function(){ const st=document.createElement('style'); st.id='__prevc'; st.textContent='/* ══════ 2026-10-17 周视图 / 月历减色 / 家长概况 ══════ */\n/* 月历减色：颜色只表示上午 / 下午 / 晚上；「已写反馈」改成淡灰勾，「待写」改成橙色小字，不再是实心色块 */\n.cal .mk.ok,.agenda .mk.ok,.wk-l .mk.ok{background:none;color:var(--muted);padding:0 1px;font-weight:600}\n.cal .mk.q,.agenda .mk.q,.wk-l .mk.q{background:none;color:var(--warn);padding:0 1px}\n/* 周视图 */\n.wk-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}\n.wk-grid{display:grid;grid-template-columns:44px repeat(7,minmax(96px,1fr));min-width:720px}\n.wk-hd{position:sticky;top:0;z-index:2;background:var(--surface);border-bottom:1px solid var(--line);padding:6px 4px;text-align:center;font-size:12px;color:var(--muted)}\n.wk-hd b{display:block;font-size:17px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}\n.wk-hd.we{color:var(--seal)}\n.wk-hd.today b{display:inline-block;min-width:28px;border-radius:14px;background:var(--nav);color:var(--nav-ink)}\n.wk-times{position:relative;border-right:1px solid var(--line)}\n.wk-times span{position:absolute;right:6px;transform:translateY(-50%);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}\n.wk-times span:first-child{transform:none}\n.wk-col{position:relative;border-left:1px solid var(--line-2);cursor:copy;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 45px,var(--line-2) 45px,var(--line-2) 46px)}\n.wk-col.today{background-color:color-mix(in srgb,var(--gold) 6%,transparent)}\n.wk-l{position:absolute;display:flex;flex-direction:column;align-items:flex-start;gap:0;overflow:hidden;text-align:left;cursor:pointer;\n  border:0;border-left:3px solid var(--hc);border-radius:4px;background:color-mix(in srgb,var(--hc) 16%,var(--surface));padding:2px 5px;font-size:11.5px;line-height:1.3;color:var(--ink)}\n.wk-l:hover{background:color-mix(in srgb,var(--hc) 26%,var(--surface))}\n.wk-l .t{font-size:10.5px;color:var(--muted);font-variant-numeric:tabular-nums}\n.wk-l .w{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}\n.wk-l .s{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}\n.wk-l.leave{background:color-mix(in srgb,var(--seal) 10%,var(--surface));border-left-color:var(--seal);text-decoration:line-through;text-decoration-color:var(--seal)}\n.wk-l.pend{border-left-style:dashed}\n/* 家长概况：顶上的本月数字卡片 */\n.po-stats .bst{margin-top:8px}\n\n'; document.head.appendChild(st); })();
window.__prevC = 1;