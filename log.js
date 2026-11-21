/* ══════════════════════════════════════════════════════════════
   改动记录（数据库第 56 步，2026-11-19）
   · 菜单「管理 → 改动记录」：只有教务 · 管理（总管理、潘老师、金老师）能看
   · 谁（哪条链接）在什么时候新增 / 修改 / 删除了什么；同一次点保存的几条放在一起
   · Panda 那边的改动只有总管理看得到（数据库里已经筛好，这里不用再管）
   · 「链接与权限」的「清除」「清除登录记录」：清掉最近打开时间和设备（admin_seen_clear）
   ══════════════════════════════════════════════════════════════ */
const LOGX = {rows: [], at: 0, busy: false, more: false, err: '', who: '', cat: '', sid: '', seq: 0};
// 每次读都编个号：读的过程中又换了学生、点了刷新，旧的那次结果就不要了（免得乙的筛选下显示甲的记录）
async function logFetch(older){
  if (older && LOGX.busy) return;
  const my = ++LOGX.seq, sid = LOGX.sid;
  LOGX.busy = true; LOGX.err = '';
  let r = [], err = '';
  try {
    const args = {};
    if (older && LOGX.rows.length) args.upto = LOGX.rows[LOGX.rows.length - 1].id;
    if (sid) args.stu = sid;
    r = await rpc('change_log_load', args) || [];
  } catch(e) { err = e.message; }
  if (my !== LOGX.seq) return;
  LOGX.busy = false; LOGX.at = Date.now();
  if (err) LOGX.err = err; else { LOGX.rows = older ? LOGX.rows.concat(r) : r; LOGX.more = r.length >= 300; }
  if (S.page === 'log' && !document.querySelector('.modal')) render();
}
// 每次从菜单点进来都重新读一遍（在别的点击处理之前先标记）
document.addEventListener('click', e => { const a = e.target.closest('[data-act="page"]'); if (a && a.dataset.v === 'log') LOGX.at = 0; }, true);

/* ───────── 怎么显示 ───────── */
const LOG_TBL = {students:'学生', teachers:'老师', courses:'课程', lessons:'课', feedbacks:'课后反馈', requests:'改期 / 请假', lesson_changes:'老师申请',
  month_plans:'月计划', reviews:'月度家长反馈', review_raw:'面谈纪要', scores:'成绩', targets:'目标学校', followups:'跟进记录', checklists:'通关点检表',
  check_items:'点检关卡', check_templates:'点检模板', student_msgs:'学生留言', files:'文件', teacher_files:'老师资料', teacher_notes:'老师备注',
  pay_status:'工资', people:'链接', programs:'院校库', program_rounds:'院校日程', settings:'设置'};
const LOG_CATS = [['', '全部'], ['les', '课表', ['courses','lessons','lesson_changes','requests']], ['fb', '反馈与计划', ['feedbacks','month_plans','reviews','review_raw']],
  ['stu', '学生档案', ['students','scores','targets','followups','checklists','check_items','student_msgs','teacher_notes','files']],
  ['tea', '老师与工资', ['teachers','teacher_files','pay_status']], ['link', '链接', ['people']], ['etc', '院校库与设置', ['programs','program_rounds','check_templates','settings']]];
