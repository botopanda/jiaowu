/* ══════════════════════════════════════════════════════════════
   新版面（2026-11-22 第一批）：「课程册」＋「白底 · 一点蓝」＋ 三列逐级
   · 叠在原来的系统上：读数据、保存、弹窗、权限检查全部沿用原来的（app.js 等），这里只换「样子」
   · 默认看新版；顶上一条「这是新版 · 不习惯？切回旧版」，点「知道了」就不再出现
   · 每个人的选择跟着自己的链接存（数据库第 64 步）；数据库还没加第 64 步时只记在这台设备上
   · 第一批做好的页：
       教务 —— 学生档案、老师档案、待处理（三列）、课表与排课（老师 × 一周）
       老师 —— 我的学生、反馈批改（三列）、课表（一周）
       学生 —— 首页（按科目翻）、课表、作业（要交 / 等批改 / 批改好了）
       家长 —— 首页、课表
   · 还没重做的页：放在新版的框里，里面暂时还是原来的样子（下一批再换）
   · 手机上三列变两步：先名单，点进去看详情，「返回」回到原位置
   ══════════════════════════════════════════════════════════════ */

/* ───────── 新版 / 旧版 ───────── */
const V2 = {ver: null, seen: false, asked: false};
const V2_DEFAULT = 'new';
(function(){ const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'v2.css?v=' + encodeURIComponent(APP_VER || 'x'); document.head.appendChild(l); })();
const v2Key = () => { const m = ME(); return 'jw_ui:' + (m.id || `${m.role}:${m.student_id || m.teacher_id || m.name || ''}`); };
const V2_FORCE = (p => p === 'old' || p === 'new' ? p : '')(new URLSearchParams(location.search).get('ui'));   // 地址后面加 &ui=old / &ui=new：这一次按指定的版本打开（不存，测试、截图用）
function v2Init(){
  if (V2.ver) return;
  if (V2_FORCE){ V2.ver = V2_FORCE; V2.seen = true; V2.asked = true; return; }
  let c = null; try { c = JSON.parse(localStorage.getItem(v2Key()) || 'null'); } catch(e) {}
  V2.local = c && (c.ver === 'old' || c.ver === 'new') ? c : null;   // 这台设备上记的（数据库还没记时，拿它补上去）
  V2.ver = V2.local ? V2.local.ver : V2_DEFAULT; V2.seen = !!(c && c.seen);
}
function v2Save(){ if (PEEK) return; try { localStorage.setItem(v2Key(), JSON.stringify({ver: V2.ver, seen: V2.seen})); } catch(e) {} }   // 「打开看看」时不动本机记的
// 打开后在后台读数据库里记的选择（换了设备也一样）；和本机记的不一样就按数据库的重画
// Codex 复查第 9 条：读回来之前用户已经点过切换 → 以用户刚点的为准；数据库里还没记、这台设备记过 → 把这台的补进数据库
async function v2Pref(){
  if (PEEK) return;
  try {
    const r = await rpc('ui_pref_load'); if (!r) return;
    v2ThemeSync(r);
    if (V2.touched) return;
    let ver = r.ver === 'old' || r.ver === 'new' ? r.ver : null;
    if (!ver && V2.local){ ver = V2.local.ver; rpc('ui_pref_set', {ver, why: null}).then(() => V2.seen && !r.seen && rpc('ui_pref_set', {ver: 'seen'})).catch(() => {}); }
    ver = ver || V2_DEFAULT;
    const seen = !!r.seen || V2.seen;
    if (ver !== V2.ver || seen !== V2.seen){
      V2.ver = ver; V2.seen = seen; v2Save();
      const busy = document.querySelector('.modal') || S.dirtyMain || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if (!busy) render();
    }
  } catch(e) {}   // 数据库还没加第 64 步：只用本机记的
}
// 第 66 步：配色跟着链接走。数据库里记的和这台设备不一样 → 用数据库的；数据库还没记、这台选过 → 补进数据库；读回来之前刚点过 → 以刚点的为准
function v2ThemeSync(r){
  if (V2.themeTouched || !('theme' in r)) return;   // 数据库还没加第 66 步（读回来没有这一项）：只用这台设备记的
  const db = V2_THEMES.some(x => x[0] === r.theme) ? r.theme : null, cur = v2Theme();
  if (db && db !== cur){
    V2.theme = db; try { localStorage.setItem(v2ThemeKey(), db); } catch(e) {}
    if (document.body.classList.contains('v2')) document.body.dataset.theme = db;
    document.querySelectorAll('.v2-sw').forEach(b => { const on = b.dataset.v === db; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  } else if (!db && cur !== 'notion') rpc('ui_theme_set', {theme: cur}).catch(() => {});
}
function v2Set(ver, why){
  V2.ver = ver; V2.seen = true; V2.touched = true; v2Save();
  if (!PEEK) rpc('ui_pref_set', {ver, why: why || null}).catch(() => toast('网络不稳，这次只在这台设备上换了；换别的手机、电脑打开可能还是原来的', true, 6000));
  closeModal(); render(); window.scrollTo(0, 0);
  toast(ver === 'old' ? '已切回旧版。想回来，点最上面的「回到新版」' : '已换成新版');
}
function v2OldAsk(){
  openModal(`${mHead('切回旧版')}
  <div class="small">切回以后，下次打开也是旧版；想回来，点页面最上面的「回到新版」就行。</div>
  <label class="field"><span>新版哪里不好用？（可以不写；写了我们会照着改）</span><textarea id="v2-why" maxlength="500" placeholder="例：找不到某个按钮、字太小、手机上不好点"></textarea></label>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">再用用新版</button><button class="btn pri" data-act="v2-ui-old">切回旧版</button></div>`);
}
const v2OldBar = () => `<div class="v2-oldbar" role="status"><span>现在是旧版页面</span><button type="button" class="btn sm" data-act="v2-ui-new">回到新版</button></div>`;
const v2Banner = () => V2.seen || PEEK ? '' : `<div class="v2-banner" role="status"><span><b>这是新版页面</b><span class="muted"> · 不习惯的话可以切回旧版</span></span><span class="v2-banner-acts"><button type="button" class="v2-link" data-act="v2-ui-old-ask">切回旧版</button><button type="button" class="btn sm" data-act="v2-ui-seen">知道了</button></span></div>`;
const v2UiRow = () => PEEK ? '' : `<section class="card v2-uirow"><div><b>页面样子</b><div class="muted xs">现在用的是新版。不习惯可以切回旧版，以后随时能换回来。</div></div><button class="btn sm" data-act="v2-ui-old-ask">切回旧版</button></section>`;

/* ───────── 外观：四套配色（2026-11-22 提前做；先记在这台设备上，满意了再跟着链接存） ───────── */
const V2_THEMES = [['notion', '白底 · 一点蓝', '默认', '#ffffff', '#f7f7f5', '#2383e2', '#37352f'], ['seaglass', '海玻璃', '清透的海水绿', '#f3f7f7', '#e8eeee', '#006f76', '#d5eeeb'],
  ['sakura', '桜', '很浅的樱花粉', '#fdf7f8', '#f6edef', '#d45d7e', '#fbe3e8'], ['latte', '奶咖', '咖啡店的暖色', '#f6f1ea', '#ede6dd', '#b97a44', '#3b2f2a'],
  ['night', '夜间', '深色，晚上看不刺眼', '#191919', '#262626', '#5aa9f0', '#e6e6e3']];
const v2ThemeKey = () => 'jw_theme:' + (ME().id || ME().role);
function v2Theme(){
  if (V2.theme == null){ let t = ''; if (!PEEK) { try { t = localStorage.getItem(v2ThemeKey()) || ''; } catch(e) {} } V2.theme = V2_THEMES.some(x => x[0] === t) ? t : 'notion'; }
  return V2.theme;
}
const v2Look = () => `<section class="card v2-look"><div><b>外观</b><div class="muted xs">选一套自己喜欢的颜色，只改你自己看到的样子。科目颜色、完成 / 等待 / 要跟进这些颜色不变。</div></div>
  <div class="v2-sws" role="radiogroup" aria-label="配色">${V2_THEMES.map(([k, t, d, b, c, a, p]) => `<button type="button" role="radio" aria-checked="${v2Theme() === k}" class="v2-sw ${v2Theme() === k ? 'on' : ''}" data-act="v2-theme" data-v="${k}" style="--b:${b};--c:${c};--a:${a};--p:${p}"><span class="pv"><i></i><span><em></em></span></span><span>${t}</span><small>${d}</small></button>`).join('')}</div></section>`;
const v2LookModal = () => openModal(`${mHead('外观')}${v2Look()}<div class="row" style="justify-content:flex-end"><button class="btn pri" data-act="close">好了</button></div>`);

/* ───────── 接管画页面 ───────── */
const renderOld = render;
render = function(){
  if (!DB || !DB.me) return renderOld();
  v2Init();
  if (!V2.asked){ V2.asked = true; setTimeout(v2Pref, 0); }
  if (V2.ver === 'old'){
    document.body.classList.remove('v2'); renderOld();
    if (!PEEK) app.insertAdjacentHTML('afterbegin', v2OldBar());
    return;
  }
  document.body.classList.add('v2'); document.body.dataset.theme = v2Theme();
  S.dirtyMain = false;
  if (!S.v2init){ S.v2init = true; if (ME().role === 'teacher' && S.tab === 'a') S.tab = 'b'; }   // 老师打开先看「我的学生」
  setTimeout(labelTables);
  app.innerHTML = v2Shell();
  v2After();
};
const v2Phone = () => matchMedia('(max-width:760px)').matches;
let v2WasPhone = v2Phone();
addEventListener('resize', () => {   // 电脑窗口拉窄 / 手机横竖屏：跨过手机宽度时重画
  const p = v2Phone(); if (p === v2WasPhone) return; v2WasPhone = p;
  if (DB && V2.ver === 'new' && !document.querySelector('.modal') && !S.dirtyMain && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) render();
});

/* ───────── 小工具 ───────── */
const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const v2Day = d => { const n = dBetween(TODAY, d); return n === 0 ? '今天' : n === 1 ? '明天' : `${md(d)} 周${WD[pd(d).getDay()]}`; };
const v2Ava = (name, big) => `<span class="v2-ava ${big ? 'big' : ''}" style="--hc:${hue(String(name || '?'))}" aria-hidden="true">${esc(String(name || '?').slice(0, 1))}</span>`;
const v2Ic = k => `<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true">${{search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', go: '<path d="M9 5l7 7-7 7"/>'}[k] || ''}</svg>`;
const v2Head = (title, sub = '', acts = '') => `<div class="v2-head"><h1>${title}</h1>${sub ? `<span class="v2-sub">${sub}</span>` : ''}${acts ? `<div class="v2-acts">${acts}</div>` : ''}</div>`;
const v2Box = (title, inner, link = '', cls = '') => `<section class="v2-box ${cls}"><div class="v2-bh"><h3>${title}</h3>${link}</div>${inner}</section>`;
const v2Legacy = (html, narrow) => `<div class="v2-legacy ${narrow ? 'narrow' : ''}">${html}</div>`;
// 一节课旁边的「等批准」：学生申请了改期 / 请假，或者老师申请了调课，都还没批
function v2Flag(l){
  const q = reqOf(l); if (q && q.status === 'pending') return `${q.type}待确认`;
  const x = typeof chPendOf === 'function' && ['admin', 'teacher'].includes(ME().role) ? chPendOf(l.id) : null;
  return x ? `${chLabel(x)}待批准` : '';
}
const v2FlagTag = l => { const f = v2Flag(l); return f ? ` <span class="tag warn">${f}</span>` : ''; };
const nowBJ = () => bjHM();
const v2Next = ls => { const n = nowBJ(); return ls.filter(l => l.status === 'scheduled' && (l.date > TODAY || (l.date === TODAY && l.end > n))); };
const v2Given = n => { n = String(n || '').trim(); return /^[一-鿿]{3}$/.test(n) ? n.slice(1) : n; };   // 「林知夏」→「知夏」；2026-11-25：只有正好 3 个汉字的才去掉姓（「Amber」「欧阳娜娜」「佐藤健太」都用全名）
const v2WkMon = d => { const wd = (pd(d).getDay() + 6) % 7; return addDay(d, -wd); };
const v2Range = days => `${md(days[0])}–${days[6].slice(5, 7) === days[0].slice(5, 7) ? +days[6].slice(8) : md(days[6])}`;

/* ───────── 三列：左菜单（外框）→ 中间名单（搜索＋筛选）→ 右边详情 ─────────
   items：[{k, name, line(已转义的 HTML), flag:[字, 颜色], q(搜索用的字)}]；手机上先名单，点进去整页详情 */
S.v2sel = S.v2sel || {}; S.v2idx = S.v2idx || {}; S.v2q = S.v2q || {}; S.v2chip = S.v2chip || {}; S.v2scroll = S.v2scroll || {};
const v2QOf = s => [s.name, s.code, s.direction, s.track, s.staff, ...DB.courses.filter(c => c.student_id === s.id).map(c => tea(c.teacher_id).name + c.subject)].filter(Boolean).join(' ');
const v2Hit = (id, x) => { const q = (S.v2q[id] || '').trim().toLowerCase(); return !q || String(x.q || x.name).toLowerCase().includes(q); };
function v2Pick(id, items){
  // 选中的不在了（比如刚批完）：停在原来那个位置的下一条；搜索框里有字时，只在搜到的里面选（Codex 复查第 2 条）
  const ok = items.map(x => v2Hit(id, x));
  let i = items.findIndex((x, j) => x.k === S.v2sel[id] && ok[j]);
  if (i < 0){ const from = Math.min(S.v2idx[id] || 0, Math.max(items.length - 1, 0)); i = items.findIndex((x, j) => j >= from && ok[j]); if (i < 0) i = ok.indexOf(true); }
  if (i < 0){ if (S.v2open === id) S.v2open = null; S.v2sel[id] = null; return null; }
  if (v2Phone() && S.v2open === id && items[i].k !== S.v2sel[id]) S.v2open = null;   // 手机上正看的那条已经处理掉了：回到名单
  S.v2sel[id] = items[i].k; S.v2idx[id] = i;
  return items[i];
}
function v2Tri(o){
  const open = S.v2open === o.id && v2Phone();
  const rows = o.items.length ? o.items.map(x => `${x.sep ? `<div class="v2-sep">${x.sep}</div>` : ''}<button type="button" class="v2-row ${x.k === o.sel ? 'on' : ''}" data-act="v2-sel" data-v="${o.id}|${esc(x.k)}" data-q="${esc(x.q || x.name)}">${x.ava === false ? '' : v2Ava(x.ava || x.name)}<span class="tx"><b>${esc(x.name)}</b>${x.line ? `<span>${x.line}</span>` : ''}</span>${x.flag ? `<span class="v2-flag ${x.flag[1] || ''}">${esc(x.flag[0])}</span>` : ''}</button>`).join('')
    : `<div class="v2-empty">${o.empty || '没有'}</div>`;
  return `<div class="v2-tri ${open ? 'open' : ''}" data-tri="${o.id}">
    <aside class="v2-list" aria-label="${esc(o.label || '名单')}">${o.top || ''}
      ${o.search ? `<label class="v2-search">${v2Ic('search')}<input type="search" placeholder="${esc(o.search)}" data-v2q="${o.id}" value="${esc(S.v2q[o.id] || '')}" aria-label="搜索"></label>` : ''}
      ${o.chips && o.chips.length > 1 ? `<div class="v2-chips">${o.chips.map(([k, t, n]) => `<button type="button" class="v2-chip ${o.chip === k ? 'on' : ''}" data-act="v2-chip" data-v="${o.id}|${k}">${t}${n != null ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>` : ''}
      ${o.count ? `<div class="v2-count">${o.count}</div>` : ''}${o.bulk || ''}
      <div class="v2-rows">${rows}</div></aside>
    <section class="v2-det">${open ? `<button type="button" class="v2-back" data-act="v2-back" data-v="${o.id}">${v2Ic('back')}返回</button>` : ''}${o.detail || `<div class="v2-empty big">${o.emptyDet || '在左边选一个'}</div>`}</section></div>`;
}

/* ───────── 外框：左菜单 / 手机底栏 ───────── */
function v2Nav(){
  const me = ME();
  if (me.role === 'admin'){
    const todoN = v2TodoTotal();
    const stuGrp = ['学生', [['students', '学生档案'], ['reviews', '月度家长反馈'], ['apply', '升学与出愿'], ['schools', '院校库'], ['checks', '通关点检']]];
    const groups = isTop()
      ? [['日常', [['overview', '总览'], ['calendar', '课表与排课'], ['todo', '待处理', todoN]]], stuGrp, ['管理', [['teachers', '老师档案'], ['payroll', '课时与工资'], ['sys', '链接与备份'], ['log', '改动记录']]]]
      : [['日常', [['overview', '总览'], ['calendar', '课表与排课'], ['todo', '待处理', todoN]]], stuGrp];
    const bar = [['overview', '总览', '总览'], ['todo', '待处理', '待处理', todoN], ['calendar', '课表', '课表与排课'], ['students', '档案', '学生档案'], ['more', '更多', '']];
    return {act: 'page', cur: S.page === 'student' ? 'students' : S.page, groups, bar};
  }
  if (me.role === 'teacher'){
    const n = v2TCand().length + DB.feedbacks.filter(f => f.hw_sub && !f.hw_fb).length;
    return {act: 'tab', cur: S.tab, groups: [['', [['b', '我的学生'], ['a', '课表'], ['c', '反馈批改', n, '反馈·批改'], ['f', '通关点检'], ['d', '我的']]]],
      bar: [['b', '学生', '我的学生'], ['a', '课表', '课表'], ['c', '批改', '反馈·批改', n], ['d', '我的', '我的']]};
  }
  const s = stu(me.student_id), tabs = sTabs(s), nOf = k => (tabs.find(t => t[0] === k) || [])[2];
  return {act: 'tab', cur: S.tab, groups: [['', tabs.map(([k, t, n]) => [k, t, n])]],
    bar: [['a', '首页', '首页'], ['b', '课表', '课表'], ['c', '作业', '作业', nOf('c')], ['d', '记录', '上课记录', nOf('d')], ['e', PRO() ? '档案' : '我的', PRO() ? '档案' : '我的', nOf('e')]]};
}
function v2Shell(){
  const me = ME(), nv = v2Nav();
  const label = me.role === 'admin' ? (me.owner ? '' : me.level === 'top' ? '教务 · 管理' : '教务') : {teacher: '任课老师', student: '学生', parent: '家长'}[me.role];
  const nm = me.role === 'student' ? `${me.name}同学` : me.role === 'parent' ? `${stu(me.student_id).name}的家长` : me.name;
  const side = nv.groups.map(([g, list]) => (g ? `<div class="v2-grp">${g}</div>` : '') + list.map(([k, t, n, ic]) =>
    `<button type="button" class="v2-nav ${nv.cur === k ? 'on' : ''}" data-act="${nv.act}" data-v="${k}" title="${esc(t)}">${navIcon(ic || t)}<span class="v2-nl">${t}</span>${n ? `<span class="cnt">${n}</span>` : ''}</button>`).join('')).join('');
  const sd = ['student', 'parent'].includes(me.role) ? sSide(stu(me.student_id)) : null;
  const foot = `<div class="v2-foot">${sd ? `<div class="v2-tea">${sd.bottom}</div>` : ''}
    <div class="v2-me">${v2Ava(me.role === 'parent' ? stu(me.student_id).name : me.name)}<span class="v2-nl"><b>${esc(nm)}</b><small>${esc(label || '')}</small></span></div>
    ${me.role === 'admin' ? `<button type="button" class="v2-link v2-nl" data-act="v2-look">外观</button>` : ''}
    ${PEEK ? '' : `<button type="button" class="v2-link v2-nl" data-act="v2-ui-old-ask">切回旧版</button>`}
    ${['student', 'parent'].includes(me.role) ? '' : `<button type="button" class="v2-link v2-nl" data-act="logout" title="让这台设备忘掉你的链接">退出</button>`}</div>`;
  const curT = (nv.groups.flatMap(g => g[1]).find(x => x[0] === nv.cur) || [])[1] || (nv.cur === 'more' ? '更多' : '');
  const bar = `<nav class="v2-tabbar" style="grid-template-columns:repeat(${nv.bar.length},1fr)" aria-label="菜单">${nv.bar.map(([k, t, ic, n]) =>
    `<button type="button" class="${nv.cur === k || (k === 'more' && v2MoreKeys().includes(nv.cur)) ? 'on' : ''}" data-act="${nv.act}" data-v="${k}">${k === 'more' ? `<svg class="nav-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>` : navIcon(ic)}<span>${t}</span>${n ? `<span class="dot">${n}</span>` : ''}</button>`).join('')}</nav>`;
  const peek = PEEK ? `<div class="peek-bar" role="status"><span>正在用「打开看看」查看 <b>${esc(me.name)}</b> 的页面：只能看、不能改，不留登录记录。</span><button class="btn sm" data-act="peek-close">关掉这一页</button></div>` : '';
  return `${peek}<div class="v2-app v2-${me.role}">
    <aside class="v2-side" aria-label="菜单"><div class="v2-brand"><span class="v2-logo" aria-hidden="true">教</span><span class="v2-nl">${me.role === 'admin' ? '学生教务' : esc(nm)}</span></div>${side}${foot}</aside>
    <main class="v2-main"><div class="v2-top"><b>${esc(curT)}</b><span class="v2-top-me">${v2Ava(me.role === 'parent' ? stu(me.student_id).name : me.name)}</span></div>
      ${me.owner ? `<div class="v2-booksw">${bookSwitch()}</div>` : ''}${v2Banner()}${v2Page()}</main></div>${bar}`;
}
// 2026-11-25：手机、平板上左边菜单收起来了，教务和老师找不到「退出」——在「更多」「我的」最下面也放一个
const V2_LOGOUT = '<div class="row" style="justify-content:center;margin:20px 0 4px"><button class="btn sm" data-act="logout">退出这台设备</button></div><div class="muted xs" style="text-align:center;margin-bottom:12px">在别人的手机、电脑上打开过的话，用完点这里退出</div>';
const v2MoreKeys = () =>['more', 'teachers', 'reviews', 'apply', 'schools', 'checks', 'payroll', 'sys', 'log'];
function v2Page(){
  const me = ME();
  if (me.role === 'admin'){
    const ok = isTop() || ['overview', 'calendar', 'todo', 'students', 'student', 'checks', 'apply', 'schools', 'reviews', 'more'].includes(S.page);
    const pg = ok ? S.page : 'overview';
    const NEW = {overview: typeof v2Overview2 === 'function' ? v2Overview2 : v2Overview, calendar: v2Calendar, todo: v2Todo, students: v2Students, student: v2Students, teachers: v2Teachers, more: v2More,
      ...(typeof v2Payroll === 'function' ? {payroll: v2Payroll} : {}), ...(typeof v2Reviews === 'function' ? {reviews: v2Reviews} : {}),
      ...(typeof v2Sys === 'function' ? {sys: v2Sys, log: v2Log} : {}), ...(typeof v2Schools === 'function' ? {schools: v2Schools} : {}),
      ...(typeof v2Apply === 'function' ? {apply: v2Apply, checks: () => v2Checks(DB.students.filter(s => s.active !== false), '点学生看他完整的点检表；学生和家长在自己的链接里也能看到（只能看）')} : {})};
    if (NEW[pg]) return NEW[pg]();
    const OLD = {sys: pgSys, log: typeof pgLog === 'function' ? pgLog : pgOverview, checks: pgChecks, apply: pgApply2, reviews: pgReviews, payroll: pgPayroll, schools: pgSchools};
    return v2Legacy((OLD[pg] || pgOverview)());
  }
  if (me.role === 'teacher'){
    const t = tea(me.teacher_id);
    if (S.tab === 'd') return v2Legacy(`<div class="v2-entry"><button type="button" class="v2-go" data-act="tab" data-v="f">${navIcon('通关点检')}<span>通关点检</span>${v2Ic('go')}</button></div>` + tMe(t) + v2Look() + v2UiRow() + V2_LOGOUT, true);
    if (S.tab === 'f') return typeof v2Checks === 'function' ? v2Checks(DB.students.filter(s => DB.courses.some(c => c.student_id === s.id && c.teacher_id === t.id)), '上完课在这里给学生打档') : v2Legacy(tChecks(t));
    return ({a: v2TSched, b: v2TStudents, c: v2TWrite}[S.tab] || v2TStudents)(t);
  }
  const s = stu(me.student_id);
  if (S.tab === 'e') return v2Legacy(sMine(s) + v2Look() + v2UiRow() + ('<div class="row" style="justify-content:center;margin:20px 0 4px"><button class="btn sm" data-act="logout">退出这台设备</button></div><div class="muted xs" style="text-align:center;margin-bottom:12px">在别人的手机、电脑上打开过的话，看完点这里退出</div>'), true);
  if (S.tab === 'd') return typeof v2Records === 'function' ? v2Records(s) : v2Legacy(v2Head('上课记录') + sFeedback2(s), true);
  if (S.tab === 'f') return typeof v2SCheck === 'function' ? v2SCheck(s) : v2Legacy(sCheck(s), true);
  if (S.tab === 'b') return v2Head('课表', '北京时间') + v2Legacy(sSched(s));
  if (S.tab === 'c') return v2SHw(s);
  return PRO() ? v2PHome(s) : v2SHome(s);
}
function v2More(){
  const nv = v2Nav(), list = nv.groups.flatMap(g => g[1]).filter(([k]) => !['overview', 'calendar', 'todo', 'students'].includes(k));
  return v2Head('更多') + `<div class="v2-entry">${list.map(([k, t]) => `<button type="button" class="v2-go" data-act="page" data-v="${k}">${navIcon(t)}<span>${t}</span>${v2Ic('go')}</button>`).join('')}</div>` + v2Look() + v2UiRow() + V2_LOGOUT;
}

/* ═════════════ 教务 ═════════════ */
function v2Overview(){
  return (ownerUI() && !PEEK ? `<div class="v2-stat-line"><button type="button" class="btn sm" data-act="v2-stats">新版使用情况</button></div>` : '') + v2Legacy(pgOverview());
}
// 学生档案：名单每行写「为什么要点」（最多一个状态），要处理的排前面
function v2StuInfo(s){
  const my = l => course(l.course_id)?.student_id === s.id, n = nowBJ();
  const rq = isTop() ? DB.requests.filter(q => q.status === 'pending' && L(q.lesson_id) && my(L(q.lesson_id))) : [];
  const fp = isTop() ? DB.feedbacks.filter(f => f.status === 'pending' && cOfF(f)?.student_id === s.id).length : 0;
  const pe = lsOfS(s.id).filter(isPend).length;
  const bad = DB.feedbacks.filter(f => f.confirm === '不满意' && cOfF(f)?.student_id === s.id && L(f.lesson_id).date >= addDay(TODAY, -30));
  const chs = chPend().filter(x => course(x.course_id)?.student_id === s.id).length;
  const un = latestHw(s.id).filter(f => !f.hw_sub).length;
  const todayL = lsOfS(s.id).filter(l => l.date === TODAY && l.status === 'scheduled');
  const live = todayL.find(l => l.start <= n && l.end > n), next = v2Next(lsOfS(s.id))[0];
  let flag = null, line = '';
  if (s.active === false){ flag = ['停课', 'mute']; line = esc(s.direction || s.track || ''); }
  else if (rq.length){ const l = L(rq[0].lesson_id); flag = [rq[0].type, rq[0].type === '请假' ? 'bad' : 'warn']; line = `${rq[0].type}待处理 · ${md(l.date)} ${esc(course(l.course_id).subject)}`; }
  else if (bad.length){ flag = ['不满意', 'bad']; line = `对 ${md(L(bad[0].lesson_id).date)} 的课不满意`; }
  else if (live){ flag = ['上课中', 'blue']; line = `${live.start} ${esc(course(live.course_id).subject)}上课中`; }
  else if (pe){ flag = ['待写反馈', 'warn']; line = `${pe} 节课老师还没写反馈`; }
  else if (fp){ flag = ['待审批', 'warn']; line = `${fp} 条反馈等审批`; }
  else if (chs){ flag = ['排课', 'warn']; line = `老师有 ${chs} 条排课申请`; }
  if (!line) line = next ? `下节 ${v2Day(next.date)} ${next.start} ${esc(course(next.course_id).subject)}` : (esc(s.direction || s.track || '') || '还没有排课');
  if (un && s.active !== false && !rq.length && !bad.length) line += ` · ${un} 份作业没交`;
  return {flag, line, todo: rq.length + fp + pe + bad.length + chs, today: todayL.length > 0};
}
function v2Students(){
  const all = DB.students.map(s => ({s, i: v2StuInfo(s)}));
  const F = {all: () => true, todo: x => x.i.todo > 0, today: x => x.i.today, off: x => x.s.active === false};
  // Codex 复查第 5 条：从别处点名打开某个学生（待处理、老师档案……），名单的筛选、搜索挡住了他 → 先放开筛选，保证右边就是点的那个人
  if (S.page === 'student' && S.stuId){
    const tg = all.find(x => x.s.id === S.stuId);
    if (!tg){ if (S.v2jump) toast('这个学生已经不在你能看的名单里了', true); S.page = 'students'; S.stuId = null; }
    else if (S.v2jump === S.stuId && S.page === 'student'){
      if (!(F[S.v2chip.stu] || F.all)(tg)) S.v2chip.stu = 'all';
      const q = (S.v2q.stu || '').trim().toLowerCase();
      if (q && !v2QOf(tg.s).toLowerCase().includes(q)) S.v2q.stu = '';
    }
  }
  S.v2jump = null;
  const chip = S.v2chip.stu || 'all';
  const pick = F[chip] || F.all;
  const list = all.filter(pick).sort((a, b) => (a.s.active === false) - (b.s.active === false) || b.i.todo - a.i.todo || b.i.today - a.i.today || pyCmp(a.s.name, b.s.name));
  const items = list.map(({s, i}) => ({k: s.id, name: s.name, line: i.line, flag: i.flag, q: v2QOf(s)}));
  if (S.page === 'student' && S.stuId && items.some(x => x.k === S.stuId)) S.v2sel.stu = S.stuId;
  const cur = v2Pick('stu', items);
  if (cur){ S.stuId = cur.k; if (!S.stuTab) S.stuTab = 'home'; }
  const n = k => all.filter({todo: x => x.i.todo > 0, today: x => x.i.today, off: x => x.s.active === false}[k]).length;
  const chips = [['all', '全部', all.length], ['todo', '有待处理', n('todo')], ['today', '今天有课', n('today')], ...(n('off') ? [['off', '停课', n('off')]] : [])];
  return v2Head('学生档案', fmtMD(TODAY), isTop() ? `<button class="btn pri" data-act="student-form">${v2Ic('plus')}新增学生</button>` : '') + scopeNote()
    + v2Tri({id: 'stu', label: '学生名单', items, sel: cur && cur.k, search: '查学生、方向、老师…', chips, chip, count: `${items.length} 个学生 · 要处理的排前面`,
      empty: DB.students.length ? '没有符合的学生' : '还没有学生。点右上角「新增学生」开始。', detail: cur ? `<div class="v2-card v2-stu">${typeof v2StuDetail === 'function' ? v2StuDetail() : pgStudent()}</div>` : ''});
}
// 老师档案
function v2Teachers(){
  const ym = TODAY.slice(0, 7), mon = v2WkMon(TODAY), sun = addDay(mon, 6);
  const info = t => { const ms = lsOfT(t.id).filter(l => l.date.startsWith(ym)), pn = ms.filter(isPend).length, names = [...new Set(DB.courses.filter(c => c.teacher_id === t.id && c.active !== false).map(c => stu(c.student_id).name))];
    return {pn, names, hDone: +ms.filter(l => paidH(l) > 0).reduce((a, l) => a + paidH(l), 0).toFixed(2), nDone: ms.filter(l => paidH(l) > 0).length,
      hPlan: +ms.filter(l => l.status === 'scheduled').reduce((a, l) => a + dur(l), 0).toFixed(2), nPlan: ms.filter(l => l.status === 'scheduled').length}; };
  const chip = S.v2chip.tea || 'all';
  const all = DB.teachers.filter(t => !t.staff).map(t => ({t, i: info(t)}));
  const list = all.filter({all: () => true, pend: x => x.i.pn > 0, art: x => tCat(x.t.id) === '艺术', sci: x => tCat(x.t.id) !== '艺术'}[chip] || (() => true))
    .sort((a, b) => b.i.pn - a.i.pn || pyCmp(a.t.name, b.t.name));
  const items = list.map(({t, i}) => ({k: t.id, name: t.name, line: `${i.names.length} 个学生 · 本月已上 ${i.hDone} 小时`, flag: i.pn ? [`待确认 ${i.pn}`, 'warn'] : t.active === false ? ['停用', 'mute'] : null,
    q: [t.name, t.subject, t.loc, ...i.names].filter(Boolean).join(' ')}));
  const cur = v2Pick('tea', items);
  let detail = '';
  if (cur){
    const t = tea(cur.k), i = info(t), p = typeof teacherRealLink === 'function' ? teacherRealLink(t) : null;
    const wk = lsOfT(t.id).filter(l => l.date >= mon && l.date <= sun && l.status !== 'cancelled');
    const byS = {}; DB.courses.filter(c => c.teacher_id === t.id && c.active !== false).forEach(c => (byS[c.student_id] ??= []).push(c.subject));
    const sub = [tCat(t.id), t.subject, t.loc].filter(Boolean).map(esc).join(' · ');
    detail = `<div class="v2-card"><div class="v2-ph">${typeof cvPhoto === 'function' ? cvPhoto(t, 'sm') : v2Ava(t.name, true)}<div class="v2-pt"><h2>${esc(t.name)} ${typeof tBookTag === 'function' ? tBookTag(t) : ''}</h2><p>${sub}${typeof cvOf === 'function' && cvOf(t.id).tagline ? ` · ${esc(cvOf(t.id).tagline)}` : ''}</p></div>
      <div class="v2-acts"><button class="btn pri sm" data-act="cv-open" data-v="${t.id}">履历</button><button class="btn sm" data-act="teacher-form" data-v="${t.id}">编辑</button>${p ? `<button class="btn sm" data-act="copy-link" data-v="${p.key}">复制老师链接</button>` : ''}${typeof ownerFullLinkBtn === 'function' ? ownerFullLinkBtn(t) : ''}</div></div>
      <div class="v2-grid">
        ${v2Box(`${+ym.slice(5)} 月课时`, `<div class="v2-nums"><div><b>${i.hDone}</b><small>已上 · ${i.nDone} 节</small></div><div><b>${i.hPlan}</b><small>应上 · ${i.nPlan} 节</small></div><div class="${i.pn ? 'warn' : ''}"><b>${i.pn}</b><small>节待确认</small></div></div>`, i.pn && isTop() ? `<button class="btn sm" data-act="page" data-v="feedback-missing">去处理 ›</button>` : '')}
        ${v2Box('带的学生', Object.keys(byS).length ? `<div class="v2-lines">${Object.entries(byS).map(([sid, subs]) => `<button type="button" class="v2-line" data-act="student" data-v="${sid}"><b>${esc(stu(sid).name)}</b><span>${subs.map(x => subjTag(x)).join(' ')}</span></button>`).join('')}</div>` : '<div class="v2-empty">还没有学生</div>')}
        ${v2Box(`这一周的课 <span class="v2-sub2">${v2Range([mon, '', '', '', '', '', sun])}</span>`, wk.length ? `<div class="v2-lines">${wk.map(l => { const c = course(l.course_id); return `<button type="button" class="v2-line" data-act="lesson" data-v="${l.id}"><b>${v2Day(l.date)} ${l.start}</b><span>${esc(stu(c.student_id).name)} · ${subjTag(c.subject)}${l.status === 'leave' ? ' <span class="tag seal">请假</span>' : ''}${isPend(l) ? ' <span class="tag warn">待确认</span>' : ''}${v2FlagTag(l)}</span></button>`; }).join('')}</div>` : '<div class="v2-empty">这周没有课</div>')}
        ${typeof meetTeacherSummary === 'function' ? v2Box('上课链接', `<div class="small">${meetTeacherSummary(t)}</div>`) : ''}
        ${typeof cvBrief === 'function' ? v2Box('简历摘要', `<dl class="kv small">${cvBrief(t)}</dl>`, `<button class="btn sm" data-act="cv-open" data-v="${t.id}">看全部 ›</button>`) : ''}
      </div></div>`;
  }
  const n = f => all.filter(f).length, arts = n(x => tCat(x.t.id) === '艺术');
  const chips = [['all', '全部', all.length], ['pend', '有待确认', n(x => x.i.pn > 0)], ...(arts && arts < all.length ? [['sci', '学科', all.length - arts], ['art', '艺术', arts]] : [])];
  return v2Head('老师档案', '', `<button class="btn pri" data-act="teacher-form">${v2Ic('plus')}新增老师</button>`)
    + v2Tri({id: 'tea', label: '老师名单', items, sel: cur && cur.k, search: '查老师、科目、学生…', chips, chip, count: `${items.length} 位老师`, empty: '还没有老师。点右上角「新增老师」开始。', detail});
}
// 待处理：按事排，一件一行；先逾期，再按日期
function v2TodoItems(){
  const out = [];
  if (isTop()){
    DB.requests.filter(q => q.status === 'pending').forEach(q => { const l = L(q.lesson_id); if (!l) return; const c = course(l.course_id);
      out.push({k: 'q:' + q.id, g: 'req', d: l.date, sid: c.student_id, name: stu(c.student_id).name, line: `${q.type} · ${md(l.date)} ${esc(c.subject)}${q.wish ? ` → ${esc(q.wish)}` : ''}`, flag: [q.type, q.type === '请假' ? 'bad' : 'warn']}); });
  }
  // 2026-11-26：老师的排课申请、待确认的课，普通教务也能处理自己负责的学生的（数据库一直允许、旧版总览也一直列着），新版以前只给教务·管理看
  chPend().forEach(x => { const c = course(x.course_id) || {}, l = L(x.lesson_id), d = (x.d && (x.d.date || (x.d.dates || [])[0])) || (l && l.date) || TODAY;
      out.push({k: 'c:' + x.id, g: 'ch', d, sid: c.student_id, name: stu(c.student_id).name, line: `${esc(x.by_name)} · ${chLabel(x)} ${md(d)}${c.subject ? ' ' + esc(c.subject) : ''}`, flag: [chLabel(x), 'warn']}); });
  if (isTop()) DB.feedbacks.filter(f => f.status === 'pending').forEach(f => { const l = L(f.lesson_id), c = l && course(l.course_id); if (!c) return;
      out.push({k: 'f:' + f.id, g: 'fb', d: l.date, sid: c.student_id, name: stu(c.student_id).name, line: `${esc(tea(c.teacher_id).name)} · ${md(l.date)} ${esc(c.subject)}的反馈`, flag: ['审批', 'blue']}); });
  needFb().forEach(l => { const c = course(l.course_id);
      out.push({k: 'l:' + l.id, g: 'pend', d: l.date, sid: c.student_id, name: stu(c.student_id).name, line: `${esc(tea(c.teacher_id).name)} · ${md(l.date)} ${esc(c.subject)} · ${dBetween(l.date, TODAY)} 天没写反馈`, flag: ['待确认', 'warn']}); });
  out.sort((a, b) => (a.d < TODAY ? 0 : 1) - (b.d < TODAY ? 0 : 1) || a.d.localeCompare(b.d));
  const mu = typeof msgUnread === 'function' ? msgUnread() : 0, fuDue = (DB.followups || []).filter(f => f.next_date && f.confirm !== '已确认' && f.next_date <= TODAY).length;
  if (typeof pgMsgs === 'function') out.push({k: 'msg', g: 'other', n: mu, ava: '留', name: '学生留言', line: mu ? `${mu} 条还没看` : '没有新留言', flag: mu ? [`${mu}`, 'blue'] : null});
  out.push({k: 'fu', g: 'other', n: fuDue, ava: '跟', name: '跟进记录', line: fuDue ? `${fuDue} 条到期` : '没有到期的', flag: fuDue ? [`${fuDue}`, 'warn'] : null});
  return out;
}
// 要处理的一共几件：申请、审批、待确认的课各算一件，再加没看的留言、到期的跟进（左边菜单的数字也用这个）
const v2TodoTotal = (all = v2TodoItems()) => all.reduce((a, x) => a + (x.g === 'other' ? (x.n || 0) : 1), 0);
// 最近处理过的（Codex 复查第 8 条）：误批的反馈能在这里「撤回审批」；处理过的改期、请假、老师申请也能回头看
function v2TodoDone(){
  const out = [], who = l => { const c = l && course(l.course_id); return c ? {sid: c.student_id, name: stu(c.student_id).name, subj: c.subject} : {sid: null, name: '（课已删除）', subj: ''}; };
  DB.requests.filter(q => q.status !== 'pending').slice(-20).reverse().forEach(q => { const l = L(q.lesson_id); if (!l) return; const w = who(l);
    out.push({k: 'q:' + q.id, g: 'done', sid: w.sid, name: w.name, line: `${q.type} · ${md(l.date)} ${esc(w.subj)} · ${q.status === 'accepted' ? '已同意' : '未同意'}`, flag: [q.status === 'accepted' ? '已同意' : '未同意', q.status === 'accepted' ? 'ok' : 'mute']}); });
  (DB.changes || []).filter(x => x.status === 'approved' || x.status === 'rejected' || (x.status === 'withdrawn' && x.result)).slice(0, 10).forEach(x => { const c = course(x.course_id) || {};
    out.push({k: 'c:' + x.id, g: 'done', sid: c.student_id, name: c.student_id ? stu(c.student_id).name : '—', line: `${esc(x.by_name)} · ${chLabel(x)}`, flag: [x.status === 'approved' ? '已批准' : x.status === 'rejected' ? '未批准' : '已关掉', x.status === 'approved' ? 'ok' : 'mute']}); });
  DB.feedbacks.filter(f => f.status === 'approved').slice().reverse().slice(0, 15).forEach(f => { const l = L(f.lesson_id), w = who(l); if (!l) return;
    out.push({k: 'f:' + f.id, g: 'done', sid: w.sid, name: w.name, line: `${esc(tea(course(l.course_id).teacher_id).name)} · ${md(l.date)} ${esc(w.subj)}的反馈 · 家长可见`, flag: ['已审批', 'ok']}); });
  return out;
}
// 待处理（2026-11-23 用户要求改回「全部摊开」）：今天要一起处理的事全部列出来，每一条直接带按钮处理，不用一条条点进去；
// 上面一个搜索框，输学生或老师名字就只看相关的（S.v2q.todo）；分类按钮照旧（全部 / 改期请假 / 老师申请 / 反馈审批 / 待确认的课 / 留言·跟进 / 最近处理过的）
function v2TdWho(t, id){   // 搜索用：学生、老师、科目、申请人
  let c = null, extra = '';
  if (t === 'q'){ const q = DB.requests.find(y => y.id === id), l = q && L(q.lesson_id); c = l && course(l.course_id); extra = q ? q.type : ''; }
  else if (t === 'c'){ const x = (DB.changes || []).find(y => y.id === id); c = x && course(x.course_id); extra = x ? `${x.by_name || ''} ${chLabel(x)}` : ''; }
  else if (t === 'f'){ const f = DB.feedbacks.find(y => y.id === id), l = f && L(f.lesson_id); c = l && course(l.course_id); extra = '反馈'; }
  else if (t === 'l'){ const l = L(id); c = l && course(l.course_id); extra = '待确认'; }
  return [c && stu(c.student_id).name, c && tea(c.teacher_id).name, c && c.subject, extra].filter(Boolean).join(' ');
}
function v2TdCard(x){   // 一件事：直接用原来那几种卡片（带按钮），外面包一层，搜索时按 data-q 显示 / 隐藏
  const [t, id] = x.k.split(':'); let h = '';
  if (t === 'q'){ const q = DB.requests.find(y => y.id === id); h = q ? reqCard(q) : ''; }
  else if (t === 'c'){ const c = (DB.changes || []).find(y => y.id === id); h = c ? `<div class="list">${chCard(c, true)}</div>` : ''; }
  else if (t === 'f'){ const f = DB.feedbacks.find(y => y.id === id); h = f ? fbCard(f, {actions: true}) : ''; }
  else if (t === 'l'){ const l = L(id); h = l ? `<div class="list">${pendRow(l)}</div>` : ''; }
  return h ? `<div class="v2-tdi" id="td-${esc(x.k)}" data-q="${esc(fz(v2TdWho(t, id)))}">${h}</div>` : '';
}
function v2Todo(){
  if (typeof v2TdDraft === 'function' && !S.v2tdKeep) S.v2tdKeep = v2TdDraft();   // 重画前：卡片里改过、还没提交的先记下，画完放回去（v2d.js）
  const all = v2TodoItems(), chip = S.v2chip.todo === 'done' && !isTop() ? 'all' : (S.v2chip.todo || 'all');
  const n = g => all.filter(x => x.g === g).length;
  const chips = [['all', '全部', v2TodoTotal(all)], ...(isTop() ? [['req', '改期请假', n('req')]] : []), ['ch', '老师申请', n('ch')], ...(isTop() ? [['fb', '反馈审批', n('fb')]] : []), ['pend', '待确认的课', n('pend')], ['other', '留言 · 跟进'], ...(isTop() ? [['done', '最近处理过的']] : [])];
  const cpOk = chPend().filter(x => !chStuck(x)).length;
  const GROUPS = [
    ['req', '改期 · 请假', '学生在自己的链接里申请；在这里处理，学生和任课老师同时看到结果，课表自动更新', ''],
    ['ch', '老师排课申请', '批准后才会改到课表上', cpOk > 1 ? `<button class="btn sm v2-bulk" data-act="ch-ok-all">全部批准（${cpOk} 条）</button>` : ''],
    ['fb', '反馈审批', '审批通过后家长才能看到；措辞不合适可以先改再通过', n('fb') > 1 ? `<button class="btn sm v2-bulk" data-act="v2-fb-all">全部审批通过（${n('fb')} 条）</button>` : ''],
    ['pend', '待确认的课', '上课时间过了、老师还没写反馈，暂时不计课时和工资。上了就点「已上课」，没上或时长不对点「改时长 / 取消」', n('pend') > 1 ? `<button class="btn sm v2-bulk" data-act="done-all">全部标为已上课（${n('pend')} 节）</button>` : ''],
  ];
  const sec = (g, title, note, bulk, cards) => cards ? `<section class="v2-tds" data-g="${g}"><div class="v2-tdh"><b>${title}</b><span class="v2-tdn">${(cards.match(/class="v2-tdi"/g) || []).length}</span>${bulk}</div>${note ? `<p class="v2-tdnote">${note}</p>` : ''}<div class="v2-tdl">${cards}</div></section>` : '';
  let body = '';
  if (chip === 'done'){
    const done = v2TodoDone();
    body = sec('done', '最近处理过的', '新的在上；误批的反馈可以在这里撤回审批', '', done.map(v2TdCard).join(''));
  } else if (chip === 'other'){
    body = (typeof pgMsgs === 'function' ? `<section class="v2-tds" id="td-msg"><div class="v2-tdh"><b>学生留言</b></div>${v2Legacy(pgMsgs())}</section>` : '')
      + `<section class="v2-tds" id="td-fu"><div class="v2-tdh"><b>跟进记录</b></div>${v2Legacy(pgFollowups())}</section>`;
  } else {
    body = GROUPS.filter(([g]) => chip === 'all' || chip === g).map(([g, title, note, bulk]) => sec(g, title, note, bulk, all.filter(x => x.g === g).map(v2TdCard).join(''))).join('');
    if (chip === 'all'){   // 留言、跟进：有新的才提一句，点进去看
      const others = all.filter(x => x.g === 'other' && x.n);
      if (others.length) body += `<section class="v2-tds" data-g="other"><div class="v2-tdh"><b>留言 · 跟进</b></div><div class="v2-tdl">${others.map(x => `<div class="v2-tdi" id="td-${x.k}" data-q="${esc(fz(x.name))}"><div class="list"><div class="li"><span class="tag ${x.flag ? x.flag[1] : 'mute'}">${esc(x.name)}</span><div class="grow">${x.line}</div><button class="btn sm" data-act="v2-chip" data-v="todo|other">去看 ›</button></div></div></div>`).join('')}</div></section>`;
    }
  }
  const total = chip === 'done' || chip === 'other' ? '' : `${v2TodoTotal(chip === 'all' ? all : all.filter(x => x.g === chip))} 件要处理`;
  return v2Head('待处理', '今天要处理的事都在这一页，直接在每一条上处理')
    + `<div class="v2-tdbar"><label class="v2-search">${v2Ic('search')}<input type="search" data-v2td placeholder="查学生、老师、科目…" value="${esc(S.v2q.todo || '')}" aria-label="查学生、老师"></label>
      <div class="v2-chips">${chips.map(([k, t, c]) => `<button type="button" class="v2-chip ${chip === k ? 'on' : ''}" data-act="v2-chip" data-v="todo|${k}">${t}${c != null ? ` <b>${c}</b>` : ''}</button>`).join('')}</div>
      ${total ? `<span class="muted xs">${total}</span>` : ''}</div>
    <div class="v2-td">${body || `<div class="v2-empty big">${chip === 'done' ? '还没有处理过的' : '都处理完了 👍'}</div>`}<div class="v2-empty big v2-tdnone" hidden>没有找到和「<span></span>」有关的事</div></div>`;
}
// 课表与排课：老师 × 一周（点空格＝给这位老师这天排课）；也能切回原来的月历 / 时间轴
function v2Calendar(){
  const mode = S.v2cal || 'grid';
  const seg = `<div class="seg" role="group" aria-label="看法"><button class="${mode === 'grid' ? 'on' : ''}" data-act="v2-cal" data-v="grid">老师 × 一周</button><button class="${mode === 'old' ? 'on' : ''}" data-act="v2-cal" data-v="old">月历 · 时间轴</button></div>`;
  if (mode === 'old') return `<div class="v2-calseg">${seg}</div>` + v2Legacy(pgCalendar());
  const mon = S.v2wk || (S.v2wk = v2WkMon(TODAY)), days = Array.from({length: 7}, (_, i) => addDay(mon, i));
  const fS = S.calType === 's' && S.calId ? S.calId : '', fT = S.calType === 't' && S.calId ? S.calId : '';   // 只看某个学生 / 某位老师
  const mineL = l => { const c = course(l.course_id); return c && (!fS || c.student_id === fS) && (!fT || c.teacher_id === fT); };
  const ls = DB.lessons.filter(l => l.date >= days[0] && l.date <= days[6] && mineL(l));
  const tids = new Set(ls.map(l => course(l.course_id)?.teacher_id));
  const teachers = DB.teachers.filter(t => tids.has(t.id) || (t.active !== false && DB.courses.some(c => c.teacher_id === t.id && c.active !== false && (!fS || c.student_id === fS))))
    .filter(t => !fT || t.id === fT).sort((a, b) => !!a.staff - !!b.staff || pyCmp(a.name, b.name));
  const exs = examGroups(examsOf(calExSids())).filter(e => e.date >= days[0] && e.date <= days[6]);
  const only = fS || fT ? `<span class="v2-only">只看 <b>${esc(fS ? stu(fS).name : tea(fT).name)}</b><button type="button" class="v2-link" data-act="caltype" data-v="all">看全部 ✕</button></span>${fS && typeof sxBtn === 'function' ? `<button class="btn sm" data-act="v2-sx" data-v="${fS}|${addDay(mon, 3).slice(0, 7)}">导出${+addDay(mon, 3).slice(5, 7)}月课表图片</button>` : ''}` : '';
  const hours = ls.filter(l => l.status === 'scheduled').reduce((a, l) => a + dur(l), 0);
  const chipL = l => { const c = course(l.course_id), f = v2Flag(l);
    return `<button type="button" class="v2-lc ${l.status !== 'scheduled' ? 'off' : ''} ${isPend(l) ? 'pend' : ''} ${f ? 'flag' : ''}" style="--hc:${hue(c.subject)}" data-act="lesson" data-v="${l.id}" title="${esc(`${l.start}–${l.end} ${stu(c.student_id).name} ${c.subject}${l.kind ? '·' + l.kind : ''}${l.topic ? '\n本节：' + l.topic : ''}`)}"><b>${l.start}</b><span class="n">${esc(stu(c.student_id).name)}</span><span class="s">${esc(c.subject)}${l.status === 'leave' ? ' · 请假' : l.status === 'cancelled' ? ' · 取消' : ''}${l.makeup ? ' · 补' : ''}</span>${f ? `<span class="f">${f}</span>` : isPend(l) ? '<span class="f">待确认</span>' : ''}</button>`; };
  const nav = `<div class="v2-wknav"><button class="btn sm" data-act="v2-wk" data-v="-7" aria-label="上一周">‹</button><b>${v2Range(days)}</b><button class="btn sm" data-act="v2-wk" data-v="7" aria-label="下一周">›</button><button class="btn sm" data-act="v2-wk" data-v="0">本周</button>${only}<span class="muted xs">共 ${ls.filter(l => l.status === 'scheduled').length} 节 · ${+hours.toFixed(1)} 小时 · 北京时间${isAdmin() ? ' · <b>点空格给那位老师那天排课</b>' : ''}</span></div>`;
  const acts = isAdmin() ? `${exAddBtn()}<button class="btn pri" data-act="add-lesson" ${DB.courses.length ? '' : 'disabled title="先在学生档案里添加课程"'}>${v2Ic('plus')}排课</button>` : '';
  let body;
  if (v2Phone()){
    const d0 = S.v2day && S.v2day >= days[0] && S.v2day <= days[6] ? S.v2day : (TODAY >= days[0] && TODAY <= days[6] ? TODAY : days[0]);
    const dl = ls.filter(l => l.date === d0), byT = {}; dl.forEach(l => (byT[course(l.course_id).teacher_id] ??= []).push(l));
    body = `<div class="v2-days">${days.map(d => `<button type="button" class="${d === d0 ? 'on' : ''} ${d === TODAY ? 'today' : ''}" data-act="v2-day" data-v="${d}">周${WD[pd(d).getDay()]}<b>${+d.slice(8)}</b>${ls.some(l => l.date === d) ? '<i></i>' : ''}</button>`).join('')}</div>
      ${exs.filter(e => e.date === d0).map(e => exLine(e, true)).join('')}
      ${Object.keys(byT).length ? Object.entries(byT).map(([tid, xs]) => `<section class="v2-box"><div class="v2-bh"><h3>${esc(tea(tid).name)}</h3><button class="btn sm" data-act="v2-slot" data-v="${d0}|${tid}">＋ 排课</button></div><div class="v2-lcs">${xs.map(chipL).join('')}</div></section>`).join('') : `<div class="v2-empty big">这天没有课${isAdmin() ? `<div style="margin-top:8px"><button class="btn pri sm" data-act="v2-slot" data-v="${d0}|">＋ 这天排课</button></div>` : ''}</div>`}`;
  } else {
    const head = `<div class="v2-wk-h"></div>${days.map((d, i) => `<div class="v2-wk-h ${d === TODAY ? 'today' : ''} ${i >= 5 ? 'we' : ''}">周${WD[pd(d).getDay()]}<b>${+d.slice(8)}</b></div>`).join('')}`;
    const exRow = exs.length ? `<div class="v2-wk-t ex">考试</div>${days.map(d => `<div class="v2-wk-c ex">${exs.filter(e => e.date === d).map(e => `<button type="button" class="v2-lc ex" data-act="exam" data-v="${e.tid}|${e.date}" title="${esc(exTitle(e))}"><b>考</b><span class="n">${esc(stu(e.sid).name)}</span><span class="s">${esc(exShort(e.school))} · ${e.label}</span></button>`).join('')}</div>`).join('')}` : '';
    const rows = teachers.map(t => { const tl = ls.filter(l => course(l.course_id).teacher_id === t.id);
      return `<div class="v2-wk-t">${v2Ava(t.name)}<span><b>${esc(t.name)}</b><small>${tl.filter(l => l.status === 'scheduled').length} 节</small></span></div>` + days.map(d => `<div class="v2-wk-c ${d === TODAY ? 'today' : ''} ${isAdmin() ? 'can' : ''}" ${isAdmin() ? `data-act="v2-slot" data-v="${d}|${t.id}" title="点空白处给 ${esc(t.name)} 在 ${md(d)} 排课"` : ''}>${tl.filter(l => l.date === d).map(chipL).join('')}</div>`).join(''); }).join('');
    body = teachers.length || exs.length ? `<div class="v2-wk-wrap"><div class="v2-wk">${head}${exRow}${rows}</div></div>` : '<div class="v2-empty big">还没有老师和课程</div>';   // 2026-11-25：没有课、只有考试的那一周，考试也要显示
  }
  return v2Head('课表与排课', '', acts) + scopeNote() + `<div class="v2-calseg">${seg}</div>` + nav + body;
}

/* ═════════════ 老师 ═════════════ */
const v2TCanWrite = () => DB.lessons.filter(l => (l.date < TODAY || (l.date === TODAY && l.start <= bjHM())) && l.status === 'scheduled' && !fbOf(l));   // 老师能写反馈的课：上过（或正在上）、还没有反馈
// 2026-11-26：教务已经标了「已上课」的课不算「待写」（和旧版一样，不催老师）；放到「教务已确认」那一类里，想补写还能写
const v2TCand = () => v2TCanWrite().filter(l => !l.done_manual);   // 老师要写反馈的课（左边数字、首页提示、反馈批改都用这个）
const v2TExtra = () => v2TCanWrite().filter(l => l.done_manual).reverse();   // 教务确认上过、老师没写的：可以补写，新的在上
const v2TLesson = l => { const c = course(l.course_id), f = fbOf(l), fl = v2Flag(l);
  return `<button type="button" class="v2-tl ${l.status !== 'scheduled' ? 'off' : ''}" style="--hc:${hue(c.subject)}" data-act="${f ? 't-fb' : 'lesson'}" data-v="${f ? f.id : l.id}"><b>${l.start}–${l.end}</b><span class="n">${esc(stu(c.student_id).name)} · ${esc(c.subject)}${l.kind ? ` · ${esc(l.kind)}` : ''}</span>
    <span class="tags">${l.makeup ? '<span class="tag blue">补课</span>' : ''}${l.status === 'leave' ? '<span class="tag seal">请假</span>' : ''}${l.status === 'cancelled' ? '<span class="tag mute">已取消</span>' : ''}${isPend(l) ? '<span class="tag warn">待写反馈</span>' : f ? '<span class="tag ok">已反馈</span>' : ''}${fl ? `<span class="tag warn">${fl}</span>` : ''}</span>${l.topic ? `<span class="tp">本节：${esc(l.topic)}</span>` : ''}</button>`; };
function v2TSched(t){
  const mode = S.v2tcal || 'week';
  const seg = `<div class="seg" role="group" aria-label="看法"><button class="${mode === 'week' ? 'on' : ''}" data-act="v2-tcal" data-v="week">这一周</button><button class="${mode === 'month' ? 'on' : ''}" data-act="v2-tcal" data-v="month">月历</button></div>`;
  const acts = `${seg}<button class="btn pri" data-act="add-lesson">${v2Ic('plus')}申请排课</button>`;
  if (mode === 'month') return v2Head('课表', '北京时间', seg) +v2Legacy(tSchedule(t).replace(/^\s*<h2[^>]*>.*?<\/h2>/, ''));
  const mon = S.v2twk || (S.v2twk = v2WkMon(TODAY)), days = Array.from({length: 7}, (_, i) => addDay(mon, i));
  const ls = lsOfT(t.id).filter(l => l.date >= days[0] && l.date <= days[6]);
  const exs = examGroups(examsOf(exStudentsOfTeacher(t.id))).filter(e => e.date >= days[0] && e.date <= days[6]);
  const miss = v2TCand();
  const nav = `<div class="v2-wknav"><button class="btn sm" data-act="v2-twk" data-v="-7" aria-label="上一周">‹</button><b>${v2Range(days)}</b><button class="btn sm" data-act="v2-twk" data-v="7" aria-label="下一周">›</button><button class="btn sm" data-act="v2-twk" data-v="0">本周</button><span class="muted xs">共 ${ls.filter(l => l.status === 'scheduled').length} 节 · 排课、调课提交后要教务批准</span></div>`;
  const shown = v2Phone() ? days.filter(d => d === TODAY || ls.some(l => l.date === d) || exs.some(e => e.date === d)) : days;
  const cols = shown.map(d => `<div class="v2-day ${d === TODAY ? 'today' : ''}"><div class="v2-dayh">${d === TODAY ? '今天 · ' : ''}周${WD[pd(d).getDay()]} <b>${md(d)}</b></div>
    ${exs.filter(e => e.date === d).map(e => exLine(e, true)).join('')}${ls.filter(l => l.date === d).map(v2TLesson).join('')}
    <button type="button" class="v2-add" data-act="v2-tslot" data-v="${d}" title="申请这天排课">${v2Ic('plus')}<span>排课</span></button></div>`).join('');
  return v2Head('课表', '北京时间', acts)
    + (miss.length ? `<div class="v2-strip warn"><span>有 ${miss.length} 节课还没写反馈</span><button class="v2-link" data-act="tab" data-v="c" data-todo="1">去写 ›</button></div>` : '')
    + (typeof meetTodoNote === 'function' ? meetTodoNote(t) : '') + tChBox() + nav
    + (shown.length ? `<div class="v2-week">${cols}</div>` : '<div class="v2-empty big">这周没有课</div>');
}
function v2TStudents(t){
  const cs = DB.courses.filter(c => c.teacher_id === t.id && c.active), sids = [...new Set(cs.map(c => c.student_id))];
  const mine = lsOfT(t.id);
  const cand = v2TCand(), info = sid => { const pl = cand.filter(l => course(l.course_id).student_id === sid).length,
      g = DB.feedbacks.filter(f => f.hw_sub && !f.hw_fb && cOfF(f)?.student_id === sid).length,
      nx = v2Next(mine.filter(l => course(l.course_id).student_id === sid))[0];
    return {pl, g, nx}; };
  const chip = S.v2chip.ts || 'all';
  const all = sids.map(sid => ({sid, i: info(sid)}));
  const list = all.filter(x => chip === 'all' || x.i.pl + x.i.g > 0).sort((a, b) => (b.i.pl + b.i.g) - (a.i.pl + a.i.g) || pyCmp(stu(a.sid).name, stu(b.sid).name));
  const items = list.map(({sid, i}) => ({k: sid, name: stu(sid).name, flag: i.pl ? ['待写反馈', 'warn'] : i.g ? ['待批改', 'blue'] : null,
    line: i.nx ? `下节 ${v2Day(i.nx.date)} ${i.nx.start} ${esc(course(i.nx.course_id).subject)}${v2Flag(i.nx) ? ' · ' + v2Flag(i.nx) : ''}` : '还没有排课',
    q: [stu(sid).name, stu(sid).track, ...cs.filter(c => c.student_id === sid).map(c => c.subject)].filter(Boolean).join(' ')}));
  const cur = v2Pick('ts', items);
  let detail = '';
  if (cur){
    const s = stu(cur.k), my = cs.filter(c => c.student_id === s.id), i = info(s.id), up = v2Next(mine.filter(l => course(l.course_id).student_id === s.id)).slice(0, 5);
    const fs = DB.feedbacks.filter(f => cOfF(f)?.student_id === s.id).slice(-3).reverse();
    detail = `<div class="v2-card"><div class="v2-ph">${v2Ava(s.name, true)}<div class="v2-pt"><h2>${esc(s.name)}</h2><p>${[s.direction || s.track, s.target_ym ? `目标 ${tgtLabel(s.target_ym)}` : ''].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</p></div>
      <div class="v2-acts">${i.pl + i.g ? `<button class="btn pri sm" data-act="v2-go-write" data-v="${s.id}">${i.pl ? '写反馈' : '批改作业'} ›</button>` : ''}</div></div>
      <div class="v2-grid">
        ${my.map(c => { const fsC = DB.feedbacks.filter(f => L(f.lesson_id)?.course_id === c.id), lastF = fsC[fsC.length - 1], nx = v2Next(mine.filter(l => l.course_id === c.id))[0];
          return v2Box(`${subjTag(c.subject)}`, `<dl class="kv small"><dt>下节课</dt><dd>${nx ? `${v2Day(nx.date)} ${nx.start}–${nx.end}${v2FlagTag(nx)}` : '—'}</dd>
            <dt>${+TODAY.slice(5, 7)} 月计划</dt><dd>${esc(planText(c.id, TODAY.slice(0, 7)) || '还没写')}</dd>
            <dt>上次作业</dt><dd>${lastF && hasHw(lastF) ? `${esc(lastF.hw)} ${lastF.hw_fb ? '<span class="tag ok">已批改</span>' : lastF.hw_sub ? '<span class="tag blue">已交 · 待批改</span>' : '<span class="tag warn">未交</span>'}` : '—'}</dd></dl>`,
            `<button class="btn sm" data-act="t-stu" data-v="${c.id}">档案 · 月计划 · 私下备注</button>`); }).join('')}
        ${v2Box('接下来的课', up.length ? `<div class="v2-lines">${up.map(l => `<button type="button" class="v2-line" data-act="lesson" data-v="${l.id}"><b>${v2Day(l.date)} ${l.start}</b><span>${subjTag(course(l.course_id).subject)}${v2FlagTag(l)}</span></button>`).join('')}</div>` : '<div class="v2-empty">还没有排课</div>')}
        ${v2Box('最近的反馈', fs.length ? `<div class="v2-lines">${fs.map(f => { const l = L(f.lesson_id); return `<button type="button" class="v2-line" data-act="t-fb" data-v="${f.id}"><b>${md(l.date)}</b><span>${esc(String(f.content || '').slice(0, 30))}${String(f.content || '').length > 30 ? '…' : ''}</span></button>`; }).join('')}</div>` : '<div class="v2-empty">还没有写过</div>')}
      </div></div>`;
  }
  const todoN = cand.length, gN = DB.feedbacks.filter(f => f.hw_sub && !f.hw_fb).length;
  const today = todoN + gN ? `<button type="button" class="v2-strip warn v2-today" data-act="tab" data-v="c" data-todo="1"><span><b>今天要处理的</b> · ${[todoN ? `${todoN} 节课待写反馈` : '', gN ? `${gN} 份作业待批改` : ''].filter(Boolean).join(' · ')}</span><span class="v2-link">去处理 ›</span></button>` : '';
  return v2Head('我的学生', fmtMD(TODAY)) + today + (typeof msgTeacherBox === 'function' ? `<div class="v2-msgs">${msgTeacherBox()}</div>` : '')
    + v2Tri({id: 'ts', label: '我的学生', items, sel: cur && cur.k, search: '查学生…', chips: [['all', '全部', all.length], ['todo', '有要处理的', all.filter(x => x.i.pl + x.i.g > 0).length]], chip,
      count: `${items.length} 个学生`, empty: sids.length ? '没有要处理的学生' : '还没有分配学生', detail});
}
function v2TWrite(t){
  const cand = v2TCand();
  const toGrade = DB.feedbacks.filter(f => f.hw_sub && !f.hw_fb);
  const dOf = f => L(f.lesson_id).date, allW = DB.feedbacks.filter(f => L(f.lesson_id) && course(L(f.lesson_id).course_id)).sort((a, b) => dOf(b).localeCompare(dOf(a)));
  const wMonths = [...new Set(allW.map(f => dOf(f).slice(0, 7)))], wm = S.v2twM === 'all' || wMonths.includes(S.v2twM) ? S.v2twM : (wMonths[0] || 'all');
  const written = allW.filter(f => wm === 'all' || dOf(f).startsWith(wm));   // Codex 复查第三批第 4 条：按月份看全部，和原来一样
  const extra = v2TExtra();
  if (S.v2chip.tw === 'extra' && !extra.length){ S.v2chip.tw = 'todo'; wTags.clear(); }   // 这一类空了就回「要做的」，并且记住（不然以后教务再确认一节，页面会自己跳回这一类）；给上一节课点的学生状态不带到别的课（Codex 复查）
  const chip = S.v2chip.tw || 'todo';
  const sName = l => stu(course(l.course_id).student_id).name;
  const items = chip === 'extra'
    ? extra.map(l => ({k: 'w:' + l.id, name: sName(l), line: `${md(l.date)} ${l.start} ${esc(course(l.course_id).subject)} · 教务已确认上过`, flag: ['可补写', 'mute'], q: sName(l) + course(l.course_id).subject}))
    : chip === 'done'
    ? written.map(f => { const l = L(f.lesson_id), c = course(l.course_id); return {k: 'd:' + f.id, name: sName(l), line: `${md(l.date)} ${esc(c.subject)} · ${esc(String(f.content || '').slice(0, 16))}`, flag: f.status === 'approved' ? ['家长可见', 'ok'] : ['待审核', 'mute'], q: sName(l) + c.subject + (f.content || '')}; })
    : [...cand.map(l => { const on = !lesEnded(l); return {k: 'w:' + l.id, name: sName(l), line: `${md(l.date)} ${l.start} ${esc(course(l.course_id).subject)} · ${on ? '上课中，可以先写' : l.date === TODAY ? '今天下的课' : `下课 ${dBetween(l.date, TODAY)} 天`}`, flag: on ? ['上课中', 'blue'] : ['待写', 'warn'], q: sName(l) + course(l.course_id).subject}; }),
       ...toGrade.map(f => { const l = L(f.lesson_id); return {k: 'g:' + f.id, name: sName(l), line: `${md(l.date)} 布置 · ${esc(String(f.hw || '').slice(0, 14))}`, flag: ['待批改', 'blue'], q: sName(l) + (f.hw || '')}; })];
  const cur = v2Pick('tw', items);
  let detail = '';
  if (cur){
    const [k, id] = cur.k.split(':');
    if (k === 'w'){ const l = L(id), c = course(l.course_id);
      detail = `<div class="v2-card"><div class="v2-dh">${v2Ava(cur.name, true)}<div class="v2-pt"><h2>${esc(cur.name)}</h2><p>${fmtMD(l.date)} ${l.start}–${l.end} · ${subjTag(c.subject)}${l.kind ? ` · ${esc(l.kind)}` : ''}</p></div></div>
      ${l.done_manual ? '<div class="note">这节课教务已经确认上过了，<b>不写也可以</b>。想补一条反馈，照常填就行。</div>' : ''}
      <div class="note warn">这条反馈学生会马上看到，<b>教务审核后家长也能看到</b>，请注意用词。不方便让家长看的内容，写到「我的学生 → 私下备注」。</div>
      <input type="hidden" id="w-lesson" value="${l.id}">
      <label class="field"><span>一、本节授课内容</span><textarea id="w-content" placeholder="例：听解练习，要求学生用日语复述听力内容">${esc(l.topic || '')}</textarea></label>
      <label class="field"><span>二、学生课堂表现</span><textarea id="w-perf" placeholder="例：课堂状态良好，能积极参与练习"></textarea></label>
      <div class="field"><span>学生状态（点选，可多选）</span><div class="chips">${[...TAGS_GOOD, ...TAGS_WARN].map(x => `<button type="button" class="chip ${wTags.has(x) ? 'on' : ''}" data-act="w-tag" data-v="${x}">${x}</button>`).join('')}</div></div>
      <label class="field"><span>三、课后作业安排</span><textarea id="w-hw" placeholder="例：1. 复习本节生词  2. 完成长文 1–10"></textarea></label>
      <label class="field"><span>作业图片 / PDF（可以不选；学生在「作业」里能看到，最多 9 个）</span><input type="file" id="w-hwfiles" accept="image/*,.pdf,application/pdf" multiple></label>
      <div class="fields"><label class="field"><span>实际上课时长</span><select id="w-hrs">${wHrsOpts(l)}</select></label><label class="field"><span>时长不一样的原因</span><input type="text" id="w-why" placeholder="例：学生临时有事，提前半小时结束"></label></div>
      <label class="field"><span>上次作业完成情况</span><select id="w-last"><option>已完成</option><option>部分完成</option><option>未完成</option><option>没有布置</option></select></label>
      <div class="row"><button class="btn pri" data-act="submit-fb">提交反馈</button><span class="muted xs">提前结束或者上超了，在上面改时长；工资按实际时长算。</span></div></div>`; }
    else if (k === 'g'){ const f = DB.feedbacks.find(x => x.id === id), l = L(f.lesson_id), c = course(l.course_id);
      detail = `<div class="v2-card"><div class="v2-dh">${v2Ava(cur.name, true)}<div class="v2-pt"><h2>${esc(cur.name)}</h2><p>${md(l.date)} 布置 · ${subjTag(c.subject)} · 学生已交</p></div></div>
      <div class="v2-box"><div class="v2-bh"><h3>布置的作业</h3></div><div>${esc(f.hw)}</div>${fileList(f.id, 'hwref', '作业图片')}</div>
      ${f.hw_note ? `<div class="note">学生说：${esc(f.hw_note)}</div>` : ''}${fileList(f.id, 'hw', '学生交的作业')}${fileList(f.id, 'grade', '我的批改文件')}
      <label class="field"><span>批改意见（学生能看到）</span><textarea id="gr-${f.id}" placeholder="例：比例准了很多，手部再多练几张"></textarea></label>
      <div class="row"><button class="btn pri" data-act="grade" data-v="${f.id}">批改完成</button>${uploadBtn('grade', f.id, '上传批改文件')}<button class="btn sm" style="margin-left:auto" data-act="grade-seen" data-v="${f.id}">看过了，不用批改</button></div></div>`; }
    else { const f = DB.feedbacks.find(x => x.id === id), l = L(f.lesson_id), c = course(l.course_id);
      detail = `<div class="v2-card"><div class="v2-dh">${v2Ava(cur.name, true)}<div class="v2-pt"><h2>${esc(cur.name)}</h2><p>${fmtMD(l.date)} · ${subjTag(c.subject)} · <span class="tag ${f.status === 'approved' ? 'ok' : 'warn'}">${f.status === 'approved' ? '已审核 · 家长可见' : '待教务审核'}</span>${hrsTag(l)}</p></div></div>
      <div class="fb"><div class="sec"><b>一、本节授课内容</b><p>${esc(f.content || '—')}</p></div>${tFbRest(f)}${fileList(f.id, 'hwref', '作业图片')}${fileList(f.id, 'note', '上课笔记')}</div>
      <div class="row">${uploadBtn('hwref', f.id, '补传作业图片')}${uploadBtn('note', f.id, '上传上课笔记')}</div><div class="muted xs">反馈内容要改，请联系教务老师。</div></div>`; }
  }
  const top = chip === 'done' && wMonths.length ? `<select class="v2-msel" data-change="v2-twm" aria-label="月份">${wMonths.map(m => `<option value="${m}" ${m === wm ? 'selected' : ''}>${ymLabel(m)}</option>`).join('')}<option value="all" ${wm === 'all' ? 'selected' : ''}>全部月份</option></select>` : '';
  return v2Head('反馈批改') + v2Tri({id: 'tw', label: '反馈批改', items, sel: cur && cur.k, search: '查学生…', chips: [['todo', '要做的', cand.length + toGrade.length], ...(extra.length ? [['extra', '教务已确认', extra.length]] : []), ['done', '我写过的', allW.length]], chip, top,
    count: chip === 'extra' ? `${items.length} 节 · 不写也可以 · 新的在上` : chip === 'done' ? `${wm === 'all' ? '全部月份' : ymLabel(wm)} · ${items.length} 条 · 新的在上` : `${items.length} 件 · 早的在上`, empty: chip === 'done' ? '还没有写过反馈' : '上完的课都写好反馈了，作业也批完了 👍', detail, emptyDet: '都处理完了 👍'});
}

/* ═════════════ 学生、家长 ═════════════ */
// 「进入课堂」：开课前 30 分钟到下课能点；没到点写「11/24 09:30 可进入」
function v2Meet(l){
  if (typeof meetOk !== 'function' || !meetOk(l)) return '';
  const open = tstr(Math.max(0, mins(l.start) - 30)), n = nowBJ();
  if (l.date === TODAY && n >= open && n < l.end) return meetBtn(l, {big: true, label: '进入课堂'});
  return `<span class="v2-pill">${MEET_IC}${md(l.date)} ${open} 可进入</span>`;
}
function v2NextBlock(l, s){
  if (!l) return `<div class="v2-empty">近期没有排课</div>`;
  const c = course(l.course_id), q = reqOf(l), fl = v2Flag(l);
  return `<div class="v2-next" style="--hc:${hue(c.subject)}"><div class="v2-nt"><b class="num">${l.start}</b><div><b>${v2Day(l.date)} · ${esc(tName(c.teacher_id))}</b><span>到 ${l.end} · ${esc(c.subject)}${l.kind ? ` · ${esc(l.kind)}` : ''}${BJ}</span></div></div>
    ${l.topic ? `<div class="v2-topic">本节：${esc(l.topic)}</div>` : ''}${fl ? `<div><span class="tag warn">${fl}</span></div>` : ''}${q && q.status !== 'pending' ? reqLine(q) : ''}
    ${PRO() ? '' : `<div class="row">${v2Meet(l)}${!(q && q.status === 'pending') ? `<button class="btn sm" data-act="req-open" data-v="${l.id}">请假 / 改期</button>` : ''}</div>`}</div>`;
}
function v2HwLine(f){
  const l = L(f.lesson_id), c = course(l.course_id), st = f.hw_fb ? ['批改好了', 'ok'] : f.hw_sub ? ['等批改', 'blue'] : ['要交', 'warn'];
  return `<button type="button" class="v2-hwl" data-act="tab" data-v="c"><span class="t">${esc(f.hw)}</span><span class="m">${subjTag(c.subject)} · ${md(l.date)} 布置</span><span class="tag ${st[1]}">${st[0]}</span></button>`;
}
function v2SHome(s){
  const h = +nowBJ().slice(0, 2), greet = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  const cs = DB.courses.filter(c => c.student_id === s.id && c.active !== false), subs = [...new Set(cs.map(c => c.subject))];
  const sub = subs.includes(S.v2subj) ? S.v2subj : 'all';
  const inSub = l => sub === 'all' || course(l.course_id)?.subject === sub, fInSub = f => sub === 'all' || cOfF(f)?.subject === sub;
  const up = v2Next(lsOfS(s.id)), un = sUnHw(s), nc = sUnConfirm(s);
  // 顶上一条：最要紧的一件事
  const strip = un.length ? `<button type="button" class="v2-strip" data-act="tab" data-v="c"><span>${v2Ic('go')}有 ${un.length} 份作业还没交：${esc(String(un[0].hw || '').slice(0, 20))}</span><span class="v2-link">去交作业 ›</span></button>`
    : nc.length ? `<button type="button" class="v2-strip" data-act="tab" data-v="d"><span>有 ${nc.length} 节课还没确认</span><span class="v2-link">去确认 ›</span></button>`
    : sSelfDue(s) ? `<button type="button" class="v2-strip" data-act="v2-self"><span>${+TODAY.slice(5, 7)} 月的自我评价还没写：这个月学得怎么样？</span><span class="v2-link">去写 ›</span></button>` : '';
  const tabs = `<div class="v2-tabs" role="tablist">${[['all', '全部'], ...subs.map(x => [x, x])].map(([k, t]) => `<button type="button" role="tab" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}" data-act="v2-subj" data-v="${esc(k)}" style="--hc:${k === 'all' ? 'var(--gold)' : hue(k)}">${k === 'all' ? '' : '<i></i>'}${esc(t)}</button>`).join('')}</div>`;
  const nx = up.find(inSub), hw = latestHw(s.id).filter(fInSub), fs = fbOfS(s.id).filter(fInSub), lastF = fs[fs.length - 1];
  const ym = TODAY.slice(0, 7), mLs = lsOfS(s.id).filter(l => l.date.startsWith(ym) && inSub(l));
  const doneN = mLs.filter(isDone).length, leftN = mLs.filter(l => l.status === 'scheduled' && !isDone(l) && !isPend(l)).length;
  const plan = sub === 'all' ? mpView(s.id, ym) : (() => { const c = cs.find(x => x.subject === sub); const t = c && planText(c.id, ym); return t ? `<div class="small">${esc(t)}</div>` : '<div class="muted small">这个月的计划还没写</div>'; })();
  const book = `<div class="v2-book">${tabs}<div class="v2-page"><div class="v2-pcol">
      ${v2Box('下节课', v2NextBlock(nx, s), `<button class="btn sm" data-act="tab" data-v="b">课表 ›</button>`)}
      ${v2Box('作业', hw.length ? `<div class="v2-lines">${hw.map(v2HwLine).join('')}</div>` : '<div class="v2-empty">暂时没有作业</div>')}
    </div><div class="v2-pcol">
      ${v2Box('老师最近说', lastF ? `<div class="v2-say">${v2Ava(tea(cOfF(lastF).teacher_id).name)}<div><p>${esc(String(lastF.content || '').slice(0, 90))}${String(lastF.content || '').length > 90 ? '…' : ''}</p><small>${md(L(lastF.lesson_id).date)} · ${esc(tName(cOfF(lastF).teacher_id))}</small></div></div>${fileList(lastF.id, 'note', '上课笔记')}` : '<div class="v2-empty">上完第一节课后，老师写的反馈会出现在这里</div>', `<button class="btn sm" data-act="tab" data-v="d">全部 ›</button>`)}
      ${v2Box(`这个月${sub === 'all' ? '' : ' · ' + esc(sub)}`, `<div class="v2-nums"><div><b>${doneN}</b><small>已上</small></div><div><b>${leftN}</b><small>还有</small></div><div><b>${hw.filter(f => !f.hw_sub).length}</b><small>作业没交</small></div></div><div class="v2-plan"><b class="xs muted">${+ym.slice(5)} 月学习计划</b>${plan}</div>`)}
    </div></div></div>`;
  const confirmBox = nc.length ? v2Box('要你确认', nc.slice(-3).reverse().map(f => { const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="v2-cf"><b>${md(l.date)} 周${WD[pd(l.date).getDay()]} ${esc(c.subject)}，上得怎么样？</b><span class="muted xs">点一下就算确认上过了；满意不满意只给教务看</span><div class="row"><button class="btn pri sm" data-act="confirm" data-v="${f.id}|满意">满意</button><button class="btn sm" data-act="confirm" data-v="${f.id}|不满意">不满意</button></div></div>`; }).join(''),
    nc.length > 3 ? `<button class="btn sm" data-act="tab" data-v="d">全部 ${nc.length} 节 ›</button>` : '', 'hot') : '';
  const soon = v2Box('接下来', up.length ? `<div class="v2-dots">${up.slice(0, 4).map(l => { const c = course(l.course_id); return `<div style="--hc:${hue(c.subject)}"><i></i><b>${v2Day(l.date)} ${l.start}</b><span>${esc(c.subject)} · ${esc(tName(c.teacher_id))}${v2Flag(l) ? ` · <em>${v2Flag(l)}</em>` : ''}</span></div>`; }).join('')}</div>` : '<div class="v2-empty">还没有排课</div>');
  return v2Head(`${esc(v2Given(s.name))}，${greet}`, `${fmtMD(TODAY)} · 北京时间`) + strip
    + `<div class="v2-home"><div class="v2-hmain">${book}</div><div class="v2-hside">${confirmBox}${soon}${sCountdown(s)}${sCkCard(s)}${typeof sWordCard === 'function' ? sWordCard(s) : ''}${typeof sMsgEntry === 'function' ? sMsgEntry() : ''}</div></div>`;
}
function v2HwGroups(s){
  const cur = latestHw(s.id), older = fbOfS(s.id).filter(f => !cur.includes(f) && hasHw(f)).slice(-12).reverse(), all = [...cur, ...older];
  return {now: cur.filter(f => !f.hw_sub), late: older.filter(f => !f.hw_sub), wait: all.filter(f => f.hw_sub && !f.hw_fb), done: all.filter(f => f.hw_fb).slice(0, 10)};
}
function v2PHome(s){
  const ym = TODAY.slice(0, 7), st = monthStats(s.id, ym), G = v2HwGroups(s);
  const nTodo = G.now.length, nWait = G.wait.length, nOk = G.done.length;
  const up = v2Next(lsOfS(s.id));
  return v2Head(`${esc(s.name)}同学的学习情况`, fmtMD(TODAY), typeof mrBtn === 'function' ? mrBtn(s.id) : '')
    + `<div class="v2-strip soft"><span>老师的课后反馈由教务审核后发布在这里</span></div>`
    + `<div class="v2-home"><div class="v2-hmain"><div class="v2-grid">
        ${v2Box('下节课', v2NextBlock(up[0], s), `<button class="btn sm" data-act="tab" data-v="b">课表 ›</button>`)}
        ${v2Box('作业进度', `<div class="v2-nums"><div class="${nTodo ? 'warn' : ''}"><b>${nTodo}</b><small>要交</small></div><div><b>${nWait}</b><small>等批改</small></div><div><b>${nOk}</b><small>批改好了</small></div></div>`, `<button class="btn sm" data-act="tab" data-v="c">看作业 ›</button>`)}
        ${v2Box(`${+ym.slice(5)} 月出勤`, st.req ? `<div class="v2-nums"><div><b>${st.actual}/${st.req}</b><small>出勤</small></div><div class="${st.leave ? 'warn' : ''}"><b>${st.leave}</b><small>请假</small></div><div><b>${st.fbN ? st.hwOk + '%' : '—'}</b><small>作业完成</small></div></div>` : '<div class="v2-empty">这个月还没有上完的课</div>')}
        ${v2Box(`${+ym.slice(5)} 月学习计划`, mpView(s.id, ym))}
      </div>${sLastFb(s)}</div>
      <div class="v2-hside">${v2Box('接下来', up.length ? `<div class="v2-dots">${up.slice(0, 5).map(l => { const c = course(l.course_id); return `<div style="--hc:${hue(c.subject)}"><i></i><b>${v2Day(l.date)} ${l.start}</b><span>${esc(c.subject)} · ${esc(tName(c.teacher_id))}${v2Flag(l) ? ` · <em>${v2Flag(l)}</em>` : ''}</span></div>`; }).join('')}</div>` : '<div class="v2-empty">还没有排课</div>')}${sCountdown(s)}${sCkCard(s)}${typeof sMsgEntry === 'function' ? sMsgEntry() : ''}</div></div>`;
}
// 作业：要交 / 等批改 / 批改好了 三组
function v2SHw(s){
  const ro = PRO(), who = ro ? '孩子' : '我';
  const G = v2HwGroups(s), wait = G.wait, done = G.done;
  const item = f => { const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="v2-hw" style="--hc:${hue(c.subject)}"><div class="v2-hwm">${subjTag(c.subject)}<span class="muted xs">${esc(tName(c.teacher_id))} · ${md(l.date)} 布置</span></div>
      <div class="v2-hwt">${esc(f.hw)}</div>${fileList(f.id, 'hwref', '老师给的作业图片')}
      ${!ro && !f.hw_sub ? `<div class="row">${uploadBtn('hw', f.id, '上传作业照片 / PDF')}<button class="btn pri sm" data-act="hw-done" data-v="${f.id}">我完成了</button></div>` : ''}
      ${!ro && f.hw_sub && !f.hw_fb ? `<div class="row">${uploadBtn('hw', f.id, '再传几张')}<button class="btn sm" style="margin-left:auto" data-act="hw-undo" data-v="${f.id}" title="点错了「我完成了」？老师批改前可以撤回">还没做完，撤回</button></div>` : ''}
      ${fileList(f.id, 'hw', `${who}交的作业`)}${fileList(f.id, 'grade', '老师的批改')}
      ${f.hw_note ? `<div class="muted xs">${who}说：${esc(f.hw_note)}</div>` : ''}${f.hw_fb ? `<div class="note"><b>老师批改：</b>${esc(f.hw_fb)}</div>` : ''}</div>`; };
  const col = (t, cls, xs, empty, extra = '') => `<section class="v2-col"><div class="v2-colh ${cls}"><b>${t}</b><span>${xs.length}</span></div>${xs.length ? xs.map(item).join('') : `<div class="v2-empty">${empty}</div>`}${extra}</section>`;
  const late = G.late.length ? `<div class="v2-sep">以前没交的 · ${G.late.length} 份${ro ? '' : '，可以补交'}</div>${G.late.map(item).join('')}` : '';
  return v2Head('作业', ro ? '只能看' : '交了作业点「我完成了」，老师批改后在右边看')
    + `<div class="v2-cols">${col('要交', 'warn', G.now, '这次的都交了 👍', late)}${col('等批改', 'blue', wait, '没有等批改的')}${col('批改好了', 'ok', done, '还没有批改好的')}</div>`;
}

/* ───────── 画完以后：搜索框按原来的字筛一遍 ───────── */
function v2Filter(id){
  const q = (S.v2q[id] || '').trim().toLowerCase(), box = document.querySelector(`[data-tri="${id}"]`); if (!box) return;
  let n = 0; box.querySelectorAll('.v2-row').forEach(r => { const hit = !q || (r.dataset.q || '').toLowerCase().includes(q); r.hidden = !hit; if (hit) n++; });
  let em = box.querySelector('.v2-nohit'); if (q && !n){ if (!em) box.querySelector('.v2-rows').insertAdjacentHTML('beforeend', '<div class="v2-empty v2-nohit">没有找到</div>'); } else if (em) em.remove();
  // Codex 复查第 2 条：右边正在看的那个被搜索挡住了 → 右边先不显示（免得对着看不见的人操作）；件数跟着搜索变；搜索时不给「全部……」这类一次批好几条的按钮
  const on = box.querySelector('.v2-row.on'); box.classList.toggle('nosel', !!q && (!on || on.hidden));
  const ct = box.querySelector('.v2-count'); if (ct){ ct.dataset.orig ??= ct.textContent; ct.textContent = q ? `搜到 ${n} 个` : ct.dataset.orig; }
  box.querySelectorAll('.v2-bulk').forEach(b => b.hidden = !!q);
}
function v2After(){ document.querySelectorAll('[data-v2q]').forEach(i => v2Filter(i.dataset.v2q)); }
const v2Dirty = () => !!document.querySelector('.v2-det[data-dirty]');
document.addEventListener('input', e => {
  const i = e.target.closest?.('[data-v2q]');
  if (!i){ const d = e.target.closest?.('.v2-det'); if (d) d.dataset.dirty = '1'; return; }   // 右边填了东西：记下来，换人、换页前先问
  S.v2q[i.dataset.v2q] = i.value; v2Filter(i.dataset.v2q);
  S.dirtyMain = v2Dirty();   // 只是在搜索框打字不算「填了一半」；右边有填了一半的就还算（Codex 复查第 6 条）
});
// 先于原来的按钮处理（捕获阶段）：右边有填了一半没保存的内容，换人、换页、筛选、返回前先问一句；从别处点名打开学生，记下来
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || V2.ver !== 'new' || !document.body.classList.contains('v2')) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (a.closest('#modal-root')) return;
  const LEAVE = ['page', 'tab', 'v2-sel', 'v2-chip', 'v2-back', 'v2-subj', 'v2-go-write', 'student', 'v2-cal', 'v2-tcal', 'v2-wk', 'v2-twk', 'book', 'stu-tab', 'student-tab', 'v2-ssub', 'v2-ov', 'v2-go-todo', 'v2-ap', 'v2-apym', 'v2-ap-open', 'v2-go-ts'];
  if (LEAVE.includes(k) && v2Dirty() && !(k === 'v2-sel' && a.classList.contains('on') && !v2Phone())
      && !confirm('右边填的内容还没保存，离开会丢掉。\n\n确定离开吗？')){ e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (k === 'student') S.v2jump = v;
  if (k === 'student-tab' || k === 'stu-tab') S.v2jump = v.split('|')[0];
}, true);

/* ───────── 新版的按钮 ───────── */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (V2.ver !== 'new' || !document.body.classList.contains('v2')) { if (k === 'v2-ui-new') v2Set('new'); return; }
  // 原来的按钮（app.js 先处理完）：换页时手机上回到名单；「去处理」「去审批」这类跳到待处理的对应一类；从别处点学生名字，手机上直接打开详情
  if (k === 'page' || k === 'tab'){
    S.v2open = null;
    // Codex 复查第 14 条：「学生留言」「跟进记录」直接选中那一项，手机上直接打开
    const TODO = {todo: ['all'], requests: ['req'], 'requests-ch': ['ch'], feedback: ['fb'], 'feedback-missing': ['pend'], msgs: ['other', 'msg'], followups: ['other', 'fu']};
    if (k === 'page' && TODO[v]){ S.v2chip.todo = TODO[v][0]; S.v2idx.todo = 0; S.v2sel.todo = TODO[v][1] || null; S.v2q.todo = ''; if (TODO[v][1] && v2Phone()) S.v2open = 'todo'; }
    // 2026-11-26（Codex 复查）：老师点「有 N 节课还没写反馈 · 去写」「今天要处理的 · 去处理」：一定打开「要做的」，不留上次看的分类和搜索的名字
    if (k === 'tab' && a.dataset.todo){ if ((S.v2chip.tw || 'todo') !== 'todo') wTags.clear(); S.v2chip.tw = 'todo'; S.v2q.tw = ''; S.v2idx.tw = 0; }
    render(); return;
  }
  if ((k === 'student' || k === 'student-tab') && v2Phone()){ S.v2open = 'stu'; S.v2sel.stu = v.split('|')[0]; render(); window.scrollTo(0, 0); return; }
  if (!k.startsWith('v2-')) return;
  try {
  switch (k){
    case 'v2-ui-old-ask': v2OldAsk(); break;
    case 'v2-look': v2LookModal(); break;
    case 'v2-theme': {   // 换配色：马上生效；「打开看看」时只换这一页，不记
      V2.theme = V2_THEMES.some(x => x[0] === v) ? v : 'notion'; document.body.dataset.theme = V2.theme;
      if (!PEEK) { V2.themeTouched = true; try { localStorage.setItem(v2ThemeKey(), V2.theme); } catch(e) {}
        rpc('ui_theme_set', {theme: V2.theme}).catch(() => toast('网络不稳，这次只在这台设备上换了；换别的手机、电脑打开可能还是原来的颜色', true, 6000)); }
      document.querySelectorAll('.v2-sw').forEach(b => { const on = b.dataset.v === V2.theme; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      break; }
    case 'v2-ui-old': v2Set('old', val('v2-why').trim()); break;
    case 'v2-ui-new': v2Set('new'); break;
    case 'v2-ui-seen': V2.seen = true; v2Save(); if (!PEEK) rpc('ui_pref_set', {ver: 'seen'}).catch(() => {}); document.querySelector('.v2-banner')?.remove(); break;
    case 'v2-sel': {
      const i = v.indexOf('|'), id = v.slice(0, i), key = v.slice(i + 1);
      if (S.v2sel[id] === key && !v2Phone()) break;
      if (S.v2sel[id] !== key && id === 'tw') wTags.clear();
      S.v2sel[id] = key;
      if (id === 'stu'){ S.stuId = key; S.page = 'student'; }
      const ph = v2Phone(); if (ph){ S.v2scroll[id] = window.scrollY; S.v2open = id; }
      render();
      if (ph) window.scrollTo(0, 0);
      else { const d = document.querySelector(`[data-tri="${id}"]`); if (d && d.getBoundingClientRect().top < 0) d.scrollIntoView({block: 'start'}); }
      break; }
    case 'v2-back': S.v2open = null; render(); window.scrollTo(0, S.v2scroll[v] || 0); break;
    case 'v2-chip': { const [id, c] = v.split('|');
      // 2026-11-25：待处理摊开以后，卡片里写了一半的（不同意原因、改措辞、改期时间）换分类会丢——先问一句
      if (id === 'todo' && v2TdDraft().length && !confirm('这一页有写了一半还没提交的内容，换过去会丢掉。\n\n确定换过去吗？')) break;
      if (id === 'tw') wTags.clear();   // 老师换「要做的 / 我写过的」：给上一节课点的学生状态不带到别的课
      if (id === 'ck') S.v2sel.ck = null;   // 通关点检：手动换分类时不带着上一类选中的学生（不然点「还没建表」会被弹回「有点检表」）
      S.v2chip[id] = c; S.v2idx[id] = 0; if (S.v2open === id) S.v2open = null; render(); break; }
    case 'v2-cal': S.v2cal = v; render(); break;
    case 'v2-sx': { const [sid, ym] = v.split('|'); if (typeof sxOpen === 'function') sxOpen(sid, ym); break; }
    case 'v2-wk': S.v2wk = v === '0' ? v2WkMon(TODAY) : addDay(S.v2wk || v2WkMon(TODAY), Number(v)); render(); break;
    case 'v2-day': S.v2day = v; render(); break;
    case 'v2-slot': {   // 「老师 × 一周」点空格：那位老师、那天，时间先填 18:00–20:00
      if (!isAdmin()) break;
      if (e.target.closest('.v2-lc') && e.target.closest('.v2-lc') !== a) break;
      const [d, tid] = v.split('|'); S.alPre = {d, s: '18:00', e: '20:00', tid: tid || ''}; addLessonModal(); break; }
    case 'v2-tcal': S.v2tcal = v; render(); break;
    case 'v2-twk': S.v2twk = v === '0' ? v2WkMon(TODAY) : addDay(S.v2twk || v2WkMon(TODAY), Number(v)); render(); break;
    case 'v2-tslot': S.alPre = {d: v, s: '18:00', e: '20:00'}; addLessonModal(); break;
    case 'v2-go-write': {   // 老师「我的学生」→ 反馈批改，直接选中这个学生的第一件
      S.tab = 'c'; S.v2chip.tw = 'todo'; S.v2q.tw = '';   // 2026-11-25：反馈页搜索框里留着别的学生名字时，会选到别人的课——跳过去先清搜索
      const l = DB.lessons.find(x => (x.date < TODAY || (x.date === TODAY && x.start <= bjHM())) && x.status === 'scheduled' && !fbOf(x) && !x.done_manual && course(x.course_id).student_id === v);
      const f = !l && DB.feedbacks.find(x => x.hw_sub && !x.hw_fb && cOfF(x)?.student_id === v);
      S.v2sel.tw = l ? 'w:' + l.id : f ? 'g:' + f.id : null; wTags.clear();
      if (v2Phone() && S.v2sel.tw) S.v2open = 'tw';
      render(); window.scrollTo(0, 0); break; }
    case 'v2-subj': S.v2subj = v; render(); break;
    case 'v2-fb-all': {
      // 2026-11-25 全面检查：只批屏幕上现在看得到的那几条，版本号也用屏幕上的。
      //   以前是从后台刚读进来的数据里取：页面没重画时（正在别处打字），老师新交的、刚改过的，教务没看过也会一起批掉、放给家长
      const bs = [...document.querySelectorAll('.v2-td .v2-tdi:not([hidden]) [data-act="approve"][data-v]')].filter(b => b.dataset.ver);
      const ids = bs.map(b => b.dataset.v), vers = Object.fromEntries(bs.map(b => [b.dataset.v, b.dataset.ver])); if (!ids.length) break;
      const editing = document.querySelector('.v2-td [data-act="save-edit"]') ? '\n（正在「先修改措辞」的那一条不在里面，改完保存后再单独批）' : '';
      if (!confirm(`把页面上这 ${ids.length} 条待审批的反馈全部审批通过？\n通过后家长就能看到。${editing}`)) break;
      await act('admin_feedback_approve', {ids, vers}, r => r === ids.length ? `已审批 ${r} 条` : `已审批 ${r} 条；另外 ${ids.length - r} 条老师刚改过，请重新看一遍再批`); break; }
    case 'v2-stats': v2Stats(); break;
  }
  } catch(err) { if (err && err.message !== 'busy') toast(err.message || '操作没成功，请稍后再试', true); }
});

/* ───────── 总管理：新版使用情况（只有总管理，Project K 视图里不显示） ───────── */
async function v2Stats(){
  if (!ownerUI()) return;
  let r; try { r = await rpc('admin_ui_stats'); } catch(e){ toast(/没有权限|function|找不到|schema/i.test(e.message) ? '数据库第 64 步还没运行，暂时看不到' : e.message, true); return; }
  const P = r.people || [], E = r.events || [];
  const RN = {admin_top: '教务 · 管理', admin_normal: '教务', teacher: '老师', student: '学生', parent: '家长'};
  const since = addDay(TODAY, -30), recent = P.filter(x => x.last_seen && x.last_seen.slice(0, 10) >= since);
  const rows = Object.keys(RN).map(k => { const xs = recent.filter(x => x.role === k); return xs.length ? `<tr><td>${RN[k]}</td><td class="num">${xs.filter(x => x.ver !== 'old').length}</td><td class="num">${xs.filter(x => x.ver === 'old').length}</td></tr>` : ''; }).join('');
  const why = E.filter(x => x.ver === 'old' && x.why);
  const themes = V2_THEMES.map(([k, t]) => [t, recent.filter(x => (x.theme || 'notion') === k && x.ver !== 'old').length]);
  openModal(`${mHead('新版使用情况')}
  <div class="muted xs">最近 30 天打开过的人里，现在用新版、旧版的各有几位（没选过的算新版）。只有总管理看得到。</div>
  ${rows ? `<div class="tw"><table class="rt"><thead><tr><th>身份</th><th>用新版</th><th>用旧版</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">最近 30 天还没有人打开过</div>'}
  ${rows ? `<div class="small"><b>用新版的人选的配色：</b>${themes.map(([t, n]) => `${t} ${n} 人`).join(' · ')}</div>` : ''}
  <b class="small">切回旧版时写的原因（${why.length} 条）</b>
  ${why.length ? `<div class="list">${why.slice(0, 50).map(x => `<div class="li small"><span class="muted num">${esc(bjAt(x.at).slice(5, 16))}</span><span class="grow"><b>${esc(x.name)}</b>（${RN[x.role] || ''}）：${esc(x.why)}</span></div>`).join('')}</div>` : '<div class="muted small">还没有人写</div>'}
  <div class="row" style="justify-content:flex-end"><button class="btn pri" data-act="close">知道了</button></div>`, true);
}
