/* ══════════════════════════════════════════════════════════════
   月学习计划：「自动整理」和「AI 生成」
   · 自动整理（不花钱，马上出）：把这门课这个月每节课的「本节内容」
     （上完的课没写本节内容的，用课后反馈里的「本节授课内容」）按主题归好，排成一段草稿
   · AI 生成：同样的材料交给 AI 写成一段学习计划（PLAN_AI 打开后才显示按钮）
   · 两种都先出预览，老师点「填进去」才放进输入框，最后还要点「保存计划」
   ══════════════════════════════════════════════════════════════ */
const PLAN_AI = true;   // AI 生成（2026-10-25 接通：Supabase 小程序 plan-draft + API 额度）

// 这门课这个月每节课的内容（按日期），没写的记下几节
function planLessons(cid, ym){
  const ls = DB.lessons.filter(l => l.course_id === cid && l.date.startsWith(ym) && l.status !== 'cancelled' && l.status !== 'leave')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return ls.map(l => { const f = fbOf(l); return {l, text: (l.topic || (f && f.content) || '').trim()}; });
}
// 主题：「人体：头像与三庭五眼」→ 主题「人体」、细项「头像与三庭五眼」；没有冒号的整句当一个主题
function planAuto(cid, ym){
  const items = planLessons(cid, ym), m = +ym.slice(5);
  if (!items.length) return {err: `${m} 月这门课还没有排课，排好课、写上「本节内容」后再来整理。`};
  const withText = items.filter(x => x.text), blank = items.length - withText.length;
  if (!withText.length) return {err: `${m} 月的 ${items.length} 节课都还没写「本节内容」，写上以后再来整理。`};
  const groups = [], byKey = {};
  withText.forEach(({text}) => {
    const one = text.split(/\n/)[0].slice(0, 60), mt = one.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
    const key = mt ? mt[1].trim() : one, sub = mt ? mt[2].trim() : '';
    if (!byKey[key]) { byKey[key] = {key, subs: []}; groups.push(byKey[key]); }
    if (sub && !byKey[key].subs.includes(sub)) byKey[key].subs.push(sub);
  });
  const kinds = {}; items.forEach(({l}) => { if (l.kind) kinds[l.kind] = (kinds[l.kind] || 0) + 1; });
  const kindTxt = Object.entries(kinds).map(([k, n]) => `${k} ${n} 节`).join('、');
  const nums = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫';
  const lines = groups.map((g, i) => `${nums[i] || (i + 1) + '.'} ${g.key}${g.subs.length ? `：${g.subs.join('、')}` : ''}`);
  return {text: `本月共 ${items.length} 节课${kindTxt ? `（${kindTxt}）` : ''}，按顺序学习：\n${lines.join('\n')}${blank ? `\n（另有 ${blank} 节还没写本节内容）` : ''}`};
}

// 输入框下面的小工具条
const mpTools = (ym, cid) => `<div class="mp-tools" id="mpt-${ym}-${cid}"><span class="row"><button class="btn sm" data-act="mp-auto" data-v="${ym}|${cid}">自动整理</button>${PLAN_AI ? `<button class="btn sm" data-act="mp-ai" data-v="${ym}|${cid}">AI 生成</button>` : ''}<span class="muted xs">按这个月每节课的内容生成一段草稿，看过再填进去</span></span><div class="mp-prev" hidden></div></div>`;
function mpPreview(ym, cid, text, label){
  const box = document.querySelector(`#mpt-${ym}-${cid} .mp-prev`), ta = document.getElementById(`mp-${ym}-${cid}`); if (!box) return;
  box.hidden = false; box.dataset.text = text;
  box.innerHTML = `<div class="muted xs">${label}，看一下，合适就填进去，填进去以后还可以改：</div><div class="mp-draft">${esc(text)}</div>
    <div class="row"><button class="btn pri sm" data-act="mp-fill" data-v="${ym}|${cid}|set">${ta && ta.value.trim() ? '替换框里的内容' : '填进去'}</button>${ta && ta.value.trim() ? `<button class="btn sm" data-act="mp-fill" data-v="${ym}|${cid}|add">加在后面</button>` : ''}<button class="btn sm" data-act="mp-fill" data-v="${ym}|${cid}|no">不要</button></div>`;
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act; if (!['mp-auto', 'mp-ai', 'mp-fill'].includes(k)) return;
  const [ym, cid, how] = a.dataset.v.split('|');
  if (k === 'mp-auto') { const r = planAuto(cid, ym); if (r.err) toast(r.err, true); else mpPreview(ym, cid, r.text, '自动整理好的草稿'); }
  if (k === 'mp-ai') {
    const items = planLessons(cid, ym).filter(x => x.text);
    if (!items.length) { toast('这个月的课还没写「本节内容」，AI 没有材料可写', true); return; }
    a.disabled = true; const old = a.textContent; a.textContent = 'AI 正在写…';
    try { const r = await planAI(cid, ym); mpPreview(ym, cid, r, 'AI 写好的草稿'); }
    catch(err) { toast('AI 没写出来：' + err.message, true); }
    finally { a.disabled = false; a.textContent = old; }
  }
  if (k === 'mp-fill') {
    const box = document.querySelector(`#mpt-${ym}-${cid} .mp-prev`), ta = document.getElementById(`mp-${ym}-${cid}`);
    if (how !== 'no' && ta) { ta.value = how === 'add' ? `${ta.value.trim()}\n${box.dataset.text}` : box.dataset.text; ta.focus(); toast('已填进去，确认没问题再点「保存计划」'); }
    if (box) { box.hidden = true; box.innerHTML = ''; }
  }
});

