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

/* ═════════════ 院校库（2026-11-23）：结构不变——上面搜索＋四个筛选，下面一个专业一张卡片、点开看各轮日期和全部资料；只换样子 ═════════════ */
function v2Schools(){
  const acts = `<a class="btn sm" href="院校库导入模板.xlsx" download>下载 Excel 模板</a><label class="btn sm" for="prog-file">导入 Excel</label><input type="file" id="prog-file" accept=".xlsx,.csv" data-change="prog-import" hidden><button class="btn pri sm" data-act="prog-new">${v2Ic('plus')}添加专业</button>`;
  const help = `<details class="v2-help"><summary>怎么用 ›</summary><div class="small"><p>一个专业一张卡片，点开看全部资料和各轮入试日期。学生的「大学与出愿」可以直接从这里带入。导入 Excel 时，同年度、同学校、同学部学科的会更新，其他的新增。</p></div></details>`;
  if (!PROG){
    progLoad().then(() => { if (S.page === 'schools') render(); }).catch(e => toast(e.message, true));
    return v2Head('院校库', '', acts) + help + '<div class="v2-empty big">正在读取院校库…</div>';
  }
  const uniq = k => [...new Set(PROG.map(p => String(pv(p, k))).filter(Boolean))].sort();
  const sel = (k, label) => `<select id="pf-${k}" aria-label="${label}"><option value="">${label}：全部</option>${uniq(k).map(x => `<option ${x === PF[k] ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  return v2Head('院校库', `${v2Uniq(PROG)} 个专业`, acts) + help
    + `<div class="v2-scbar"><label class="v2-search big">${v2Ic('search')}<input type="search" id="pf-q" placeholder="搜学校、学部、学科、关键词；中文、日文、英文都行，例：早稻田 / waseda" value="${esc(PF.q)}" aria-label="搜院校库"></label>
      <div class="v2-scsel"><select id="pf-sort" aria-label="排序">${V2_SC_SORT.map(([v, l]) => `<option value="${v}" ${v === (PF.sort || '') ? 'selected' : ''}>排序：${l}</option>`).join('')}</select>${sel('year', '年度')}${sel('level', '类别')}${sel('field', '方向')}${sel('school_type', '学校类型')}</div></div>
    <div id="pg-list" class="v2-schools">${progList()}</div>`;
}

/* ───────── 院校库：排序＋按学校分块（2026-11-23） ─────────
   学校名（默认）：拼音 A→Z，有中文校名用中文校名排；地区：北→南（都道府县顺序）；国公立私立：国立→公立→私立；
   这三种都是一所学校一个块，块里放这所学校的专业。出愿截止近的：不分块，按下一轮出愿截止日从近到远平铺。 */
const V2_SC_SORT = [['', '学校名'], ['region', '地区'], ['type', '国公立私立'], ['due', '出愿截止近的']];
const V2_PREF = ['北海道','青森','岩手','宮城|宫城','秋田','山形','福島|福岛','茨城','栃木','群馬|群马','埼玉','千葉|千叶','東京|东京','神奈川','新潟','富山','石川','福井','山梨','長野|长野','岐阜','静岡|静冈','愛知|爱知','三重','滋賀|滋贺','京都','大阪','兵庫|兵库','奈良','和歌山','鳥取|鸟取','島根|岛根','岡山|冈山','広島|广岛','山口','徳島|德岛','香川','愛媛|爱媛','高知','福岡|福冈','佐賀|佐贺','長崎|长崎','熊本','大分','宮崎|宫崎','鹿児島|鹿儿岛','沖縄|冲绳'];
const v2PrefNo = r => { const s = String(r || ''); return V2_PREF.findIndex(x => x.split('|').some(n => s.includes(n))); };   // 「东京都」先碰上「东京」，不会被当成京都
const v2PrefLabel = i => i < 0 ? '' : V2_PREF[i].split('|').pop();
const V2_TYPE = ['国立', '公立', '私立'];
// 下一次出愿截止：所有轮次里今天以后最早的截止日；没公布日期的排在有日期的后面（9998），各轮都过了排最后（9999）
function v2ScDue(p){
  const rs = p.rounds || [], ds = rs.map(r => r.apply_end).filter(d => d && d >= TODAY).sort();
  if (ds.length) return ds[0];
  return !rs.length || rs.some(r => !r.apply_end && (r.apply_start || r.result_date || '9999') >= TODAY) ? '9998' : '9999';
}
const v2ScDueLabel = d => d === '9998' ? '日期还没公布' : d === '9999' ? '本年度各轮已截止' : (d.slice(0, 4) === TODAY.slice(0, 4) ? '' : d.slice(0, 4) + ' 年 ') + (+d.slice(5, 7)) + ' 月截止';
// 一所学校的国公私、地区：用整个院校库里这所学校最常见的写法（筛选掉几个专业，学校也不会换位置）
function v2ScInfo(school){
  const c = PROG._sc || (PROG._sc = {});
  if (c[school]) return c[school];
  const top = k => { const n = {}; PROG.forEach(p => { if (p.school === school && pv(p, k)) n[pv(p, k)] = (n[pv(p, k)] || 0) + 1; }); return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || ''; };
  const one = PROG.find(p => p.school === school) || {};
  return (c[school] = {type: top('school_type'), region: top('region'), alias: [pv(one, 'school_cn'), pv(one, 'school_en')].filter(x => x && x !== school)});
}
const v2Uniq = ps => new Set(ps.map(p => [p.school, p.level, p.faculty, p.dept].join('|'))).size;   // 同一个专业的不同年度只算一个
function v2ProgList(){
  if (!PROG.length) return `<div class="v2-empty big">院校库还是空的。点右上角「下载 Excel 模板」，填好后「导入 Excel」；也可以「添加专业」一个个录。</div>`;
  const list = progFiltered();
  if (!list.length) return '<div class="v2-empty big">没有符合条件的专业</div>';
  const mode = PF.sort || '';
  if (mode === 'due'){   // 不分学校，按截止日平铺；按月份分小标题
    const xs = list.slice().sort((a, b) => v2ScDue(a).localeCompare(v2ScDue(b)) || progCmpAll(a, b));
    let last = null, out = `<div class="muted xs">共 ${list.length} 个专业 · 按下一次出愿截止日，从近到远</div>`;
    xs.forEach(p => { const l = v2ScDueLabel(v2ScDue(p)); if (l !== last){ out += `<div class="v2-scsec">${esc(l)}</div>`; last = l; } out += progCard(p); });
    return out;
  }
  // 一所学校一个块
  const by = new Map(); list.slice().sort(progCmpAll).forEach(p => { if (!by.has(p.school)) by.set(p.school, []); by.get(p.school).push(p); });
  const blocks = [...by.entries()].map(([school, ps]) => ({school, ps, ...v2ScInfo(school)}));
  const sec = b => mode === 'region' ? v2PrefNo(b.region) : mode === 'type' ? V2_TYPE.indexOf(b.type) : 0;
  if (mode) blocks.sort((a, b) => { const x = sec(a), y = sec(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });   // 稳定排序：同一地区 / 类型里还是学校名顺序
  const secName = b => mode === 'region' ? (v2PrefLabel(v2PrefNo(b.region)) || (b.region ? '其他地区' : '没填地区')) : mode === 'type' ? (V2_TYPE.includes(b.type) ? b.type : '没填学校类型') : '';
  const q = (PF.q || '').trim(), open = S.v2scOpen || {};
  const isOpen = b => q ? true : (open[b.school] ?? S.v2scAll ?? blocks.length <= 3);   // 搜索时全部展开；学校不多时也展开
  let last = null, out = `<div class="row v2-sccount"><span class="muted xs">共 ${v2Uniq(list)} 个专业 · ${blocks.length} 所学校</span>${q || blocks.length < 2 ? '' : `<span class="row" style="margin-left:auto"><button class="btn xs" data-act="v2-sc-all" data-v="1">全部展开</button><button class="btn xs" data-act="v2-sc-all" data-v="0">全部收起</button></span>`}</div>`;
  blocks.forEach(b => {
    const s = secName(b);
    if (mode && s !== last){ out += `<div class="v2-scsec">${esc(s)} <span class="muted xs">${blocks.filter(x => secName(x) === s).length} 所</span></div>`; last = s; }
    const multiLv = new Set(b.ps.map(p => p.level)).size > 1, lvGrp = lv => b.ps.some(p => p.level === lv && pv(p, 'school_group'));
    const label = p => [multiLv ? p.level : '', pv(p, 'school_group') || (lvGrp(p.level) ? '未分类' : '')].filter(Boolean).join(' · ');
    const due = b.ps.map(v2ScDue).filter(d => d < '9998').sort()[0], u = v2Uniq(b.ps);
    let inner = '', gl = null;
    b.ps.forEach(p => { const l = label(p); if (l && l !== gl){ inner += `<div class="v2-scgrp">${esc(l)} <span class="muted xs">${v2Uniq(b.ps.filter(x => label(x) === l))}</span></div>`; } gl = l; inner += progCard(p, {inSchool: true}); });
    out += `<details class="v2-scblk" data-s="${esc(b.school)}" ${isOpen(b) ? 'open' : ''}><summary class="v2-schd"><span class="v2-scarr">›</span><b class="pg-school">${esc(b.school)}</b>${b.alias.length ? `<span class="muted small">${esc(b.alias.join(' / '))}</span>` : ''}
      ${b.type ? `<span class="tag mute">${esc(b.type)}</span>` : ''}${b.region ? `<span class="tag mute">${esc(b.region)}</span>` : ''}
      <span class="muted xs v2-scn">${u} 个专业${b.ps.length > u ? `（${b.ps.length} 条，含不同年度）` : ''}${due ? ` · 最近截止 ${dS(due)}` : ''}</span></summary>
      <div class="v2-scin">${inner}</div></details>`;
  });
  return out;
}
const v2ScRedraw = () => { const box = document.getElementById('pg-list'); if (box) { box.innerHTML = progList(); labelTables(); } };
document.addEventListener('change', e => { if (e.target.id === 'pf-sort'){ PF.sort = e.target.value; v2ScRedraw(); } });
// 学校块：自己点开 / 收起的记住（筛选、换排序以后还是那样）；「全部展开 / 全部收起」
document.addEventListener('click', e => {
  const s = e.target.closest('.v2-scblk > summary'); if (s){ (S.v2scOpen ||= {})[s.parentElement.dataset.s] = !s.parentElement.open; return; }
  const a = e.target.closest('[data-act="v2-sc-all"]'); if (a){ S.v2scAll = a.dataset.v === '1'; S.v2scOpen = {}; v2ScRedraw(); }
});

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
