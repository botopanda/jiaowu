/* ══════════════════════════════════════════════════════════════
   学生端（2026-10 减法版）
   原则：一页只做一件事；少框、少标签、少说明文字；只有要提醒的才用红色
   底部菜单：首页 / 课表 / 作业 / 上课记录 / 我的
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

/* ───────── 首页：下一节课 ＋ 要做的事 ───────── */
function sHome2(s){
  return `<div class="sx">${sNext(s)}${sTodo(s)}</div>`;
}
function sNext(s){
  const now = nowJST();
  const l = lsOfS(s.id).find(l => l.status === 'scheduled' && (l.date > TODAY || (l.date === TODAY && l.end > now)));
  if (!l) return `<section class="sx-next"><div class="sx-cap">下一节课</div><div class="muted">近期没有排课</div></section>`;
  const c = course(l.course_id), q = reqOf(l), pending = q && q.status === 'pending';
  return `<section class="sx-next"><div class="sx-cap">下一节课</div>
    <div class="sx-when">${dayWord(l.date)} <span class="num">${timeFor(l, s.tz).split('–')[0]}</span></div>
    <div class="sx-what">${esc(c.subject)} · ${esc(tea(c.teacher_id).name)}</div>
    ${pending ? `<div class="sx-note">已申请${esc(q.type)}，等教务处理</div>` : `<button class="sx-link" data-act="req-open" data-v="${l.id}">请假 / 改期</button>`}</section>`;
}
function sTodo(s){
  const items = [];
  const hw = sUnHw(s).length, nc = sUnConfirm(s).length;
  if (hw) items.push({t:'c', txt:`${hw} 份作业没交`});
  if (nc) items.push({t:'d', txt:`${nc} 节课没确认`});
  if (sSelfDue(s)) items.push({t:'e', txt:`写 ${+TODAY.slice(5,7)} 月自我评价`});
  targetsOf(s.id).map(t => ({t, nx: nextEventOf(t)})).filter(x => x.nx && x.nx.days <= 30).sort((a, b) => a.nx.days - b.nx.days)
    .forEach(({t, nx}) => items.push({t:'e', txt:`${esc(t.school.split('／')[0])} ${nx.label}`, tail:`还有 ${nx.days} 天`, hot: nx.days <= 14}));
  return `<section class="sx-sec"><div class="sx-cap">要做的事</div>
    ${items.length ? `<div class="sx-list">${items.map(x => `<button class="sx-row" data-act="tab" data-v="${x.t}"><span class="grow">${x.txt}</span>${x.tail ? `<span class="${x.hot ? 'sx-hot' : 'muted'}">${x.tail}</span>` : ''}<span class="sx-arr">›</span></button>`).join('')}</div>`
      : '<div class="muted sx-empty">没有要做的事</div>'}</section>`;
}

/* ───────── 课表 ───────── */
const sSched = s => schedule(lsOfS(s.id), s.tz, c => tea(c.teacher_id).name, true);

