/* ══════════════════════════════════════════════════════════════
   课表导出成图片（月历样子）
   · 教务：课表与排课 → 按学生 → 选一个学生 → 「导出图片」
   · 学生 / 家长：课表页右上角「导出图片」，导出正在看的那个月
   · 图片在弹窗里显示：手机长按保存或转发，电脑点「下载图片」
   · 不管系统是深色还是浅色，导出的图片都用浅色，方便发给别人看
   ══════════════════════════════════════════════════════════════ */
const SX_C = {bg:'#f7f5f0', card:'#ffffff', ink:'#1a1814', muted:'#8a847a', line:'#e2ded6', off:'#faf8f4', gold:'#b8953a', seal:'#b03a2e', am:'#2e9e7a', pm:'#d9822b', ev:'#5b5fc7'};
const SX_TINT = {am:'rgba(46,158,122,.11)', pm:'rgba(217,130,43,.12)', ev:'rgba(91,95,199,.11)'};
const sxSlot = t => { const h = +String(t).slice(0, 2); return h < 12 ? 'am' : h < 18 ? 'pm' : 'ev'; };
const sxBtn = sid => `<button class="btn sm" data-act="sx" data-v="${sid}">导出图片</button>`;
let SX_LOGO = null;
const sxLogo = () => SX_LOGO || (SX_LOGO = new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'apple-touch-icon.png'; }));

function sxRound(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// 文字太长就截断，结尾加「…」
function sxFit(g, txt, w){ if (g.measureText(txt).width <= w) return txt; while (txt && g.measureText(txt + '…').width > w) txt = txt.slice(0, -1); return txt + '…'; }

async function sxCanvas(sid, ym){
  const s = stu(sid), [y, m] = ym.split('-').map(Number);
  const ls = lsOfS(sid).filter(l => l.date.startsWith(ym) && l.status === 'scheduled').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const byD = {}; ls.forEach(l => (byD[+l.date.slice(8)] ??= []).push(l));
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7, last = new Date(y, m, 0).getDate(), rows = Math.ceil((lead + last) / 7);
  const W = 860, P = 24, CW = (W - P * 2) / 7, CH = 50, GAP = 6, DN = 32, HEAD = 128, WK = 40, FOOT = 70;
  const rowH = Array.from({length: rows}, (_, r) => { let mx = 0; for (let c = 0; c < 7; c++){ const d = r * 7 + c - lead + 1; if (d >= 1 && d <= last) mx = Math.max(mx, (byD[d] || []).length); } return Math.max(100, DN + mx * (CH + GAP) + 6); });
  const H = HEAD + WK + rowH.reduce((a, b) => a + b, 0) + FOOT;
  const F = getComputedStyle(document.body).fontFamily || 'sans-serif', font = (px, b) => `${b ? 600 : 400} ${px}px ${F}`;
  const k = 2, cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k;
  const g = cv.getContext('2d'); g.scale(k, k); g.textBaseline = 'alphabetic';

  // 底色 + 标题
  g.fillStyle = SX_C.bg; g.fillRect(0, 0, W, H);
  const logo = await sxLogo();
  if (logo) { g.save(); sxRound(g, W - P - 26, 34, 26, 26, 6); g.clip(); g.drawImage(logo, W - P - 26, 34, 26, 26); g.restore(); }
  g.textAlign = 'right'; g.fillStyle = SX_C.muted; g.font = font(14); g.fillText('学生教务管理系统', W - P - (logo ? 34 : 0), 52);
  g.textAlign = 'left'; g.fillStyle = SX_C.ink; g.font = font(28, true); g.fillText(`${s.name}　${y}年${m}月课表`, P, 62);
  const hrs = ls.reduce((a, l) => a + dur(l), 0);
  g.fillStyle = SX_C.muted; g.font = font(15); g.fillText(ls.length ? `北京时间 · 共 ${ls.length} 节课 · ${+hrs.toFixed(1)} 小时` : '北京时间 · 这个月还没有排课', P, 94);

  // 月历卡片
  const top = HEAD, bodyH = WK + rowH.reduce((a, b) => a + b, 0);
  g.save(); sxRound(g, P, top, W - P * 2, bodyH, 12); g.fillStyle = SX_C.card; g.fill(); g.clip();
  ['一','二','三','四','五','六','日'].forEach((d, i) => { g.fillStyle = i >= 5 ? SX_C.seal : SX_C.muted; g.font = font(14, true); g.textAlign = 'center'; g.fillText(d, P + CW * i + CW / 2, top + 26); });
  g.textAlign = 'left';
  let yy = top + WK;
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < 7; c++){
      const d = r * 7 + c - lead + 1, x = P + CW * c;
      if (d < 1 || d > last) { g.fillStyle = SX_C.off; g.fillRect(x, yy, CW, rowH[r]); continue; }
      g.fillStyle = c >= 5 ? SX_C.seal : SX_C.ink; g.font = font(15, true); g.fillText(String(d), x + 10, yy + 22);
      (byD[d] || []).forEach((l, i) => {
        const cy = yy + DN + i * (CH + GAP), cx = x + 5, cw = CW - 10, sl = sxSlot(l.start), co = course(l.course_id);
        g.fillStyle = SX_TINT[sl]; sxRound(g, cx, cy, cw, CH, 6); g.fill();
        g.fillStyle = SX_C[sl]; sxRound(g, cx, cy, 4, CH, 2); g.fill();
        g.fillStyle = SX_C.ink; g.font = font(14, true); g.fillText(`${l.start}–${l.end}`, cx + 9, cy + 21);
        // 第二行：［补］科目·课程类型（放不下就只写科目）……右边是老师
        let lx = cx + 9;
        if (l.makeup) { g.fillStyle = SX_C.seal; g.font = font(12.5, true); g.fillText('补', lx, cy + 40); lx += g.measureText('补').width + 4; }
        const who = tea(co.teacher_id).name || '', avail = cx + cw - 5 - lx;
        g.font = font(12.5); const ww = g.measureText(who).width;
        let what = co.subject + (l.kind ? '·' + l.kind : '');
        g.font = font(12.5, true); if (g.measureText(what).width + ww + 6 > avail) what = co.subject;
        what = sxFit(g, what, Math.max(24, avail - ww - 6));
        g.fillStyle = SX_C[sl]; g.fillText(what, lx, cy + 40);
        const wl = g.measureText(what).width; g.fillStyle = SX_C.muted; g.font = font(12.5); g.textAlign = 'right'; g.fillText(sxFit(g, who, Math.max(0, avail - wl - 6)), cx + cw - 5, cy + 40); g.textAlign = 'left';
      });
    }
    yy += rowH[r];
  }
  // 格子线
  g.strokeStyle = SX_C.line; g.lineWidth = 1;
  let ly = top + WK; for (let r = 0; r <= rows; r++){ g.beginPath(); g.moveTo(P, ly + .5); g.lineTo(W - P, ly + .5); g.stroke(); ly += rowH[r] || 0; }
  for (let c = 1; c < 7; c++){ g.beginPath(); g.moveTo(P + CW * c + .5, top + WK); g.lineTo(P + CW * c + .5, top + bodyH); g.stroke(); }
  g.restore();
  g.strokeStyle = SX_C.line; sxRound(g, P + .5, top + .5, W - P * 2 - 1, bodyH - 1, 12); g.stroke();

  // 底部：颜色说明 + 导出日期
  const fy = H - 30; let fx = P; g.font = font(13);
  [['am','上午'],['pm','下午'],['ev','晚上']].forEach(([sl, t]) => { g.fillStyle = SX_C[sl]; sxRound(g, fx, fy - 10, 12, 12, 3); g.fill(); g.fillStyle = SX_C.muted; g.fillText(t, fx + 18, fy); fx += 18 + g.measureText(t).width + 18; });
  if (ls.some(l => l.makeup)) { g.fillStyle = SX_C.seal; g.font = font(13, true); g.fillText('补', fx, fy); g.fillStyle = SX_C.muted; g.font = font(13); g.fillText('＝补课', fx + 15, fy); }
  g.textAlign = 'right'; g.fillText(`${TODAY} 导出`, W - P, fy); g.textAlign = 'left';
  return cv;
}

