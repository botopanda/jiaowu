/* ══════════════════════════════════════════════════════════════
   学生端（2026-10 改版）
   底部菜单：首页 / 课表 / 作业 / 上课记录 / 我的
   · 首页：下一节课、本周课程、待办 ｜ 通关进度、最近反馈、出愿倒计时、本月学习计划
   · 电脑左侧菜单：上面学生名片，下面「我的老师」
   · 上课记录、作业：平时收起，点开看全文
   · 我的：目标大学与出愿日程、成绩变化、月度自评、个人档案
   · 家长打开时（PRO）：同样这些页面，只能看，不能点按钮；「我的」叫「档案」；首页有「月报图片」
   ══════════════════════════════════════════════════════════════ */
const PRO = () => ME().role === 'parent';   // 家长只读
const nowJST = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 16);   // 现在几点（北京时间）
const addDay = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const tName = id => { const n = tea(id).name || ''; return /老师$/.test(n) ? n : n + '老师'; };   // 「陈伟健」→「陈伟健老师」
const dayWord = d => { const n = dBetween(TODAY, d); return n === 0 ? '今天' : n === 1 ? '明天' : n === 2 ? '后天' : fmtMD(d); };
const sUnHw = s => latestHw(s.id).filter(f => !f.hw_sub);
const sUnConfirm = s => fbOfS(s.id).filter(f => !f.confirm);
const sSelfDue = s => !reviewOf(s.id, TODAY.slice(0,7))?.self_eval && +TODAY.slice(8,10) >= 20;   // 每月 20 号以后提醒写自评
function sTabs(s){
  if (PRO()) return [['a','首页'],['b','课表'],['c','作业'],['d','上课记录'],...(ckListsOf(s.id).length ? [['f','通关']] : []),['e','档案']];
  return [['a','首页'],['b','课表'],['c','作业',sUnHw(s).length],['d','上课记录',sUnConfirm(s).length],...(ckListsOf(s.id).length ? [['f','通关']] : []),['e','我的',sSelfDue(s)?1:0]];
}
function sView(s){ return ({a:sHome2, b:sSched, c:sHomework2, d:sFeedback2, e:sMine, f:sCheck}[S.tab] || sHome2)(s); }