/* ───────── 作业 ───────── */
function sHomework2(s){
  const cur = latestHw(s.id), todo = cur.filter(f => !f.hw_sub), done = cur.filter(f => f.hw_sub);
  const older = fbOfS(s.id).filter(f => !cur.includes(f)).slice(-8).reverse();
  const item = (f, now) => { const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="sx-item"><div class="sx-meta">${esc(c.subject)} · ${esc(tea(c.teacher_id).name)} · ${sMD(l.date)}${f.hw_fb ? ' · <span class="ok-t">已批改</span>' : f.hw_sub ? ' · 已交' : ''}</div>
      <div class="sx-main">${esc(f.hw)}</div>
      ${now && !f.hw_sub ? `<div class="row">${uploadBtn('hw', f.id, '上传作业照片 / PDF')}<button class="btn pri sm" data-act="hw-done" data-v="${f.id}">我完成了</button></div>` : ''}
      ${now && f.hw_sub && !f.hw_fb ? `<div class="row">${uploadBtn('hw', f.id, '再传几张')}</div>` : ''}
      ${fileList(f.id,'hw','我交的')}${fileList(f.id,'grade','老师的批改')}
      ${f.hw_fb ? `<div class="sx-fb">老师：${esc(f.hw_fb)}</div>` : ''}</div>`; };
  return `<div class="sx">
    <section class="sx-sec"><div class="sx-cap">没交的作业</div>${todo.length ? `<div class="sx-list">${todo.map(f => item(f, true)).join('')}</div>` : '<div class="muted sx-empty">作业都交了</div>'}</section>
    ${done.length ? `<section class="sx-sec"><div class="sx-cap">已交</div><div class="sx-list">${done.map(f => item(f, true)).join('')}</div></section>` : ''}
    ${older.length ? `<details class="sx-sec sx-fold"><summary>以前的作业</summary><div class="sx-list">${older.map(f => item(f, false)).join('')}</div></details>` : ''}</div>`;
}

/* ───────── 上课记录：一行一节，点开看反馈；没确认的行尾带两个按钮 ───────── */
function sFeedback2(s){
  const all = fbOfS(s.id).slice().reverse();
  if (!all.length) return '<div class="muted sx-empty">还没有上课记录</div>';
  const ordered = [...all.filter(f => !f.confirm), ...all.filter(f => f.confirm)].slice(0, 60);
  return `<div class="sx"><section class="sx-sec"><div class="sx-list">${ordered.map(f => {
    const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="sx-fbr"><details><summary><span class="num sx-d">${sMD(l.date)}</span><span class="grow">${esc(c.subject)} · ${esc(tea(c.teacher_id).name)}</span>${f.confirm ? `<span class="muted xs">${f.confirm}</span>` : ''}</summary>
        <div class="sx-body"><p><b>内容</b>${esc(f.content)}</p><p><b>表现</b>${esc(f.perf)}</p><p><b>作业</b>${esc(f.hw)}</p>${fileList(f.id,'note','上课笔记')}</div></details>
      ${f.confirm ? '' : `<div class="sx-btns"><button class="btn pri sm" data-act="confirm" data-v="${f.id}|满意">满意</button><button class="btn sm" data-act="confirm" data-v="${f.id}|不满意">不满意</button></div>`}</div>`; }).join('')}</div></section></div>`;
}

/* ───────── 我的：从上往下几段 ───────── */
function sMine(s){
  const ym = TODAY.slice(0,7), r = reviewOf(s.id, ym) || {};
  const past = reviewsOf(s.id).filter(x => x.ym !== ym && (x.content || x.self_eval || x.teacher_eval || x.next_focus)).slice().reverse();
  const ts = targetsOf(s.id);
  return `<div class="sx">
  <section class="sx-sec"><div class="sx-cap">${+ym.slice(5)} 月学习计划</div>${mpView(s.id, ym)}</section>
  <section class="sx-sec"><div class="sx-cap">目标大学</div>${ts.length ? `<div class="sx-list">${ts.map(t => { const nx = nextEventOf(t);
      return `<div class="sx-item"><div class="sx-main">${esc(t.school)}</div><div class="sx-meta">${t.tier}${t.exam_way ? ' · ' + esc(t.exam_way) : ''}</div>
        <div class="sx-dates">${DATE_KEYS.filter(([k]) => t[k]).map(([k, lb]) => `<span class="${t[k] < TODAY ? 'muted' : ''}">${lb} ${sMD(t[k])}</span>`).join('') || '<span class="muted">日期待定</span>'}</div>
        ${nx ? `<div class="${nx.days <= 14 ? 'sx-hot' : 'muted'} xs">${nx.label}还有 ${nx.days} 天</div>` : ''}</div>`; }).join('')}</div>` : '<div class="muted sx-empty">还没有目标大学</div>'}</section>
  <section class="sx-sec"><div class="sx-cap">成绩</div>${scoreTrend(s.id)}</section>
  <section class="sx-sec"><div class="sx-cap">${+ym.slice(5)} 月自我评价</div>
    <textarea id="self-eval" class="sx-ta" placeholder="这个月哪里进步了、哪里还吃力、下个月想加强什么">${esc(r.self_eval||'')}</textarea>
    <div class="row"><button class="btn pri" data-act="self-save" data-v="${ym}">${r.self_eval ? '更新' : '提交'}</button>${r.self_eval ? '<span class="muted xs">已提交</span>' : ''}</div>
    ${r.teacher_eval || r.next_focus ? reviewCard({...r, ym, student_id: s.id}) : ''}</section>
  ${past.length ? `<details class="sx-sec sx-fold"><summary>以前的月度回访</summary>${past.map(x => reviewCard(x)).join('')}</details>` : ''}
  <details class="sx-sec sx-fold"><summary>个人档案</summary>${profilePage(s, {hideEmpty: true})}</details></div>`;
}
