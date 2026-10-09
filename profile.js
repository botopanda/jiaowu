/* ══════════════════════════════════════════════════════════════
   个人档案页（照 Excel「个人档案」第一页：给家长和学生看的成品）
   跟进看板（照 Excel「跟进看板」：一年 12 个月一张表）
   依赖 app.js、track.js 里的工具和数据。
   ══════════════════════════════════════════════════════════════ */
function scoreRows(sid){
  const by = {};
  scoresOf(sid).forEach(x => (by[x.metric] ??= []).push(x));
  return Object.keys(by).sort((a,b) => OPT.metric.indexOf(a) - OPT.metric.indexOf(b)).map(m => {
    const ls = by[m].sort((a,b) => a.date.localeCompare(b.date));
    return {m, ls, f: ls[0], l: ls[ls.length-1]};
  });
}

// 成绩折线图：横轴日期、纵轴分数，每个点标分数
function scoreChart(ls){
  if (!ls.length) return '<div class="empty">还没有这个指标的成绩</div>';
  const W = 560, H = 190, L = 40, R = 16, T = 22, B = 28;
  const ys = ls.map(x => Number(x.score)), full = Number(ls[ls.length-1].full_score) || 0;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const room = Math.max((hi - lo) * 0.25, hi * 0.04, 1);
  lo = Math.max(0, lo - room); hi = hi + room;
  if (full && hi > full) hi = full;
  const X = i => ls.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (ls.length - 1);
  const Y = v => T + (hi - v) / ((hi - lo) || 1) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi].map(v => Math.round(v));
  const path = ls.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(Number(x.score)).toFixed(1)}`).join('');
  const grid = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`
    + `<text x="${L - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${t}</text>`).join('');
  const dots = ls.map((x, i) => {
    const cx = X(i).toFixed(1), cy = Y(Number(x.score)).toFixed(1), last = i === ls.length - 1;
    return `<circle cx="${cx}" cy="${cy}" r="${last ? 5 : 3.5}" fill="${last ? 'var(--gold)' : 'var(--surface)'}" stroke="var(--gold)" stroke-width="2"/>`
      + `<text x="${cx}" y="${(Number(cy) - 10).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${x.score}</text>`
      + `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${x.date.slice(2, 7).replace('-', '/')}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="pf-chart" role="img" aria-label="成绩变化折线图">${grid}<path d="${path}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}

function profilePage(s, opt = {}){
  const kv = (l, v) => !v && opt.hideEmpty ? '' : `<div class="pf-kv"><span>${l}</span><b>${v ? esc(v) : '<span class="muted">—</span>'}</b></div>`;   // 学生自己看时，空着的项不显示
  const rows = scoreRows(s.id), metric = (rows.find(r => r.m === S.pfMetric) || rows[0] || {}).m;
  const ts = targetsOf(s.id);
  const birth = s.birth ? `${+s.birth.slice(0,4)}年${+s.birth.slice(5,7)}月${+s.birth.slice(8,10)}日` : '';
  const bunri = [s.lv_bun, s.lv_ri].filter(x => x && x !== '不适用').join('；');

  const scoreTable = rows.length ? `<div class="tw"><table class="pf-table ${opt.hideEmpty ? 'rt' : ''}"><thead><tr><th>成绩指标</th><th>首次日期</th><th>首次分数</th><th>最新日期</th><th>最新分数</th><th>提升</th></tr></thead><tbody>
    ${rows.map(r => {
      const d = Number(r.l.score) - Number(r.f.score), many = r.ls.length > 1;
      return `<tr><td><b>${esc(r.m)}</b></td><td class="num">${r.f.date}</td><td class="num">${r.f.score}</td>
        <td class="num">${many ? r.l.date : '—'}</td><td class="num"><b>${many ? r.l.score : '—'}</b>${r.l.full_score ? `<span class="muted xs"> / ${r.l.full_score}</span>` : ''}</td>
        <td>${many ? `<span class="tag ${d > 0 ? 'ok' : d < 0 ? 'seal' : 'mute'}">${d > 0 ? '+' : ''}${+d.toFixed(1)}</span>` : '<span class="muted xs">只有一次</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="pf-chart-box"><div class="row" style="margin-bottom:4px"><span class="muted small">看哪个指标的变化：</span>
      <div class="chips noprint">${rows.map(r => `<button class="chip ${r.m === metric ? 'on' : ''}" data-act="pf-metric" data-v="${esc(r.m)}" data-sid="${s.id}">${esc(r.m)}</button>`).join('')}</div>
      <b class="printonly">${esc(metric)}</b></div>${scoreChart(rows.find(r => r.m === metric).ls)}</div>`
    : '<div class="muted small">还没有成绩记录</div>';

  const tierTable = ts.length ? `<div class="tw"><table class="pf-table ${opt.hideEmpty ? 'rt' : ''}"><thead><tr><th>类别</th><th>序号</th><th>大学 / 专业</th><th>入试要求</th><th>分数要求</th><th>资料状态</th><th>下一个日期</th></tr></thead><tbody>
    ${ts.map(t => {
      const nx = nextEventOf(t);
      const next = nx ? `${nx.label} <b class="num">${fmtYMD(nx.date)}</b><br><span class="${nx.days <= 14 ? 'tag seal' : 'muted xs'}">还有 ${nx.days} 天</span>`
                      : `<span class="muted">${t.apply_end ? esc(t.status || '') : '日期待定'}</span>`;
      return `<tr><td><span class="tag ${TIER_CLS[t.tier]}">${t.tier}大学</span></td><td class="num">${t.seq}</td>
        <td><b>${esc(t.school)}</b>${t.exam_way ? `<br><span class="muted xs">${esc(t.exam_way)}</span>` : ''}</td>
        <td class="small">${esc(t.requirement || '')}</td><td class="small">${esc(t.score_req || '')}</td><td class="small">${esc(t.doc_status || '')}</td><td class="small">${next}</td></tr>`;
    }).join('')}</tbody></table></div>`
    : '<div class="muted small">还没有大学目标</div>';

  return `<article class="pf-page">
  <header class="pf-head"><div><small>学生个人档案与升学计划</small><h2>${esc(s.name)}</h2></div>
    <div class="pf-tags">${s.code ? `<span class="tag mute">${esc(s.code)}</span>` : ''}${s.direction ? `<span class="tag gold">${esc(s.direction)}</span>` : ''}${s.target_ym ? `<span class="tag blue">目标入学 ${tgtLabel(s.target_ym)}</span>` : ''}
      <button class="btn sm noprint" data-act="pf-print" data-v="${s.id}">打印 / 存 PDF</button></div></header>
  <section><h3 class="pf-h">基本信息</h3><div class="pf-grid">
    ${kv('姓名', s.name)}${kv('出生日期', birth)}${kv('学年', s.grade)}${kv('性别', s.gender)}
    ${kv('升学方向', s.direction || s.track)}${kv('当前学校', s.school)}${kv('目标入学', s.target_ym ? tgtLabel(s.target_ym) : '')}</div></section>
  <section><h3 class="pf-h">现阶段各科水平</h3><div class="pf-grid two">
    ${kv('日语', s.lv_jp)}${kv('英语', s.lv_en)}${kv('数学', s.lv_math)}${kv('文综 / 理综', bunri)}${kv('SAT / ACT', s.lv_sat)}${kv('A-Level / AP / IB', s.lv_ap)}</div>
    ${s.lv_note ? `<div class="pf-note">补充说明：${esc(s.lv_note)}</div>` : ''}</section>
  <section><h3 class="pf-h">成绩变化</h3>${scoreTable}</section>
  <section><h3 class="pf-h">志望大学与申请偏好</h3><div class="pf-grid">
    ${kv('大学类型', s.uni_type)}${kv('第一优先', s.pref1)}${kv('第二优先', s.pref2)}${kv('地区', s.region)}${kv('学费 / 奖学金', s.fee)}
    ${kv('专业方向 1', s.major1)}${kv('专业方向 2', s.major2)}${kv('专业方向 3', s.major3)}${s.major_other ? kv('其他专业', s.major_other) : ''}</div></section>
  <section><h3 class="pf-h">大学分层</h3>${tierTable}</section>
  <footer class="pf-foot">数据更新至 ${fmtMD(TODAY)} · 一对一教务台</footer>
  </article>`;
}

function boardView(sid){
  const years = [...new Set([TODAY.slice(0,4), ...lsOfS(sid).map(l => l.date.slice(0,4)), ...reviewsOf(sid).map(r => r.ym.slice(0,4))])].sort();
  const y = years.includes(S.bdYear) ? S.bdYear : TODAY.slice(0,4);
  const ls = lsOfS(sid).filter(l => l.date.startsWith(y) && isDone(l)), rv = reviewsOf(sid).filter(r => r.ym.startsWith(y));
  const staff = ME().role === 'admin' || ME().role === 'teacher';
  const pendFu = staff ? fusOf(sid).filter(f => f.date.startsWith(y) && f.confirm !== '已确认').length : 0;
  const cut = (t, n = 40) => t ? esc(t.length > n ? t.slice(0, n) + '…' : t) : '';
  const rowsHtml = Array.from({length: 12}, (_, i) => {
    const ym = `${y}-${pad(i + 1)}`, ml = ls.filter(l => l.date.startsWith(ym)), r = rv.find(x => x.ym === ym);
    const cls = (ym > TODAY.slice(0,7) ? 'fut ' : '') + (ym === TODAY.slice(0,7) ? 'cur' : '');
    return `<tr class="${cls}"><td class="num"><b>${i + 1} 月</b></td><td class="num">${ml.length || ''}</td><td class="num">${ml.length ? +ml.reduce((a, l) => a + dur(l), 0).toFixed(1) : ''}</td>
      <td>${cut(r && r.content)}</td><td>${cut(r && r.self_eval)}</td><td>${cut(r && r.teacher_eval)}</td><td>${cut(r && r.conclusion)}</td><td>${cut(r && r.next_focus)}</td>
      <td>${r ? `<span class="tag ${r.status === '已完成' ? 'ok' : r.status === '需调整' ? 'seal' : 'mute'}">${esc(r.status || '待跟进')}</span>` : ''}</td></tr>`;
  }).join('');
  return `<div class="row" style="justify-content:space-between"><b style="font-family:var(--f-disp);font-size:16px">${y} 年跟进看板</b>
    ${years.length > 1 ? `<select id="bd-year" data-change="bd-year" data-sid="${sid}">${years.map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}</div>
  <div class="stats"><div class="stat"><small>本年已上课次</small><b>${ls.length}</b></div><div class="stat"><small>本年已上课时</small><b>${+ls.reduce((a, l) => a + realH(l), 0).toFixed(1)}</b></div>
    <div class="stat"><small>已记录月份</small><b>${rv.filter(r => r.content || r.teacher_eval).length}</b></div>${staff ? `<div class="stat ${pendFu ? 'al' : ''}"><small>待确认跟进</small><b>${pendFu}</b></div>` : ''}</div>
  <div class="tw"><table class="board"><thead><tr><th>月份</th><th>课次</th><th>课时</th><th>本月课程内容</th><th>学生自我评价</th><th>老师评价</th><th>任务 / 跟进结论</th><th>下月重点</th><th>状态</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

// 打印：只打印档案页本身
function printProfile(sid){
  let root = document.getElementById('print-root');
  if (!root){ root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = profilePage(stu(sid));
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'pf-metric'){
    S.pfMetric = a.dataset.v;
    if (document.querySelector('.modal .pf-page')) studentModal(a.dataset.sid, 'pfview'); else render();
  }
  if (a.dataset.act === 'pf-print') printProfile(a.dataset.v);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset && el.dataset.change === 'bd-year'){
    S.bdYear = el.value;
    if (document.querySelector('.modal')) studentModal(el.dataset.sid, 'board'); else render();
  }
});
