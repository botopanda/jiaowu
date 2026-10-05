/* ══════════════════════════════════════════════════════════════
   一对一教务台 · 正式版第 1 版
   数据全部通过 Supabase 的「门卫函数」读写（见 数据库/01_建表与权限.sql）。
   网页只用浏览器自带的 fetch，不加载任何外部脚本。
   ══════════════════════════════════════════════════════════════ */
const SB_URL = 'https://euwsrpppykescwflgtgu.supabase.co';
const SB_KEY = 'sb_publishable_Lgyp6nefs88z4X01-1v3wA_gPJNl8fW';   // 公开用的大门钥匙，本来就放在网页里

/* ───────── 专属钥匙：链接里的 ?k=，本机记住一份 ───────── */
function readKey(){
  const q = new URLSearchParams(location.search).get('k');
  try { if (q) localStorage.setItem('jw_k', q); } catch(e) {}
  if (q) return q;
  try { return localStorage.getItem('jw_k') || ''; } catch(e) { return ''; }
}
const KEY = readKey();
const linkOf = key => `${location.origin}${location.pathname}?k=${key}`;

async function rpc(fn, args = {}){
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {apikey: SB_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({k: KEY, ...args}),
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch(e) {}
  if (!r.ok) {
    let m = (j && j.message) || '网络出错了，请稍后再试';
    // 数据库的英文报错翻成能看懂的话（我们自己写的中文提示原样显示）
    if (/invalid input syntax|violates not-null|null value/i.test(m)) m = '有一项没选或格式不对，请检查后再试';
    else if (/duplicate key/i.test(m)) m = '这条记录已经存在了';
    else if (/violates foreign key/i.test(m)) m = '关联的老师或学生不存在，请刷新页面后再试';
    else if (/^[\x00-\x7F]+$/.test(m)) m = '操作没成功，请刷新页面后再试（' + m + '）';
    throw new Error(m);
  }
  return j;
}

/* ───────── 小工具 ───────── */
const pad = n => String(n).padStart(2,'0');
const WD = '日一二三四五六';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtMD = s => { const d = pd(s); return `${d.getMonth()+1}月${d.getDate()}日 周${WD[d.getDay()]}`; };
const sMD = s => { const d = pd(s); return `${d.getMonth()+1}.${d.getDate()}`; };
const mins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const tstr = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
const dBetween = (a,b) => Math.round((pd(b)-pd(a))/86400000);
const yen = n => '¥' + Math.round(n||0).toLocaleString('ja-JP');
// 单价规则：3 位数以内是人民币，4 位数以上是日元
const curOf = rate => (rate||0) >= 1000 ? 'JPY' : 'CNY';
const money = (n, cur) => cur==='JPY' ? '¥' + Math.round(n||0).toLocaleString('ja-JP') : Math.round(n||0).toLocaleString('zh-CN') + ' 元';
const rateTxt = rate => (rate ? money(rate, curOf(rate)) : '未设') + '/小时';
// 多种币种分开合计，比如「3,400 元 + ¥12,000」
const sumMoney = ls => { const t = {}; ls.forEach(([amt, cur]) => t[cur] = (t[cur]||0) + amt); return Object.keys(t).length ? Object.entries(t).sort().map(([c,v]) => money(v,c)).join(' + ') : money(0,'CNY'); };
const ymLabel = ym => `${+ym.slice(0,4)}年${+ym.slice(5)}月`;
const ymShift = (ym, n) => { const [y,m] = ym.split('-').map(Number); const d = new Date(y, m-1+n, 1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
const HUES = ['--h1','--h2','--h3','--h4','--h5','--h6'];
const hueMap = {};
const hue = s => { if (!(s in hueMap)) hueMap[s] = HUES[Object.keys(hueMap).length % HUES.length]; return `var(${hueMap[s]})`; };
const subjTag = s => `<span class="subj" style="--hc:${hue(s)}">${esc(s)}</span>`;
const TAGS_GOOD = ['优秀认真','积极配合','进步明显','基础扎实','主动提问'];
const TAGS_WARN = ['容易走神','未完成任务','基础薄弱','需要督促','状态低迷'];

/* ───────── 数据 ───────── */
let DB = null, TODAY = '';
const S = {page:'overview', tab:'a', month:'', calType:'all', calId:'', fbTab:'pending', sel:new Set(), editing:null, stuQ:'', payMonth:'', teaMonth:''};
const stu = id => DB.students.find(s => s.id===id) || {name:'（已删除）'};
const tea = id => DB.teachers.find(t => t.id===id) || {name:'（已删除）'};
const course = id => DB.courses.find(c => c.id===id);
const L = id => DB.lessons.find(l => l.id===id);
const fbOf = l => DB.feedbacks.find(f => f.lesson_id===l.id);
const cOfF = f => course(L(f.lesson_id).course_id);
const dur = l => (mins(l.end)-mins(l.start))/60;
const isDone = l => l.status==='scheduled' && l.date < TODAY;
const paidH = l => isDone(l) ? dur(l) : l.status==='leave' ? Number(l.deduct) : 0;
const timeFor = (l, tz) => tz==='CN' ? `${tstr(mins(l.start)-60)}–${tstr(mins(l.end)-60)}` : `${l.start}–${l.end}`;
const lsOfS = sid => DB.lessons.filter(l => course(l.course_id)?.student_id===sid);
const lsOfT = tid => DB.lessons.filter(l => course(l.course_id)?.teacher_id===tid);
const fbOfS = sid => DB.feedbacks.filter(f => cOfF(f)?.student_id===sid);
const needFb = () => DB.lessons.filter(l => isDone(l) && !fbOf(l));
const ME = () => DB.me;
const isAdmin = () => ME().role==='admin';
const isTop = () => isAdmin() && ME().level==='top';
const canSched = () => isAdmin() || ME().role==='teacher';          // 排课、调课、删课（数据库里还会再按范围检查）
const myTz = () => ME().role==='teacher' ? (tea(ME().teacher_id).tz || 'JP') : 'JP';
const tzName = tz => tz==='CN' ? '北京时间' : '日本时间';
const wrap = m => tstr(((m % 1440) + 1440) % 1440);
const fromJST = t => myTz()==='CN' ? wrap(mins(t)-60) : t;          // 日本时间 → 自己的时间（显示用）
const toJST = t => myTz()==='CN' ? (mins(t)+60 >= 1440 ? null : tstr(mins(t)+60)) : t;   // 自己填的时间 → 日本时间（存库用）
const planText = (cid, ym) => DB.plans.find(p => p.course_id===cid && p.ym===ym)?.text || '';
const reqOf = l => DB.requests.filter(q => q.lesson_id===l.id).slice(-1)[0];
const personOf = (role, field, id) => (DB.people||[]).find(p => p.role===role && p[field]===id && p.active);
function monthStats(sid, ym){
  const ls = lsOfS(sid).filter(l => l.date.startsWith(ym) && l.date < TODAY);
  const actual = ls.filter(l => l.status==='scheduled').length, leave = ls.filter(l => l.status==='leave').length;
  const fs = fbOfS(sid).filter(f => L(f.lesson_id).date.startsWith(ym));
  return {req: ls.length, actual, leave, hwOk: fs.length ? Math.round(fs.filter(f => f.hw_sub).length / fs.length * 100) : 0, fbN: fs.length};
}
const latestHw = sid => DB.courses.filter(c => c.student_id===sid).map(c => DB.feedbacks.filter(f => L(f.lesson_id).course_id===c.id).slice(-1)[0]).filter(Boolean);

async function load(){
  DB = await rpc('app_load');
  TODAY = DB.today;
  DB.lessons.sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start));
  if (!S.month) S.month = TODAY.slice(0,7);
  if (!S.payMonth) S.payMonth = ymShift(TODAY.slice(0,7), -1);
  if (!S.teaMonth) S.teaMonth = TODAY.slice(0,7);
}
// 做完一个操作：刷新数据、重画页面、提示结果
async function act(fn, args, okMsg, after){
  document.body.classList.add('busy');
  try { const r = await rpc(fn, args); await load(); if (after) after(r); render(); if (okMsg) toast(typeof okMsg==='function' ? okMsg(r) : okMsg); return r; }
  catch(e){ toast(e.message, true); throw e; }
  finally { document.body.classList.remove('busy'); }
}

/* ───────── 渲染入口 ───────── */
const app = document.getElementById('app');
function render(){
  const me = ME();
  const label = me.role==='admin' ? (me.level==='top' ? '教务 · 管理' : '教务') : {teacher:'任课老师', student:'学生', parent:'家长'}[me.role];
  setTimeout(labelTables);
  app.innerHTML = `<header class="top"><h1>一对一教务台</h1><span class="who">${esc(me.name)}${me.role==='parent'?'':' · '+label}</span></header>` + (isAdmin() ? adminView() : phoneView());
}

/* ═════════════ 教务端 ═════════════ */
function adminView(){
  const pend = DB.feedbacks.filter(f => f.status==='pending').length, reqN = DB.requests.filter(q => q.status==='pending').length;
  const items = isTop()
    ? [['日常',[['overview','总览'],['calendar','课表与排课'],['requests','改期 · 请假',reqN],['feedback','反馈审批',pend]]],
       ['学生',[['students','学生档案'],['apply','升学与出愿'],['reviews','月度回访'],['followups','跟进记录']]],
       ['管理',[['teachers','老师档案'],['payroll','课时与工资'],['links','链接与权限']]]]
    : [['日常',[['overview','总览'],['calendar','课表与排课']]],['学生',[['students','学生档案'],['apply','升学与出愿'],['reviews','月度回访'],['followups','跟进记录']]]];
  const nav = items.map(([g,list]) => `<div class="grp">${g}</div>` + list.map(([k,t,n]) =>
    `<button class="nav ${S.page===k?'on':''}" data-act="page" data-v="${k}"><span>${t}</span>${n?`<span class="cnt">${n}</span>`:''}</button>`).join('')).join('');
  const P = {overview:pgOverview, calendar:pgCalendar, requests:pgRequests, apply:pgApply2, reviews:pgReviews, followups:pgFollowups, feedback:pgFeedback, students:pgStudents, teachers:pgTeachers, payroll:pgPayroll, links:pgLinks};
  const page = (isTop() || ['overview','calendar','students','apply','reviews','followups'].includes(S.page)) ? (P[S.page]||pgOverview) : pgOverview;
  return `<div class="layout"><nav class="side" aria-label="教务导航">${nav}</nav><main class="main">${page()}</main></div>`;
}
const scopeNote = () => !isTop() ? `<div class="scope">你负责 ${DB.students.length} 位学生，只显示他们的资料。</div>` : '';

function pgOverview(){
  const today = DB.lessons.filter(l => l.date===TODAY);
  const pend = DB.feedbacks.filter(f => f.status==='pending');
  const miss = needFb();
  const reqs = DB.requests.filter(q => q.status==='pending');
  const bad = DB.feedbacks.filter(f => f.confirm==='不满意' && L(f.lesson_id).date >= ymShift(TODAY.slice(0,7),-1)+'-01');
  const empty = !DB.students.length;
  return `<div class="ph"><h2>总览</h2><span class="muted small">${fmtMD(TODAY)}</span></div>${scopeNote()}
  ${empty && isTop() ? `<div class="note">系统是空的，按这个顺序开始：① <b>老师档案</b>里添加老师 → ② <b>学生档案</b>里添加学生，并在学生里添加课程（哪位老师、什么科目、单价）→ ③ <b>课表与排课</b>里排课 → ④ <b>链接与权限</b>里复制每个人的专属链接发给他们。</div>` : ''}
  <div class="stats">
    <button class="stat" data-act="page" data-v="calendar"><small>今天的课</small><b>${today.length}</b></button>
    ${isTop() ? `<button class="stat ${reqs.length?'al':''}" data-act="page" data-v="requests"><small>待处理申请</small><b>${reqs.length}</b></button>
    <button class="stat ${pend.length?'al':''}" data-act="page" data-v="feedback"><small>待审批反馈</small><b>${pend.length}</b></button>` : ''}
    <button class="stat ${miss.length?'al':''}" ${isTop()?'data-act="page" data-v="feedback-missing"':''}><small>老师未写反馈</small><b>${miss.length}</b></button>
  </div>
  <div class="grid2">
    <section class="card"><h3>今天的课</h3><div class="list">${today.length ? today.map(l => { const c=course(l.course_id);
      return `<div class="li"><span class="num">${l.start}</span><div class="grow">${esc(stu(c.student_id).name)} · ${esc(tea(c.teacher_id).name)} ${subjTag(c.subject)}</div>${l.status==='leave'?'<span class="tag seal">请假</span>':''}</div>`}).join('') : '<div class="empty">今天没有课</div>'}</div></section>
    <section class="card"><h3>需要处理</h3><div class="list">
      ${isTop() ? reqs.map(q => { const l=L(q.lesson_id), c=course(l.course_id); return `<div class="li"><span class="tag ${q.type==='请假'?'seal':'warn'}">${q.type}</span><div class="grow">${esc(stu(c.student_id).name)} · ${sMD(l.date)} ${esc(c.subject)}：${esc(q.reason)}</div><button class="btn sm" data-act="page" data-v="requests">去处理</button></div>`}).join('') : ''}
      ${isTop() && pend.length ? `<div class="li"><span class="tag seal">审批</span><div class="grow">${pend.length} 条反馈等待审批，审批后家长才能看到</div><button class="btn sm" data-act="page" data-v="feedback">去审批</button></div>` : ''}
      ${bad.map(f => { const l=L(f.lesson_id), c=course(l.course_id); return `<div class="li"><span class="tag seal">不满意</span><div class="grow">${esc(stu(c.student_id).name)} 对 ${sMD(l.date)} ${esc(tea(c.teacher_id).name)} 的课评价「不满意」</div></div>`}).join('')}
      ${miss.slice(0,8).map(l => { const c=course(l.course_id); return `<div class="li"><span class="tag warn">未写</span><div class="grow">${esc(tea(c.teacher_id).name)} · ${sMD(l.date)} ${esc(stu(c.student_id).name)} ${esc(c.subject)}</div><button class="btn sm" data-act="copy-remind" data-v="${l.id}">复制提醒</button></div>`}).join('')}
      ${upcomingEvents(14).map(e=>`<div class="li"><span class="tag ${e.days<=7?'seal':'warn'}">${e.days===0?'今天':e.days+' 天'}</span><div class="grow">${esc(stu(e.t.student_id).name)} · ${esc(e.t.school)} ${e.label} ${sMD(e.date)}</div><button class="btn sm" data-act="page" data-v="apply">查看</button></div>`).join('')}
      ${(DB.followups||[]).filter(f=>f.next_date && f.confirm!=='已确认' && f.next_date<=TODAY).map(f=>`<div class="li"><span class="tag gold">跟进</span><div class="grow">${esc(stu(f.student_id).name)} · ${esc(f.next_action||f.task||'')}（${sMD(f.next_date)}）</div><button class="btn sm" data-act="fu-edit" data-v="${f.id}">更新</button></div>`).join('')}
      ${!reqs.length && !pend.length && !bad.length && !miss.length && !upcomingEvents(14).length ? '<div class="empty">没有要处理的事</div>' : ''}
    </div></section>
  </div>`;
}

function pgCalendar(){
  const [y,m] = S.month.split('-').map(Number);
  const first = new Date(y,m-1,1), last = new Date(y,m,0).getDate(), lead = (first.getDay()+6)%7;
  let ls = DB.lessons.filter(l => l.date.startsWith(S.month));
  if (S.calType==='s' && S.calId) ls = ls.filter(l => course(l.course_id).student_id===S.calId);
  if (S.calType==='t' && S.calId) ls = ls.filter(l => course(l.course_id).teacher_id===S.calId);
  const chip = l => { const c = course(l.course_id);
    const who = S.calType==='s' ? tea(c.teacher_id).name : S.calType==='t' ? stu(c.student_id).name : `${stu(c.student_id).name}·${tea(c.teacher_id).name.replace('老师','')}`;
    return `<button class="lc ${l.status==='leave'?'leave':''} ${l.moved?'moved':''}" style="--hc:${hue(c.subject)}" data-act="lesson" data-v="${l.id}"><span class="t">${l.start}</span>${l.makeup?'<b class="mk">补</b>':''} ${esc(who)}<br>${esc(c.subject)}${l.status==='leave'?' 请假':''}</button>`; };
  let cells = ['一','二','三','四','五','六','日'].map((d,i) => `<div class="hd ${i>=5?'we':''}">${d}</div>`).join('');
  for (let i=0;i<lead;i++) cells += `<div class="day off"></div>`;
  for (let d=1; d<=last; d++){ const dd=`${S.month}-${pad(d)}`; cells += `<div class="day ${dd===TODAY?'today':''}"><span class="dn">${d}</span>${ls.filter(l=>l.date===dd).map(chip).join('')}</div>`; }
  for (let i=0;i<(7-(lead+last)%7)%7;i++) cells += `<div class="day off"></div>`;
  const byD = {}; ls.forEach(l => (byD[l.date] ??= []).push(l));
  const agenda = Object.keys(byD).sort().map(d => `<div class="dg ${d===TODAY?'today':''}">${fmtMD(d)}</div>` + byD[d].map(chip).join('')).join('') || '<div class="empty">这个月没有课</div>';
  const who = S.calType==='s' ? DB.students : S.calType==='t' ? DB.teachers : [];
  const title = S.calType==='s' && S.calId ? `${y}年${m}月｜${stu(S.calId).name}` : S.calType==='t' && S.calId ? `${y}年${m}月｜${tea(S.calId).name}` : `${y}年${m}月｜全部课程`;
  const hours = ls.filter(l=>l.status!=='leave').reduce((a,l)=>a+dur(l),0);
  return `<div class="ph"><h2>课表与排课</h2>${isAdmin()?`<button class="btn pri" data-act="add-lesson" ${DB.courses.length?'':'disabled title="先在学生档案里添加课程"'}>＋ 排课</button>`:'<span class="tag mute">只读</span>'}</div>${scopeNote()}
  <div class="cal-bar">
    <button class="btn sm" data-act="month" data-v="-1" aria-label="上个月">‹</button><span class="mon">${S.month.replace('-','.')}</span><button class="btn sm" data-act="month" data-v="1" aria-label="下个月">›</button>
    <button class="btn sm" data-act="month" data-v="0">本月</button>
    <div class="seg">${[['all','全部'],['s','按学生'],['t','按老师']].map(([k,t])=>`<button class="${S.calType===k?'on':''}" data-act="caltype" data-v="${k}">${t}</button>`).join('')}</div>
    ${who.length ? `<select id="cal-who" data-change="calwho"><option value="">选择${S.calType==='s'?'学生':'老师'}…</option>${who.map(x=>`<option value="${x.id}" ${S.calId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:''}
  </div>
  <div class="row"><h3 style="font-size:16px">${esc(title)}</h3><span class="muted xs">共 ${ls.length} 节 · ${hours} 小时 · 日本时间 · 划线＝请假 · 「调」＝调过课</span></div>
  <div class="cal">${cells}</div><div class="agenda">${agenda}</div>`;
}

function pgRequests(){
  const pend = DB.requests.filter(q=>q.status==='pending'), done = DB.requests.filter(q=>q.status!=='pending').slice().reverse().slice(0,20);
  const card = q => { const l=L(q.lesson_id), c=course(l.course_id), same = q.created_at.slice(0,10)===l.date;
    return `<section class="card" style="display:flex;flex-direction:column;gap:8px">
      <div class="row"><span class="tag ${q.type==='请假'?'seal':'warn'}">${q.type}</span><b>${esc(stu(c.student_id).name)}</b>${subjTag(c.subject)}<span class="muted small">${esc(tea(c.teacher_id).name)} · ${q.status==='pending'?'原定':'课程'} ${fmtMD(l.date)} ${l.start}–${l.end}</span></div>
      <dl class="kv small"><dt>原因</dt><dd>${esc(q.reason)}</dd>${q.wish?`<dt>希望时间</dt><dd>${esc(q.wish)}</dd>`:''}</dl>
      ${q.status==='pending' ? `${q.type==='改期'
        ? `<div class="fields"><label class="field"><span>新日期</span><input type="date" id="rq-d-${q.id}" value="${l.date}"></label><label class="field"><span>开始（日本时间）</span><input type="time" id="rq-s-${q.id}" value="${l.start}"></label><label class="field"><span>结束</span><input type="time" id="rq-e-${q.id}" value="${l.end}"></label></div>
           <div class="row"><button class="btn pri sm" data-act="req-ok" data-v="${q.id}">同意，改到这个时间</button></div>`
        : `<div class="row" style="align-items:flex-end"><label class="field"><span>扣学生课时${same?'（当天请假）':'（提前请假）'}</span><select id="rq-dd-${q.id}"><option value="0" ${same?'':'selected'}>不扣</option><option value="${dur(l)/2}" ${same?'selected':''}>扣 ${dur(l)/2} 小时（一半）</option><option value="${dur(l)}">扣全部 ${dur(l)} 小时</option></select></label><button class="btn seal sm" data-act="req-ok" data-v="${q.id}">同意请假</button></div>`}
        <div class="row"><input type="text" id="rq-r-${q.id}" placeholder="不同意的话，写一句原因回复学生" style="flex:1;min-width:180px"><button class="btn sm" data-act="req-no" data-v="${q.id}">不同意</button></div>`
      : `<div class="small" style="color:${q.status==='accepted'?'var(--ok)':'var(--seal)'}">${q.status==='accepted'?'已同意':'未同意'}（${esc(q.handled_by)}）：${esc(q.reply)}</div>`}
    </section>`; };
  return `<div class="ph"><h2>改期 · 请假</h2></div>
  <div class="note">学生在自己的链接里申请。你们在这里处理，<b>学生和任课老师同时看到结果</b>，课表自动更新。当天请假扣不扣课时由你们决定。</div>
  ${pend.length ? pend.map(card).join('') : '<div class="card empty">没有待处理的申请</div>'}
  ${done.length ? `<h3 style="font-size:15px">最近处理过的</h3>${done.map(card).join('')}` : ''}`;
}

const tagRow = f => (f.tags||[]).length ? `<div class="chips">${f.tags.map(t=>`<span class="tag ${TAGS_WARN.includes(t)?'warn':'ok'}">${esc(t)}</span>`).join('')}</div>` : '';
const confirmTag = f => f.confirm ? `<span class="tag ${f.confirm==='满意'?'ok':'seal'}">上了·${f.confirm}</span>` : '<span class="tag mute">未确认</span>';
function fbCard(f, o={}){
  const l = L(f.lesson_id), c = course(l.course_id), edit = S.editing===f.id;
  const sec = (k,t) => edit ? `<label class="field"><span>${t}</span><textarea id="ed-${k}-${f.id}">${esc(f[k])}</textarea></label>` : `<div class="sec"><b>${t}</b><p>${esc(f[k])}</p></div>`;
  return `<article class="card fb">${f.status==='approved' ? `<div class="stamp" aria-label="已审批">已审</div>`:''}
    <div class="row" style="padding-right:${f.status==='approved'?'64px':'0'}">
      ${o.check && f.status==='pending' ? `<input type="checkbox" class="chk" id="sel-${f.id}" data-act="sel" data-v="${f.id}" ${S.sel.has(f.id)?'checked':''} aria-label="选择这条">`:''}
      <b>${esc(stu(c.student_id).name)}</b>${subjTag(c.subject)}<span class="muted small">${esc(tea(c.teacher_id).name)} · ${fmtMD(l.date)} ${l.start}–${l.end}</span></div>
    ${tagRow(f)}${sec('content','一、本节授课内容')}${sec('perf','二、学生课堂表现')}${sec('hw','三、课后作业')}${fileList(f.id,'note','上课笔记')}${fileList(f.id,'hw','学生交的作业')}${fileList(f.id,'grade','批改文件')}
    <div class="row xs"><span class="muted">上次作业</span><span class="tag ${f.last_hw==='已完成'?'ok':f.last_hw==='未完成'?'seal':'warn'}">${esc(f.last_hw||'—')}</span>
      <span class="muted">本次作业</span><span class="tag ${f.hw_fb?'ok':f.hw_sub?'blue':'mute'}">${f.hw_fb?'已批改':f.hw_sub?'已交·待批改':'未交'}</span>
      <span class="muted">学生确认</span>${confirmTag(f)}<span class="muted">${f.status==='approved'?'家长可见':'家长暂不可见'}</span></div>
    ${o.actions ? `<div class="row">${edit ? `<button class="btn pri sm" data-act="save-edit" data-v="${f.id}">保存修改</button><button class="btn sm" data-act="cancel-edit">取消</button>`
      : f.status==='pending' ? `<button class="btn seal sm" data-act="approve" data-v="${f.id}">审批通过</button><button class="btn sm" data-act="edit" data-v="${f.id}">先修改措辞</button>`
      : `<button class="btn sm" data-act="unapprove" data-v="${f.id}">撤回审批</button>`}</div>` : ''}
  </article>`;
}
function pgFeedback(){
  const pend = DB.feedbacks.filter(f => f.status==='pending'), done = DB.feedbacks.filter(f => f.status==='approved').slice().reverse(), miss = needFb();
  let body;
  if (S.fbTab==='pending') body = pend.length ? `<div class="card row"><label class="row"><input type="checkbox" class="chk" id="sel-all" data-act="sel-all" ${S.sel.size===pend.length?'checked':''}> 全选</label>
      <span class="muted small">已选 ${S.sel.size} 条</span><button class="btn seal sm" data-act="approve-sel" ${S.sel.size?'':'disabled'}>批量审批通过</button></div>${pend.map(f => fbCard(f,{check:true,actions:true})).join('')}` : '<div class="card empty">没有待审批的反馈</div>';
  else if (S.fbTab==='approved') body = done.slice(0,15).map(f => fbCard(f,{actions:true})).join('') || '<div class="card empty">还没有</div>';
  else body = miss.length ? `<div class="card list">${miss.map(l => { const c=course(l.course_id); return `<div class="li"><div class="grow"><b>${esc(tea(c.teacher_id).name)}</b> · ${esc(stu(c.student_id).name)} ${subjTag(c.subject)}<br><span class="muted xs">${fmtMD(l.date)} ${l.start}–${l.end} 上完课，${dBetween(l.date,TODAY)} 天未写</span></div><button class="btn sm" data-act="copy-remind" data-v="${l.id}">复制提醒文字</button></div>`}).join('')}</div>` : '<div class="card empty">反馈都写完了</div>';
  return `<div class="ph"><h2>反馈审批</h2></div>
  <div class="note">老师写完反馈，学生马上能看到；<b>审批通过后，家长才能看到</b>。措辞不合适可以先改再通过。</div>
  <div class="seg">${[['pending',`待审批 ${pend.length}`],['approved','已通过'],['missing',`老师未写 ${miss.length}`]].map(([k,t])=>`<button class="${S.fbTab===k?'on':''}" data-act="fbtab" data-v="${k}">${t}</button>`).join('')}</div>${body}`;
}

// 学生的任课老师排成一行：同一位老师的几门课合在一起，比如「刘天曦 数学·物理」
function teacherChips(cs){
  const by = {}; cs.filter(c => c.active !== false).forEach(c => (by[c.teacher_id] ??= []).push(c.subject));
  return Object.entries(by).length ? `<span class="tchips">${Object.entries(by).map(([tid, subs]) =>
    `<span class="tchip"><b>${esc(tea(tid).name)}</b>${subs.map(x => `<span class="subj" style="--hc:${hue(x)}">${esc(x)}</span>`).join('')}</span>`).join('')}</span>` : '';
}
function pgStudents(){
  const q = S.stuQ.trim();
  const list = DB.students.filter(s => !q || s.name.includes(q) || (s.track||'').includes(q));
  const ym = TODAY.slice(0,7);
  return `<div class="ph"><h2>学生档案</h2>${isTop()?`<button class="btn pri" data-act="student-form">＋ 新增学生</button>`:''}</div>${scopeNote()}
  <div class="row"><input type="text" id="stu-q" placeholder="搜索姓名或方向" value="${esc(S.stuQ)}" data-input="stuq" style="width:200px"></div>
  ${list.length ? `<div class="tw"><table class="rt stu-tbl"><thead><tr><th>编号</th><th>姓名</th><th>方向</th><th>任课老师</th><th>负责教务</th><th>${+ym.slice(5)} 月出勤</th><th>作业</th><th>${+ym.slice(5)} 月计划</th></tr></thead><tbody>
  ${list.map(s => { const cs = DB.courses.filter(c=>c.student_id===s.id), st = monthStats(s.id, ym), un = latestHw(s.id).filter(f=>!f.hw_sub).length;
    const pn = cs.filter(c => planText(c.id, ym)).length;
    return `<tr class="click" data-act="student" data-v="${s.id}"><td class="num">${esc(s.code||'')}</td><td><b>${esc(s.name)}</b>${s.active?'':' <span class="tag mute">停课</span>'}<br><span class="xs muted">${esc(s.loc||'')}</span></td><td>${esc(s.direction||s.track||'')}${s.target_ym?`<br><span class="xs muted">目标 ${esc(s.target_ym)}</span>`:''}</td>
    <td>${teacherChips(cs) || '<span class="tag warn">还没有课程</span>'}</td><td>${esc(s.staff)}</td>
    <td class="num">${st.actual}/${st.req}${st.leave?` <span class="tag seal">请假 ${st.leave}</span>`:''}</td><td>${un?`<span class="tag warn">${un} 份未交</span>`:'<span class="tag ok">已交齐</span>'}</td>
    <td>${cs.length ? `<span class="tag ${pn===cs.length?'ok':'warn'}">${pn}/${cs.length}</span>` : ''}</td></tr>`}).join('')}
  </tbody></table></div>` : `<div class="card empty">${DB.students.length ? '没有符合的学生' : '还没有学生。点右上角「新增学生」开始。'}</div>`}`;
}

function pgTeachers(){
  return `<div class="ph"><h2>老师档案</h2><button class="btn pri" data-act="teacher-form">＋ 新增老师</button></div>
  <div class="hint">履历可以你们填，也可以老师在自己的链接里填。</div>
  ${DB.teachers.length ? `<div class="grid2">${DB.teachers.map(t => { const cs = DB.courses.filter(c=>c.teacher_id===t.id), ym = TODAY.slice(0,7);
    const h = lsOfT(t.id).filter(l=>l.date.startsWith(ym)).reduce((a,l)=>a+paidH(l),0), p = personOf('teacher','teacher_id',t.id);
    return `<section class="card"><div class="row" style="margin-bottom:6px"><h3 style="margin-right:auto;font-size:16px">${esc(t.name)}</h3>${t.subject?subjTag(t.subject):''}<span class="tag mute">${esc(t.loc||'—')} · ${t.tz==='CN'?'北京时间':'日本时间'}</span></div>
    <dl class="kv small"><dt>学历</dt><dd>${esc(t.edu||'—')}</dd><dt>经历</dt><dd>${esc(t.exp||'—')}</dd><dt>擅长</dt><dd>${esc(t.good||'—')}</dd>
    <dt>带的学生</dt><dd>${cs.map(c=>esc(stu(c.student_id).name)).join('、')||'—'}</dd><dt>本月课时</dt><dd class="num">${h} 小时</dd></dl>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="teacher-form" data-v="${t.id}">编辑</button>${p?`<button class="btn sm" data-act="copy-link" data-v="${p.key}">复制老师链接</button>`:''}</div></section>`}).join('')}</div>` : '<div class="card empty">还没有老师。点右上角「新增老师」开始。</div>'}`;
}

function pgPayroll(){
  const ym = S.payMonth;
  const rows = DB.teachers.map(t => { const ls = lsOfT(t.id).filter(l => l.date.startsWith(ym) && paidH(l)>0);
    const parts = ls.map(l => { const rt = course(l.course_id).rate||0; return [paidH(l)*rt, curOf(rt)]; });
    return {t, ls, h: ls.reduce((a,l)=>a+paidH(l),0), parts, amt: sumMoney(parts)}; }).filter(r => r.ls.length);
  const total = sumMoney(rows.flatMap(r => r.parts));
  const months = [...new Set(DB.lessons.map(l=>l.date.slice(0,7)).concat([TODAY.slice(0,7), ymShift(TODAY.slice(0,7),-1)]))].sort().reverse();
  return `<div class="ph"><h2>课时与工资</h2><select id="pay-m" data-change="paym">${months.map(v=>`<option value="${v}" ${v===ym?'selected':''}>${ymLabel(v)}</option>`).join('')}</select></div>
  <div class="note">只有<b>教务 · 管理</b>能看到这一页。上完的课自动计入课时；当天请假扣学生的课时，照样计入老师工资。单价在学生档案 → 课程里设置（3 位数以内按人民币算，4 位数以上按日元算）。每位老师每月：<b>核对课时 → 审核通过 → 结算完成</b>。</div>
  <div class="stats"><div class="stat"><small>计费课时</small><b>${rows.reduce((a,r)=>a+r.h,0)}</b></div><div class="stat"><small>工资合计</small><b style="font-size:18px">${total}</b></div>
    <div class="stat"><small>已审核</small><b>${rows.filter(r=>payOf(r.t.id,ym).reviewed_at).length}/${rows.length}</b></div><div class="stat"><small>已结算</small><b>${rows.filter(r=>payOf(r.t.id,ym).settled_at).length}/${rows.length}</b></div></div>
  ${rows.length ? '' : '<div class="card empty">这个月还没有上完的课</div>'}
  ${rows.map(r => `<details class="card"><summary class="row"><b style="margin-right:auto;font-family:var(--f-disp)">${esc(r.t.name)}</b><span class="num small">${r.ls.length} 节 · ${r.h} 小时</span><b class="num">${r.amt}</b>${payBadge(r.t.id, ym)}<span class="muted xs">展开明细</span></summary>
    <div class="tw" style="margin-top:8px"><table><thead><tr><th>日期</th><th>时间（日本）</th><th>学生</th><th>科目</th><th>计费</th><th>单价</th><th>金额</th><th>备注</th></tr></thead><tbody>
    ${r.ls.map(l=>{const c=course(l.course_id);return `<tr><td class="num">${sMD(l.date)}</td><td class="num">${l.start}–${l.end}</td><td>${esc(stu(c.student_id).name)}</td><td>${subjTag(c.subject)}</td><td class="num">${paidH(l)}h</td><td class="num">${rateTxt(c.rate)}</td><td class="num">${money(paidH(l)*(c.rate||0), curOf(c.rate))}</td><td class="xs">${l.status==='leave'?'<span class="tag seal">当天请假</span> ':''}${esc(l.note)}</td></tr>`}).join('')}
    </tbody></table></div><div class="row" style="margin-top:8px"><button class="btn sm" data-act="copy-pay" data-v="${r.t.id}">复制课时清单（发给老师核对）</button><span style="margin-left:auto" class="row">${payButtons(r.t.id, ym)}</span></div></details>`).join('')}`;
}

function pgLinks(){
  const P = DB.people || [];
  const scopeTxt = p => p.role==='admin' ? (p.level==='top' ? '全部' : (p.scope||[]).map(id=>stu(id).name).join('、')||'（未分配学生）')
    : p.role==='teacher' ? '自己带的：'+(DB.courses.filter(c=>c.teacher_id===p.teacher_id).map(c=>stu(c.student_id).name).join('、')||'—')
    : p.role==='student' ? '自己的课表、作业、上课记录' : `${stu(p.student_id).name} 的出勤、审批过的反馈、课表`;
  const grp = [['教务','admin'],['任课老师','teacher'],['学生','student'],['家长','parent']];
  return `<div class="ph"><h2>链接与权限</h2><button class="btn pri" data-act="link-new">＋ 新建链接</button></div>
  <div class="note">每个人一条专属链接，打开就能用。点「复制链接」发到对方微信。<b>链接被转发、老师离职、学生毕业</b>时，点「重新生成」或「停用」，旧链接马上失效。新增老师、学生时会自动生成链接。</div>
  ${grp.map(([g,r]) => { const ps = P.filter(p=>p.role===r); return ps.length ? `<section><h3 style="font-size:15px;margin:6px 0">${g}</h3><div class="tw"><table class="rt"><thead><tr><th>姓名</th><th>身份</th><th>能看到</th><th>状态</th><th></th></tr></thead><tbody>
    ${ps.map(p => `<tr><td><b>${esc(p.name)}</b>${p.id===ME().id?' <span class="tag gold">我</span>':''}</td><td><span class="tag ${p.level==='top'?'seal':p.role==='admin'?'gold':'mute'}">${p.role==='admin'?(p.level==='top'?'教务 · 管理':'教务 · 普通'):g}</span></td>
      <td class="small">${esc(scopeTxt(p))}${p.role==='admin'&&p.level!=='top'?` <button class="btn sm" data-act="scope-edit" data-v="${p.id}">改范围</button>`:''}</td>
      <td>${p.active?'<span class="tag ok">启用</span>':'<span class="tag seal">已停用</span>'}</td>
      <td><div class="row"><button class="btn sm" data-act="copy-link" data-v="${p.key}" ${p.active?'':'disabled'}>复制链接</button><button class="btn sm" data-act="link-regen" data-v="${p.id}">重新生成</button>
        ${p.id===ME().id?'':`<button class="btn sm ${p.active?'danger':''}" data-act="link-toggle" data-v="${p.id}">${p.active?'停用':'恢复'}</button>`}</div></td></tr>`).join('')}
  </tbody></table></div></section>` : ''; }).join('')}`;
}

/* ═════════════ 手机端（老师 / 学生 / 家长） ═════════════ */
function phoneView(){
  const me = ME(); let tabs, body;
  if (me.role==='teacher'){
    const t = tea(me.teacher_id);
    const n = needFb().length + DB.feedbacks.filter(f => f.hw_sub && !f.hw_fb).length;
    tabs = [['a','课表'],['b','我的学生'],['c','反馈·批改',n],['d','我的']];
    body = {a:tSchedule,b:tStudents,c:tWrite,d:tMe}[S.tab](t);
  } else if (me.role==='student'){
    const s = stu(me.student_id);
    const selfDue = !reviewOf(s.id, TODAY.slice(0,7))?.self_eval && +TODAY.slice(8,10) >= 20 ? 1 : 0;   // 每月 20 号以后提醒写自评
    tabs = [['a','首页'],['b','作业',latestHw(s.id).filter(f=>!f.hw_sub).length],['c','上课记录',fbOfS(s.id).filter(f=>!f.confirm).length],['d','档案'],['e','月度',selfDue]];
    body = {a:sHome,b:sHomework,c:sFeedback,d:profilePage,e:sMonthly}[S.tab]?.(s) ?? sHome(s);
  } else {
    const s = stu(me.student_id);
    tabs = [['a','概况'],['b','老师反馈'],['c','课表'],['d','档案'],['e','月度']];
    body = {a:pOverview,b:pFeedback,c:pSchedule,d:profilePage,e:pMonthly}[S.tab]?.(s) ?? pOverview(s);
  }
  return `<div class="pw"><div class="phone"><div class="p-body">${body}</div></div></div>
    <nav class="tabbar" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs.map(([k,t,n])=>`<button class="${S.tab===k?'on':''}" data-act="tab" data-v="${k}">${t}${n?`<span class="dot">${n}</span>`:''}</button>`).join('')}</nav>`;
}
function reqLine(q){
  if (!q) return '';
  if (q.status==='pending') return `<div class="xs" style="color:var(--warn)">已申请${q.type}，等教务处理 · ${esc(q.reason)}${q.wish?` · 希望：${esc(q.wish)}`:''}</div>`;
  return `<div class="xs" style="color:${q.status==='accepted'?'var(--ok)':'var(--seal)'}">${q.type}申请${q.status==='accepted'?'已同意':'未同意'}（${esc(q.handled_by)}）：${esc(q.reply)}</div>`;
}
function agenda(ls, tz, whoFn, n=12, canReq=false, canEdit=false){
  const up = ls.filter(l=>l.date>=TODAY).slice(0,n);
  if (!up.length) return '<div class="empty">近期没有课</div>';
  let out='', last='';
  up.forEach(l => {
    if (l.date!==last){ out += `<div class="dg ${l.date===TODAY?'today':''}">${l.date===TODAY?'今天 · ':''}${fmtMD(l.date)}</div>`; last=l.date; }
    out += lessonItem(l, tz, whoFn, canReq, canEdit);
  });
  return out;
}
const tzNote = tz => `<div class="muted xs">${tz==='CN'?'北京时间（日本时间减 1 小时）':'日本时间'}</div>`;

/* 手机端课表：月历 / 列表 两种看法，每个人自己选，本机记住 */
let PV = 'cal'; try { PV = localStorage.getItem('jw_view') || 'cal'; } catch(e) {}
function lessonItem(l, tz, whoFn, canReq, canEdit){
  const c = course(l.course_id), q = reqOf(l), leave = l.status==='leave';
  return `<div class="les" style="--hc:${hue(c.subject)}${leave?';opacity:.6':''}"><div class="when">${timeFor(l,tz)}</div><div style="min-width:0;flex:1">${subjTag(c.subject)} · ${esc(whoFn(c))}${l.makeup?' <span class="tag blue">补课</span>':''}${l.moved?' <span class="tag warn">调课</span>':''}${leave?' <span class="tag seal">请假</span>':''}${isDone(l)?' <span class="tag ok">已上</span>':''}
    ${reqLine(q)}${canReq && !leave && l.date>=TODAY && !(q && q.status==='pending') ? `<button class="btn sm" style="margin-top:4px" data-act="req-open" data-v="${l.id}">申请改期 / 请假</button>`:''}${canEdit && !leave && !fbOf(l) ? `<button class="btn sm" style="margin-top:4px" data-act="lesson" data-v="${l.id}">调课 / 删除</button>`:''}</div></div>`;
}
function schedule(ls, tz, whoFn, canReq=false, canEdit=false){
  const toggle = `<div class="seg" role="group" aria-label="课表看法">${[['cal','月历'],['list','列表']].map(([k,t])=>`<button class="${PV===k?'on':''}" data-act="pview" data-v="${k}">${t}</button>`).join('')}</div>`;
  if (PV==='list') return `<div class="row" style="justify-content:space-between">${tzNote(tz)}${toggle}</div>${agenda(ls,tz,whoFn,30,canReq,canEdit)}`;
  const ym = S.pMonth || (S.pMonth = TODAY.slice(0,7)), [y,m] = ym.split('-').map(Number);
  const first = new Date(y,m-1,1), last = new Date(y,m,0).getDate(), lead = (first.getDay()+6)%7;
  const sel = S.pDay && S.pDay.startsWith(ym) ? S.pDay : (TODAY.startsWith(ym) ? TODAY : `${ym}-01`);
  const mine = ls.filter(l => l.date.startsWith(ym));
  let cells = ['一','二','三','四','五','六','日'].map((d,i)=>`<div class="ph-hd ${i>=5?'we':''}">${d}</div>`).join('');
  for (let i=0;i<lead;i++) cells += '<div></div>';
  for (let d=1; d<=last; d++){
    const ds_ = `${ym}-${pad(d)}`, dl = mine.filter(l=>l.date===ds_);
    const st = l => tz==='CN' ? wrap(mins(l.start)-60) : l.start;
    cells += `<button class="ph-day ${ds_===TODAY?'today':''} ${ds_===sel?'sel':''} ${dl.length?'has':''}" data-act="pday" data-v="${ds_}" aria-label="${fmtMD(ds_)}，${dl.length} 节课"><span class="n">${d}</span>
      ${dl.slice(0,5).map(l=>{ const c=course(l.course_id); return `<span class="pc ${l.status==='leave'?'lv':''}" style="--hc:${hue(c.subject)}"><span class="pt">${st(l)}${l.makeup?'<b class="mk">补</b>':''}<span class="ps"> ${esc(c.subject)}</span></span><span class="pn ${whoFn(c).length>3?'long':''}">${esc(whoFn(c))}</span></span>`; }).join('')}
      ${dl.length>3?`<span class="more m">+${dl.length-3}</span>`:''}${dl.length>5?`<span class="more d">+${dl.length-5}</span>`:''}</button>`;
  }
  const day = mine.filter(l=>l.date===sel);
  return `<div class="row" style="justify-content:space-between">${tzNote(tz)}${toggle}</div>
  <div class="card ph-cal">
    <div class="row" style="justify-content:space-between;margin-bottom:6px"><button class="btn sm" data-act="pmonth" data-v="-1" aria-label="上个月">‹</button>
      <b class="num" style="font-size:16px">${y}.${pad(m)}</b><span class="row"><button class="btn sm" data-act="pmonth" data-v="0">本月</button><button class="btn sm" data-act="pmonth" data-v="1" aria-label="下个月">›</button></span></div>
    <div class="ph-grid">${cells}</div>
    <div class="muted xs" style="margin-top:6px">这个月共 ${mine.filter(l=>l.status!=='leave').length} 节课 · 点日期看当天的课</div>
  </div>
  <div class="dg ${sel===TODAY?'today':''}">${sel===TODAY?'今天 · ':''}${fmtMD(sel)}</div>
  ${day.length ? day.map(l=>lessonItem(l,tz,whoFn,canReq,canEdit)).join('') : '<div class="empty" style="padding:10px">这天没有课</div>'}`;
}
function tSchedule(t){
  const miss = needFb();
  return `<h2 style="font-size:19px">${esc(t.name)}</h2>
  ${miss.length?`<div class="note warn row" style="justify-content:space-between">有 ${miss.length} 节课还没写反馈 <button class="btn sm" data-act="tab" data-v="c">去写</button></div>`:''}
  <div class="row" style="justify-content:flex-end"><button class="btn pri sm" data-act="add-lesson">＋ 排课</button></div>
  ${schedule(lsOfT(t.id),t.tz,c=>stu(c.student_id).name,false,true)}`;
}
function tStudents(t){
  const cs = DB.courses.filter(c=>c.teacher_id===t.id && c.active);
  return cs.length ? cs.map(c => { const s=stu(c.student_id), fs=DB.feedbacks.filter(f=>L(f.lesson_id).course_id===c.id), lastF=fs[fs.length-1], next=DB.lessons.find(l=>l.course_id===c.id && l.date>=TODAY && l.status!=='leave');
    return `<section class="card" style="display:flex;flex-direction:column;gap:6px"><div class="row"><h3 style="font-size:16px;margin-right:auto">${esc(s.name)}</h3>${subjTag(c.subject)}</div>
    <dl class="kv small"><dt>方向</dt><dd>${esc(s.track||'—')}</dd><dt>下节课</dt><dd>${next?`${fmtMD(next.date)} ${timeFor(next,t.tz)}`:'—'}</dd>
    <dt>本月计划</dt><dd>${esc(planText(c.id, TODAY.slice(0,7))||'还没写')}</dd><dt>上次作业</dt><dd>${lastF?`${esc(lastF.hw)} ${lastF.hw_sub?'<span class="tag ok">已交</span>':'<span class="tag warn">未交</span>'}`:'—'}</dd></dl>
    <button class="btn sm" data-act="t-stu" data-v="${c.id}">档案 · 月计划 · 私下备注</button></section>`}).join('') : '<div class="empty">还没有分配学生</div>';
}
function tWrite(t){
  const cand = DB.lessons.filter(l => l.date<=TODAY && l.status==='scheduled' && !fbOf(l)).reverse();
  const mine = DB.feedbacks.slice(-6).reverse();
  const toGrade = DB.feedbacks.filter(f => f.hw_sub && !f.hw_fb);
  const grade = toGrade.length ? `<div class="dg">学生交上来的作业 · 待批改 ${toGrade.length}</div>` + toGrade.map(f=>{const l=L(f.lesson_id);return `<section class="card small" style="display:flex;flex-direction:column;gap:6px">
    <div class="row"><b>${esc(stu(course(l.course_id).student_id).name)}</b><span class="muted">${sMD(l.date)} 布置</span></div><div>${esc(f.hw)}</div>${f.hw_note?`<div class="note">学生说：${esc(f.hw_note)}</div>`:''}${fileList(f.id,'hw','学生交的作业')}${fileList(f.id,'grade','我的批改文件')}
    <textarea id="gr-${f.id}" placeholder="批改意见（学生能看到）"></textarea><div class="row"><button class="btn pri sm" data-act="grade" data-v="${f.id}">批改完成</button>${uploadBtn('grade', f.id, '上传批改文件')}</div></section>`}).join('') : '';
  const form = cand.length ? `<section class="card" style="display:flex;flex-direction:column;gap:8px">
    <h3 style="font-size:16px">课后反馈</h3>
    <div class="note warn">这条反馈学生会马上看到，<b>教务审核后家长也能看到</b>，请注意用词。不方便让家长看的内容，写到「我的学生 → 私下备注」。</div>
    <label class="field"><span>哪一节课</span><select id="w-lesson">${cand.map(l=>`<option value="${l.id}">${sMD(l.date)} ${esc(stu(course(l.course_id).student_id).name)} ${esc(course(l.course_id).subject)}</option>`).join('')}</select></label>
    <label class="field"><span>一、本节授课内容</span><textarea id="w-content" placeholder="例：听解练习，要求学生用日语复述听力内容"></textarea></label>
    <label class="field"><span>二、学生课堂表现</span><textarea id="w-perf" placeholder="例：课堂状态良好，能积极参与练习"></textarea></label>
    <div class="field"><span>学生状态（点选，可多选）</span><div class="chips">${[...TAGS_GOOD,...TAGS_WARN].map(x=>`<button class="chip ${wTags.has(x)?'on':''}" data-act="w-tag" data-v="${x}">${x}</button>`).join('')}</div></div>
    <label class="field"><span>三、课后作业安排</span><textarea id="w-hw" placeholder="例：1. 复习本节生词  2. 完成长文 1–10"></textarea></label>
    <label class="field"><span>上次作业完成情况</span><select id="w-last"><option>已完成</option><option>部分完成</option><option>未完成</option><option>没有布置</option></select></label>
    <button class="btn pri" data-act="submit-fb">提交反馈</button></section>` : `<div class="card empty">上完的课都写好反馈了</div>`;
  return grade + form + (mine.length ? `<div class="dg">我最近写的反馈</div>` + mine.map(f=>{const l=L(f.lesson_id);return `<div class="card small"><div class="row"><b>${sMD(l.date)} ${esc(stu(course(l.course_id).student_id).name)}</b><span style="margin-left:auto">${confirmTag(f)}</span><span class="tag ${f.status==='approved'?'ok':'warn'}">${f.status==='approved'?'已审核·家长可见':'待教务审核'}</span></div><div class="muted">${esc(f.content)}</div>${fileList(f.id,'note','上课笔记')}<div class="row" style="margin-top:4px">${uploadBtn('note', f.id, '上传上课笔记')}</div></div>`}).join('') : '');
}
function tMe(t){
  const ls = lsOfT(t.id).filter(l=>l.date.startsWith(S.teaMonth) && paidH(l)>0), h = ls.reduce((a,l)=>a+paidH(l),0);
  const months = [TODAY.slice(0,7), ymShift(TODAY.slice(0,7),-1), ymShift(TODAY.slice(0,7),-2)];
  return `<section class="card" style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:16px">我的履历</h3>
    <label class="field"><span>学历</span><input type="text" id="me-edu" value="${esc(t.edu)}"></label>
    <label class="field"><span>教学经历</span><textarea id="me-exp">${esc(t.exp)}</textarea></label>
    <label class="field"><span>擅长领域</span><input type="text" id="me-good" value="${esc(t.good)}"></label>
    <button class="btn pri" data-act="save-me">保存履历</button></section>
  <section class="card"><div class="row" style="margin-bottom:4px"><h3 style="font-size:16px;margin-right:auto">课时记录</h3><select id="tea-m" data-change="team">${months.map(v=>`<option value="${v}" ${v===S.teaMonth?'selected':''}>${ymLabel(v)}</option>`).join('')}</select></div>
  <div class="muted xs" style="margin-bottom:4px">自动记录，不用再整理清单发给教务。${ls.length?` 这个月：${payBadge(t.id, S.teaMonth)}`:''}</div>
  ${ls.length?`<div class="list">${ls.map(l=>`<div class="li small"><span class="num">${sMD(l.date)}</span><span class="num">${timeFor(l,t.tz)}</span><span class="grow">${esc(stu(course(l.course_id).student_id).name)}</span><span class="num">${paidH(l)}h</span>${l.status==='leave'?'<span class="tag seal">请假</span>':''}</div>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:4px"><b class="num">共 ${h} 小时</b></div>`:'<div class="empty">这个月还没有上完的课</div>'}</section>`;
}
function mpView(sid, ym){
  const cs = DB.courses.filter(c=>c.student_id===sid && c.active);
  return cs.some(c=>planText(c.id,ym)) ? `<div class="list">${cs.map(c=>`<div class="li small"><span style="min-width:74px">${subjTag(c.subject)}</span><span class="grow">${planText(c.id,ym)?esc(planText(c.id,ym)):'<span class="muted">还没写</span>'}</span></div>`).join('')}</div>` : '<div class="muted small">这个月的计划还没写</div>';
}
function sHome(s){
  const un = latestHw(s.id).filter(f=>!f.hw_sub).length, nc = fbOfS(s.id).filter(f=>!f.confirm).length;
  const r = [...(un?[['b',`有 ${un} 份作业还没交`]]:[]), ...(nc?[['c',`有 ${nc} 节课还没确认`]]:[])];
  return `<h2 style="font-size:19px">${esc(s.name)}</h2>
  ${r.length?`<div class="remind"><b>提醒</b>${r.map(([t,x])=>`<button data-act="tab" data-v="${t}">${esc(x)}</button>`).join('')}</div>`:''}
  <details class="card" ${DB.courses.some(c=>planText(c.id,TODAY.slice(0,7)))?'open':''}><summary class="row"><b style="font-family:var(--f-disp);margin-right:auto">${+TODAY.slice(5,7)} 月学习计划</b><span class="muted xs">展开 / 收起</span></summary><div style="margin-top:6px">${mpView(s.id,TODAY.slice(0,7))}</div></details>
  <div class="muted xs">有事可以在当天的课下面直接申请改期或请假</div>${schedule(lsOfS(s.id),s.tz,c=>tea(c.teacher_id).name,true)}`;
}
function sHomework(s){
  const cur = latestHw(s.id), older = fbOfS(s.id).filter(f=>!cur.includes(f)).slice(-5).reverse();
  const item = (f, now) => { const l=L(f.lesson_id), c=course(l.course_id);
    return `<div class="les" style="--hc:${hue(c.subject)}"><div style="min-width:0;flex:1"><div class="row xs">${subjTag(c.subject)}<span class="muted">${esc(tea(c.teacher_id).name)} · ${sMD(l.date)} 布置</span><span style="margin-left:auto" class="tag ${f.hw_fb?'ok':f.hw_sub?'blue':'warn'}">${f.hw_fb?'已批改':f.hw_sub?'已交':'未交'}</span></div>${esc(f.hw)}
    ${now && !f.hw_sub ? `<textarea id="hw-${f.id}" style="margin-top:6px;min-height:48px" placeholder="写一句完成情况（照片可以用下面的按钮上传）"></textarea><div class="row" style="margin-top:4px"><button class="btn pri sm" data-act="hw-done" data-v="${f.id}">我完成了</button>${uploadBtn('hw', f.id, '上传作业照片 / PDF')}</div>`:''}
    ${now && f.hw_sub && !f.hw_fb ? `<div class="row" style="margin-top:4px">${uploadBtn('hw', f.id, '再传几张')}</div>` : ''}
    ${fileList(f.id,'hw','我交的作业')}${fileList(f.id,'grade','老师的批改')}
    ${f.hw_note?`<div class="muted xs">我说：${esc(f.hw_note)}</div>`:''}${f.hw_fb?`<div class="note" style="margin-top:6px"><b>老师批改：</b>${esc(f.hw_fb)}</div>`:''}</div></div>`; };
  return `<div class="dg">最新作业</div>${cur.map(f=>item(f,true)).join('')||'<div class="empty">暂无作业</div>'}${older.length?`<div class="dg">以前的作业</div>${older.map(f=>item(f,false)).join('')}`:''}`;
}
function fbMini(f, student){
  const l=L(f.lesson_id), c=course(l.course_id);
  return `<article class="card fb small"><div class="row">${subjTag(c.subject)}<span class="muted">${esc(tea(c.teacher_id).name)} · ${fmtMD(l.date)}</span>${student&&f.confirm?`<span style="margin-left:auto">${confirmTag(f)}</span>`:''}</div>${tagRow(f)}
  <div class="sec"><b>本节授课内容</b><p>${esc(f.content)}</p></div><div class="sec"><b>课堂表现</b><p>${esc(f.perf)}</p></div><div class="sec"><b>课后作业</b><p>${esc(f.hw)}</p></div>${fileList(f.id,'note','老师的上课笔记')}
  ${student && !f.confirm ? `<div class="row" style="border-top:1px solid var(--line-2);padding-top:6px"><span class="muted xs">确认上了这节课：</span><button class="btn pri sm" data-act="confirm" data-v="${f.id}|满意">满意</button><button class="btn sm" data-act="confirm" data-v="${f.id}|不满意">不满意</button></div>`:''}</article>`;
}
const sFeedback = s => fbOfS(s.id).slice().reverse().slice(0,20).map(f=>fbMini(f,true)).join('') || '<div class="empty">还没有上课记录</div>';
function pOverview(s){
  const ym = TODAY.slice(0,7), prev = ymShift(ym,-1);
  const block = (m) => { const st = monthStats(s.id, m), leaves = lsOfS(s.id).filter(l=>l.date.startsWith(m) && l.status==='leave' && l.date<TODAY);
    return `<div class="dg">${ymLabel(m)}</div>${!st.req ? '<div class="card small muted">这个月还没有上完的课</div>' : `<div class="bst"><div><b>${st.actual}/${st.req}</b><small>出勤</small></div><div><b style="${st.leave?'color:var(--seal)':''}">${st.leave}</b><small>请假</small></div><div><b>${st.hwOk}%</b><small>作业完成</small></div></div>`}
    ${leaves.map(l=>`<div class="card small"><span class="tag seal">请假</span> ${fmtMD(l.date)} ${esc(course(l.course_id).subject)} · ${esc(l.note)}</div>`).join('')}`; };
  return `<h2 style="font-size:19px">${esc(s.name)} 的学习情况</h2>${block(ym)}
  <div class="dg">${+ym.slice(5)} 月学习计划</div><div class="card">${mpView(s.id, ym)}</div>
  ${block(prev)}<div class="dg">接下来的课</div>${agenda(lsOfS(s.id),'JP',c=>tea(c.teacher_id).name,4)}`;
}
const pFeedback = s => `<div class="muted xs">老师的课后反馈经教务审核后显示在这里。</div>` + (fbOfS(s.id).slice().reverse().slice(0,20).map(f=>fbMini(f,false)).join('') || '<div class="empty">还没有反馈</div>');
const pSchedule = s => schedule(lsOfS(s.id),'JP',c=>tea(c.teacher_id).name);

/* ═════════════ 弹窗 ═════════════ */
const mroot = document.getElementById('modal-root');
function openModal(html, wide){ mroot.innerHTML = `<div class="mb" data-act="close-bg"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true">${html}</div></div>`; labelTables(); }
// 手机上把宽表格变成卡片：每个格子前面显示它的列名
function labelTables(){ document.querySelectorAll('table.rt').forEach(t => { const hs = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim()); t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => td.setAttribute('data-label', hs[i] || ''))); }); }
function closeModal(){ mroot.innerHTML=''; lastModal = null; }
const mHead = t => `<div class="mh"><h3>${t}</h3><button class="btn sm" data-act="close" aria-label="关闭">✕</button></div>`;

function lessonModal(id){
  lastModal = () => lessonModal(id);
  const l = L(id), c = course(l.course_id), s = stu(c.student_id), t = tea(c.teacher_id), f = fbOf(l), q = reqOf(l);
  const st = isDone(l)?'<span class="tag ok">已上课</span>':l.status==='leave'?'<span class="tag seal">请假</span>':'<span class="tag blue">待上课</span>';
  openModal(`${mHead(`${esc(s.name)} · ${esc(c.subject)}`)}
  <dl class="kv"><dt>老师</dt><dd>${esc(t.name)}${t.loc?`（${esc(t.loc)}）`:''}</dd><dt>时间</dt><dd>${fmtMD(l.date)} ${l.start}–${l.end} 日本${t.tz==='CN'||s.tz==='CN'?` <span class="muted">／北京 ${timeFor(l,'CN')}</span>`:''}</dd>
  <dt>状态</dt><dd>${st} ${l.makeup?'<span class="tag blue">补课</span>':''} ${l.moved?'<span class="tag warn">调过课</span>':''}${canSched() && !f ? ` <button class="btn sm" data-act="makeup" data-v="${l.id}|${l.makeup?0:1}">${l.makeup?'取消补课标记':'标为补课'}</button>` : ''}</dd>${l.note?`<dt>备注</dt><dd>${esc(l.note)}</dd>`:''}
  ${l.status==='leave'?`<dt>扣学生课时</dt><dd class="num">${l.deduct} 小时（老师照发）</dd>`:''}${isDone(l)?`<dt>反馈</dt><dd>${f?(f.status==='approved'?'已审批':'待审批'):'<span class="tag warn">老师未写</span>'}</dd>`:''}
  ${q?`<dt>申请</dt><dd>${reqLine(q)}</dd>`:''}</dl>
  ${canSched() && !f && l.status!=='leave' ? `<section class="card" style="display:flex;flex-direction:column;gap:8px"><b>调课</b>
    <div class="fields"><label class="field"><span>日期</span><input type="date" id="mv-date" value="${l.date}"></label><label class="field"><span>开始（${tzName(myTz())}）</span><input type="time" id="mv-s" value="${fromJST(l.start)}"></label><label class="field"><span>结束</span><input type="time" id="mv-e" value="${fromJST(l.end)}"></label></div>
    <label class="field"><span>原因</span><input type="text" id="mv-note" placeholder="例：老师发烧，改到周二"></label>
    <div class="row"><button class="btn pri" data-act="move" data-v="${l.id}">保存调课</button><span class="muted xs">老师、学生、家长的课表同时更新</span></div></section>` : ''}
  ${!isTop() && canSched() && !f ? `<div class="row" id="del-row"><button class="btn danger sm" data-act="del-ask" data-v="${l.id}">删除这节课</button><span class="muted xs">学生请假、扣课时请联系教务·管理处理</span></div>` : ''}
  ${!isTop() && canSched() && f ? '<div class="muted xs">这节课已经写了反馈，不能再调课或删除。需要改的话请联系教务老师。</div>' : ''}
  ${isTop() && !f ? `<section class="card" style="display:flex;flex-direction:column;gap:8px"><b>${l.status==='leave'?'请假':'标记请假'}</b>
    <div class="muted xs">当天请假原则上扣一半课时，也可以酌情不扣。</div>
    <div class="fields"><label class="field"><span>扣学生课时</span><select id="lv-d"><option value="0">不扣</option><option value="${dur(l)/2}" ${l.date===TODAY?'selected':''}>扣 ${dur(l)/2} 小时（一半）</option><option value="${dur(l)}">扣全部 ${dur(l)} 小时</option></select></label>
    <label class="field"><span>备注</span><input type="text" id="lv-note" placeholder="例：第一次，已口头提醒"></label></div>
    <div class="row"><button class="btn seal" data-act="leave" data-v="${l.id}">${l.status==='leave'?'更新请假':'确认请假'}</button>${l.status==='leave'?`<button class="btn" data-act="unleave" data-v="${l.id}">取消请假</button>`:''}</div></section>
  <div class="row" id="del-row"><button class="btn danger sm" data-act="del-ask" data-v="${l.id}">删除这节课</button></div>` : (isTop() && f ? '<div class="muted xs">这节课已经写了反馈，不能再调课或删除。</div>' : '')}`);
}
function addLessonModal(){
  const act = DB.courses.filter(c=>c.active && (ME().role!=='teacher' || c.teacher_id===ME().teacher_id));
  if (!act.length){ toast(ME().role==='teacher' ? '你还没有分配学生，请联系教务老师' : '先在学生档案里给学生添加课程', true); return; }
  openModal(`${mHead('排课')}
  <label class="field"><span>${ME().role==='teacher'?'学生 · 科目':'学生 · 老师 · 科目'}</span><select id="al-c">${act.map(c=>`<option value="${c.id}">${esc(stu(c.student_id).name)}${ME().role==='teacher'?'':' · '+esc(tea(c.teacher_id).name)} · ${esc(c.subject)}</option>`).join('')}</select></label>
  <div class="fields"><label class="field"><span>第一节日期</span><input type="date" id="al-d" value="${TODAY}"></label><label class="field"><span>开始（${tzName(myTz())}）</span><input type="time" id="al-s" value="${myTz()==='CN'?'18:00':'19:00'}"></label><label class="field"><span>结束</span><input type="time" id="al-e" value="${myTz()==='CN'?'20:00':'21:00'}"></label></div>
  ${myTz()==='CN'?'<div class="note">请按<b>北京时间</b>填写，系统会自动换算成日本时间（＋1 小时）给学生和教务看。</div>':''}
  <label class="field"><span>类型</span><select id="al-mk"><option value="0">普通课</option><option value="1">补课</option></select></label>
  <label class="field"><span>重复</span><select id="al-rep"><option value="month">每周同一时间，到这个月底</option><option value="1">只排这一节</option><option value="4">每周同一时间，共 4 周</option><option value="8">每周同一时间，共 8 周</option></select></label>
  <div class="muted xs">和这位老师已有的课时间重叠的，会自动跳过。</div>
  <div class="row"><button class="btn pri" data-act="save-lesson">排课</button></div>`);
}
function studentForm(id){
  const s = id ? stu(id) : {name:'', track:'', grad:false, loc:'', tz:'JP', staff:'', memo:'', active:true};
  openModal(`${mHead(id?'编辑学生':'新增学生')}
  <div class="fields"><label class="field"><span>姓名 *</span><input type="text" id="sf-name" value="${esc(s.name)}"></label>
  <label class="field"><span>方向</span><input type="text" id="sf-track" value="${esc(s.track)}" placeholder="例：学部 · 文科 / 大学院 · 写真"></label>
  <label class="field"><span>类别</span><select id="sf-grad"><option value="false" ${s.grad?'':'selected'}>学部</option><option value="true" ${s.grad?'selected':''}>大学院</option></select></label>
  <label class="field"><span>所在地</span><input type="text" id="sf-loc" value="${esc(s.loc)}" placeholder="例：东京 / 杭州"></label>
  <label class="field"><span>显示时间</span><select id="sf-tz"><option value="JP" ${s.tz==='JP'?'selected':''}>日本时间</option><option value="CN" ${s.tz==='CN'?'selected':''}>北京时间</option></select></label>
  <label class="field"><span>负责教务</span><input type="text" id="sf-staff" value="${esc(s.staff)}" placeholder="例：金老师"></label>
  ${id?`<label class="field"><span>状态</span><select id="sf-active"><option value="true" ${s.active?'selected':''}>在读</option><option value="false" ${s.active?'':'selected'}>停课 / 毕业</option></select></label>`:''}</div>
  <label class="field"><span>教务备注（只有教务能看到）</span><textarea id="sf-memo">${esc(s.memo||'')}</textarea></label>
  ${id?'':'<div class="muted xs">保存后会自动生成这位学生和家长的两条专属链接。</div>'}
  <div class="row"><button class="btn pri" data-act="save-student" data-v="${id||''}">保存</button></div>`);
}
function teacherForm(id){
  const t = id ? tea(id) : {name:'', subject:'', loc:'', tz:'JP', edu:'', exp:'', good:'', active:true};
  openModal(`${mHead(id?'编辑老师':'新增老师')}
  <div class="fields"><label class="field"><span>姓名 *</span><input type="text" id="tf-name" value="${esc(t.name)}" placeholder="例：陆老师"></label>
  <label class="field"><span>主要科目</span><input type="text" id="tf-subject" value="${esc(t.subject)}" placeholder="例：EJU日语"></label>
  <label class="field"><span>所在地</span><input type="text" id="tf-loc" value="${esc(t.loc)}" placeholder="例：北京"></label>
  <label class="field"><span>显示时间</span><select id="tf-tz"><option value="JP" ${t.tz==='JP'?'selected':''}>日本时间</option><option value="CN" ${t.tz==='CN'?'selected':''}>北京时间</option></select></label>
  ${id?`<label class="field"><span>状态</span><select id="tf-active"><option value="true" ${t.active?'selected':''}>在职</option><option value="false" ${t.active?'':'selected'}>离职</option></select></label>`:''}</div>
  <label class="field"><span>学历</span><input type="text" id="tf-edu" value="${esc(t.edu)}"></label>
  <label class="field"><span>教学经历</span><textarea id="tf-exp">${esc(t.exp)}</textarea></label>
  <label class="field"><span>擅长领域</span><input type="text" id="tf-good" value="${esc(t.good)}"></label>
  ${id?'<div class="muted xs">老师离职后，记得到「链接与权限」里停用他的链接。</div>':'<div class="muted xs">保存后会自动生成这位老师的专属链接。</div>'}
  <div class="row"><button class="btn pri" data-act="save-teacher" data-v="${id||''}">保存</button></div>`);
}
function studentModal(id, tab){
  lastModal = () => studentModal(id, tab);
  const s = stu(id), cs = DB.courses.filter(c=>c.student_id===id); tab = tab || 'info';
  const ym = TODAY.slice(0,7), nx = ymShift(ym,1), pv = ymShift(ym,-1);
  const tabs = [['info','概况与课程'],['pfview','家长看到的档案'],['board','跟进看板'],['profile','档案资料'],['score','成绩'],['target','大学与出愿'],['review','月度回访'],['fu','跟进记录'],['mp','月计划'],['fb','反馈'],['note','私下备注']];
  let body = '';
  if (tab==='pfview') body = `<div class="hint" style="margin:0">这就是学生和家长在自己链接「档案」里看到的页面，照 Excel 第一页的顺序。</div>${profilePage(s)}`;
  else if (tab==='board') body = boardView(id);
  else if (['profile','score','target','review','fu'].includes(tab)) body = studentTrackTab(id, tab);
  else if (tab==='info'){
    const ps = personOf('student','student_id',id), pp = personOf('parent','student_id',id);
    body = `<div class="grid2"><dl class="kv">${s.code?`<dt>编号</dt><dd class="num">${esc(s.code)}</dd>`:''}<dt>方向</dt><dd>${esc(s.track||'—')}（${s.grad?'大学院':'学部'}）</dd><dt>所在地</dt><dd>${esc(s.loc||'—')}（${s.tz==='CN'?'北京时间':'日本时间'}）</dd><dt>负责教务</dt><dd>${esc(s.staff||'—')}</dd>${s.memo?`<dt>教务备注</dt><dd>${esc(s.memo)}</dd>`:''}</dl>
      <div class="row" style="align-content:flex-start">${isTop()?`<button class="btn sm" data-act="student-form" data-v="${id}">编辑资料</button>`:''}<button class="btn sm" data-act="stu-cal" data-v="${id}">看课表</button>
      ${ps?`<button class="btn sm" data-act="copy-link" data-v="${ps.key}">复制学生链接</button>`:''}${pp?`<button class="btn sm" data-act="copy-link" data-v="${pp.key}">复制家长链接</button>`:''}</div></div>
      <b>课程</b><div class="list">${cs.map(c=>`<div class="li small"><span class="grow">${esc(tea(c.teacher_id).name)} ${subjTag(c.subject)}${c.active?'':' <span class="tag mute">已停</span>'}</span>${isTop()?`<span class="num">${rateTxt(c.rate)}</span>`:''}${isAdmin()?`<button class="btn sm" data-act="course-edit" data-v="${c.id}">改</button>`:''}</div>`).join('')||'<div class="muted small">还没有课程</div>'}</div>
      ${isAdmin()?`<details class="card" ${cs.length?'':'open'}><summary><b>＋ 添加课程</b> <span class="muted xs">（这位学生跟哪位老师上什么课）</span></summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${DB.teachers.length?`<div class="fields"><label class="field"><span>老师</span><select id="cf-t">${DB.teachers.filter(t=>t.active).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label class="field"><span>科目</span><input type="text" id="cf-subj" placeholder="例：文综"></label>${isTop()?'<label class="field"><span>老师单价（每小时；3 位数＝人民币，4 位数＝日元）</span><input type="number" id="cf-rate" step="500" min="0" value="0"></label>':''}</div>${isTop()?'':'<div class="muted xs">课时单价由教务·管理设置。</div>'}
        <div class="row"><button class="btn pri sm" data-act="add-course" data-v="${id}">添加课程</button></div>`:'<div class="muted small">先到「老师档案」里添加老师。</div>'}</div></details>`:''}
      ${isTop()?`<div class="row" id="stu-del-row" style="margin-top:6px"><button class="btn danger sm" data-act="stu-del-ask" data-v="${id}">删除这位学生</button></div>`:''}`;
  } else if (tab==='mp') {
    const editable = cs.filter(c=>c.active);
    const edit = m => `<section class="card" style="display:flex;flex-direction:column;gap:8px"><b>${ymLabel(m)}计划</b>${editable.map(c=>`<label class="field"><span>${esc(c.subject)} · ${esc(tea(c.teacher_id).name)}${DB.plans.find(p=>p.course_id===c.id&&p.ym===m)?.updated_by?` <span class="xs">（${esc(DB.plans.find(p=>p.course_id===c.id&&p.ym===m).updated_by)} 写）</span>`:''}</span><textarea id="mp-${m}-${c.id}" style="min-height:52px" placeholder="这个月这门课要完成什么">${esc(planText(c.id,m))}</textarea></label>`).join('')||'<div class="muted small">还没有课程</div>'}
      ${editable.length?`<div class="row"><button class="btn pri sm" data-act="mp-save" data-v="${id}|${m}">保存${+m.slice(5)}月计划</button></div>`:''}</section>`;
    body = `<div class="hint" style="margin:0">每门课每月写一句，学生和家长能看到。任课老师也可以在自己的链接里写。进度快了慢了，下个月重新写就行。</div>${edit(ym)}${edit(nx)}<section class="card"><b>${ymLabel(pv)}计划</b>${mpView(id,pv)}</section>`;
  } else if (tab==='fb') body = fbOfS(id).slice().reverse().slice(0,6).map(f=>fbCard(f)).join('') || '<div class="empty">还没有反馈</div>';
  else body = `<div class="note">私下备注只有老师和教务能看到，学生和家长看不到。</div>${DB.notes.filter(n=>n.student_id===id).slice().reverse().map(n=>`<div class="card small"><b>${esc(n.author)}</b> <span class="muted">${sMD(n.created_at.slice(0,10))}</span><p style="margin:4px 0 0;white-space:pre-wrap">${esc(n.text)}</p></div>`).join('')||'<div class="empty">暂无备注</div>'}
    <textarea id="note-new" placeholder="写一条备注"></textarea><div class="row"><button class="btn sm" data-act="note-add" data-v="${id}">添加备注</button></div>`;
  openModal(`${mHead(`${esc(s.name)} <span class="muted small" style="font-family:var(--f-body)">${esc(s.track||'')}</span>`)}
  <div class="seg">${tabs.map(([k,t])=>`<button class="${tab===k?'on':''}" data-act="stu-tab" data-v="${id}|${k}">${t}</button>`).join('')}</div>${body}`, true);
}
function courseEdit(cid){
  const c = course(cid);
  openModal(`${mHead(`${esc(stu(c.student_id).name)} · ${esc(tea(c.teacher_id).name)}`)}
  <div class="fields"><label class="field"><span>科目</span><input type="text" id="ce-subj" value="${esc(c.subject)}"></label>${isTop()?`<label class="field"><span>老师单价（每小时；3 位数＝人民币，4 位数＝日元）</span><input type="number" id="ce-rate" step="500" min="0" value="${c.rate||0}"></label>`:''}
  <label class="field"><span>状态</span><select id="ce-active"><option value="true" ${c.active?'selected':''}>在上</option><option value="false" ${c.active?'':'selected'}>停了</option></select></label></div>
  <div class="row"><button class="btn pri" data-act="save-course" data-v="${cid}">保存</button></div>`);
}
function tStuModal(cid){
  const c = course(cid), s = stu(c.student_id), ym = TODAY.slice(0,7), nx = ymShift(ym,1);
  openModal(`${mHead(`${esc(s.name)} · ${esc(c.subject)}`)}
  ${teacherTrackBlock(s.id)}
  <b class="small">月计划 <span class="muted xs" style="font-weight:400">学生和家长能看到</span></b>
  ${[ym,nx].map(m=>`<label class="field"><span>${ymLabel(m)}</span><textarea id="mp-${m}-${cid}" style="min-height:52px" placeholder="这个月要完成什么，例：日本史近代收尾，每周 1 篇记述">${esc(planText(cid,m))}</textarea></label>`).join('')}
  <div class="row"><button class="btn pri sm" data-act="t-mp-save" data-v="${cid}">保存计划</button></div>
  <b class="small">私下备注 <span class="muted xs" style="font-weight:400">只有你和教务能看到</span></b>
  ${DB.notes.filter(n=>n.student_id===s.id).map(n=>`<div class="card small"><span class="muted">${sMD(n.created_at.slice(0,10))}</span> ${esc(n.text)}</div>`).join('')}
  <textarea id="t-note" placeholder="例：学生最近状态不好，家长比较焦虑"></textarea><div class="row"><button class="btn sm" data-act="t-note-save" data-v="${s.id}">添加备注</button></div>`);
}
function reqModal(lid){
  const l = L(lid), c = course(l.course_id);
  openModal(`${mHead('申请改期 / 请假')}
  <div class="small">${fmtMD(l.date)} ${l.start}–${l.end}（日本时间）· ${esc(c.subject)} · ${esc(tea(c.teacher_id).name)}</div>
  ${l.date===TODAY?'<div class="note warn">这是今天的课。当天请假原则上要扣一半课时，最终由教务老师决定。</div>':''}
  <label class="field"><span>申请什么</span><select id="rq-type" data-change="rq-type"><option>改期</option><option>请假</option></select></label>
  <label class="field"><span>原因（必填）</span><textarea id="rq-reason" placeholder="例：学校有考试 / 身体不舒服"></textarea></label>
  <label class="field" id="rq-wish-f"><span>希望改到什么时候（可以写几个候选）</span><textarea id="rq-wish" placeholder="例：周一 19 点以后，或周二全天"></textarea></label>
  <div class="row"><button class="btn pri" data-act="req-submit" data-v="${lid}">提交申请</button><span class="muted xs">教务老师处理后，你和老师都会看到结果</span></div>`);
}
function linkModal(){
  openModal(`${mHead('新建链接')}
  <div class="muted small">老师、学生、家长的链接在新增时已经自动生成。这里一般用来<b>给新的教务老师开链接</b>，或者给同一个学生多开一条家长链接（比如爸爸妈妈各一条）。</div>
  <div class="fields"><label class="field"><span>身份</span><select id="ln-role" data-change="ln-role"><option value="normal">教务 · 普通</option><option value="top">教务 · 管理</option><option value="parent">家长</option><option value="student">学生</option><option value="teacher">任课老师</option></select></label>
  <label class="field"><span>姓名</span><input type="text" id="ln-name" placeholder="例：甘老师"></label>
  <label class="field" id="ln-target-f" hidden><span>对应的人</span><select id="ln-target"></select></label></div>
  <div class="note warn" id="ln-empty" hidden></div>
  <div id="ln-scope-f" class="field"><span>负责哪些学生（点选）</span><div class="chips">${DB.students.map(s=>`<button class="chip" data-act="ln-chip" data-v="${s.id}">${esc(s.name)}</button>`).join('')||'<span class="muted small">还没有学生</span>'}</div></div>
  <div class="row"><button class="btn pri" data-act="link-create">生成链接</button></div>`);
}
function scopeModal(pid){
  const p = DB.people.find(x=>x.id===pid); scopeSel = new Set(p.scope||[]);
  openModal(`${mHead(`${esc(p.name)} 负责的学生`)}
  <div class="chips">${DB.students.map(s=>`<button class="chip ${scopeSel.has(s.id)?'on':''}" data-act="scope-chip" data-v="${s.id}">${esc(s.name)}</button>`).join('')}</div>
  <div class="row"><button class="btn pri" data-act="scope-save" data-v="${pid}">保存</button><span class="muted xs">立即生效，不用重新发链接</span></div>`);
}

/* ═════════════ 交互 ═════════════ */
function toast(msg, err){ const r=document.getElementById('toast-root'); r.innerHTML=`<div class="toast ${err?'err':''}" role="status">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t=setTimeout(()=>r.innerHTML='', err?5000:2800); }
const val = id => document.getElementById(id)?.value ?? '';
function copyText(t, ok){
  const done = () => toast(ok), fail = () => { openModal(`${mHead('请手动复制')}<textarea readonly style="min-height:90px" onclick="this.select()">${esc(t)}</textarea>`); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fail); else fail();
}
let lnScope = new Set(), wTags = new Set(), scopeSel = new Set();
function lessonDates(first, rep){
  const out = [], d0 = pd(first), m = d0.getMonth();
  if (rep==='1') return [first];
  for (let d = new Date(d0), i = 0; ; d = new Date(d.getTime()+7*86400000), i++){
    if (rep==='month' ? d.getMonth()!==m : i >= Number(rep)) break;
    out.push(ds(d));
  }
  return out;
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const v = a.dataset.v, k = a.dataset.act;
  if (k==='close-bg' && e.target!==a) return;
  try {
  switch(k){
    case 'page': if (v==='feedback-missing'){ S.page='feedback'; S.fbTab='missing'; } else { S.page=v; if (v==='feedback') S.fbTab='pending'; } render(); window.scrollTo(0,0); break;
    case 'tab': S.tab=v; render(); window.scrollTo(0,0); break;
    case 'pview': PV=v; try{ localStorage.setItem('jw_view', v); }catch(_){} render(); break;
    case 'pday': S.pDay=v; render(); break;
    case 'pmonth': S.pMonth = v==='0' ? TODAY.slice(0,7) : ymShift(S.pMonth || TODAY.slice(0,7), Number(v)); S.pDay = S.pMonth===TODAY.slice(0,7) ? TODAY : S.pMonth+'-01'; render(); break;
    case 'month': S.month = v==='0' ? TODAY.slice(0,7) : ymShift(S.month, Number(v)); render(); break;
    case 'caltype': S.calType=v; S.calId=''; render(); break;
    case 'lesson': lessonModal(v); break;
    case 'add-lesson': addLessonModal(); break;
    case 'close': case 'close-bg': closeModal(); break;
    case 'fbtab': S.fbTab=v; S.sel.clear(); S.editing=null; render(); break;
    case 'sel': S.sel.has(v)?S.sel.delete(v):S.sel.add(v); render(); break;
    case 'sel-all': { const p=DB.feedbacks.filter(f=>f.status==='pending'); if (S.sel.size===p.length) S.sel.clear(); else p.forEach(f=>S.sel.add(f.id)); render(); break; }
    case 'approve': await act('admin_feedback_approve', {ids:[v]}, '已审批，家长现在能看到这条反馈'); S.sel.delete(v); break;
    case 'approve-sel': { const ids=[...S.sel]; await act('admin_feedback_approve', {ids}, r=>`已审批 ${r} 条`); S.sel.clear(); render(); break; }
    case 'unapprove': await act('admin_feedback_unapprove', {fid:v}, '已撤回，家长暂时看不到'); break;
    case 'edit': S.editing=v; render(); break;
    case 'cancel-edit': S.editing=null; render(); break;
    case 'save-edit': { const args={fid:v, content:val(`ed-content-${v}`), perf:val(`ed-perf-${v}`), hw:val(`ed-hw-${v}`)}; S.editing=null; await act('admin_feedback_edit', args, '已保存修改，可以审批了'); break; }
    case 'copy-remind': { const l=L(v), c=course(l.course_id); copyText(`${tea(c.teacher_id).name}您好，${sMD(l.date)} ${stu(c.student_id).name}的${c.subject}课反馈还没写，麻烦抽空填一下，谢谢！`, '提醒文字已复制，发到老师微信就行'); break; }
    case 'student': studentModal(v); break;
    case 'stu-tab': { const [id,t]=v.split('|'); studentModal(id,t); break; }
    case 'stu-cal': closeModal(); S.page='calendar'; S.calType='s'; S.calId=v; render(); break;
    case 'student-form': studentForm(v); break;
    case 'save-student': { if(!val('sf-name').trim()){toast('请填写姓名',true);break;}
      const d={name:val('sf-name'), track:val('sf-track'), grad:val('sf-grad')==='true', loc:val('sf-loc'), tz:val('sf-tz'), staff:val('sf-staff'), memo:val('sf-memo')};
      if (v){ d.id=v; d.active = val('sf-active')!=='false'; }
      const sid = await act('admin_save_student', {d}, v?'已保存':'已添加。接下来在「概况与课程」里给他添加课程'); studentModal(sid,'info'); break; }
    case 'teacher-form': teacherForm(v); break;
    case 'save-teacher': { if(!val('tf-name').trim()){toast('请填写姓名',true);break;}
      const d={name:val('tf-name'), subject:val('tf-subject'), loc:val('tf-loc'), tz:val('tf-tz'), edu:val('tf-edu'), exp:val('tf-exp'), good:val('tf-good')};
      if (v){ d.id=v; d.active = val('tf-active')!=='false'; }
      await act('admin_save_teacher', {d}, v?'已保存':'已添加，老师的专属链接也生成好了'); closeModal(); break; }
    case 'add-course': { if(!val('cf-subj').trim()){toast('请填写科目',true);break;}
      await act('admin_save_course', {d:{student_id:v, teacher_id:val('cf-t'), subject:val('cf-subj'), rate:Number(val('cf-rate'))||0}}, '课程已添加，可以去排课了'); studentModal(v,'info'); break; }
    case 'course-edit': courseEdit(v); break;
    case 'save-course': { const c=course(v); await act('admin_save_course', {d:{id:v, subject:val('ce-subj'), rate: isTop() ? (Number(val('ce-rate'))||0) : undefined, active:val('ce-active')==='true'}}, '已保存'); studentModal(c.student_id,'info'); break; }
    case 'move': { const d=val('mv-date'), s=toJST(val('mv-s')), en=toJST(val('mv-e')); if(!d||!s||!en||mins(en)<=mins(s)){toast('请检查日期和时间（不能跨过半夜 12 点）',true);break;}
      await act('admin_update_lesson', {lid:v, d:{date:d, start:s, end:en, moved:true, note:val('mv-note')||'已调课'}}, '已调课，各方的课表已更新'); closeModal(); break; }
    case 'leave': { const dd=Number(val('lv-d')); await act('admin_update_lesson', {lid:v, d:{status:'leave', deduct:dd, note:val('lv-note')||(dd?`当天请假，扣 ${dd} 小时`:'请假，不扣课时')}}, '已标记请假'); closeModal(); break; }
    case 'unleave': await act('admin_update_lesson', {lid:v, d:{status:'scheduled', deduct:0, note:''}}, '已取消请假'); closeModal(); break;
    case 'del-ask': document.getElementById('del-row').innerHTML=`<span class="small">确定删除这节课？</span><button class="btn danger sm" data-act="del" data-v="${v}">删除</button><button class="btn sm" data-act="close">算了</button>`; break;
    case 'del': await act('admin_delete_lesson', {lid:v}, '已删除'); closeModal(); break;
    case 'save-lesson': { const d=val('al-d'), s=toJST(val('al-s')), en=toJST(val('al-e')); if(!d||!s||!en||mins(en)<=mins(s)){toast('请检查日期和时间（不能跨过半夜 12 点）',true);break;}
      await act('admin_add_lessons', {course:val('al-c'), dates:lessonDates(d, val('al-rep')), st:s, et:en, ...(val('al-mk')==='1'?{makeup:true}:{})}, r=>`已排 ${r.added} 节课`+(r.skipped?`，${r.skipped} 节和老师已有的课冲突，已跳过`:'')); S.month=d.slice(0,7); closeModal(); render(); break; }
    case 'req-ok': { const q=DB.requests.find(x=>x.id===v);
      const args = q.type==='改期' ? {rid:v, accept:true, reply:'', nd:val('rq-d-'+v), ns:val('rq-s-'+v), ne:val('rq-e-'+v), deduct:0} : {rid:v, accept:true, reply:'', deduct:Number(val('rq-dd-'+v))};
      await act('admin_handle_request', args, '已处理，学生和老师都能看到结果'); break; }
    case 'req-no': await act('admin_handle_request', {rid:v, accept:false, reply:val('rq-r-'+v)}, '已回复学生'); break;
    case 'mp-save': { const [sid,m]=v.split('|'); const cs=DB.courses.filter(c=>c.student_id===sid && c.active);
      for (const c of cs) await rpc('plan_save', {cid:c.id, month:m, txt:val(`mp-${m}-${c.id}`)});
      await load(); render(); studentModal(sid,'mp'); toast('计划已保存，学生和家长能看到'); break; }
    case 't-mp-save': { const ym=TODAY.slice(0,7); for (const m of [ym, ymShift(ym,1)]) await rpc('plan_save', {cid:v, month:m, txt:val(`mp-${m}-${v}`)}); await load(); render(); tStuModal(v); toast('计划已保存'); break; }
    case 'note-add': await act('note_add', {sid:v, txt:val('note-new')}, '已保存，学生和家长看不到'); studentModal(v,'note'); break;
    case 't-note-save': { const c=DB.courses.find(x=>x.student_id===v && x.teacher_id===ME().teacher_id); await act('note_add', {sid:v, txt:val('t-note')}, '已保存，只有你和教务能看到'); if(c) tStuModal(c.id); break; }
    case 't-stu': tStuModal(v); break;
    case 'w-tag': wTags.has(v)?wTags.delete(v):wTags.add(v); a.classList.toggle('on'); break;
    case 'submit-fb': { const c=val('w-content').trim(), p=val('w-perf').trim(), h=val('w-hw').trim(); if(!c||!p||!h){toast('三项内容都要填',true);break;}
      await act('feedback_submit', {lid:val('w-lesson'), content:c, perf:p, hw:h, tags:[...wTags], last_hw:val('w-last')}, '已提交，学生已经能看到了'); wTags.clear(); render(); break; }
    case 'grade': { const t=val('gr-'+v).trim(); if(!t){toast('先写批改意见',true);break;} await act('teacher_grade', {fid:v, fb:t}, '批改完成，学生能看到了'); break; }
    case 'save-me': await act('teacher_save_profile', {edu:val('me-edu'), exp:val('me-exp'), good:val('me-good')}, '履历已保存'); break;
    case 'confirm': { const [id,r]=v.split('|'); await act('student_confirm', {fid:id, rating:r}, r==='满意'?'已确认，谢谢':'已确认，教务老师会看到你的评价'); break; }
    case 'hw-done': await act('student_hw_done', {fid:v, note:val('hw-'+v)}, '已提交，老师会批改'); break;
    case 'req-open': reqModal(v); break;
    case 'req-submit': { const t=val('rq-type'), why=val('rq-reason').trim(), wish=val('rq-wish').trim(); if(!why){toast('请写原因',true);break;} if(t==='改期'&&!wish){toast('请写希望的时间',true);break;}
      await act('student_request', {lid:v, typ:t, reason:why, wish}, '已提交，教务老师处理后你会在这里看到结果'); closeModal(); break; }
    case 'copy-link': copyText(linkOf(v), '链接已复制，发到对方微信就行'); break;
    case 'copy-pay': { const ls=lsOfT(v).filter(l=>l.date.startsWith(S.payMonth) && paidH(l)>0); const t=tea(v);
      copyText(`${t.name} ${ymLabel(S.payMonth)}课时\n`+ls.map(l=>`${sMD(l.date)} ${timeFor(l,t.tz)} ${stu(course(l.course_id).student_id).name} ${paidH(l)}h${l.status==='leave'?'（当天请假）':''}`).join('\n')+`\n共 ${ls.reduce((a,l)=>a+paidH(l),0)} 小时`, '已复制，发给老师核对'); break; }
    case 'link-regen': { const p=DB.people.find(x=>x.id===v); const isMe=p.id===ME().id;
      const nk = await act('admin_link_update', {pid:v, d:{regen:'true'}}, `已为 ${p.name} 生成新链接，旧链接已失效`);
      if (isMe && nk){ try{localStorage.setItem('jw_k', nk);}catch(e){} location.href = linkOf(nk); } break; }
    case 'link-toggle': { const p=DB.people.find(x=>x.id===v); await act('admin_link_update', {pid:v, d:{active: p.active?'false':'true'}}, p.active?`${p.name} 的链接已停用`:`${p.name} 的链接已恢复`); break; }
    case 'link-new': lnScope=new Set(); linkModal(); break;
    case 'ln-chip': lnScope.has(v)?lnScope.delete(v):lnScope.add(v); a.classList.toggle('on'); break;
    case 'link-create': { const r=val('ln-role'), name=val('ln-name').trim(); if(!name){toast('请填写姓名',true);break;}
      const d = {name, role: (r==='normal'||r==='top')?'admin':r, level: (r==='normal'||r==='top')?r:null, scope:[...lnScope]};
      if (r==='teacher'||r==='student'||r==='parent'){ if(!val('ln-target')){toast('请先选择对应的人',true);break;} if (r==='teacher') d.teacher_id=val('ln-target'); else d.student_id=val('ln-target'); }
      const nk = await act('admin_link_create', {d}); closeModal(); copyText(linkOf(nk), `已生成 ${name} 的链接并复制`); break; }
    case 'go-add': closeModal(); S.page = v==='teacher' ? 'teachers' : 'students'; render(); if (v==='teacher') teacherForm(); else studentForm(); break;
    case 'scope-edit': scopeModal(v); break;
    case 'scope-chip': scopeSel.has(v)?scopeSel.delete(v):scopeSel.add(v); a.classList.toggle('on'); break;
    case 'scope-save': await act('admin_link_update', {pid:v, d:{scope:[...scopeSel]}}, '范围已更新'); closeModal(); break;
  }
  } catch(err){ /* act() 已经提示过错误 */ if (!String(err?.message||'').length) toast('出错了', true); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change;
  if (k==='calwho'){ S.calId=el.value; render(); }
  else if (k==='paym'){ S.payMonth=el.value; render(); }
  else if (k==='team'){ S.teaMonth=el.value; render(); }
  else if (k==='rq-type'){ document.getElementById('rq-wish-f').hidden = el.value!=='改期'; }
  else if (k==='ln-role'){ const r=el.value, adm=r==='normal'||r==='top', list = r==='teacher'?DB.teachers:DB.students;
    const emptyBox=document.getElementById('ln-empty'), noOne = !adm && !list.length;
    document.getElementById('ln-target-f').hidden=adm||noOne; document.getElementById('ln-scope-f').hidden=r!=='normal';
    document.querySelector('[data-act="link-create"]').disabled = noOne;
    emptyBox.hidden = !noOne;
    if (noOne) emptyBox.innerHTML = r==='teacher'
      ? `还没有老师。请先到「老师档案」新增老师，<b>保存后会自动生成他的链接</b>，不用在这里建。 <button class="btn sm" data-act="go-add" data-v="teacher">去新增老师</button>`
      : `还没有学生。请先到「学生档案」新增学生，<b>保存后会自动生成学生和家长的链接</b>。 <button class="btn sm" data-act="go-add" data-v="student">去新增学生</button>`;
    if(!adm && !noOne) document.getElementById('ln-target').innerHTML=list.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''); }
});
document.addEventListener('input', e => {
  if (e.target.dataset?.input==='stuq' && !e.isComposing){ S.stuQ=e.target.value; render(); const i=document.getElementById('stu-q'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); }
});
document.addEventListener('compositionend', e => { if (e.target.id==='stu-q'){ S.stuQ=e.target.value; render(); const i=document.getElementById('stu-q'); i.focus(); } });
document.addEventListener('keydown', e => { if (e.key==='Escape' && mroot.innerHTML) closeModal(); });

/* ───────── 启动 ───────── */
window.addEventListener('DOMContentLoaded', async function start(){
  if (!KEY){ app.innerHTML = `<div class="center"><h2>一对一教务台</h2><p class="muted">请用教务老师发给你的专属链接打开。</p></div>`; return; }
  try { await load(); render(); }
  catch(e){
    const bad = /无效|停用/.test(e.message);
    if (bad){ try{ localStorage.removeItem('jw_k'); }catch(_){} }
    app.innerHTML = `<div class="center"><h2>${bad?'这个链接已失效':'暂时打不开'}</h2><p class="muted">${bad?'链接可能已经停用或更换。请联系教务老师重新发一条链接。':'网络好像不太稳定，请稍后刷新再试。'}</p>${bad?'':'<p><button class="btn" onclick="location.reload()">刷新</button></p>'}</div>`;
  }
});