const LOG_ROLE = {admin_top:'教务 · 管理', admin_normal:'教务', teacher:'老师', student:'学生', parent:'家长', '':'系统'};
const LOG_COL = {
  _: {name:'姓名', note:'备注', status:'状态', subject:'科目', student_id:'学生', teacher_id:'老师', course_id:'课程', lesson_id:'课', date:'日期', active:'启用',
      kind:'类型', text:'内容', ym:'月份', school:'学校', type:'类型', title:'名称', seq:'顺序', time:'时间', size:'大小', uploaded_by:'上传人', created_by:'记录人',
      meet_url:'上课链接', meet_note:'会议号 / 密码', loc:'所在地', tz:'时区', info:'详细资料', book:'归属', tags:'标签', edu:'学历', jobs:'工作经历',
      written_date:'笔试', interview_date:'面试', result_date:'放榜', first_result:'一次结果', apply_end:'出愿截止', docs_due:'资料截止', procedure_due:'手续截止'},
  lessons: {start_time:'开始', end_time:'结束', deduct:'请假扣课时', moved:'调课标记', makeup:'补课', done_manual:'教务确认已上', actual_hours:'实际时长',
            actual_note:'时长说明', kind:'课程类型', topic:'本节内容', status:'状态'},
  feedbacks: {content:'上课内容', perf:'课堂表现', hw:'作业', tags:'标签', last_hw:'上次作业', status:'审批', confirm:'学生确认', hw_sub:'交了作业',
              hw_note:'交作业时写的', hw_fb:'老师批改', approved_by:'审批人', approved_at:'审批时间'},
  requests: {reason:'原因', wish:'希望', reply:'回复', handled_by:'处理人'},
  lesson_changes: {kind:'申请', d:'申请内容', old:'原来的课', reply:'回复', by_name:'申请人', handled_by:'处理人', handled_at:'处理时间', result:'结果'},
  courses: {rate:'课时单价', cur:'币种', active:'在上'},
  teachers: {name:'姓名', edu:'学历', exp:'经历', good:'擅长', active:'在职', cv:'履历', cat:'分类', staff:'教务老师'},
  students: {track:'方向', grad:'类别', staff:'负责教务', memo:'教务备注', code:'编号', birth:'生日', grade:'年级', gender:'性别', direction:'升学方向', school:'当前学校',
             target_ym:'目标入学', lv_jp:'日语', lv_en:'英语', lv_math:'数学', lv_bun:'文综', lv_ri:'理综', lv_sat:'SAT / ACT', lv_ap:'A-Level / AP / IB', lv_note:'水平备注',
             uni_type:'大学类型', pref1:'第一优先', pref2:'第二优先', region:'地区', fee:'学费 / 奖学金', major1:'专业方向 1', major2:'专业方向 2', major3:'专业方向 3',
             major_other:'其他专业', private:'只属于 Panda', active:'状态'},
  month_plans: {text:'月计划'},
  reviews: {content:'本月内容', self_eval:'学生自评', teacher_eval:'老师评价', conclusion:'结论', next_focus:'下月重点', note:'补充说明', self_at:'自评时间', talk:'面谈记录'},
  review_raw: {text:'面谈原始纪要', teacher:'任课老师说的'},
  scores: {metric:'项目', score:'分数', full_score:'满分'},
  targets: {tier:'档次', requirement:'入试要求', score_req:'分数要求', doc_status:'资料状态', exam_way:'入试方式', apply_start:'出愿开始', apply_end:'出愿截止',
            docs_due:'资料截止', written_date:'笔试', interview_date:'面试', result_date:'放榜', procedure_due:'手续截止', status:'出愿状态', next_step:'下一步',
            first_result:'一次结果', exam_info:'考试时间备注'},
  followups: {type:'方式', subject:'主题', task:'跟进事项', result:'结果', student_fb:'学生反馈', judgment:'判断', next_action:'下一步', next_date:'下次日期', confirm:'确认'},
  check_items: {stage:'阶段', name:'关卡', plan:'计划', level:'等级', passed_on:'通过日期'},
  check_templates: {name:'名称', items:'关卡', created_by_name:'建的人'},
  student_msgs: {to_teacher:'任课老师可见', hidden_by:'屏蔽', read_at:'已读时间', read_by:'已读人', from_role:'谁写的'},
  files: {name:'文件名', purpose:'用途'},
  teacher_files: {name:'文件名'},
  teacher_notes: {author:'写的人'},
  pay_status: {reviewed_by:'核对', reviewed_at:'核对时间', settled_by:'发工资', settled_at:'发放时间'},
  people: {name:'名字', role:'身份', level:'级别', scope:'负责学生', active:'启用', full_view:'完整链接', key:'链接'},
  programs: {year:'年度', level:'层次', field:'领域', region:'地区', faculty:'学部', dept:'学科'},
  program_rounds: {name:'期', apply_start:'出愿开始', apply_end:'出愿截止', docs_due:'资料截止', first_result:'一次结果', written_date:'笔试', interview_date:'面试', result_date:'放榜', procedure_due:'手续截止'},
  settings: {value:'内容'},
};
const LOG_ENUM = {
  'lessons.status': {scheduled:'正常', leave:'请假'}, 'lessons.moved': {true:'已调课', false:'无'},
  'feedbacks.status': {pending:'待审批', approved:'已通过'},
  'requests.status': {pending:'待处理', accepted:'已同意', rejected:'没同意'},
  'lesson_changes.status': {pending:'等批准', approved:'已批准', rejected:'没批准', withdrawn:'撤回 / 关掉'}, 'lesson_changes.kind': {add:'排课', move:'调课', delete:'删课'},
  'students.grad': {true:'大学院', false:'学部'}, 'students.active': {true:'在读', false:'停课 / 结束'},
  'people.role': {admin:'教务', teacher:'老师', student:'学生', parent:'家长'}, 'people.level': {top:'管理', normal:'普通'},
  'teacher_files.kind': {cv:'简历', cvp:'照片', cvw:'代表作品'}, 'files.purpose': {hw:'学生交的作业', note:'老师的笔记', ck:'点检作品', cv:'履历'},
  'student_msgs.from_role': {student:'学生', parent:'家长'},
  cur: {CNY:'人民币', JPY:'日元'}, tz: {CN:'北京', JP:'日本'}, book: {K:'Project K', mine:'Panda', both:'两边都教'},
};
// 不显示的栏目（内部编号、文件地址这些）
// 「审批时间」「核对时间」这些和每条上面的时间重复，也不显示（「审批人」「核对」那一项还在）
const LOG_HIDE = new Set(['id', 'skey', 'path', 'mime', 'ref', 'by_person', 'by_teacher', 'round_id', 'program_id', 'created_by', 'checklist_id', 'view_book', 'owner',
  'approved_at', 'reviewed_at', 'settled_at', 'handled_at', 'self_at', 'read_at', 'snap', 'uploaded_by_id']);
