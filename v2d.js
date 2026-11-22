/* ══════════════════════════════════════════════════════════════
   新版面：链接与备份、改动记录（2026-11-23，用户：「链接与备份是从上到下翻的一长条，用起来很不方便」）
   · 链接与权限：三列——中间是所有链接（按身份筛、能搜），点一个人，右边是他的链接和所有按钮
   · 改动记录：三列——中间一行一次保存（几点、谁、改了什么），按天分开；点一行，右边看详细
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
const V2_ROLES = [['admin', '教务'], ['teacher', '老师'], ['student', '学生'], ['parent', '家长']];
const v2RoleName = p => p.role === 'admin' ? (p.level === 'top' ? '教务 · 管理' : '教务 · 普通') : ({teacher: '任课老师', student: '学生', parent: '家长'}[p.role] || '');
// 最近打开：一行字（名单里用）
function v2Seen(p){
  if (!p.last_seen) return '还没打开过';
  const t = bjAt(p.last_seen), n = dBetween(t.slice(0, 10), TODAY);
  return n <= 0 ? `今天 ${t.slice(11)} 打开过` : n === 1 ? `昨天 ${t.slice(11)} 打开过` : n < 30 ? `${n} 天前打开过` : `${md(t.slice(0, 10))} 打开过`;
}
function v2Links(){
  const P = (DB.people || []).filter(p => !ownerShadow(p)), chip = S.v2chip.ln || 'all';
  const scopeTxt = p => p.role === 'admin' ? (p.level === 'top' ? '全部学生' : (p.scope || []).map(id => stu(id).name).join('、') || '（还没分配学生）')
    : p.role === 'teacher' ? '自己带的学生：' + ([...new Set(DB.courses.filter(c => c.teacher_id === p.teacher_id).map(c => stu(c.student_id).name))].join('、') || '—')
    : p.role === 'student' ? '自己的课表、作业、上课记录' : `${stu(p.student_id).name} 的出勤、审核过的反馈、课表`;
  const warn = p => { if (!p.last_seen) return null; const n = dBetween(bjAt(p.last_seen).slice(0, 10), TODAY);
    if (['student', 'parent'].includes(p.role) && (p.devices || []).length >= 3) return ['可能被转发', 'warn']; if (n >= 14) return ['很久没打开', 'warn']; return null; };
  const flag = p => p.id === ME().id ? ['我', 'blue'] : !p.active ? ['已停用', 'bad'] : warn(p) || (!p.last_seen ? ['没打开过', ''] : null);
  const order = r => V2_ROLES.findIndex(x => x[0] === r);
  const pick = {all: p => p.active, off: p => !p.active}[chip] || (p => p.active && p.role === chip);
  const list = P.filter(pick).sort((a, b) => order(a.role) - order(b.role) || (b.level === 'top') - (a.level === 'top') || pyCmp(a.name, b.name));
  let last = '';
  const items = list.map(p => { const g = (V2_ROLES.find(x => x[0] === p.role) || [])[1]; const it = {k: p.id, name: p.name, line: `${esc(v2RoleName(p))} · ${esc(v2Seen(p))}`, flag: flag(p), q: [p.name, v2RoleName(p), p.role === 'parent' ? stu(p.student_id).name : ''].join(' ')};
    if (chip === 'all' || chip === 'off'){ if (g !== last){ it.sep = g; last = g; } } return it; });
  const cur = v2Pick('ln', items);
  let detail = '';
  if (cur){
    const p = P.find(x => x.id === cur.k), me = p.id === ME().id;
    detail = `<div class="v2-card"><div class="v2-ph">${v2Ava(p.name, true)}<div class="v2-pt"><h2>${esc(p.name)}${me ? ' <span class="tag gold">我</span>' : ''}${ownerLinkTag(p)}</h2><p><span class="tag ${p.level === 'top' ? 'seal' : p.role === 'admin' ? 'gold' : 'mute'}">${esc(v2RoleName(p))}</span> ${p.active ? '<span class="tag ok">启用</span>' : '<span class="tag seal">已停用</span>'}</p></div></div>
      <div class="v2-grid">
        ${v2Box('链接', `<div class="small muted">每个人一条专属链接，打开就能用。复制以后发到对方微信。</div>
          <div class="row"><button class="btn pri sm" data-act="copy-link" data-v="${p.key}" ${p.active ? '' : 'disabled'}>复制链接</button>${!me && p.active ? `<button class="btn sm" data-act="peek" data-v="${p.id}" title="用这个人的身份看他的页面：只能看，不留登录记录">打开看看</button>` : ''}${ownerLinkToggle(p)}</div>`)}
        ${v2Box('能看到什么', `<div class="small">${esc(scopeTxt(p))}</div>${p.role === 'admin' && p.level !== 'top' ? `<div class="row"><button class="btn sm" data-act="scope-edit" data-v="${p.id}">改负责的学生</button></div>` : ''}`)}
        ${v2Box('最近打开', `<div class="small">${seenTxt(p)}</div>${p.last_seen || (p.devices || []).length ? `<div class="row"><button class="btn sm" data-act="seen-clear" data-v="${p.id}" title="清掉这条链接的最近打开时间和设备">清除登录记录</button></div>` : ''}`)}
        ${v2Box('换链接 / 停用', `<div class="small muted">链接被转发、老师离职、学生毕业时用。换新链接或停用以后，旧链接马上打不开。</div>
          <div class="row"><button class="btn sm" data-act="link-regen" data-v="${p.id}">换一条新链接</button>${me ? '' : `<button class="btn sm ${p.active ? 'danger' : ''}" data-act="link-toggle" data-v="${p.id}">${p.active ? '停用' : '恢复'}</button><button class="btn sm danger" data-act="link-del" data-v="${p.id}">删除</button>`}</div>`)}
      </div></div>`;
  }
  const n = f => P.filter(f).length;
  const chips = [['all', '全部', n(p => p.active)], ...V2_ROLES.map(([k, t]) => [k, t, n(p => p.active && p.role === k)]).filter(x => x[2]), ...(n(p => !p.active) ? [['off', '已停用', n(p => !p.active)]] : [])];
  const help = `<details class="v2-help"><summary>怎么用 ›</summary><div class="small">
    <p>每个人一条专属链接，打开就能用。点「复制链接」发到对方微信。<b>链接被转发、老师离职、学生毕业</b>时，点「换一条新链接」或「停用」，旧链接马上失效。新增老师、学生时会自动生成链接。</p>
    <p>想看学生、老师、家长那边是什么样子，点「打开看看」：新开一页、只能看，<b>不留登录记录</b>，这台电脑记住的也还是你自己的链接。直接点开别人的链接还是会记成「最近打开」，看完可以点「清除登录记录」。</p></div></details>`;
  return `<div class="v2-linkbar">${help}<span class="v2-acts"><button class="btn sm" data-act="seen-clear-all">清除全部登录记录</button><button class="btn pri sm" data-act="link-new">${v2Ic('plus')}新建链接</button></span></div>`
    + v2Tri({id: 'ln', label: '链接名单', items, sel: cur && cur.k, search: '查姓名…', chips, chip, count: `${items.length} 条链接`, empty: '这一类没有链接', detail});
}

/* ═════════════ 改动记录 ═════════════ */
function v2Log(){
  // 和原来一样：从菜单进来先读；切了视图、选的学生不在了就重读
  if (LOGX.sid && !DB.students.some(s => s.id === LOGX.sid)) { LOGX.sid = ''; LOGX.rows = []; LOGX.more = false; LOGX.at = 0; setTimeout(() => logFetch(false)); }
  else if (!LOGX.busy && !LOGX.at) setTimeout(() => logFetch(false));
  const cat = LOG_CATS.find(c => c[0] === LOGX.cat) || LOG_CATS[0];
  const inView = r => !isOwner() || S.book === 'all' || (S.book === 'K' ? !r.priv : r.priv);
  const seen = LOGX.rows.filter(inView);
  const whoKey = r => r.who + (r.who_id && r.who_id === ME().id ? '（我）' : '');
  const whos = [...new Set(seen.map(whoKey))]; if (LOGX.who && !whos.includes(LOGX.who)) whos.push(LOGX.who);
  const rows = seen.filter(r => (!LOGX.who || whoKey(r) === LOGX.who) && (!cat[2] || cat[2].includes(r.tbl)));
  // 一次保存＝一组（rows 是新的在前）
  const groups = []; const at = new Map();
  for (const r of rows) { const key = logBJ(r.at).slice(0, 10) + '|' + r.tx; if (!at.has(key)) { at.set(key, groups.length); groups.push([]); } groups[at.get(key)].push(r); }
  const dayName = d => { const n = dBetween(d, TODAY); return n === 0 ? '今天' : n === 1 ? '昨天' : `${logD(d)} 周${WD[pd(d).getDay()]}`; };
  const OPF = {I: ['新增', 'ok'], U: ['修改', 'blue'], D: ['删除', 'bad']};
  let lastDay = '';
  const items = groups.map(g => { const r0 = g[0], d = logBJ(r0.at).slice(0, 10), kinds = [...new Set(g.map(r => LOG_TBL[r.tbl] || r.tbl))];
    const ops = [...new Set(g.map(r => r.op))], clear = g.every(r => r.tbl === 'people' && r.new && r.new.seen_clear);
    const it = {k: d + '|' + r0.tx, ava: r0.who, name: `${r0.who}${r0.who_id && r0.who_id === ME().id ? '（我）' : ''}`,
      line: `${logBJ(r0.at).slice(11)} · ${clear ? '清除登录记录' : esc(kinds.slice(0, 2).join('、') + (kinds.length > 2 ? ' 等' : ''))}${g.length > 1 ? ` ${g.length} 条` : ''}${r0.ctx ? ' · ' + esc(r0.ctx) : ''}`,
      flag: clear ? ['清除', ''] : ops.length === 1 ? OPF[ops[0]] : ['多项', 'blue'], q: [r0.who, ...kinds, ...g.map(r => r.ctx || '')].join(' '), g};
    if (d !== lastDay){ it.sep = dayName(d); lastDay = d; } return it; });
  const cur = v2Pick('lg', items);
  const detail = cur ? `<div class="v2-card"><div class="v2-dh">${v2Ava(cur.g[0].who, true)}<div class="v2-pt"><h2>${esc(cur.name)}</h2><p>${dayName(logBJ(cur.g[0].at).slice(0, 10))} ${logBJ(cur.g[0].at).slice(11)} · ${esc(LOG_ROLE[cur.g[0].role] ?? '')} · 同一次保存的 ${cur.g.length} 条</p></div></div>
    <div class="v2-legacy">${logGroup(cur.g)}</div></div>` : '';
  const stus = DB.students.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')) || a.name.localeCompare(b.name));
  const top = `<div class="v2-lgf"><select id="lg-who" aria-label="谁改的"><option value="">所有人改的</option>${whos.map(w => `<option value="${esc(w)}" ${w === LOGX.who ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select>
    <select id="lg-sid" aria-label="学生"><option value="">所有学生</option>${stus.map(s => `<option value="${s.id}" ${s.id === LOGX.sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>`;
  const chips = LOG_CATS.map(([k, t]) => [k || 'all', t]);
  const more = LOGX.more ? `<button class="btn sm v2-bulk" data-act="lg-more" ${LOGX.busy ? 'disabled' : ''}>${LOGX.busy ? '正在读取…' : '再往前看'}</button>` : '';
  const empty = LOGX.err ? `没读到改动记录：${esc(LOGX.err)}` : !LOGX.at || (LOGX.busy && !LOGX.rows.length) ? '正在读取…'
    : LOGX.more ? `已经读出来的 ${LOGX.rows.length} 条里没有符合的，点「再往前看」接着找` : seen.length ? '这样筛没有记录，换个条件看看' : '还没有改动记录';
  return v2Head('改动记录', '谁在什么时候新增、修改、删除了什么', `<button class="btn sm" data-act="lg-reload" ${LOGX.busy ? 'disabled' : ''}>刷新</button>`)
    + `<details class="v2-help"><summary>记了什么 ›</summary><div class="small"><p>谁（用哪条链接）在什么时候<b>新增、修改、删除</b>了什么，都会自动记在这里，同一次保存的放在一起。打开页面、切换视图、学生记单词不算改动。从 2026 年 11 月 19 日开始记，保留一年。</p></div></details>`
    + v2Tri({id: 'lg', label: '改动', items, sel: cur && cur.k, search: '查人、学生、改了什么…', chips, chip: LOGX.cat || 'all', top, bulk: more,
      count: `${items.length} 次保存${LOGX.more ? '（还有更早的）' : ''}`, empty, detail, emptyDet: empty}).replace(/data-act="v2-chip" data-v="lg\|([^"]*)"/g, (m, k) => `data-act="lg-cat" data-v="${k === 'all' ? '' : k}"`);
}

/* ───────── 按钮 ───────── */
// 「换一条新链接」：先问一句（旧链接马上不能用）
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act="link-regen"]'); if (!a || V2.ver !== 'new' || !document.body.classList.contains('v2')) return;
  const p = (DB.people || []).find(x => x.id === a.dataset.v); if (!p) return;
  if (!confirm(`给「${p.name}」换一条新链接？\n旧链接马上打不开，要把新链接重新发给${p.id === ME().id ? '自己（这台设备会自动换成新链接）' : '他'}。`)) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
// 改动记录换了类别：回到第一条
document.addEventListener('click', e => { const a = e.target.closest('[data-act="lg-cat"]'); if (a && document.body.classList.contains('v2')) { S.v2idx.lg = 0; S.v2sel.lg = null; } }, true);
