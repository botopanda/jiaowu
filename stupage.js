/* ══════════════════════════════════════════════════════════════
   学生页（2026-10-29）：学生档案从弹窗改成整页
   · 上面：名字、方向、目标、常用按钮（看课表 / 写本月家长反馈 / 更多）
   · 横排页签：总览 · 按时间看 · 计划与月度反馈 · 成绩 · 升学 · 资料 · 家长视角
   · 「总览」一页看到这个学生现在的情况：要处理的事、接下来的课、这个月、课程、最近反馈、成绩、升学
   · 旧的页签名字（概况与课程、月计划、月度回访、档案资料、家长看到的档案……）都会自动对到新的页签
   ══════════════════════════════════════════════════════════════ */
const SP_TABS = [['home', '总览'], ['tl', '按时间看'], ['month', '计划与月度反馈'], ['score', '成绩'], ['target', '升学'], ['data', '资料'], ['parent', '家长视角']];
const SP_OLD = {info: 'home', fb: 'tl', fu: 'tl', note: 'tl', mp: 'month', review: 'month', profile: 'data', pfview: 'parent', board: 'parent'};

function studentModal(id, tab){
  if (tab === 'board') S.parView = 'board'; if (tab === 'pfview') S.parView = 'pf';
  const t = SP_OLD[tab] || tab || 'home', moved = S.page !== 'student' || S.stuId !== id || S.stuTab !== t;
  closeModal();
  S.page = 'student'; S.stuId = id; S.stuTab = t;
  render();
  if (moved) window.scrollTo(0, 0);
}