// 新增 / 删除时「看内容」里不再重复的（上面那句话已经写了是哪个学生、哪节课）
const LOG_CTXCOL = new Set(['student_id', 'teacher_id', 'course_id', 'lesson_id', 'key']);
// 「Project K」视图：归属、Panda 标记这些也不显示（潘、金那边数据库就不给）
const logHid = c => LOG_HIDE.has(c) || (S.book === 'K' && ['book', 'private', 'full_view', 'owner'].includes(c));
const logCol = (t, c) => (LOG_COL[t] || {})[c] || LOG_COL._[c] || c;
const logEmpty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const logLong = v => typeof v === 'string' ? v.length > 40 || v.includes('\n') : (v && typeof v === 'object' && JSON.stringify(v).length > 60);
const logBJ = iso => new Date(iso).toLocaleString('sv-SE', {timeZone: 'Asia/Shanghai'}).slice(0, 16);
const logTime = iso => { const t = logBJ(iso); return `${+t.slice(5,7)}/${+t.slice(8,10)} ${t.slice(11)}`; };
const logD = d => (d.slice(0, 4) === String(TODAY).slice(0, 4) ? '' : d.slice(0, 4) + '/') + `${+d.slice(5,7)}/${+d.slice(8,10)}`;
const logAll = () => (typeof DB_ALL !== 'undefined' && DB_ALL) || DB;
const logStu = id => (logAll().students.find(s => s.id === id) || {name:'（已删除的学生）'}).name;
const logTea = id => (logAll().teachers.find(t => t.id === id) || {name:'（已删除的老师）'}).name;
// 里面套着的内容（考试时间备注、履历这些）摊成一行字
const logFlat = x => x == null ? '' : Array.isArray(x) ? x.map(logFlat).filter(Boolean).join('、') : typeof x === 'object' ? Object.values(x).map(logFlat).filter(Boolean).join(' ') : String(x);
const opTag = op => ({I:'<span class="tag ok">新增</span>', U:'<span class="tag gold">修改</span>', D:'<span class="tag seal">删除</span>'})[op] || '';