let SX = null;   // 弹窗里正在看的 {学生, 月份}
async function sxOpen(sid, ym){
  SX = {sid, ym}; document.body.classList.add('busy');
  try {
    const url = (await sxCanvas(sid, ym)).toDataURL('image/png'), s = stu(sid), [y, m] = ym.split('-').map(Number);
    openModal(`<div class="row" style="justify-content:space-between;align-items:center"><h3 style="font-size:17px;margin:0">导出课表图片</h3>
        <span class="row"><button class="btn sm" data-act="sx-m" data-v="-1" aria-label="上个月">‹</button><b class="num">${y}.${pad(m)}</b><button class="btn sm" data-act="sx-m" data-v="1" aria-label="下个月">›</button></span></div>
      <div class="muted small" style="margin-top:6px">手机上：<b>长按图片</b>，可以保存到相册，或直接发给别人。电脑上：点下面的「下载图片」。</div>
      <img src="${url}" alt="${esc(s.name)} ${y}年${m}月课表" style="display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:8px;margin:10px 0">
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">关闭</button><a class="btn pri" href="${url}" download="${esc(s.name)}_${y}年${m}月课表.png">下载图片</a></div>`, true);
  } catch(err) { toast('图片没生成出来：' + err.message, true); }
  finally { document.body.classList.remove('busy'); }
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v;
  if (k === 'sx') sxOpen(v, ['student','parent'].includes(ME().role) ? (S.pMonth || TODAY.slice(0, 7)) : S.month);
  if (k === 'sx-m' && SX) sxOpen(SX.sid, ymShift(SX.ym, Number(v)));
});

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
  const tiles = [[`${st.actual}/${st.req}`, '上课（节）'], [String(hrs), '上课时长（小时）'], [String(st.leave), '请假（次）'], [st.fbN ? `${st.hwOk}%` : '—', '作业完成']];
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
