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
  const W = 1000, P = 36, CW = (W - P * 2) / 7, CH = 46, GAP = 6, DN = 32, HEAD = 128, WK = 40, FOOT = 70;
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
  g.textAlign = 'left'; g.fillStyle = SX_C.ink; g.font = font(30, true); g.fillText(`${s.name}　${y}年${m}月课表`, P, 62);
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
        g.fillStyle = SX_C.ink; g.font = font(13, true); g.fillText(`${l.start}–${l.end}`, cx + 10, cy + 19);
        if (l.makeup) { g.fillStyle = SX_C.seal; g.font = font(11, true); g.textAlign = 'right'; g.fillText('补', cx + cw - 6, cy + 18); g.textAlign = 'left'; }
        const who = tea(co.teacher_id).name || '', avail = cw - 16;
        g.font = font(12); const ww = g.measureText(who).width;
        let what = co.subject + (l.kind ? '·' + l.kind : '');
        g.font = font(12, true); if (g.measureText(what).width + ww + 6 > avail) what = co.subject;
        what = sxFit(g, what, Math.max(30, avail - ww - 6));
        g.fillStyle = SX_C[sl]; g.fillText(what, cx + 10, cy + 37);
        g.fillStyle = SX_C.muted; g.font = font(12); g.textAlign = 'right'; g.fillText(sxFit(g, who, Math.max(0, avail - g.measureText(what).width - 6)), cx + cw - 6, cy + 37); g.textAlign = 'left';
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