function logVal(t, c, v, full){
  if (logEmpty(v)) return '<span class="muted">空</span>';
  const en = LOG_ENUM[t + '.' + c] || LOG_ENUM[c];
  if (en && typeof v !== 'object' && en[String(v)] != null) return esc(en[String(v)]);
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (c === 'student_id') return esc(logStu(v));
  if (c === 'teacher_id') return esc(logTea(v));
  if (c === 'scope' && Array.isArray(v)) return esc(v.map(logStu).join('、'));
  let s;
  if (Array.isArray(v)) s = v.map(logFlat).filter(Boolean).join('、');
  else if (typeof v === 'object') s = Object.entries(v).map(([k, x]) => [logCol(t, k), logFlat(x)]).filter(x => x[1]).map(([k, x]) => `${k}：${x}`).join('；');
  else {
    s = String(v);
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) s = s.slice(0, 5);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = logD(s);
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) s = logTime(s);
  }
  return esc(full || s.length <= 60 ? s : s.slice(0, 60) + '…');
}
// 老师申请的内容：和「老师排课申请」页同一种写法
function logChange(r){
  const x = r.op === 'D' ? r.old : r.new; if (!x || !x.kind) return '';
  try { return `<div class="lg-d">${chText({kind: x.kind, d: x.d || {}, old: x.old, status: 'log', lesson_id: x.lesson_id})}</div>`; } catch(e) { return ''; }
}
// 修改：只列改了的栏目，旧 → 新；长的放进「点开看」
function logDiff(r){
  const o = r.old || {}, n = r.new || {}, short = [], long = [];
  for (const c of Object.keys(n)) {
    if (logHid(c)) continue;
    if (r.tbl === 'people' && c === 'key') { short.push('<b>换了新链接</b>（旧链接不能用了）'); continue; }
    if (logVal(r.tbl, c, o[c], true) === logVal(r.tbl, c, n[c], true)) continue;   // 显示出来一样（比如只是去掉了空的备注）就不列
    if (logLong(o[c]) || logLong(n[c])) long.push([c, `<div class="lg-dl"><b>${esc(logCol(r.tbl, c))}</b><div>原来：${logVal(r.tbl, c, o[c], true)}</div><div>改成：${logVal(r.tbl, c, n[c], true)}</div></div>`]);
    else short.push(`${esc(logCol(r.tbl, c))} <span class="lg-o">${logVal(r.tbl, c, o[c])}</span> → <b>${logVal(r.tbl, c, n[c])}</b>`);
  }
  return (short.length ? `<div class="lg-d">${short.join('；')}</div>` : '')
    + (long.length ? `<details class="lg-more"><summary class="muted xs">改了「${long.map(x => esc(logCol(r.tbl, x[0]))).join('」「')}」，点开看</summary>${long.map(x => x[1]).join('')}</details>` : '');
}
// 新增 / 删除：内容放进「看内容」
function logBody(r){
  const d = (r.op === 'I' ? r.new : r.old) || {};
  const ks = Object.keys(d).filter(c => !logHid(c) && !LOG_CTXCOL.has(c) && !logEmpty(d[c]) && !(r.tbl === 'lesson_changes' && ['kind', 'd', 'old', 'status', 'by_name'].includes(c)));
  return (r.tbl === 'lesson_changes' ? logChange(r) : '')
    + (ks.length ? `<details class="lg-more"><summary class="muted xs">看${r.op === 'D' ? '删掉的' : ''}内容</summary><div class="lg-kv">${ks.map(c => `<div><span class="muted">${esc(logCol(r.tbl, c))}</span>　${logVal(r.tbl, c, d[c], true)}</div>`).join('')}</div></details>` : '');
}
function logLine(r, withTag = true){
  const what = `<span class="lg-k">${esc(LOG_TBL[r.tbl] || r.tbl)}</span>${r.ctx ? ' ' + esc(r.ctx) : ''}`;
  if (r.tbl === 'people' && r.new && r.new.seen_clear) {
    const o = r.old || {}, was = o.last_seen ? `（原来：最近打开 ${logTime(o.last_seen)}${(o.devices || []).length ? ' · ' + o.devices.map(esc).join('、') : ''}）` : '';
    return `<span class="tag mute">清除</span> 登录记录 · ${r.ctx ? esc(r.ctx) : ''}<span class="muted xs">${was}</span>`;
  }
  return `${withTag ? opTag(r.op) + ' ' : ''}${what}${r.op === 'U' ? logDiff(r) : logBody(r)}`;
}
// 同一次操作：同一类超过 3 条（比如一次排了 8 节课）合成一行
function logGroup(g){
  const r0 = g[0], rs = g.slice().reverse(), by = new Map();
  for (const r of rs) { const k = r.tbl + r.op; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const items = [];
  for (const xs of by.values()) {
    if (xs.length > 3) items.push(`<div class="lg-i">${opTag(xs[0].op)} <span class="lg-k">${esc(LOG_TBL[xs[0].tbl] || xs[0].tbl)}</span> ${xs.length} 条${xs[0].ctx ? `：${esc(xs[0].ctx)} 等` : ''}
      <details class="lg-more"><summary class="muted xs">看是哪些</summary>${xs.map(r => `<div class="lg-sub">${logLine(r, false)}</div>`).join('')}</details></div>`);
    else for (const r of xs) items.push(`<div class="lg-i">${logLine(r)}</div>`);
  }
  const me = r0.who_id && r0.who_id === ME().id, names = [...new Set(g.map(r => r.who))].join(' / ');
  return `<div class="lg-g"><div class="lg-h"><span class="num lg-tm">${logBJ(r0.at).slice(11)}</span><b>${esc(names)}</b>${me ? ' <span class="tag gold">我</span>' : ''}${r0.who === '系统' ? '' : `<span class="muted xs">${esc(LOG_ROLE[r0.role] ?? '')}</span>`}${isOwner() && S.book === 'all' && g.some(r => r.priv) ? '<span class="tag seal">Panda</span>' : ''}</div>${items.join('')}</div>`;
}

function pgLog(){
  // 切了视图，选中的学生已经不在这个视图里：回到「所有学生」重新读
  if (LOGX.sid && !DB.students.some(s => s.id === LOGX.sid)) { LOGX.sid = ''; LOGX.rows = []; LOGX.more = false; LOGX.at = 0; setTimeout(() => logFetch(false)); }
  else if (!LOGX.busy && !LOGX.at) setTimeout(() => logFetch(false));
  const cat = LOG_CATS.find(c => c[0] === LOGX.cat) || LOG_CATS[0];
  // 总管理切到「Project K」：和潘、金看到的一样，Panda 的记录不显示；切到「Panda」：只显示 Panda 的
  const inView = r => !isOwner() || S.book === 'all' || (S.book === 'K' ? !r.priv : r.priv);
  const seen = LOGX.rows.filter(inView);
  const whoKey = r => r.who + (r.who_id && r.who_id === ME().id ? '（我）' : '');
  const whos = [...new Set(seen.map(whoKey))];
  if (LOGX.who && !whos.includes(LOGX.who)) whos.push(LOGX.who);
  const rows = seen.filter(r => (!LOGX.who || whoKey(r) === LOGX.who) && (!cat[2] || cat[2].includes(r.tbl)));
  // 按天、按「同一次操作」分组（rows 是新的在前）
  const days = [];
  for (const r of rows) {
    const d = logBJ(r.at).slice(0, 10);
    let day = days[days.length - 1]; if (!day || day.d !== d) { day = {d, groups: new Map()}; days.push(day); }
    if (!day.groups.has(r.tx)) day.groups.set(r.tx, []); day.groups.get(r.tx).push(r);
  }
  const dayName = d => { const n = dBetween(d, TODAY); return n === 0 ? '今天' : n === 1 ? '昨天' : `${logD(d)} 周${WD[pd(d).getDay()]}`; };
  const stus = DB.students.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')) || a.name.localeCompare(b.name));
  const bar = `<div class="tl-bar lg-bar">
    <label class="lg-f"><span class="muted xs">谁改的</span><select id="lg-who"><option value="">所有人</option>${whos.map(w => `<option value="${esc(w)}" ${w === LOGX.who ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
    <label class="lg-f"><span class="muted xs">学生</span><select id="lg-sid"><option value="">所有学生</option>${stus.map(s => `<option value="${s.id}" ${s.id === LOGX.sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <button class="btn sm" data-act="lg-reload" ${LOGX.busy ? 'disabled' : ''}>刷新</button></div>
    <div class="tl-chips">${LOG_CATS.map(([k, t]) => `<button class="chip ${LOGX.cat === k ? 'on' : ''}" data-act="lg-cat" data-v="${k}" aria-pressed="${LOGX.cat === k}">${t}</button>`).join('')}</div>`;
  const body = LOGX.err ? `<div class="card empty">没读到改动记录：${esc(LOGX.err)}</div>`
    : !LOGX.at || (LOGX.busy && !LOGX.rows.length) ? '<div class="card empty">正在读取…</div>'
    : !rows.length ? `<div class="card empty">${LOGX.more ? `已经读出来的 ${LOGX.rows.length} 条里没有符合的，点下面「再往前看」接着找` : seen.length ? '这样筛没有记录，换个条件看看' : '还没有改动记录'}</div>`
    : days.map(day => `<div class="lg-day">${dayName(day.d)}</div>${[...day.groups.values()].map(logGroup).join('')}`).join('');
  return `<div class="ph"><h2>改动记录</h2></div>
  <div class="note">谁（用哪条链接）在什么时候<b>新增、修改、删除</b>了什么，都会自动记在这里，同一次保存的放在一起。打开页面、切换视图、学生记单词不算改动。从 2026 年 11 月 19 日开始记，保留一年。</div>
  ${bar}${body}
  ${LOGX.more ? `<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="lg-more" ${LOGX.busy ? 'disabled' : ''}>${LOGX.busy ? '正在读取…' : '再往前看'}</button></div>` : ''}`;
}

document.addEventListener('change', e => {
  const id = e.target?.id;
  if (id === 'lg-who') { LOGX.who = e.target.value; render(); }
  if (id === 'lg-sid') { LOGX.sid = e.target.value; LOGX.rows = []; LOGX.more = false; logFetch(false); render(); }
});
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v;
  if (k === 'lg-cat') { LOGX.cat = v; render(); }
  else if (k === 'lg-more') logFetch(true);
  else if (k === 'lg-reload') logFetch(false);
  else if (k === 'peek') {   // 「打开看看」：新开一页（第 61 步）
    const w = window.open(`${location.origin}${location.pathname}?peek=${encodeURIComponent(v)}`, '_blank');   // 只带对方编号（第 63 步）
    if (w) w.opener = null; else toast('浏览器拦住了新窗口，请允许这个网站弹出窗口后再点', true);
  }
  else if (k === 'seen-clear') {
    const p = (DB.people || []).find(x => x.id === v); if (!p) return;
    if (!confirm(`清除「${p.name}」的登录记录（最近打开时间、设备）？\n以后有人再打开这条链接，会重新记。`)) return;
    try { await act('admin_seen_clear', {pid: v, ...(isOwner() && S.book !== 'all' ? {bk: S.book} : {})}, r => r ? `已清除「${p.name}」的登录记录` : '本来就没有登录记录'); LOGX.at = 0; } catch(_) {}
  }
  else if (k === 'seen-clear-all') {
    if (!confirm('把全部链接的登录记录（最近打开时间、设备）都清掉？\n适合自己点开学生、老师的链接看过以后用。以后谁再打开链接，会重新记。' + (ownerUI() ? (S.book === 'mine' ? '\n只清 Panda 这一边的链接。' : '\nProject K 和 Panda 两边的链接都会清掉。') : '') + '\n（你现在用的这条也会清掉，然后马上重新记上）')) return;
    try { await act('admin_seen_clear', isOwner() && S.book !== 'all' ? {bk: S.book} : {}, r => r ? `已清除 ${r} 条链接的登录记录` : '本来就没有登录记录'); LOGX.at = 0; } catch(_) {}
  }
});
