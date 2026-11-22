/* ══════════════════════════════════════════════════════════════
   新版面：链接与备份、改动记录（2026-11-23）
   · 用户：以后 100 个学生，要找某个学生的家长得翻很久——链接要「好找人」，不用三列
     → 最上面一个搜索框（输入名字马上筛，不管在哪个分类）；学生和家长放同一行（一个学生一行，左学生、右家长）；
       老师、教务一人一行；每条链接只露「复制链接」和最近打开，其余收进「更多 ▾」
   · 用户：改动记录结构不要改，还是一条一条按时间排（新的在上、按天分），只换样子；上面加搜索栏，能搜某个老师、学生相关的
   · 数据备份、AI 写法要求：放在新版框里，里面还是原来的
   · 按钮、保存、权限全部沿用原来的（app.js、log.js、extras.js、owner.js）
   ══════════════════════════════════════════════════════════════ */

/* ═════════════ 链接与备份 ═════════════ */
function v2Sys(){
  const t = ['backup', 'ai'].includes(S.sysTab) ? S.sysTab : 'links';
  const seg = `<div class="seg" role="group" aria-label="分页">${[['links', '链接与权限'], ['backup', '数据备份'], ['ai', 'AI 写法要求']].map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-act="sys-tab" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (t === 'backup') return v2Head('链接与备份', '', seg) + v2Legacy(pgBackup().replace(/^\s*<div class="ph"><h2>[^<]*<\/h2><\/div>/, ''), true);
  if (t === 'ai') return v2Head('链接与备份', '', seg) + v2Legacy(subPage(pgAiRules()));
  return v2Head('链接与备份', '', seg) + v2Links();
}
const v2RoleName = p => p.role === 'admin' ? (p.level === 'top' ? '教务 · 管理' : '教务 · 普通') : ({teacher: '任课老师', student: '学生', parent: '家长'}[p.role] || '');
// 最近打开：一行小字；很久没开、可能被转发的标出来
function v2Seen(p){
  if (!p.last_seen) return '<span class="muted">还没打开过</span>';
  const t = bjAt(p.last_seen), n = dBetween(t.slice(0, 10), TODAY);
  const w = n <= 0 ? `今天 ${t.slice(11)}` : n === 1 ? `昨天 ${t.slice(11)}` : n < 30 ? `${n} 天前` : md(t.slice(0, 10));
  const many = ['student', 'parent'].includes(p.role) && (p.devices || []).length >= 3;
  return `<span class="muted">${w} 打开过</span>${n >= 14 ? ' <span class="tag warn">很久没打开</span>' : ''}${many ? ' <span class="tag warn">设备较多，可能被转发</span>' : ''}`;
}
// 一条链接：名字、复制、最近打开、「更多 ▾」（打开看看、换新链接、停用 / 恢复、删除、清除登录记录）
function v2LinkCell(p, label){
  if (!p) return '<span class="muted xs">没有链接</span>';
  const me = p.id === ME().id;
  const more = [p.active && !me ? `<button class="btn sm" data-act="peek" data-v="${p.id}" title="用这个人的身份看他的页面：只能看，不留登录记录">打开看看</button>` : '',
    `<button class="btn sm" data-act="link-regen" data-v="${p.id}">换一条新链接</button>`, ownerLinkToggle(p),
    me ? '' : `<button class="btn sm ${p.active ? 'danger' : ''}" data-act="link-toggle" data-v="${p.id}">${p.active ? '停用' : '恢复'}</button>`,
    p.last_seen || (p.devices || []).length ? `<button class="btn sm" data-act="seen-clear" data-v="${p.id}">清除登录记录</button>` : '',
    me ? '' : `<button class="btn sm danger" data-act="link-del" data-v="${p.id}">删除</button>`].filter(Boolean).join('');
  const dev = (p.devices || []).length ? `<div class="muted xs">${p.devices.map(esc).join('、')}</div>` : '';
  return `<div class="v2-lk ${p.active ? '' : 'off'}"><div class="v2-lkh">${label ? `<b>${esc(label)}</b>` : ''}${p.active ? '' : '<span class="tag seal">已停用</span>'}${ownerLinkTag(p)}</div>
    <div class="v2-lkb"><button class="btn ${p.active ? 'pri' : ''} sm" data-act="copy-link" data-v="${p.key}" ${p.active ? '' : 'disabled'}>复制链接</button>
      <details class="v2-more"><summary class="btn sm">更多 ▾</summary><div class="v2-pop">${more}${dev}</div></details></div>
    <div class="xs">${v2Seen(p)}</div></div>`;
}
function v2Links(){
  const P = (DB.people || []).filter(p => !ownerShadow(p));
  const tab = ['sp', 'teacher', 'admin', 'off'].includes(S.v2lnTab) ? S.v2lnTab : 'sp';
  const scopeTxt = p => p.level === 'top' ? '全部学生' : (p.scope || []).map(id => stu(id).name).join('、') || '（还没分配学生）';
  // 学生和家长：一个学生一行（停用的链接不在这里，在「已停用」里）
  const stuRows = DB.students.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')) || pyCmp(a.name, b.name)).map(s => {
    const ps = P.filter(p => p.student_id === s.id && p.active), st = ps.filter(p => p.role === 'student'), pa = ps.filter(p => p.role === 'parent');
    if (!st.length && !pa.length) return '';
    const q = [s.name, s.code, s.direction || s.track, ...pa.map(p => p.name), '家长'].filter(Boolean).join(' ');
    return `<div class="v2-lr" data-grp="sp" data-q="${esc(q)}"><div class="v2-lrn">${v2Ava(s.name)}<span><b>${esc(s.name)}</b><small>${esc([s.code, s.direction || s.track].filter(Boolean).join(' · '))}${s.active === false ? ' · 停课' : ''}</small></span></div>
      <div class="v2-lrc">${st.length ? st.map(p => v2LinkCell(p, '学生')).join('') : v2LinkCell(null)}</div>
      <div class="v2-lrc">${pa.length ? pa.map((p, i) => v2LinkCell(p, pa.length > 1 ? `家长 ${i + 1}` : '家长')).join('') : '<div class="v2-lk"><div class="v2-lkh"><b>家长</b></div><span class="muted xs">没有家长链接</span></div>'}</div></div>`; }).join('');
  const one = (p, sub, grp) => `<div class="v2-lr" data-grp="${grp}" data-q="${esc([p.name, v2RoleName(p), sub.replace(/<[^>]+>/g, '')].join(' '))}"><div class="v2-lrn">${v2Ava(p.name)}<span><b>${esc(p.name)}${p.id === ME().id ? ' <span class="tag gold">我</span>' : ''}</b><small>${esc(v2RoleName(p))}</small></span></div>
    <div class="v2-lrc">${v2LinkCell(p, '')}</div><div class="v2-lrc v2-lrs"><span class="muted xs">能看到</span><div class="small">${sub}</div></div></div>`;
  const teaRows = P.filter(p => p.role === 'teacher' && p.active).sort((a, b) => pyCmp(a.name, b.name))
    .map(p => one(p, esc([...new Set(DB.courses.filter(c => c.teacher_id === p.teacher_id).map(c => stu(c.student_id).name))].join('、') || '还没有学生'), 'teacher')).join('');
  const admRows = P.filter(p => p.role === 'admin' && p.active).sort((a, b) => (b.level === 'top') - (a.level === 'top') || pyCmp(a.name, b.name))
    .map(p => one(p, `${esc(scopeTxt(p))}${p.level !== 'top' ? ` <button class="btn sm" data-act="scope-edit" data-v="${p.id}">改负责的学生</button>` : ''}`, 'admin')).join('');
  const offRows = P.filter(p => !p.active).sort((a, b) => pyCmp(a.name, b.name))
    .map(p => one(p, esc(p.role === 'parent' || p.role === 'student' ? `${stu(p.student_id).name}${p.role === 'parent' ? ' 的家长' : ''}` : v2RoleName(p)), 'off')).join('');
  const n = {sp: DB.students.filter(s => P.some(p => p.student_id === s.id && p.active)).length, teacher: P.filter(p => p.role === 'teacher' && p.active).length, admin: P.filter(p => p.role === 'admin' && p.active).length, off: P.filter(p => !p.active).length};
  const tabs = [['sp', '学生和家长'], ['teacher', '老师'], ['admin', '教务'], ...(n.off ? [['off', '已停用']] : [])];
  const help = `<details class="v2-help"><summary>怎么用 ›</summary><div class="small">
    <p>每个人一条专属链接，打开就能用。点「复制链接」发到对方微信。<b>链接被转发、老师离职、学生毕业</b>时，在「更多 ▾」里点「换一条新链接」或「停用」，旧链接马上失效。新增老师、学生时会自动生成链接。</p>
    <p>想看学生、老师、家长那边是什么样子，在「更多 ▾」里点「打开看看」：新开一页、只能看，<b>不留登录记录</b>。直接点开别人的链接还是会记成「最近打开」，看完可以点「清除登录记录」。</p></div></details>`;
  return `<div class="v2-lsearch"><label class="v2-search big">${v2Ic('search')}<input type="search" data-v2ln placeholder="输入名字找人：学生、家长（输学生名字）、老师、教务" value="${esc(S.v2lnQ || '')}" aria-label="找人"></label>
      <span class="v2-acts"><button class="btn sm" data-act="seen-clear-all">清除全部登录记录</button><button class="btn pri sm" data-act="link-new">${v2Ic('plus')}新建链接</button></span></div>
    <div class="v2-chips v2-lntabs">${tabs.map(([k, t]) => `<button type="button" class="v2-chip ${tab === k ? 'on' : ''}" data-act="v2-lntab" data-v="${k}">${t} <b>${n[k]}</b></button>`).join('')}<span class="v2-lncount muted xs"></span></div>
    ${help}
    <div class="v2-lbox" data-tab="${tab}">
      <section class="v2-lsec" data-grp="sp"><div class="v2-lsh"><b>学生和家长</b><span class="muted xs">一个学生一行：左边学生自己的链接，右边家长的链接</span></div>${stuRows || '<div class="v2-empty">还没有学生链接</div>'}</section>
      <section class="v2-lsec" data-grp="teacher"><div class="v2-lsh"><b>老师</b></div>${teaRows || '<div class="v2-empty">还没有老师链接</div>'}</section>
      <section class="v2-lsec" data-grp="admin"><div class="v2-lsh"><b>教务</b></div>${admRows}</section>
      ${n.off ? `<section class="v2-lsec" data-grp="off"><div class="v2-lsh"><b>已停用</b><span class="muted xs">在「更多 ▾」里点「恢复」就能再用</span></div>${offRows}</section>` : ''}
      <div class="v2-empty v2-lnone" hidden>没有找到。学生的家长请输学生的名字。</div></div>`;
}
// 找人：没输字时只看当前分类；输了字就在全部分类里找（找某个学生的家长，输学生名字就行）
function v2LnFilter(){
  const box = document.querySelector('.v2-lbox'); if (!box) return;
  const q = (S.v2lnQ || '').trim().toLowerCase(), tab = box.dataset.tab;
  let n = 0;
  box.querySelectorAll('.v2-lsec').forEach(sec => { let k = 0;
    sec.querySelectorAll('.v2-lr').forEach(r => { const hit = q ? (r.dataset.q || '').toLowerCase().includes(q) && (sec.dataset.grp !== 'off' || tab === 'off' || true) : sec.dataset.grp === tab; r.hidden = !hit; if (hit) k++; });
    sec.hidden = q ? !k : sec.dataset.grp !== tab; n += k; });
  box.querySelector('.v2-lnone').hidden = !(q && !n);
  const c = document.querySelector('.v2-lncount'); if (c) c.textContent = q ? `找到 ${n} 行` : '';
  document.querySelectorAll('.v2-lntabs .v2-chip').forEach(b => b.classList.toggle('dim', !!q));
}

/* ═════════════ 改动记录：和原来一样一条一条按时间排，只换样子；上面加搜索栏 ═════════════ */
function v2Log(){
  if (LOGX.sid && !DB.students.some(s => s.id === LOGX.sid)) { LOGX.sid = ''; LOGX.rows = []; LOGX.more = false; LOGX.at = 0; setTimeout(() => logFetch(false)); }
  else if (!LOGX.busy && !LOGX.at) setTimeout(() => logFetch(false));
  const cat = LOG_CATS.find(c => c[0] === LOGX.cat) || LOG_CATS[0];
  const inView = r => !isOwner() || S.book === 'all' || (S.book === 'K' ? !r.priv : r.priv);
  const seen = LOGX.rows.filter(inView);
  const whoKey = r => r.who + (r.who_id && r.who_id === ME().id ? '（我）' : '');
  const whos = [...new Set(seen.map(whoKey))]; if (LOGX.who && !whos.includes(LOGX.who)) whos.push(LOGX.who);
  const rows = seen.filter(r => (!LOGX.who || whoKey(r) === LOGX.who) && (!cat[2] || cat[2].includes(r.tbl)));
  const days = [];
  for (const r of rows) {
    const d = logBJ(r.at).slice(0, 10);
    let day = days[days.length - 1]; if (!day || day.d !== d) { day = {d, groups: new Map()}; days.push(day); }
    if (!day.groups.has(r.tx)) day.groups.set(r.tx, []); day.groups.get(r.tx).push(r);
  }
  const dayName = d => { const n = dBetween(d, TODAY); return n === 0 ? '今天' : n === 1 ? '昨天' : `${logD(d)} 周${WD[pd(d).getDay()]}`; };
  const stus = DB.students.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')) || a.name.localeCompare(b.name));
  const qText = g => { const h = logGroup(g); return h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') + ' ' + g.map(r => r.who + ' ' + (r.ctx || '')).join(' '); };
  const body = LOGX.err ? `<div class="v2-empty big">没读到改动记录：${esc(LOGX.err)}</div>`
    : !LOGX.at || (LOGX.busy && !LOGX.rows.length) ? '<div class="v2-empty big">正在读取…</div>'
    : !rows.length ? `<div class="v2-empty big">${LOGX.more ? `已经读出来的 ${LOGX.rows.length} 条里没有符合的，点下面「再往前看」接着找` : seen.length ? '这样筛没有记录，换个条件看看' : '还没有改动记录'}</div>`
    : days.map(day => `<div class="v2-lgday" data-day="${day.d}"><div class="lg-day">${dayName(day.d)}</div>${[...day.groups.values()].map(g => `<div class="v2-lgw" data-q="${esc(qText(g))}">${logGroup(g)}</div>`).join('')}</div>`).join('');
  const bar = `<div class="v2-lgbar"><label class="v2-search big">${v2Ic('search')}<input type="search" data-v2lg placeholder="搜老师、学生、改了什么，例：林知夏、苏晚晴、请假" value="${esc(S.v2lgQ || '')}" aria-label="搜改动记录"></label>
    <div class="v2-lgsel"><select id="lg-who" aria-label="谁改的"><option value="">所有人改的</option>${whos.map(w => `<option value="${esc(w)}" ${w === LOGX.who ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select>
      <select id="lg-sid" aria-label="学生"><option value="">所有学生</option>${stus.map(s => `<option value="${s.id}" ${s.id === LOGX.sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <button class="btn sm" data-act="lg-reload" ${LOGX.busy ? 'disabled' : ''}>刷新</button></div>
    <div class="v2-chips">${LOG_CATS.map(([k, t]) => `<button type="button" class="v2-chip ${LOGX.cat === k ? 'on' : ''}" data-act="lg-cat" data-v="${k}" aria-pressed="${LOGX.cat === k}">${t}</button>`).join('')}<span class="v2-lgcount muted xs"></span></div></div>`;
  return v2Head('改动记录', '谁在什么时候新增、修改、删除了什么')
    + `<details class="v2-help"><summary>记了什么 ›</summary><div class="small"><p>谁（用哪条链接）在什么时候<b>新增、修改、删除</b>了什么，都会自动记在这里，同一次保存的放在一起。打开页面、切换视图、学生记单词不算改动。从 2026 年 11 月 19 日开始记，保留一年。搜索只在已经读出来的记录里找，找不到可以点最下面「再往前看」。</p></div></details>`
    + bar + `<div class="v2-lglist">${body}<div class="v2-empty big v2-lgnone" hidden>已经读出来的记录里没有找到。可以点下面「再往前看」，或者在上面选学生。</div></div>`
    + (LOGX.more ? `<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="lg-more" ${LOGX.busy ? 'disabled' : ''}>${LOGX.busy ? '正在读取…' : '再往前看'}</button></div>` : '');
}
function v2LgFilter(){
  const list = document.querySelector('.v2-lglist'); if (!list) return;
  const q = (S.v2lgQ || '').trim().toLowerCase(); let n = 0;
  list.querySelectorAll('.v2-lgday').forEach(d => { let k = 0; d.querySelectorAll('.v2-lgw').forEach(g => { const hit = !q || (g.dataset.q || '').toLowerCase().includes(q); g.hidden = !hit; if (hit) k++; }); d.hidden = !k; n += k; });
  const none = list.querySelector('.v2-lgnone'); if (none) none.hidden = !(q && !n && list.querySelector('.v2-lgday')) || !!v2LgAuto.run;
  const c = document.querySelector('.v2-lgcount'); if (c) c.textContent = q ? `找到 ${n} 次保存${v2LgAuto.run ? '，正在往前找…' : ''}` : '';
  return n;
}
// 搜的时候自动往前读：已经读出来的不够（比如刚加了很多学生，老师的记录在更早），就接着往前读，找到 30 次保存或者读满 12 批（约 3600 条）为止
async function v2LgAuto(){
  if (v2LgAuto.run) return; v2LgAuto.run = true;
  try { for (let i = 0; i < 12 && (S.v2lgQ || '').trim() && LOGX.more && S.page === 'log'; i++) { if ((v2LgFilter() || 0) >= 30) break; await logFetch(true); } }
  catch(e) {}
  finally { v2LgAuto.run = false; v2LgFilter(); }
}

/* ───────── 搜索框、按钮 ───────── */
document.addEventListener('input', e => {
  const a = e.target.closest?.('[data-v2ln]'); if (a) { S.v2lnQ = a.value; v2LnFilter(); S.dirtyMain = false; return; }
  const b = e.target.closest?.('[data-v2lg]'); if (b) { S.v2lgQ = b.value; v2LgFilter(); S.dirtyMain = false; if (b.value.trim() && !e.isComposing) setTimeout(v2LgAuto, 400); }
});
document.addEventListener('compositionend', e => { if (e.target.closest?.('[data-v2lg]')) setTimeout(v2LgAuto, 400); });
// 往前读完会重画页面：搜索框原来有光标的话，放回去，接着打字
document.addEventListener('focusin', e => { if (e.target.closest?.('[data-v2lg]')) S.v2lgFocus = true; });
document.addEventListener('focusout', e => { if (e.target.closest?.('[data-v2lg]')) setTimeout(() => { if (!document.activeElement?.closest?.('[data-v2lg]')) S.v2lgFocus = false; }, 0); });
// 画完页面以后按搜索框里的字筛一遍
const v2AfterD = v2After;
v2After = function(){ v2AfterD(); v2LnFilter(); v2LgFilter();
  const i = document.querySelector('[data-v2lg]'); if (i && S.v2lgFocus){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || V2.ver !== 'new' || !document.body.classList.contains('v2')) return;
  if (a.dataset.act === 'v2-lntab'){ S.v2lnTab = a.dataset.v; S.v2lnQ = ''; render(); }
  // 「更多 ▾」：点了里面的按钮或点到外面就收起来
  document.querySelectorAll('.v2-more[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.v2-pop .btn')) d.open = false; });
});
document.addEventListener('click', e => { if (!e.target.closest('[data-act]')) document.querySelectorAll('.v2-more[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
// 「换一条新链接」：先问一句（旧链接马上不能用）
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act="link-regen"]'); if (!a || V2.ver !== 'new' || !document.body.classList.contains('v2')) return;
  const p = (DB.people || []).find(x => x.id === a.dataset.v); if (!p) return;
  if (!confirm(`给「${p.name}」换一条新链接？\n旧链接马上打不开，要把新链接重新发给${p.id === ME().id ? '自己（这台设备会自动换成新链接）' : '他'}。`)) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