function pgStudent(){
  const s = DB.students.find(x => x.id === S.stuId);
  if (!s){ S.page = 'students'; return pgStudents(); }
  const id = s.id, ym = TODAY.slice(0, 7), tab = S.stuTab || 'home';
  const ps = personOf('student', 'student_id', id), pp = personOf('parent', 'student_id', id);
  const sub = [s.code, s.direction || s.track, s.grad ? '大学院' : '', s.target_ym ? `目标 ${s.target_ym}` : '', s.loc, s.staff ? `负责教务 ${s.staff}` : ''].filter(Boolean);
  const more = [isTop() ? `<button class="btn sm" data-act="student-form" data-v="${id}">编辑基本资料</button>` : '',
    typeof mrBtn === 'function' ? mrBtn(id) : '', typeof wkBtn === 'function' ? wkBtn(id) : '',
    ps ? `<button class="btn sm" data-act="copy-link" data-v="${ps.key}">复制学生链接</button>` : '', pp ? `<button class="btn sm" data-act="copy-link" data-v="${pp.key}">复制家长链接</button>` : ''].filter(Boolean).join('');
  const head = `<div class="sp-head"><button class="sp-back" data-act="page" data-v="students">‹ 学生档案</button>
    <div class="sp-title"><h2>${esc(s.name)}</h2>${isMine(s) && ownerUI() ? '<span class="tag gold">Panda</span>' : ''}${s.active === false ? '<span class="tag mute">停课</span>' : ''}<span class="muted small">${sub.map(esc).join(' · ')}</span></div>
    <div class="sp-acts"><button class="btn sm" data-act="stu-cal" data-v="${id}">看课表</button>
      ${isAdmin() ? `<button class="btn pri sm" data-act="rv-open" data-v="${id}|${ym}">写${+ym.slice(5)}月家长反馈</button>` : ''}
      ${more ? `<details class="sp-more"><summary class="btn sm">更多 ▾</summary><div class="sp-pop">${more}</div></details>` : ''}</div></div>`;
  const tabs = `<nav class="sp-tabs" aria-label="学生页">${SP_TABS.map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-act="stu-tab" data-v="${id}|${k}">${t}</button>`).join('')}</nav>`;
  let body;
  if (tab === 'home') body = spHome(s);
  else if (tab === 'month') body = `<h3 class="sp-h">月计划</h3>${stuTabBody(id, 'mp')}<h3 class="sp-h">月度家长反馈</h3>${stuTabBody(id, 'review')}`;
  else if (tab === 'data') body = spData(s);
  else if (tab === 'parent') { const v = S.parView || 'pf';
    body = `<div class="seg" role="group" aria-label="家长视角"><button class="${v === 'pf' ? 'on' : ''}" data-act="sp-par" data-v="pf">家长看到的档案</button><button class="${v === 'board' ? 'on' : ''}" data-act="sp-par" data-v="board">跟进看板</button></div>
      ${stuTabBody(id, v === 'pf' ? 'pfview' : 'board')}`; }
  else body = stuTabBody(id, tab);
  return `${head}${tabs}<div class="sp-body">${body}</div>`;
}

/* ───────── 总览 ───────── */
function spHome(s){
  const id = s.id, ym = TODAY.slice(0, 7), nx = ymShift(ym, 1), cs = DB.courses.filter(c => c.student_id === id), st = monthStats(id, ym);
  const card = (title, inner, link = '') => `<section class="card sp-card"><div class="row"><h3 class="sh-h" style="margin-right:auto">${title}</h3>${link}</div>${inner}</section>`;
  const go = (tab, t = '看全部 ›') => `<button class="btn sm" data-act="stu-tab" data-v="${id}|${tab}">${t}</button>`;
  // 要处理的事
  const todo = [], my = l => course(l.course_id)?.student_id === id;
  const rq = DB.requests.filter(q => q.status === 'pending' && L(q.lesson_id) && my(L(q.lesson_id))).length;
  if (rq) todo.push(['warn', `有 ${rq} 个改期 / 请假申请等处理`, 'data-act="page" data-v="requests"']);
  const fp = DB.feedbacks.filter(f => f.status === 'pending' && cOfF(f)?.student_id === id).length;
  if (fp) todo.push(['warn', `有 ${fp} 条老师反馈等审批`, 'data-act="page" data-v="feedback"']);
  const pe = lsOfS(id).filter(isPend).length;
  if (pe) todo.push(['warn', `${pe} 节课上完了，老师还没写反馈`, `data-act="stu-tab" data-v="${id}|tl"`]);
  const un = latestHw(id).filter(f => !f.hw_sub && (f.hw || '').trim()).length;
  if (un) todo.push(['seal', `${un} 份作业还没交`, `data-act="stu-tab" data-v="${id}|tl"`]);
  const mu = (typeof MSGS !== 'undefined' ? MSGS : []).filter(m => m.student_id === id && !m.read_at).length;
  if (mu) todo.push(['seal', `${mu} 条学生 / 家长留言没读`, 'data-act="page" data-v="msgs"']);
  fusOf(id).filter(f => f.next_date && f.confirm !== '已确认' && f.next_date <= addDay(TODAY, 7)).forEach(f =>
    todo.push([f.next_date < TODAY ? 'seal' : 'warn', `跟进：${tlClip(f.next_action || f.task || f.type, 24)}（${fmtYMD(f.next_date)}）`, `data-act="fu-edit" data-v="${f.id}"`]));
  const rv = reviewOf(id, ym), day = +TODAY.slice(8);
  if (isAdmin() && day >= 20 && rv?.status !== '已完成') todo.push(['warn', `${+ym.slice(5)} 月给家长的反馈还没完成`, `data-act="rv-open" data-v="${id}|${ym}"`]);
  const active = cs.filter(c => c.active), nPlan = active.filter(c => planText(c.id, nx)).length;
  if (day >= 20 && active.length && nPlan < active.length) todo.push(['warn', `${+nx.slice(5)} 月计划还有 ${active.length - nPlan} 门课没写`, `data-act="stu-tab" data-v="${id}|month"`]);
  const todoBox = todo.length ? `<div class="sp-todo">${todo.map(([c, t, a]) => `<button class="sp-ti ${c}" ${a}><span>${esc(t)}</span><b>›</b></button>`).join('')}</div>`
    : '<div class="sh-empty">没有要处理的事 👍</div>';
  // 接下来的课
  const up = lsOfS(id).filter(l => l.status === 'scheduled' && l.date >= TODAY).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 4);
  const upBox = up.length ? `<div class="list">${up.map(l => { const c = course(l.course_id), t = tea(c.teacher_id);
    return `<div class="li small sp-les"><span class="sp-d">${dayWord(l.date)}</span><span class="num">${l.start}–${l.end}</span><span class="grow">${subjTag(c.subject)}${l.kind ? `<span class="muted"> · ${esc(l.kind)}</span>` : ''}${l.topic ? `<br><span class="muted xs">本节：${esc(l.topic)}</span>` : ''}</span><span class="muted xs">${esc(t.name)}</span></div>`; }).join('')}</div>`
    : '<div class="sh-empty">还没有排接下来的课</div>';
  // 这个月
  const pn = active.filter(c => planText(c.id, ym)).length;
  const monthBox = `<div class="sp-stats"><div><b class="num">${st.actual}</b><small>已上课</small></div><div><b class="num">${st.leave}</b><small>请假</small></div><div><b class="num">${st.fbN ? st.hwOk + '%' : '—'}</b><small>作业交了</small></div></div>
    <div class="list small"><div class="li"><span class="grow">月计划</span><span class="tag ${active.length && pn === active.length ? 'ok' : 'warn'}">${pn}/${active.length} 门写了</span>${go('month', '去写 ›')}</div>
    <div class="li"><span class="grow">给家长的月度反馈</span><span class="tag ${rv?.status === '已完成' ? 'ok' : rv ? 'warn' : 'mute'}">${esc(rv?.status || '还没写')}</span>${isAdmin() ? `<button class="btn sm" data-act="rv-open" data-v="${id}|${ym}">${rv ? '修改' : '写'} ›</button>` : ''}</div></div>`;
  // 课程
  const courseBox = `<div class="list">${cs.map(c => `<div class="li small"><span class="grow">${esc(tea(c.teacher_id).name)} ${subjTag(c.subject)}${c.active ? '' : ' <span class="tag mute">已停</span>'}</span>${isTop() ? `<span class="num">${rateTxt(c)}</span>` : ''}${isAdmin() ? `<button class="btn sm" data-act="course-edit" data-v="${c.id}">改</button>` : ''}</div>`).join('') || '<div class="muted small">还没有课程</div>'}</div>
    ${isAdmin() ? `<details ${cs.length ? '' : 'open'}><summary class="small" style="cursor:pointer;color:var(--gold-text)">＋ 添加课程</summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      ${DB.teachers.length ? `<div class="fields"><label class="field"><span>老师</span><select id="cf-t">${DB.teachers.filter(t => t.active).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      ${subjField('cf-subj', '')}${isTop() ? `<label class="field"><span>老师单价（每小时）</span><div class="row" style="flex-wrap:nowrap"><input type="number" id="cf-rate" step="10" min="0" value="0" style="flex:1;min-width:0">${curSel('cf-cur', 'CNY')}</div></label>` : ''}</div>${isTop() ? '' : '<div class="muted xs">课时单价由教务·管理设置。</div>'}
      <div class="row"><button class="btn pri sm" data-act="add-course" data-v="${id}">添加课程</button></div>` : '<div class="muted small">先到「老师档案」里添加老师。</div>'}</div></details>` : ''}`;
  // 最近反馈
  const fs = fbOfS(id).slice(-2).reverse();
  const fbBox = fs.length ? `<div class="list">${fs.map(f => { const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="li small sp-fb"><div class="grow"><div><span class="muted">${fmtYMD(l.date)}</span> ${subjTag(c.subject)}${f.status === 'pending' ? ' <span class="tag warn">待审批</span>' : ''}</div>
      <div>${esc(tlClip(f.content, 70))}</div>${(f.hw || '').trim() ? `<div class="muted xs">作业：${esc(tlClip(f.hw, 40))} · ${f.hw_fb ? '已批改' : f.hw_sub ? '已交' : '未交'}</div>` : ''}</div></div>`; }).join('')}</div>`
    : '<div class="sh-empty">还没有反馈</div>';
  // 成绩
  const byM = {}; scoresOf(id).forEach(x => (byM[x.metric || '成绩'] = byM[x.metric || '成绩'] || []).push(x));
  const scBox = Object.keys(byM).length ? `<div class="list small">${Object.entries(byM).slice(0, 4).map(([m, xs]) => { const a = xs[0], b = xs[xs.length - 1], d = +b.score - +a.score;
    return `<div class="li"><span class="grow">${esc(m)}</span><span class="num">${xs.length > 1 ? `${esc(a.score)} → ` : ''}<b>${esc(b.score)}</b>${b.full_score ? ' / ' + esc(b.full_score) : ''}</span>${xs.length > 1 && d ? `<span class="tag ${d > 0 ? 'ok' : 'seal'}">${d > 0 ? '+' : ''}${+d.toFixed(1)}</span>` : ''}</div>`; }).join('')}</div>`
    : '<div class="sh-empty">还没有成绩记录</div>';
  // 升学
  const tg = (DB.targets || []).filter(t => t.student_id === id), nev = tg.map(t => ({t, e: nextEventOf(t)})).filter(x => x.e).sort((a, b) => a.e.date.localeCompare(b.e.date))[0];
  const tgBox = tg.length ? `<div class="small">${['冲刺', '目标', '保底'].map(k => { const n = tg.filter(t => t.tier === k).length; return n ? `<span class="tag ${TIER_CLS[k]}">${k} ${n}</span>` : ''; }).join(' ')}</div>
    ${nev ? `<div class="small" style="margin-top:6px">下一个日期：<b>${esc(nev.t.school)}</b> ${esc(nev.e.label)} <span class="num">${fmtYMD(nev.e.date)}</span> <span class="tag ${nev.e.days <= 14 ? 'seal' : 'mute'}">${nev.e.days} 天后</span></div>` : '<div class="muted small" style="margin-top:6px">接下来没有出愿日程</div>'}`
    : '<div class="sh-empty">还没有加大学目标</div>';
  return `<div class="sp-grid"><div class="sp-col">${card('要处理的事', todoBox)}${card('接下来的课', upBox, `<button class="btn sm" data-act="stu-cal" data-v="${id}">看课表 ›</button>`)}${card('最近的老师反馈', fbBox, go('tl'))}</div>
    <div class="sp-col">${card(`${+ym.slice(5)} 月`, monthBox)}${card('课程', courseBox)}${card('成绩', scBox, go('score'))}${card('升学', tgBox, go('target'))}</div></div>`;
}

/* ───────── 资料 ───────── */
function spData(s){
  const id = s.id;
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">基本资料</h3>${isTop() ? `<button class="btn sm" data-act="student-form" data-v="${id}">编辑</button>` : ''}</div>
    <dl class="kv">${s.code ? `<dt>编号</dt><dd class="num">${esc(s.code)}</dd>` : ''}<dt>方向</dt><dd>${esc(s.track || '—')}（${s.grad ? '大学院' : '学部'}）</dd><dt>所在地</dt><dd>${esc(s.loc || '—')}</dd><dt>负责教务</dt><dd>${esc(s.staff || '—')}</dd>${s.memo ? `<dt>教务备注</dt><dd>${esc(s.memo)}</dd>` : ''}</dl></section>
    <h3 class="sp-h">档案资料 <span class="muted xs">学生和家长在「档案」里能看到</span></h3>${stuTabBody(id, 'profile')}
    ${isTop() ? `<div class="row" id="stu-del-row" style="margin-top:10px"><button class="btn danger sm" data-act="stu-del-ask" data-v="${id}">删除这位学生</button></div>` : ''}`;
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act="sp-par"]'); if (a){ S.parView = a.dataset.v; render(); return; }
  // 「更多」菜单：点了里面的按钮或点到外面就收起来
  document.querySelectorAll('.sp-more[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.sp-pop .btn')) d.open = false; });
});
