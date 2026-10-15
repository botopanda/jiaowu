/* 学生首页「充实版」预览（确认后并进 student.js；这个文件不在网站加载清单里） */
const addDay = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };

function sHome2(s){
  const h = +nowJST().slice(0,2), greet = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  return `<div class="sh-hi"><h2>${greet}，${esc(s.name)}</h2><span class="muted small">${fmtMD(TODAY)}</span></div>
  <div class="grid2 sh-grid"><div class="sh-col">${sUp(s).length ? sNextCard(s) : ''}${sWeek(s)}${sTodo(s)}</div>
    <div class="sh-col">${sCkCard(s)}${sLastFb(s)}${sCountdown(s)}
      <section class="card"><h3 class="sh-h">${+TODAY.slice(5,7)} 月学习计划</h3>${mpView(s.id, TODAY.slice(0,7))}</section></div></div>`;
}
const sUp = s => { const now = nowJST(); return lsOfS(s.id).filter(l => l.status === 'scheduled' && (l.date > TODAY || (l.date === TODAY && l.end > now))); };
// 本周课程：今天起 7 天，一行一节
function sWeek(s){
  const end = addDay(TODAY, 6);
  const ls = lsOfS(s.id).filter(l => l.status === 'scheduled' && l.date >= TODAY && l.date <= end);
  return `<section class="card"><div class="row"><h3 class="sh-h" style="margin-right:auto">本周课程</h3><button class="btn sm" data-act="tab" data-v="b">看课表 ›</button></div>
    ${ls.length ? `<div class="wk">${ls.map(l => { const c = course(l.course_id);
      return `<div class="wk-row ${l.date === TODAY ? 'today' : ''} ${l.date === TODAY && l.end <= nowJST() ? 'past' : ''}"><span class="wk-d">${dayWord(l.date)}</span><span class="num">${timeFor(l, s.tz)}</span><span class="grow">${subjTag(c.subject)}${l.kind ? `<span class="muted xs"> · ${esc(l.kind)}</span>` : ''}</span><span class="muted small">${esc(tea(c.teacher_id).name)}</span></div>`; }).join('')}</div>`
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
    <div class="small"><span class="muted">${fmtMD(l.date)}</span> ${subjTag(c.subject)} <span class="muted">${esc(tea(c.teacher_id).name)}</span></div>
    <div style="margin-top:4px">${esc(txt.slice(0, 70))}${txt.length > 70 ? '…' : ''}</div>
    ${f.hw ? `<div class="small" style="margin-top:4px"><span class="muted">作业：</span>${esc(f.hw)}</div>` : ''}</section>`;
}
// 左边菜单栏：上面学生小名片，下面「我的老师」
function sSide(s){
  const cs = DB.courses.filter(c => c.student_id === s.id && c.active !== false), by = {};
  cs.forEach(c => (by[c.teacher_id] ??= []).push(c.subject));
  const sub = [s.direction || s.track, s.target_ym ? `目标 ${tgtLabel(s.target_ym)}` : ''].filter(Boolean);
  return {
    top: `<div class="side-me"><span class="side-av">${esc((s.name || '?').slice(-1))}</span><div><b>${esc(s.name)}</b>${sub.map(x => `<div class="muted xs">${esc(x)}</div>`).join('')}</div></div>`,
    bottom: `<div class="side-foot">${Object.keys(by).length ? `<div class="grp">我的老师</div>${Object.entries(by).map(([tid, subs]) => `<div class="side-tea"><b>${esc(tea(tid).name)}</b><span class="muted xs">${subs.map(esc).join('、')}</span></div>`).join('')}` : ''}
      <div class="muted xs side-help">有问题直接微信联系教务老师</div></div>`,
  };
}

(function(){
  const st = document.createElement('style'); st.id = '__prev_home';
  st.textContent = `
  .sh-grid .nx-later{display:none}
  .wk{display:flex;flex-direction:column}
  .wk-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line)}
  .wk-row:first-child{border-top:0}
  .wk-row.today .wk-d{color:var(--seal);font-weight:600}
  .wk-d{min-width:96px;font-size:13px}
  .wk-row.past{opacity:.45}
  .sh-empty{color:var(--muted);font-size:13.5px;padding:10px 0 4px}
  .side-me{display:flex;align-items:center;gap:10px;padding:6px 8px 14px;margin-bottom:6px;border-bottom:1px solid var(--line)}
  .side-av{width:40px;height:40px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex:none}
  .side-foot{margin-top:auto;padding-top:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:4px}
  .side-tea{display:flex;flex-direction:column;padding:4px 10px}
  .side-help{padding:8px 10px 0}
  .pside{display:flex;flex-direction:column}
  `;
  document.head.appendChild(st);
})();
// 预览用：把名片和「我的老师」塞进左边菜单栏（正式版直接写进页面里）
window.__sideInject = () => {
  const s = stu(ME().student_id), nav = document.querySelector('.pside'); if (!nav || !s) return;
  const x = sSide(s); nav.insertAdjacentHTML('afterbegin', x.top); nav.insertAdjacentHTML('beforeend', x.bottom);
};
