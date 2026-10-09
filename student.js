/* ══════════════════════════════════════════════════════════════
   学生端（2026-10 改版）
   底部菜单：首页 / 课表 / 作业 / 上课记录 / 我的
   · 首页：下一节课、待办、出愿倒计时、本月学习计划
   · 上课记录、作业：平时收起，点开看全文
   · 我的：目标大学与出愿日程、成绩变化、月度自评、个人档案
   ══════════════════════════════════════════════════════════════ */
const nowJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16);
const dayWord = d => { const n = dBetween(TODAY, d); return n === 0 ? '今天' : n === 1 ? '明天' : n === 2 ? '后天' : fmtMD(d); };
const sUnHw = s => latestHw(s.id).filter(f => !f.hw_sub);
const sUnConfirm = s => fbOfS(s.id).filter(f => !f.confirm);
const sSelfDue = s => !reviewOf(s.id, TODAY.slice(0,7))?.self_eval && +TODAY.slice(8,10) >= 20;   // 每月 20 号以后提醒写自评
function sTabs(s){
  return [['a','首页'],['b','课表'],['c','作业',sUnHw(s).length],['d','上课记录',sUnConfirm(s).length],['e','我的',sSelfDue(s)?1:0]];
}
function sView(s){ return ({a:sHome2, b:sSched, c:sHomework2, d:sFeedback2, e:sMine}[S.tab] || sHome2)(s); }