/* ───────── 首页 ───────── */
function sHome2(s){
  const h = +nowJST().slice(0,2), greet = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  return `<div class="sh-hi"><h2>${PRO() ? `${esc(s.name)}同学的学习情况` : `${greet}，${esc(s.name)}同学`}</h2><span class="muted small">${fmtMD(TODAY)}</span>${PRO() && typeof mrBtn==='function' ? `<span style="margin-left:auto">${mrBtn(s.id)}</span>` : ''}</div>
  <div class="grid2 sh-grid"><div class="sh-col">${sUp(s).length ? sNextCard(s) : ''}${sWeek(s)}${sTodo(s)}${typeof sWordCard==='function' ? sWordCard(s) : ''}</div>
    <div class="sh-col">${sCkCard(s)}${sLastFb(s)}${sCountdown(s)}
      <section class="card"><h3 class="sh-h">${+TODAY.slice(5,7)} 月学习计划</h3>${mpView(s.id, TODAY.slice(0,7))}</section></div></div>${typeof sMsgEntry==='function' ? sMsgEntry() : ''}`;
}
const sUp = s => { const now = nowJST(); return lsOfS(s.id).filter(l => l.status === 'scheduled' && (l.date > TODAY || (l.date === TODAY && l.end > now))); };
// 本周课程：今天起 7 天，一行一节
function sWeek(s){
  const end = addDay(TODAY, 6);
  const ls = lsOfS(s.id).filter(l => l.status === 'scheduled' && l.date >= TODAY && l.date <= end);
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">本周课程</h3><button class="btn sm" data-act="tab" data-v="b">看课表 ›</button></div>
    ${ls.length ? `<div class="wk">${ls.map(l => { const c = course(l.course_id);
      return `<div class="wk-row ${l.date === TODAY ? 'today' : ''} ${l.date === TODAY && l.end <= nowJST() ? 'past' : ''}"><span class="wk-d">${dayWord(l.date)}</span><span class="num">${timeFor(l, s.tz)}</span><span class="grow">${subjTag(c.subject)}${l.kind ? `<span class="muted xs"> · ${esc(l.kind)}</span>` : ''}${l.topic ? `<span class="wk-topic">${esc(l.topic)}</span>` : ''}</span><span class="muted small">${esc(tName(c.teacher_id))}</span></div>`; }).join('')}</div>`
      : `<div class="sh-empty">${sUp(s).length ? '这 7 天没有课。' : '还没有排课，老师排好后会显示在这里。'}</div>`}</section>`;
}
// 通关进度（有点检表才显示）
function sCkCard(s){
  if (typeof ckListsOf === 'undefined') return '';
  const ls = ckListsOf(s.id); if (!ls.length) return '';
  const st = ckStat({items: ls.flatMap(l => l.items)});
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">通关进度</h3><button class="btn sm" data-act="tab" data-v="f">去看 ›</button></div>
    <div class="ck-bar" style="max-width:none;margin-top:6px"><i style="width:${st.pct}%"></i></div>
    <div class="small" style="margin-top:6px">已通关 <span class="ck-frac">${st.pass} / ${st.n}</span> 关${st.cur ? `<span class="muted"> · 现在：${esc(st.cur.stage)} · ${esc(st.cur.name)}</span>` : ''}</div></section>`;
}
// 最近一次老师反馈
function sLastFb(s){
  const fs = fbOfS(s.id), f = fs[fs.length - 1];
  if (!f) return `<section class="card"><h3 class="sh-h">最近的老师反馈</h3><div class="sh-empty">上完第一节课后，老师写的反馈会出现在这里。</div></section>`;
  const l = L(f.lesson_id), c = course(l.course_id), txt = String(f.content || '');
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">最近的老师反馈</h3><button class="btn sm" data-act="tab" data-v="d">全部 ›</button></div>
    <div class="small"><span class="muted">${fmtMD(l.date)}</span> ${subjTag(c.subject)} <span class="muted">${esc(tName(c.teacher_id))}</span></div>
    <div style="margin-top:4px">${esc(txt.slice(0, 70))}${txt.length > 70 ? '…' : ''}</div>
    ${f.hw ? `<div class="small" style="margin-top:4px"><span class="muted">作业：</span>${esc(f.hw)}</div>` : ''}</section>`;
}
// 左边菜单栏：上面学生小名片，下面「我的老师」
function sSide(s){
  const cs = DB.courses.filter(c => c.student_id === s.id && c.active !== false), by = {};
  cs.forEach(c => (by[c.teacher_id] ??= []).push(c.subject));
  const sub = [s.direction || s.track, s.target_ym ? `目标 ${tgtLabel(s.target_ym)}` : ''].filter(Boolean);
  return {
    top: `<div class="side-me"><span class="side-av">${esc((s.name || '?').slice(-1))}</span><div><b>${esc(s.name)}同学</b>${sub.map(x => `<div class="muted xs">${esc(x)}</div>`).join('')}</div></div>`,
    bottom: `<div class="side-foot">${Object.keys(by).length ? `<div class="grp">${PRO() ? '孩子的老师' : '我的老师'}</div>${Object.entries(by).map(([tid, subs]) => `<div class="side-tea"><b>${esc(tName(tid))}</b><span class="muted xs">${subs.map(esc).join('、')}</span></div>`).join('')}` : ''}
      <div class="muted xs side-help">有问题直接微信联系教务老师</div></div>`,
  };
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
    <div class="nx-what">${subjTag(c.subject)} <span>${esc(tName(c.teacher_id))}</span>${l.makeup?' <span class="tag blue">补课</span>':''}${l.moved?' <span class="tag warn">调过课</span>':''}</div>
    ${l.topic ? `<div class="nx-topic">本节：${esc(l.topic)}</div>` : ''}
    ${q ? reqLine(q) : ''}
    ${PRO() ? '<div class="muted xs">北京时间</div>' : !(q && q.status==='pending') ? `<div class="row"><button class="btn sm" data-act="req-open" data-v="${l.id}">申请改期 / 请假</button><span class="muted xs">北京时间</span></div>` : ''}
    ${later.length ? `<div class="nx-later">${later.map(x => { const cc = course(x.course_id); return `<div class="row xs"><span class="muted">之后</span><b>${dayWord(x.date)}</b><span class="num">${timeFor(x, s.tz)}</span>${subjTag(cc.subject)}<span class="muted">${esc(tea(cc.teacher_id).name)}</span></div>`; }).join('')}</div>` : ''}
  </section>`;
}
function sTodo(s){
  const items = [];
  const hw = sUnHw(s).length, nc = sUnConfirm(s).length;
  const ro = PRO();
  if (hw) items.push(['c', `${hw} 份作业还没交`, ro ? '去看看' : '去交作业', 'warn']);
  if (nc) items.push(['d', `${nc} 节课还没确认`, ro ? '去看看' : '去确认', 'blue']);
  if (sSelfDue(s)) items.push(['e', `${+TODAY.slice(5,7)} 月的自我评价还没写`, ro ? '去看看' : '去写', 'gold']);
  if (!items.length) return `<section class="card todo-ok"><b>都完成了</b><span class="muted small">作业交了，课也都确认了 👍</span></section>`;
  return `<section class="card"><h3 class="sh-h">${ro ? '孩子还要做的事' : '要做的事'}</h3><div class="todo">${items.map(([t, txt, btn, cls]) =>
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
const sSched = s => `<div class="muted xs">${PRO() ? '点某一天看当天的课。' : '点某一天看当天的课；有事可以在课下面申请改期或请假。'}</div>${schedule(lsOfS(s.id), s.tz, c => tea(c.teacher_id).name, !PRO(), false, sxBtn(s.id))}`;

/* ───────── 作业：平时收起，点「我完成了」再填 ───────── */
function sHomework2(s){
  const cur = latestHw(s.id), todo = cur.filter(f => !f.hw_sub), done = cur.filter(f => f.hw_sub);
  const older = fbOfS(s.id).filter(f => !cur.includes(f)).slice(-8).reverse();
  const ro = PRO(), who = ro ? '孩子' : '我';
  const item = (f, now0) => { const l = L(f.lesson_id), c = course(l.course_id), now = now0 && !ro;
    return `<div class="les hw-i" style="--hc:${hue(c.subject)}"><div style="min-width:0;flex:1">
      <div class="row xs">${subjTag(c.subject)}<span class="muted">${esc(tName(c.teacher_id))} · ${sMD(l.date)} 布置</span><span style="margin-left:auto" class="tag ${f.hw_fb?'ok':f.hw_sub?'blue':'warn'}">${f.hw_fb?'已批改':f.hw_sub?'已交':'未交'}</span></div>
      <div class="hw-t">${esc(f.hw)}</div>${fileList(f.id,'hwref','老师给的作业图片')}
      ${now && !f.hw_sub ? `<div class="row">${uploadBtn('hw', f.id, '上传作业照片 / PDF')}<button class="btn pri sm" data-act="hw-done" data-v="${f.id}">我完成了</button></div>` : ''}
      ${now && f.hw_sub && !f.hw_fb ? `<div class="row">${uploadBtn('hw', f.id, '再传几张')}<button class="btn sm" style="margin-left:auto" data-act="hw-undo" data-v="${f.id}" title="点错了「我完成了」？老师批改前可以撤回">还没做完，撤回</button></div>` : ''}
      ${fileList(f.id,'hw',`${who}交的作业`)}${fileList(f.id,'grade','老师的批改')}
      ${f.hw_note?`<div class="muted xs">${who}说：${esc(f.hw_note)}</div>`:''}${f.hw_fb?`<div class="note"><b>老师批改：</b>${esc(f.hw_fb)}</div>`:''}</div></div>`; };
  return `${todo.length ? `<div class="dg">还没交 · ${todo.length} 份</div>${todo.map(f => item(f, true)).join('')}` : '<div class="card todo-ok"><b>作业都交了</b><span class="muted small">新作业会出现在这里</span></div>'}
  ${done.length ? `<div class="dg">这次的作业 · 已交</div>${done.map(f => item(f, true)).join('')}` : ''}
  ${older.length ? `<details class="sh-more"><summary>以前的作业（${older.length}）</summary>${older.map(f => item(f, false)).join('')}</details>` : ''}`;
}

/* ───────── 上课记录：一行一节，点开看全文；没确认的放最上面 ───────── */
function sFbBody(f){
  return `${tagRow(f)}<div class="sec"><b>本节授课内容</b><p>${esc(f.content)}</p></div><div class="sec"><b>课堂表现</b><p>${esc(f.perf)}</p></div><div class="sec"><b>课后作业</b><p>${esc(f.hw)}</p></div>${fileList(f.id,'hwref','老师给的作业图片')}${fileList(f.id,'note','老师的上课笔记')}`;
}
function sFbRow(f){
  const l = L(f.lesson_id), c = course(l.course_id), snip = String(f.content || '').slice(0, 26) + (String(f.content || '').length > 26 ? '…' : '');
  return `<details class="card fbx" style="--hc:${hue(c.subject)}"><summary><div class="fbx-h"><span class="num fbx-d">${sMD(l.date)}</span>${subjTag(c.subject)}<span class="muted xs">${esc(tName(c.teacher_id))}</span>
    <span style="margin-left:auto">${f.confirm ? confirmTag(f) : PRO() ? '' : '<span class="tag warn">待确认</span>'}</span></div><div class="fbx-s muted small">${esc(snip)}</div></summary>
    <div class="fb">${sFbBody(f)}</div></details>`;
}
function sFeedback2(s){
  const all = fbOfS(s.id).slice().reverse(), pend = all.filter(f => !f.confirm), rest = all.filter(f => f.confirm);
  if (!all.length) return '<div class="empty">还没有上课记录</div>';
  let out = '';
  if (PRO()) { let m0 = ''; all.slice(0, 60).forEach(f => { const m = L(f.lesson_id).date.slice(0,7); if (m !== m0) { out += `<div class="dg">${ymLabel(m)}</div>`; m0 = m; } out += sFbRow(f); });
    return `<div class="muted xs">每节课后老师写的反馈，教务老师审核后显示在这里。</div>${out}`; }
  if (pend.length) out += `<div class="dg">待确认 · ${pend.length} 节</div><div class="muted xs" style="margin-top:-4px">上完课点一下，告诉老师这节课上得怎么样。</div>` + pend.map(f => {
    const l = L(f.lesson_id), c = course(l.course_id);
    return `<section class="card fbp" style="--hc:${hue(c.subject)}"><div class="fbx-h"><span class="num fbx-d">${sMD(l.date)}</span>${subjTag(c.subject)}<span class="muted xs">${esc(tName(c.teacher_id))}</span></div>
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
  const jump = [['m-target','目标大学'],['m-score','成绩'],['m-month','月度自评'],['m-profile','个人档案']], ro = PRO();
  return `<h2 style="font-size:19px">${ro ? `${esc(s.name)}同学的档案` : '我的'}</h2>${typeof sMsgBox==='function' ? sMsgBox(s) : ''}
  <div class="chips">${jump.map(([id, t]) => `<button class="chip" data-act="jump" data-v="${id}">${t}</button>`).join('')}</div>
  <h3 class="sh-sec" id="m-target">目标大学与出愿日程</h3>
  ${s.target_ym || s.direction ? `<div class="card small">${s.direction?`<span class="tag gold">${esc(s.direction)}</span> `:''}${s.target_ym?`目标入学 <b>${tgtLabel(s.target_ym)}</b>`:''}</div>` : ''}
  ${targetsView(s.id, false)}
  <h3 class="sh-sec" id="m-score">成绩变化</h3><div class="card">${scoreTrend(s.id)}</div>
  <h3 class="sh-sec" id="m-month">月度自评</h3>
  ${ro ? `<section class="card self-card"><b>${ymLabel(ym)} · 孩子的自我评价</b>${r.self_eval ? `<div class="msg-t">${esc(r.self_eval)}</div>` : '<div class="muted small">这个月还没写（每月 20 号以后写）</div>'}</section>`
  : `<section class="card self-card"><b>${ymLabel(ym)} · 我的自我评价</b>
    <div class="muted xs">这个月学得怎么样？哪里进步了、哪里还觉得吃力、下个月想加强什么。老师和教务会看到。</div>
    <textarea id="self-eval" placeholder="例：词汇有进步，但有机反应链容易混淆">${esc(r.self_eval||'')}</textarea>
    <div class="row"><button class="btn pri" data-act="self-save" data-v="${ym}">${r.self_eval?'更新':'提交'}</button>${r.self_eval?'<span class="tag ok">已写</span>':''}</div></section>`}
  ${r.teacher_eval || r.next_focus ? reviewCard({...r, ym, student_id: s.id}) : ''}
  ${past.length ? `<details class="sh-more"><summary>以前的月度反馈（${past.length}）</summary>${past.map(x => reviewCard(x)).join('')}</details>` : ''}
  <h3 class="sh-sec" id="m-profile">个人档案</h3>
  <details class="card"><summary class="muted small">${ro ? '点开看孩子的档案' : '点开看我的档案'}</summary>${profilePage(s, {hideEmpty: true})}</details>`;
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'hw-open') { const p = document.getElementById('hwp-' + a.dataset.v); if (p) { p.hidden = !p.hidden; if (!p.hidden) p.querySelector('textarea')?.focus(); } }
  if (a.dataset.act === 'hw-undo') {   // 点错「我完成了」：老师批改前可以撤回
    if (!confirm('撤回「我完成了」？\n这份作业会回到「还没交」，已经传的照片会留着，做完了再点一次「我完成了」就行。')) return;
    act('student_hw_undo', {fid: a.dataset.v}, '已撤回，这份作业回到「还没交」了').catch(() => {});
  }
  if (a.dataset.act === 'jump') document.getElementById(a.dataset.v)?.scrollIntoView({behavior: 'smooth', block: 'start'});
});
