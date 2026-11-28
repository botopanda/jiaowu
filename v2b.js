/* ══════════════════════════════════════════════════════════════
   新版面第二批（2026-11-22）：总览、学生档案分页、上课记录、月度家长反馈、课时与工资（逐节核对）
   · 和第一批一样：读数据、保存、弹窗、权限全部沿用原来的，这里只换样子
   · 学生对每节课的评价只给教务看（数据库第 67 步：老师、家长只拿到「已确认」）
   · 上课记录按日期排（新的在上）；评价一开始不选（Codex 复查第 7 条）
   · 工资：中间是老师名单，右边分「已确认 / 待核对 / 合计」三行，逐节明细加起来对得上合计（Codex 复查第 6 条）
   ══════════════════════════════════════════════════════════════ */

const v2Wd = d => `${md(d)} 周${WD[pd(d).getDay()]}`;
const v2HM = h => { const m = Math.round((+h || 0) * 60); return m % 60 ? (m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分`) : `${m / 60} 小时`; };   // 0.8333 → 50 分（Codex 复查第二批第 3 条）
const v2Due = d => { const n = dBetween(TODAY, d); return n === 0 ? '今天' : n > 0 ? `${n} 天后` : `过了 ${-n} 天`; };

/* ═════════════ 总览 ═════════════ */
function v2Overview2(){
  const tab = S.v2ov || 'decide', all = v2TodoItems(), now = nowBJ();
  const bad = DB.feedbacks.filter(f => f.confirm === '不满意' && L(f.lesson_id) && L(f.lesson_id).date >= addDay(TODAY, -30));
  // 要你决定：一件一件拿主意的（改期 / 请假、老师排课申请、学生说不满意）
  const decide = all.filter(x => x.g === 'req' || x.g === 'ch').map(x => ({tag: x.flag[0], cls: x.flag[1], title: `${esc(x.name)} · ${x.line}`, sub: x.g === 'req' ? '学生申请' : '老师申请，批准后才改到课表', d: x.d, go: `data-act="v2-go-todo" data-v="${esc(x.k)}"`}))
    .sort((a, b) => a.d.localeCompare(b.d));
  const warn = bad.map(f => { const l = L(f.lesson_id), c = course(l.course_id); return {tag: '不满意', cls: 'bad', title: `${esc(stu(c.student_id).name)} 对 ${v2Wd(l.date)} ${esc(c.subject)}「不满意」`, sub: `${esc(tea(c.teacher_id).name)}的课 · 只有教务看得到这个评价（30 天内）`, go: `data-act="student" data-v="${c.student_id}"`, btn: '看学生'}; });
  // 可以集中办理：同一类一次办完的
  const n = g => all.filter(x => x.g === g).length, miss = needFb();
  const mu = (all.find(x => x.k === 'msg') || {}).n || 0, fu = (all.find(x => x.k === 'fu') || {}).n || 0;
  const batch = [n('fb') ? {tag: '审批', cls: 'blue', title: `${n('fb')} 条老师反馈等审批`, sub: '审批后家长才看得到', go: 'data-act="page" data-v="feedback"'} : null,
    miss.length ? {tag: '待确认', cls: 'warn', title: `${miss.length} 节课上完了，老师还没写反馈`, sub: `${pendByT(miss).replace(/<[^>]+>/g, '')} · 暂时不计课时和工资`, go: 'data-act="page" data-v="feedback-missing"'} : null,
    mu ? {tag: '留言', cls: 'blue', title: `${mu} 条学生 / 家长留言还没看`, sub: '', go: 'data-act="page" data-v="msgs"'} : null,
    fu ? {tag: '跟进', cls: 'warn', title: `${fu} 条跟进记录到期`, sub: '', go: 'data-act="page" data-v="followups"'} : null].filter(Boolean);
  const today = DB.lessons.filter(l => l.date === TODAY).sort((a, b) => a.start.localeCompare(b.start));
  const evs = upcomingEvents(14);
  const row = x => `<div class="v2-ovr"><span class="v2-flag ${x.cls || ''}">${esc(x.tag)}</span><div class="tx"><b>${x.title}</b>${x.sub ? `<span>${x.sub}</span>` : ''}</div>${x.d ? `<span class="v2-due ${x.d < TODAY ? 'late' : ''}">${v2Due(x.d)}</span>` : ''}<button type="button" class="btn sm" ${x.go}>${x.btn || '去处理'}</button></div>`;
  const batchN = n('fb') + miss.length + mu + fu;   // 2026-11-26：待确认的课普通教务也能办（和待处理页、旧版总览一致）
  const tabs = [['decide', '要你决定', decide.length], ['batch', '可以集中办理', batchN], ['today', '今天的课', today.length], ['exam', '近期考试 / 放榜', evs.length]];
  let body;
  if (tab === 'batch') body = batch.length ? batch.map(row).join('') : '<div class="v2-empty">没有要集中办理的 👍</div>';
  else if (tab === 'today') body = today.length ? today.map(l => { const c = course(l.course_id), on = l.start <= now && l.end > now, fl = v2Flag(l);
      return `<button type="button" class="v2-ovr click" data-act="lesson" data-v="${l.id}"><b class="num v2-ovt">${l.start}–${l.end}</b><div class="tx"><b>${esc(stu(c.student_id).name)} · ${esc(c.subject)}</b><span>${esc(tea(c.teacher_id).name)}${l.kind ? ' · ' + esc(l.kind) : ''}</span></div>${l.status === 'leave' ? '<span class="tag seal">请假</span>' : l.status === 'cancelled' ? '<span class="tag mute">取消</span>' : on ? '<span class="tag blue">上课中</span>' : isPend(l) ? '<span class="tag warn">待确认</span>' : isDone(l) ? '<span class="tag ok">已上</span>' : ''}${fl ? `<span class="tag warn">${fl}</span>` : ''}</button>`; }).join('') : '<div class="v2-empty">今天没有课</div>';
  else if (tab === 'exam') body = evs.length ? evs.map(e => `<button type="button" class="v2-ovr click" data-act="student-tab" data-v="${e.t.student_id}|target"><span class="v2-flag ${e.days <= 7 ? 'bad' : ''}">${e.days === 0 ? '今天' : e.days + ' 天'}</span><div class="tx"><b>${esc(stu(e.t.student_id).name)} · ${esc(e.t.school)}</b><span>${e.label} · ${v2Wd(e.date)}</span></div></button>`).join('') : '<div class="v2-empty">14 天内没有考试和放榜</div>';
  // 2026-11-28：「可以集中办理」的几行直接摊在「要你决定」下面，不用再点一下页签才看得到（家长留言、待审反馈以前藏在第二个页签后面）
  else body = (decide.length ? decide.map(row).join('') : '<div class="v2-empty">没有要你拿主意的事 👍</div>') + (warn.length ? `<div class="v2-sep">提醒 · 学生说不满意（不算在件数里）</div>${warn.map(row).join('')}` : '')
    + (batch.length ? `<div class="v2-sep v2-ovb">可以集中办理 · ${batchN} 件</div>${batch.map(row).join('')}` : '');
  // 右边：现在、这周、最近的老师反馈
  const nowL = today.find(l => l.status === 'scheduled' && l.start <= now && l.end > now), nextL = v2Next(DB.lessons).find(l => l !== nowL);
  const nowBox = v2Box(`现在 <span class="v2-sub2">${now}</span>`, [nowL ? `<button type="button" class="v2-now on" data-act="lesson" data-v="${nowL.id}"><b>${nowL.start}</b><span><b>${esc(stu(course(nowL.course_id).student_id).name)} · ${esc(course(nowL.course_id).subject)}</b><small>${esc(tea(course(nowL.course_id).teacher_id).name)} · 还有 ${mins(nowL.end) - mins(now)} 分钟下课</small></span></button>` : '',
    nextL ? `<button type="button" class="v2-now" data-act="lesson" data-v="${nextL.id}"><b>${nextL.start}</b><span><b>${v2Day(nextL.date)} · ${esc(stu(course(nextL.course_id).student_id).name)} · ${esc(course(nextL.course_id).subject)}</b><small>${esc(tea(course(nextL.course_id).teacher_id).name)} · 北京时间</small></span></button>` : '<div class="v2-empty">接下来没有课</div>'].join(''));
  const mon = v2WkMon(TODAY), sun = addDay(mon, 6), wk = DB.lessons.filter(l => l.date >= mon && l.date <= sun);
  const nmon = addDay(mon, 7), nsun = addDay(mon, 13);
  const weekBox = v2Box(`这周 <span class="v2-sub2">${v2Range([mon, '', '', '', '', '', sun])}</span>`, `<div class="v2-nums"><div><b>${wk.filter(isDone).length}</b><small>节已上</small></div><div class="${wk.some(l => l.status === 'leave') ? 'warn' : ''}"><b>${wk.filter(l => l.status === 'leave').length}</b><small>次请假</small></div><div><b>${DB.lessons.filter(l => l.date >= nmon && l.date <= nsun && l.status === 'scheduled').length}</b><small>节下周已排</small></div></div>`);
  const fs = DB.feedbacks.filter(f => L(f.lesson_id)).slice().sort((a, b) => L(b.lesson_id).date.localeCompare(L(a.lesson_id).date)).slice(0, 4);
  const fbBox = v2Box('最近的老师反馈', fs.length ? `<div class="v2-lines">${fs.map(f => { const l = L(f.lesson_id), c = course(l.course_id); return `<button type="button" class="v2-line" data-act="student" data-v="${c.student_id}"><b>${md(l.date)}</b><span>${esc(tea(c.teacher_id).name)} → ${esc(stu(c.student_id).name)} · ${esc(String(f.content || '').slice(0, 22))}${String(f.content || '').length > 22 ? '…' : ''}${f.status === 'pending' ? ' <span class="tag warn">待审批</span>' : ''}</span></button>`; }).join('')}</div>` : '<div class="v2-empty">还没有反馈</div>', isTop() ? '<button class="btn sm" data-act="page" data-v="log">改动记录 ›</button>' : '');
  const empty = !DB.students.length && isTop() ? `<div class="note">系统是空的，按这个顺序开始：① <b>老师档案</b>里添加老师 → ② <b>学生档案</b>里添加学生和课程 → ③ <b>课表与排课</b>里排课 → ④ <b>链接与备份</b>里复制每个人的专属链接发给他们。</div>` : '';
  return v2Head('总览', `${fmtMD(TODAY)} ${now}`, ownerUI() && !PEEK ? '<button type="button" class="btn sm" data-act="v2-stats">新版使用情况</button>' : '') + scopeNote() + empty + (typeof ownerClashBlock === 'function' ? ownerClashBlock() : '')
    + `<div class="v2-home"><div class="v2-hmain"><div class="v2-book"><div class="v2-tabs" role="tablist">${tabs.map(([k, t, c]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="v2-ov" data-v="${k}" style="--hc:var(--gold)">${t} <b class="v2-tabn">${c}</b></button>`).join('')}</div>
      <div class="v2-page one">${body}${tab === 'decide' && decide.length ? '<div class="muted xs" style="padding:8px 4px 0">按日子近的排。点「去处理」会打开待处理里的那一件。</div>' : ''}</div></div></div>
      <div class="v2-hside">${nowBox}${weekBox}${fbBox}</div></div>`;
}

/* ═════════════ 上课记录（学生、家长；教务在学生档案里也用） ═════════════ */
function v2RecCards(s, mode){   // mode：'student' / 'parent' / 'admin'
  const subs = [...new Set(DB.courses.filter(c => c.student_id === s.id).map(c => c.subject))];
  const id = 'rec-' + mode + (mode === 'admin' ? '-' + s.id : ''), stu_ = mode === 'student';
  const all = fbOfS(s.id).filter(f => L(f.lesson_id)).slice().sort((a, b) => (L(b.lesson_id).date + L(b.lesson_id).start).localeCompare(L(a.lesson_id).date + L(a.lesson_id).start));
  const un = all.filter(f => !f.confirm);
  const chips = [['all', '全部', all.length], ...(stu_ && un.length ? [['un', '等你确认', un.length]] : []), ...(subs.length > 1 ? subs.map(x => [x, x]) : [])];
  const chip = chips.some(x => x[0] === S.v2chip[id]) ? S.v2chip[id] : 'all';
  const list = all.filter(f => chip === 'all' || (chip === 'un' ? !f.confirm : cOfF(f)?.subject === chip)).slice(0, 60);
  const card = f => { const l = L(f.lesson_id), c = course(l.course_id), open = (S.v2recOpen || '') === f.id;
    const tag = mode === 'parent' ? '' : !f.confirm ? (stu_ ? '<span class="tag blue">等你确认</span>' : '<span class="tag mute">学生没确认</span>')
      : mode === 'admin' ? `<span class="tag ${f.confirm === '不满意' ? 'seal' : 'ok'}">学生：${esc(f.confirm)}</span>` : `<span class="tag ${f.confirm === '不满意' ? 'seal' : 'ok'}">上了 · ${esc(f.confirm)}</span>`;
    const st = mode === 'admin' ? `<span class="tag ${f.status === 'approved' ? 'ok' : 'warn'}">${f.status === 'approved' ? '家长可见' : '待审批'}</span>` : '';
    return `<article class="v2-rec ${!f.confirm && stu_ ? 'hot' : ''}" style="--hc:${hue(c.subject)}"><div class="v2-rech"><b>${v2Wd(l.date)} ${esc(c.subject)}</b><span class="muted xs">${esc(tName(c.teacher_id))}</span><span class="v2-rect">${st}${tag}</span></div>
      <p class="v2-say1">${esc(f.content || '')}</p>
      ${open ? `<div class="fb">${tagRow(f)}<div class="sec"><b>课堂表现</b><p>${esc(f.perf || '—')}</p></div><div class="sec"><b>课后作业</b><p>${esc(f.hw || '—')}</p></div></div>` : ''}
      ${fileList(f.id, 'note', '上课笔记')}${fileList(f.id, 'hwref', '作业图片')}
      <div class="row"><button type="button" class="v2-link" data-act="v2-rec-open" data-v="${open ? '' : f.id}">${open ? '收起' : '看课堂表现和作业 ›'}</button></div>
      ${stu_ && !f.confirm ? `<div class="v2-rate"><span class="muted xs">这节课上得怎么样？（只给教务看）</span><button class="btn sm" data-act="confirm" data-v="${f.id}|满意">满意</button><button class="btn sm" data-act="confirm" data-v="${f.id}|不满意">不满意</button></div>` : ''}</article>`; };
  let last = '', out = '';
  list.forEach(f => { const m = L(f.lesson_id).date.slice(0, 7); if (m !== last){ out += `<div class="v2-recm">${ymLabel(m)}</div>`; last = m; } out += card(f); });
  return `${chips.length > 1 ? `<div class="v2-chips">${chips.map(([k, t, n]) => `<button type="button" class="v2-chip ${chip === k ? 'on' : ''}" data-act="v2-chip" data-v="${id}|${esc(k)}">${esc(t)}${n != null ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>` : ''}
    ${list.length ? `<div class="v2-recs">${out}</div>` : `<div class="v2-empty big">${all.length ? '这一类没有' : mode === 'parent' ? '还没有审核发布的反馈' : '还没有上课记录'}</div>`}`;
}
function v2Records(s){
  const P = PRO();
  return v2Head('上课记录', P ? '每节课后老师写的反馈，教务审核后发布在这里' : '老师的话、上课笔记和作业；每节课上得怎么样只给教务看') + v2RecCards(s, P ? 'parent' : 'student');
}

/* ═════════════ 学生档案右边：分页 ═════════════ */
const V2_STABS = [['home', '总览'], ['cal', '课表'], ['hw', '作业'], ['rec', '上课记录'], ['month', '计划与月报'], ['target', '出愿'], ['data', '档案']];
function v2StuDetail(){
  const s = DB.students.find(x => x.id === S.stuId); if (!s) return '';
  const id = s.id, ym = TODAY.slice(0, 7);
  // 原来的分页名对到新的（从别处点「去写」「看全部」带来的）
  // 2026-11-25：tl 不再强行切回「上课记录」卡片——在「按时间看全部」里点时间段、筛选、写私下备注，都会带着 tl 回来，以前每次都被踢回卡片
  const OLD = {tl: ['rec', ''], fb: ['rec', ''], score: ['data', 'score'], parent: ['data', 'parent'], profile: ['data', ''], mp: ['month', ''], review: ['month', ''], board: ['data', 'parent'], pfview: ['data', 'parent'], info: ['home', '']};
  if (OLD[S.stuTab]){ const [t, sub] = OLD[S.stuTab]; S.stuTab = t; if (sub) S.v2ssub = sub; }
  const tab = V2_STABS.some(x => x[0] === S.stuTab) ? S.stuTab : 'home';
  const ps = personOf('student', 'student_id', id), pp = personOf('parent', 'student_id', id);
  const tg = (DB.targets || []).filter(t => t.student_id === id).slice(0, 2).map(t => t.school);
  const meta = [s.code, s.direction || s.track, s.grad ? '大学院' : '', s.target_ym ? `目标 ${tgtLabel(s.target_ym)}` : '', tg.length ? `志望：${tg.join('、')}` : '', s.loc, s.staff ? `负责教务 ${s.staff}` : ''].filter(Boolean).map(esc).join(' · ');
  const more = [typeof tsBtn === 'function' ? tsBtn(id) : '', isTop() ? `<button class="btn sm" data-act="student-form" data-v="${id}">编辑基本资料</button>` : '',
    typeof mrBtn === 'function' ? mrBtn(id) : '', typeof wkBtn === 'function' ? wkBtn(id) : '', typeof sxBtn === 'function' ? sxBtn(id) : '',
    ps ? `<button class="btn sm" data-act="copy-link" data-v="${ps.key}">复制学生链接</button>` : '', pp ? `<button class="btn sm" data-act="copy-link" data-v="${pp.key}">复制家长链接</button>` : ''].filter(Boolean).join('');
  const head = `<div class="v2-ph">${v2Ava(s.name, true)}<div class="v2-pt"><h2>${esc(s.name)}${isMine(s) && ownerUI() ? ' <span class="tag gold">Panda</span>' : ''}${s.active === false ? ' <span class="tag mute">停课</span>' : ''}</h2><p>${meta || '&nbsp;'}</p></div>
    <div class="v2-acts">${isAdmin() ? `<button class="btn sm" data-act="v2-stu-add" data-v="${id}">${v2Ic('plus')}给他排课</button><button class="btn pri sm" data-act="rv-open" data-v="${id}|${ym}">写${+ym.slice(5)}月家长反馈</button>` : ''}
      ${more ? `<details class="sp-more"><summary class="btn sm">更多 ▾</summary><div class="sp-pop">${more}</div></details>` : ''}</div></div>`;
  const tabs = `<nav class="v2-stabs" aria-label="学生档案">${V2_STABS.map(([k, t]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="stu-tab" data-v="${id}|${k}">${t}</button>`).join('')}</nav>`;
  const seg = (list, cur) => `<div class="seg" role="group">${list.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="v2-ssub" data-v="${k}">${t}</button>`).join('')}</div>`;
  let body;
  if (tab === 'home') body = spHome(s);
  else if (tab === 'cal'){
    const ended = l => l.date < TODAY || (l.date === TODAY && l.end <= nowBJ());
    const up = lsOfS(id).filter(l => !ended(l)).slice(0, 20), past = lsOfS(id).filter(ended).slice(-8).reverse();
    const line = l => { const c = course(l.course_id), fl = v2Flag(l); return `<button type="button" class="v2-line" data-act="lesson" data-v="${l.id}"><b>${v2Day(l.date)} ${l.start}–${l.end}</b><span>${subjTag(c.subject)} · ${esc(tea(c.teacher_id).name)}${l.kind ? ' · ' + esc(l.kind) : ''}${l.status === 'leave' ? ' <span class="tag seal">请假</span>' : l.status === 'cancelled' ? ' <span class="tag mute">取消</span>' : ''}${isPend(l) ? ' <span class="tag warn">待确认</span>' : ''}${fl ? ` <span class="tag warn">${fl}</span>` : ''}${l.moved ? ' <span class="tag mute">调过课</span>' : ''}</span></button>`; };
    body = `<div class="row"><button class="btn sm" data-act="stu-cal" data-v="${id}">在「老师 × 一周」里只看他 ›</button>${isAdmin() ? `<button class="btn sm" data-act="v2-stu-add" data-v="${id}">${v2Ic('plus')}给他排课</button>` : ''}</div>
      <div class="v2-grid">${v2Box(`接下来的课 <span class="v2-sub2">${up.length} 节</span>`, up.length ? `<div class="v2-lines">${up.map(line).join('')}</div>` : '<div class="v2-empty">还没有排接下来的课</div>')}
      ${v2Box('最近的课 <span class="v2-sub2">含请假、取消</span>', past.length ? `<div class="v2-lines">${past.map(line).join('')}</div>` : '<div class="v2-empty">还没有上过课</div>')}</div>`;
  }
  else if (tab === 'hw') body = v2HwCols(s, true);
  else if (tab === 'rec'){ const sub = S.v2ssub === 'tl' ? 'tl' : 'rec';
    body = `${seg([['rec', '只看上课记录'], ['tl', '按时间看全部（含跟进、备注）']], sub)}${sub === 'tl' ? stuTabBody(id, 'tl') : v2RecCards(s, 'admin')}`; }
  else if (tab === 'month') body = `<h3 class="sp-h">月计划</h3>${stuTabBody(id, 'mp')}<h3 class="sp-h">月度家长反馈</h3>${stuTabBody(id, 'review')}`;
  else if (tab === 'target') body = stuTabBody(id, 'target');
  else { const sub = ['score', 'parent'].includes(S.v2ssub) ? S.v2ssub : 'data';
    body = `${seg([['data', '资料'], ['score', '成绩'], ['parent', '家长看到的']], sub)}${sub === 'score' ? stuTabBody(id, 'score') : sub === 'parent' ? `<div class="seg" role="group"><button class="${(S.parView || 'pf') === 'pf' ? 'on' : ''}" data-act="sp-par" data-v="pf">家长看到的档案</button><button class="${S.parView === 'board' ? 'on' : ''}" data-act="sp-par" data-v="board">跟进看板</button></div>${stuTabBody(id, S.parView === 'board' ? 'board' : 'pfview')}` : spData(s)}`; }
  return `${head}${tabs}<div class="sp-body">${body}</div>`;
}
// 作业三组（学生自己能交；家长、教务只能看）
function v2HwCols(s, ro){
  const who = PRO() ? '孩子' : ME().role === 'student' ? '我' : '学生';
  const G = v2HwGroups(s), wait = G.wait, done = G.done;
  const item = f => { const l = L(f.lesson_id), c = course(l.course_id);
    return `<div class="v2-hw" style="--hc:${hue(c.subject)}"><div class="v2-hwm">${subjTag(c.subject)}<span class="muted xs">${esc(tName(c.teacher_id))} · ${md(l.date)} 布置</span></div>
      <div class="v2-hwt">${esc(f.hw)}</div>${fileList(f.id, 'hwref', '老师给的作业图片')}
      ${!ro && !f.hw_sub ? `<div class="row">${uploadBtn('hw', f.id, '上传作业照片 / PDF')}<button class="btn pri sm" data-act="hw-done" data-v="${f.id}">我完成了</button></div>` : ''}
      ${!ro && f.hw_sub && !f.hw_fb ? `<div class="row">${uploadBtn('hw', f.id, '再传几张')}<button class="btn sm" style="margin-left:auto" data-act="hw-undo" data-v="${f.id}" title="点错了「我完成了」？老师批改前可以撤回">还没做完，撤回</button></div>` : ''}
      ${fileList(f.id, 'hw', `${who}交的作业`)}${fileList(f.id, 'grade', '老师的批改')}
      ${f.hw_note ? `<div class="muted xs">${who}说：${esc(f.hw_note)}</div>` : ''}${f.hw_fb ? `<div class="note"><b>老师批改：</b>${esc(f.hw_fb)}</div>` : ''}</div>`; };
  const col = (t, cls, xs, empty, extra = '', n = xs.length) => `<section class="v2-col"><div class="v2-colh ${cls}"><b>${t}</b><span>${n}</span></div>${xs.length ? xs.map(item).join('') : extra ? '' : `<div class="v2-empty">${empty}</div>`}${extra}</section>`;
  const late = G.late.length ? `<div class="v2-sep">以前没交的 · ${G.late.length} 份${ro ? '' : '，可以补交'}</div>${G.late.map(item).join('')}` : '';
  return `<div class="v2-cols">${col('要交', 'warn', G.now, '这次的都交了 👍', late, G.now.length + G.late.length)}${col('等批改', 'blue', wait, '没有等批改的')}${col('批改好了', 'ok', done, '还没有批改好的')}</div>`;
}

/* ═════════════ 月度家长反馈 ═════════════ */
function v2Reviews(){
  const ym = S.rvMonth || (S.rvMonth = TODAY.slice(0, 7)), chip = S.v2chip.rv || 'all';
  const months = [1, 0, -1, -2, -3, -4, -5].map(n => ymShift(TODAY.slice(0, 7), n));
  const all = DB.students.filter(s => s.active !== false).map(s => ({s, r: reviewOf(s.id, ym), st: monthStats(s.id, ym)}));
  const done = x => x.r?.status === '已完成';
  const list = all.filter(x => chip === 'all' || (chip === 'done' ? done(x) : !done(x))).sort((a, b) => done(a) - done(b) || pyCmp(a.s.name, b.s.name));
  const FL = {'已完成': 'ok', '需调整': 'bad', '待跟进': 'warn'};
  // 2026-11-28：名单一行放不下，后半句「老师评价未写」以前被截掉看不见——写短
  const items = list.map(({s, r, st}) => ({k: s.id, name: s.name, line: `${st.actual} 节 · 自评${r?.self_eval ? '✓' : '未写'} · 师评${r?.teacher_eval ? '✓' : '未写'}`, flag: [r?.status || '未开始', FL[r?.status] || 'mute'], q: s.name + ' ' + (s.code || '')}));
  const cur = v2Pick('rv', items);
  let detail = '';
  if (cur){
    const s = stu(cur.k), r = reviewOf(s.id, ym), st = monthStats(s.id, ym);
    const pv = rvHas(r) ? reviewCard({...r, ym, student_id: s.id}) : '<div class="v2-empty">还没有内容，点右上角「写」开始</div>';
    detail = `<div class="v2-card"><div class="v2-ph">${v2Ava(s.name, true)}<div class="v2-pt"><h2>${esc(s.name)}</h2><p>${ymLabel(ym)}的家长反馈 · <span class="tag ${FL[r?.status] === 'ok' ? 'ok' : FL[r?.status] === 'bad' ? 'seal' : FL[r?.status] === 'warn' ? 'warn' : 'mute'}">${esc(r?.status || '未开始')}</span></p></div>
      <div class="v2-acts"><button class="btn pri sm" data-act="rv-open" data-v="${s.id}|${ym}">${r ? '修改' : '写'}${+ym.slice(5)}月反馈</button>${typeof mrBtn === 'function' ? mrBtn(s.id) : ''}<button class="btn sm" data-act="student" data-v="${s.id}">学生档案 ›</button></div></div>
      <div class="v2-grid">
        ${v2Box(`${ymLabel(ym)}`, st.req ? `<div class="v2-nums"><div><b>${st.actual}/${st.req}</b><small>出勤</small></div><div class="${st.leave ? 'warn' : ''}"><b>${st.leave}</b><small>请假</small></div><div><b>${st.fbN ? st.hwOk + '%' : '—'}</b><small>作业完成</small></div></div>` : '<div class="v2-empty">这个月还没有上完的课</div>')}
        ${v2Box('学生自评', r?.self_eval ? `<div class="small">${esc(r.self_eval)}</div>` : '<div class="v2-empty">学生还没写（每月 20 号以后提醒学生写）</div>')}
      </div>
      ${v2Box(`家长看到的样子 <span class="v2-sub2">${r?.status === '已完成' ? '已经发给家长' : '状态改成「已完成」后家长才看得到'}</span>`, pv, '', 'v2-prev')}
      ${r?.note ? v2Box('补充说明 <span class="v2-sub2">只有教务看得到</span>', `<div class="small">${esc(r.note)}</div>`) : ''}</div>`;
  }
  const n = f => all.filter(f).length;
  return v2Head('月度家长反馈', '', `<select data-change="rv-month" aria-label="月份">${months.map(m => `<option value="${m}" ${m === ym ? 'selected' : ''}>${ymLabel(m)}</option>`).join('')}</select>`) + scopeNote()
    + v2Tri({id: 'rv', label: '学生名单', items, sel: cur && cur.k, search: '查学生…', chips: [['all', '全部', all.length], ['todo', '还没完成', n(x => !done(x))], ['done', '已完成', n(done)]], chip,
      count: `${ymLabel(ym)} · 没完成的排前面`, empty: '这一类没有学生', detail});
}

/* ═════════════ 课时与工资：逐节核对 ═════════════ */
function v2Payroll(){
  const ym = S.payMonth;
  const months = [...new Set(DB.lessons.map(l => l.date.slice(0, 7)).concat([TODAY.slice(0, 7), ymShift(TODAY.slice(0, 7), -1)], (DB.pay || []).map(p => p.ym)))].sort().reverse();
  const info = t => { const ms = payLs(t.id, ym);   // 2026-11-28：另一本账已经结算过的课不算（extras.js）
    const ok = ms.filter(l => paidH(l) > 0), pend = ms.filter(isPend), later = ms.filter(l => l.status === 'scheduled' && !isDone(l) && !isPend(l));
    const money_ = ls => ls.map(l => { const c = course(l.course_id); return [(l.status === 'scheduled' && !isDone(l) ? dur(l) : paidH(l)) * (c.rate || 0), curOf(c)]; });
    const hOk = +ok.reduce((a, l) => a + paidH(l), 0).toFixed(2), hPend = +pend.reduce((a, l) => a + dur(l), 0).toFixed(2);
    const rawOk = ok.reduce((a, l) => a + paidH(l), 0), rawPend = pend.reduce((a, l) => a + dur(l), 0);   // 2026-11-25：合计用没取整的课时加（3 节 50 分钟＝2 小时 30 分，不是 2 小时 29 分）
    return {ok, pend, later, hOk, hPend, rawOk, rawPend, partsOk: money_(ok), amtOk: sumMoney(money_(ok)), amtPend: sumMoney(money_(pend)), amtAll: sumMoney(money_([...ok, ...pend])), snap: (DB.pay || []).some(p => p.teacher_id === t.id && p.ym === ym && p.snap)}; };
  const all = DB.teachers.filter(t => !t.staff).map(t => ({t, i: info(t)})).filter(x => x.i.ok.length || x.i.pend.length || x.i.snap);
  // 2026-11-26：「全部」视图里这位老师牵涉到哪几本账、办完没有，用 extras.js 里共用的 payBooksAll / payDone（旧版、页头的小标签也用它，三处一个算法）
  const booksAll = t => payBooksAll(t.id, ym);
  const done = (t, i, f) => payDone(t.id, ym, f);
  const PS = (t, i) => { if (isOwner() && S.book === 'all'){ const st = booksAll(t).map(b => payOfBook(t.id, ym, b)); if (!st.length) return null;   // 「全部」：两本账都结算了才算已结算
      return st.every(p => p.settled_at) ? ['已结算', 'ok'] : st.every(p => p.reviewed_at) ? ['已审核', 'blue'] : st.some(p => p.settled_at || p.reviewed_at) ? ['部分审核', 'blue'] : null; }
    const p = payOf(t.id, ym); return p.settled_at ? ['已结算', 'ok'] : p.reviewed_at ? ['已审核', 'blue'] : null; };
  // 2026-11-28：金额放最前面（以前排在最后，被右边的小标签挤成「1,4…」）
  const items = all.sort((a, b) => b.i.pend.length - a.i.pend.length || pyCmp(a.t.name, b.t.name)).map(({t, i}) => ({k: t.id, name: t.name, line: `<b class="v2-amt">${i.amtOk}</b> · ${i.ok.length} 节 ${hTxt(i.hOk)}h`, flag: i.pend.length ? [`待核对 ${i.pend.length}`, 'warn'] : PS(t, i) || ['未审核', 'mute'], q: t.name}));
  const cur = v2Pick('pay', items);
  let detail = '';
  if (cur){
    const t = tea(cur.k), i = info(t);
    const rows = [...i.ok, ...i.pend].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const st = l => isPend(l) ? '<span class="tag warn">待核对</span>' : l.status === 'leave' ? '<span class="tag seal">当天请假</span>' : l.done_manual && !hasFb(l) ? '<span class="tag mute">教务确认</span>' : '<span class="tag ok">已确认</span>';
    const why = l => isPend(l) ? (hasFb(l) ? '' : '老师还没写反馈') : '';
    const hrs = l => isPend(l) ? dur(l) : paidH(l);
    detail = `<div class="v2-card"><div class="v2-ph">${v2Ava(t.name, true)}<div class="v2-pt"><h2>${esc(t.name)}</h2><p>${ymLabel(ym)} · ${payBadge(t.id, ym)} ${payDiffTag(t.id, ym)}</p></div>
      <div class="v2-acts"><button class="btn sm" data-act="copy-pay" data-v="${t.id}">复制课时清单（发给老师核对）</button></div></div>
      <div class="v2-pay3">
        <div><small>已确认（计入工资）</small><b>${v2HM(i.hOk)}</b><span>${i.ok.length} 节 · ${i.amtOk}</span></div>
        <div class="${i.pend.length ? 'warn' : ''}"><small>待核对（还没计入）</small><b>${v2HM(i.hPend)}</b><span>${i.pend.length} 节${i.pend.length ? ` · ${i.amtPend} · 确认后才算` : ''}</span></div>
        <div><small>合计（待核对都确认以后）</small><b>${v2HM(i.rawOk + i.rawPend)}</b><span>${i.amtAll}</span></div></div>
      ${i.pend.length ? `<div class="note warn">还有 ${i.pend.length} 节没确认：${i.pend.map(l => `${md(l.date)} ${esc(stu(course(l.course_id).student_id).name)}（${hasFb(l) ? '待确认' : '老师还没写反馈'}）`).join('、')}。确认后才算进工资。上过的可以在下面每一行点「已上课」，或者 <button class="btn sm" data-act="v2-pay-done" data-v="${t.id}|${ym}">把这 ${i.pend.length} 节都标为已上课</button>（只动 ${esc(t.name)} ${+ym.slice(5)} 月这几节）</div>` : ''}
      ${payDiffBox(t.id, ym)}
      <div class="tw"><table class="rt v2-paytbl"><thead><tr><th>日期</th><th>时间</th><th>学生</th><th>科目</th><th>时长</th><th>状态</th><th>单价</th><th>金额</th></tr></thead><tbody>
      ${rows.map(l => { const c = course(l.course_id); return `<tr class="click ${isPend(l) ? 'pend' : ''}" data-act="lesson" data-v="${l.id}" title="点开这节课：看反馈、改时长"><td class="num">${v2Wd(l.date)}</td><td class="num">${l.start}–${l.end}</td><td>${esc(stu(c.student_id).name)}</td><td>${subjTag(c.subject)}</td><td class="num">${v2HM(hrs(l))}${hrsTag(l)}</td><td>${st(l)}${why(l) ? `<div class="muted xs">${why(l)}</div>` : ''}${isPend(l) ? ` <button class="btn sm" data-act="lstate" data-v="${l.id}|done|q">已上课</button>` : ''}</td><td class="num">${rateTxt(c)}</td><td class="num">${isPend(l) ? `<span class="muted">${money(hrs(l) * (c.rate || 0), curOf(c))}</span>` : money(hrs(l) * (c.rate || 0), curOf(c))}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="4"><b>已确认合计</b></td><td class="num"><b>${v2HM(i.hOk)}</b></td><td></td><td></td><td class="num"><b>${i.amtOk}</b></td></tr></tfoot></table></div>
      <div class="muted xs">点表里任意一行可以打开那节课，当场看反馈、改时长。${i.later.length ? `另：${md(i.later[0].date)} 起已排 ${i.later.length} 节，上完后计入。` : ''}</div>
      <div class="row" style="justify-content:flex-end">${v2PayBtns(t.id, ym, i.pend.length)}</div></div>`;
  }
  const tot = all.reduce((a, x) => a + x.i.rawOk, 0);
  // 2026-11-26：页头加回旧版的三个数——全体工资合计、已审核几人、已结算几人（只算名单里列出来的老师，也就是当前账本看得到的）
  const pendN = all.reduce((a, x) => a + x.i.pend.length, 0);
  const sums = all.length ? `<div class="v2-nums v2-paysum"><div><small>工资合计（已确认的课）</small><b>${sumMoney(all.flatMap(x => x.i.partsOk))}</b></div>
    <div><small>已审核</small><b>${all.filter(x => done(x.t, x.i, 'reviewed_at')).length} / ${all.length} 位</b></div>
    <div><small>已结算</small><b>${all.filter(x => done(x.t, x.i, 'settled_at')).length} / ${all.length} 位</b></div></div>${pendN ? `<div class="muted xs v2-paysum-n">另有 ${pendN} 节待核对，还没算进合计。</div>` : ''}` : '';
  return v2Head('课时与工资', `${ymLabel(ym)} · 已确认 ${v2HM(tot)}`, `<select data-change="paym" aria-label="月份">${months.map(v => `<option value="${v}" ${v === ym ? 'selected' : ''}>${ymLabel(v)}</option>`).join('')}</select>`)
    + sums + `<div class="v2-strip soft"><span>只有教务 · 管理看得到。老师写了反馈（或教务标为已上课）的课才计入，按实际时长算；当天请假扣学生课时的，照样计入老师工资。每位老师每月：核对课时 → 审核通过 → 结算完成。</span></div>`
    + v2Tri({id: 'pay', label: '老师名单', items, sel: cur && cur.k, search: '查老师…', count: `${items.length} 位老师 · 有待核对的排前面`, empty: '这个月还没有上完的课', detail});
}

// 还有待核对的课：不能审核、不能结算（撤销照样可以）
function v2PayBtns(tid, ym, np){
  if (!np || (isOwner() && S.book === 'all')) return payButtons(tid, ym);
  const p = payOf(tid, ym);
  if (p.settled_at) return payButtons(tid, ym);
  return `<span class="muted xs">还有 ${np} 节待核对，核对完才能${p.reviewed_at ? '结算' : '审核'}</span>${p.reviewed_at ? `<button class="btn sm" data-act="pay" data-v="${tid}|${ym}|reviewed|0">撤销审核</button>` : ''}`;
}

/* ───────── 第二批的按钮 ───────── */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || V2.ver !== 'new' || !document.body.classList.contains('v2')) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (k === 'v2-ov'){ S.v2ov = v; render(); }
  else if (k === 'v2-go-todo'){   // 总览「去处理」：打开待处理里的那一件
    const g = v[0] === 'q' ? 'req' : v[0] === 'c' ? 'ch' : 'all';
    if (!v2TodoItems().some(x => x.k === v)) toast('这一件刚刚已经处理掉了', true);
    S.page = 'todo'; S.v2chip.todo = g; S.v2sel.todo = v; S.v2idx.todo = 0; S.v2q.todo = ''; if (v2Phone()) S.v2open = 'todo';
    render(); window.scrollTo(0, 0);
  }
  else if (k === 'v2-rec-open'){ S.v2recOpen = v; render(); }
  else if (k === 'v2-ssub'){ S.v2ssub = v; render(); }
  else if (k === 'v2-stu-add'){ S.alPre = {d: TODAY, s: '18:00', e: '20:00', sid: v}; addLessonModal(); }
  else if (k === 'v2-pay-done'){   // 只把这位老师这个月待核对的标成已上课
    const [tid, ym] = v.split('|'), ls = payLs(tid, ym).filter(isPend); if (!ls.length) return;   // 2026-11-28：和工资页上列的同一批课（另一本账结算过的不算）
    if (!confirm(`把 ${tea(tid).name} ${ymLabel(ym)} 待核对的 ${ls.length} 节课标为已上课？\n按排课时长计入学生课时和老师工资。\n\n${ls.map(l => `${md(l.date)} ${l.start} ${stu(course(l.course_id).student_id).name} ${course(l.course_id).subject}`).join('\n')}`)) return;
    act('admin_mark_done_many', {ids: ls.map(l => l.id)}, r => Number.isFinite(+r) && +r !== ls.length ? `已标为已上课 ${+r} 节；另外 ${ls.length - r} 节刚才已经被处理过了` : `已标为已上课（${ls.length} 节）`).catch(() => {});
  }
  else if (k === 'v2-self'){ S.tab = 'e'; render(); setTimeout(() => document.getElementById('m-month')?.scrollIntoView({block: 'start'}), 50); }
});