/* ───────── 首页 ───────── */
function sHome2(s){
  const h = +nowJST().slice(0,2), greet = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  return `<div class="sh-hi"><h2>${greet}</h2><span class="muted small">${fmtMD(TODAY)}</span></div>
  <div class="grid2 sh-grid"><div class="sh-col">${sNextCard(s)}${sTodo(s)}</div><div class="sh-col">${sCountdown(s)}
    <section class="card"><h3 class="sh-h">${+TODAY.slice(5,7)} 月学习计划</h3>${mpView(s.id, TODAY.slice(0,7))}</section></div></div>`;
}
function sNextCard(s){
  const now = nowJST();
  const up = lsOfS(s.id).filter(l => l.status === 'scheduled' && (l.date > TODAY || (l.date === TODAY && l.end > now)));
  if (!up.length) return `<section class="card nx-card empty-nx"><div class="muted">近期没有排课</div></section>`;
  const l = up[0], c = course(l.course_id), q = reqOf(l), t = timeFor(l, s.tz);
  let cd;
  if (l.date === TODAY) { const m = mins(l.start) - mins(now); cd = m <= 0 ? '正在上课' : m < 60 ? `${m} 分钟后开始` : `${Math.floor(m/60)} 小时 ${m%60} 分后开始`; }
  else { const n = dBetween(TODAY, l.date); cd = `还有 ${n} 天`; }
  const later = up.slice(1, 3);
  return `<section class="card nx-card" style="--hc:${hue(c.subject)}">
    <div class="nx-top"><span class="nx-label">下一节课</span><span class="tag ${l.date===TODAY?'seal':'blue'}">${cd}</span></div>
    <div class="nx-when"><b>${dayWord(l.date)}</b> <span class="num">${t}</span></div>
    <div class="nx-what">${subjTag(c.subject)} <span>${esc(tea(c.teacher_id).name)} 老师</span>${l.makeup?' <span class="tag blue">补课</span>':''}${l.moved?' <span class="tag warn">调过课</span>':''}</div>
    ${q ? reqLine(q) : ''}
    ${!(q && q.status==='pending') ? `<div class="row"><button class="btn sm" data-act="req-open" data-v="${l.id}">申请改期 / 请假</button><span class="muted xs">${s.tz==='CN'?'北京时间':'日本时间'}</span></div>` : ''}
    ${later.length ? `<div class="nx-later">${later.map(x => { const cc = course(x.course_id); return `<div class="row xs"><span class="muted">之后</span><b>${dayWord(x.date)}</b><span class="num">${timeFor(x, s.tz)}</span>${subjTag(cc.subject)}<span class="muted">${esc(tea(cc.teacher_id).name)}</span></div>`; }).join('')}</div>` : ''}
  </section>`;
}
function sTodo(s){
  const items = [];
  const hw = sUnHw(s).length, nc = sUnConfirm(s).length;
  if (hw) items.push(['c', `${hw} 份作业还没交`, '去交作业', 'warn']);
  if (nc) items.push(['d', `${nc} 节课还没确认`, '去确认', 'blue']);
  if (sSelfDue(s)) items.push(['e', `写 ${+TODAY.slice(5,7)} 月的自我评价`, '去写', 'gold']);
  if (!items.length) return `<section class="card todo-ok"><b>都完成了</b><span class="muted small">作业交了，课也都确认了 👍</span></section>`;
  return `<section class="card"><h3 class="sh-h">要做的事</h3><div class="todo">${items.map(([t, txt, btn, cls]) =>
    `<button class="todo-i" data-act="tab" data-v="${t}"><span class="todo-dot ${cls}"></span><span class="grow">${txt}</span><span class="todo-go">${btn} ›</span></button>`).join('')}</div></section>`;
}
function sCountdown(s){
  const ev = targetsOf(s.id).map(t => ({t, nx: nextEventOf(t)})).filter(x => x.nx).sort((a, b) => a.nx.days - b.nx.days).slice(0, 3);
  if (!ev.length) return '';
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">出愿倒计时</h3><button class="btn sm" data-act="tab" data-v="e">全部目标 ›</button></div>
    <div class="cd-list">${ev.map(({t, nx}) => `<div class="cd-i"><div class="cd-n ${nx.days <= 14 ? 'hot' : ''}"><b>${nx.days}</b><small>天</small></div>
      <div class="grow"><b>${esc(t.school)}</b><div class="muted xs">${nx.label} · ${fmtMD(nx.date)}</div></div></div>`).join('')}</div></section>`;
}

/* ───────── 课表 ───────── */
const sSched = s => `<div class="muted xs">点某一天看当天的课；有事可以在课下面申请改期或请假。</div>${schedule(lsOfS(s.id), s.tz, c => tea(c.teacher_id).name, true)}`;

/* ───────── 作业：平时收起，点「我完成了」再填 ───────── */
function sHomework2(s){
  const cur = latestHw(s.id), todo = cur.filter(f => !f.hw_sub), done = cur.filter(f => f.hw_sub);
  const older = fbOfS(s.id).filter(f => !cur.includes(f)).slice(-8).reverse();
  const item = (f, now) => { const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="les hw-i" style="--hc:${hue(c.subject)}"><div style="min-width:0;flex:1">
      <div class="row xs">${subjTag(c.subject)}<span class="muted">${esc(tea(c.teacher_id).name)} · ${sMD(l.date)} 布置</span><span style="margin-left:auto" class="tag ${f.hw_fb?'ok':f.hw_sub?'blue':'warn'}">${f.hw_fb?'已批改':f.hw_sub?'已交':'未交'}</span></div>
      <div class="hw-t">${esc(f.hw)}</div>
      ${now && !f.hw_sub ? `<div class="row"><button class="btn pri sm" data-act="hw-open" data-v="${f.id}">我完成了</button></div>
        <div id="hwp-${f.id}" class="hw-panel" hidden><textarea id="hw-${f.id}" placeholder="写一句完成情况（可以不写）"></textarea>
        <div class="row"><button class="btn pri sm" data-act="hw-done" data-v="${f.id}">提交</button>${uploadBtn('hw', f.id, '上传作业照片 / PDF')}</div></div>` : ''}
      ${now && f.hw_sub && !f.hw_fb ? `<div class="row">${uploadBtn('hw', f.id, '再传几张')}</div>` : ''}
      ${fileList(f.id,'hw','我交的作业')}${fileList(f.id,'grade','老师的批改')}
      ${f.hw_note?`<div class="muted xs">我说：${esc(f.hw_note)}</div>`:''}${f.hw_fb?`<div class="note"><b>老师批改：</b>${esc(f.hw_fb)}</div>`:''}</div></div>`; };
  return `${todo.length ? `<div class="dg">还没交 · ${todo.length} 份</div>${todo.map(f => item(f, true)).join('')}` : '<div class="card todo-ok"><b>作业都交了</b><span class="muted small">新作业会出现在这里</span></div>'}
  ${done.length ? `<div class="dg">这次的作业 · 已交</div>${done.map(f => item(f, true)).join('')}` : ''}
  ${older.length ? `<details class="sh-more"><summary>以前的作业（${older.length}）</summary>${older.map(f => item(f, false)).join('')}</details>` : ''}`;
}