// AI 生成：交给 Supabase 上的小程序 plan-draft（它会先用链接核对身份，再去问 Claude）
async function planAI(cid, ym){
  let r;
  try {
    r = await fetch(`${SB_URL}/functions/v1/plan-draft`, {method: 'POST', headers: {'Content-Type': 'application/json', apikey: SB_KEY},
      body: JSON.stringify({k: KEY, cid, ym})});
  } catch(e) { throw new Error('网络不太稳定，没连上，请稍后再试'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.text) throw new Error((j.error || '请稍后再试').replace('AI 代写', 'AI 生成'));   // 数据库的次数上限提示里还写着「AI 代写」
  return j.text;
}

/* ───────── 每月给家长的反馈（月度回访）：AI 生成（数据库第 36 步 + 小程序 plan-draft 的 review）─────────
   读这个月的课、老师反馈、作业、成绩、计划、学生自评和作业 / 作品图片，按四栏写草稿填进表里，教务看过改过再保存 */
const rvAiBox = (sid, ym) => PLAN_AI && isAdmin() ? `<div class="rv-ai"><button class="btn sm" data-act="rv-ai" data-v="${sid}|${ym}">AI 生成</button>
  <span class="muted xs">AI 会读这个月老师写的反馈、作业完成情况、成绩、学生上传的作业 / 作品图片，写一份草稿填进下面四个框；看过改过再保存</span></div>` : '';
async function reviewAI(sid, ym){
  let r;
  try {
    r = await fetch(`${SB_URL}/functions/v1/plan-draft`, {method: 'POST', headers: {'Content-Type': 'application/json', apikey: SB_KEY},
      body: JSON.stringify({k: KEY, kind: 'review', sid, ym})});
  } catch(e) { throw new Error('网络不太稳定，没连上，请稍后再试'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.review) throw new Error((j.error || '请稍后再试').replace('AI 代写', 'AI 生成'));
  return j;
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act="rv-ai"]'); if (!a) return;
  const [sid, ym] = a.dataset.v.split('|'), ids = {content: 'rv-content', teacher_eval: 'rv-teacher', conclusion: 'rv-concl', next_focus: 'rv-next'};
  const has = ['rv-teacher', 'rv-concl', 'rv-next'].some(id => (document.getElementById(id)?.value || '').trim());
  if (has && !confirm('框里已经有内容了，用 AI 写的草稿替换吗？（替换后不保存的话，原来的内容不会丢）')) return;
  a.disabled = true; const old = a.textContent; a.textContent = 'AI 正在看材料、写草稿…（大约半分钟）';
  try {
    const j = await reviewAI(sid, ym);
    Object.entries(ids).forEach(([k, id]) => { const el = document.getElementById(id); if (el && j.review[k]) { el.value = j.review[k]; el.style.height = 'auto'; el.style.height = el.scrollHeight + 4 + 'px'; } });   // 框跟着内容变高，方便通读
    toast(`AI 草稿填好了${j.images ? `（看了 ${j.images} 张作业图片）` : ''}，看过改过再点「保存」`);
  } catch(err) { toast('AI 没写出来：' + err.message, true); }
  finally { a.disabled = false; a.textContent = old; }
});