/* ───────── 上课记录：一行一节，点开看全文；没确认的放最上面 ───────── */
function sFbBody(f){
  return `${tagRow(f)}<div class="sec"><b>本节授课内容</b><p>${esc(f.content)}</p></div><div class="sec"><b>课堂表现</b><p>${esc(f.perf)}</p></div><div class="sec"><b>课后作业</b><p>${esc(f.hw)}</p></div>${fileList(f.id,'note','老师的上课笔记')}`;
}
function sFbRow(f){
  const l = L(f.lesson_id), c = course(l.course_id), snip = String(f.content || '').slice(0, 26) + (String(f.content || '').length > 26 ? '…' : '');
  return `<details class="card fbx" style="--hc:${hue(c.subject)}"><summary><div class="fbx-h"><span class="num fbx-d">${sMD(l.date)}</span>${subjTag(c.subject)}<span class="muted xs">${esc(tea(c.teacher_id).name)}</span>
    <span style="margin-left:auto">${f.confirm ? confirmTag(f) : '<span class="tag warn">待确认</span>'}</span></div><div class="fbx-s muted small">${esc(snip)}</div></summary>
    <div class="fb">${sFbBody(f)}</div></details>`;
}
function sFeedback2(s){
  const all = fbOfS(s.id).slice().reverse(), pend = all.filter(f => !f.confirm), rest = all.filter(f => f.confirm);
  if (!all.length) return '<div class="empty">还没有上课记录</div>';
  let out = '';
  if (pend.length) out += `<div class="dg">待确认 · ${pend.length} 节</div><div class="muted xs" style="margin-top:-4px">上完课点一下，告诉老师这节课上得怎么样。</div>` + pend.map(f => {
    const l = L(f.lesson_id), c = course(l.course_id);
    return `<section class="card fbp" style="--hc:${hue(c.subject)}"><div class="fbx-h"><span class="num fbx-d">${sMD(l.date)}</span>${subjTag(c.subject)}<span class="muted xs">${esc(tea(c.teacher_id).name)}</span></div>
      <details><summary class="muted small">看老师写的反馈</summary><div class="fb">${sFbBody(f)}</div></details>
      <div class="row"><span class="muted xs">这节课：</span><button class="btn pri sm" data-act="confirm" data-v="${f.id}|满意">满意</button><button class="btn sm" data-act="confirm" data-v="${f.id}|不满意">不满意</button></div></section>`; }).join('');
  let last = '';
  rest.slice(0, 60).forEach(f => { const m = L(f.lesson_id).date.slice(0,7); if (m !== last) { out += `<div class="dg">${ymLabel(m)}</div>`; last = m; } out += sFbRow(f); });
  return out;
}

/* ───────── 我的 ───────── */
function sMine(s){
  const ym = TODAY.slice(0,7), r = reviewOf(s.id, ym) || {};
  const past = reviewsOf(s.id).filter(x => x.ym !== ym && (x.content || x.self_eval || x.teacher_eval || x.next_focus)).slice().reverse();
  const jump = [['m-target','目标大学'],['m-score','成绩'],['m-month','月度自评'],['m-profile','个人档案']];
  return `<h2 style="font-size:19px">我的</h2>
  <div class="chips">${jump.map(([id, t]) => `<button class="chip" data-act="jump" data-v="${id}">${t}</button>`).join('')}</div>
  <h3 class="sh-sec" id="m-target">目标大学与出愿日程</h3>
  ${s.target_ym || s.direction ? `<div class="card small">${s.direction?`<span class="tag gold">${esc(s.direction)}</span> `:''}${s.target_ym?`目标入学 <b>${tgtLabel(s.target_ym)}</b>`:''}</div>` : ''}
  ${targetsView(s.id, false)}
  <h3 class="sh-sec" id="m-score">成绩变化</h3><div class="card">${scoreTrend(s.id)}</div>
  <h3 class="sh-sec" id="m-month">月度自评</h3>
  <section class="card self-card"><b>${ymLabel(ym)} · 我的自我评价</b>
    <div class="muted xs">这个月学得怎么样？哪里进步了、哪里还觉得吃力、下个月想加强什么。老师和教务会看到。</div>
    <textarea id="self-eval" placeholder="例：词汇有进步，但有机反应链容易混淆">${esc(r.self_eval||'')}</textarea>
    <div class="row"><button class="btn pri" data-act="self-save" data-v="${ym}">${r.self_eval?'更新':'提交'}</button>${r.self_eval?'<span class="tag ok">已写</span>':''}</div></section>
  ${r.teacher_eval || r.next_focus ? reviewCard({...r, ym, student_id: s.id}) : ''}
  ${past.length ? `<details class="sh-more"><summary>以前的月度回访（${past.length}）</summary>${past.map(x => reviewCard(x)).join('')}</details>` : ''}
  <h3 class="sh-sec" id="m-profile">个人档案</h3>
  <details class="card"><summary class="muted small">点开看我的档案（家长看到的也是这一份）</summary>${profilePage(s, {hideEmpty: true})}</details>`;
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'hw-open') { const p = document.getElementById('hwp-' + a.dataset.v); if (p) { p.hidden = !p.hidden; if (!p.hidden) p.querySelector('textarea')?.focus(); } }
  if (a.dataset.act === 'jump') document.getElementById(a.dataset.v)?.scrollIntoView({behavior: 'smooth', block: 'start'});
});
