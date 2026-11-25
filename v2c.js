/* ══════════════════════════════════════════════════════════════
   新版面第三批（2026-11-23）：升学与出愿（全体看板 / 按学生 / 原来的列表）、通关点检（三列）、学生的通关
   · 和前两批一样：读数据、保存、弹窗、权限全部沿用原来的，这里只换样子
   · 工资「没核对完不能审核、结算」在 v2b.js（数据库第 68 步也会挡）
   ══════════════════════════════════════════════════════════════ */

/* ═════════════ 升学与出愿 ═════════════ */
// 每所学校现在在哪一步：准备材料 → 已出愿 → 等考试 → 等放榜 → 结果
const V2_STAGES = [['prep', '准备材料'], ['applied', '已出愿'], ['exam', '等考试'], ['wait', '等放榜'], ['done', '结果']];
// Codex 复查第三批第 7 条：只按状态认「已提交 / 已完成」，日期过了但没确认的标出来让教务追问
function v2Stage(t){
  if (t.status === '已完成') return 'done';
  if (t.status !== '已提交') return 'prep';
  if ([t.written_date, t.interview_date].some(d => d && d >= TODAY)) return 'exam';
  if ((t.first_result && t.first_result >= TODAY) || t.result_date) return 'wait';
  return 'applied';
}
function v2StageFlag(t){
  if (t.status === '需调整') return ['需调整', 'seal'];
  if (t.status !== '已提交' && t.status !== '已完成' && t.apply_end && t.apply_end < TODAY) return ['已过出愿截止，确认交了没有', 'seal'];
  if (t.status === '已提交' && t.result_date && t.result_date < TODAY) return ['已放榜，待登记结果', 'warn'];
  return null;
}
function v2Apply(){
  const mode = S.v2ap || 'board';
  const seg = `<div class="seg" role="group" aria-label="看法">${[['board', '全体看板'], ['stu', '按学生'], ['list', '列表（原来的）']].map(([k, t]) => `<button class="${mode === k ? 'on' : ''}" data-act="v2-ap" data-v="${k}">${t}</button>`).join('')}</div>`;
  if (mode === 'list') return v2Head('升学与出愿', '', seg) + v2Legacy(pgApply2().replace(/^\s*<div class="ph"><h2>[^<]*<\/h2><\/div>/, ''));
  const all = (DB.targets || []).filter(t => DB.students.some(s => s.id === t.student_id));
  // 按入学年月分（学生档案里的「目标入学」）
  const yms = [...new Set(all.map(t => stu(t.student_id).target_ym).filter(Boolean))].sort();
  const ym = yms.includes(S.v2apYm) ? S.v2apYm : 'all';
  const inYm = t => ym === 'all' || stu(t.student_id).target_ym === ym;
  const ymChips = yms.length > 1 ? `<div class="v2-chips">${[['all', '全部'], ...yms.map(y => [y, `${tgtLabel(y)}入学`])].map(([k, t]) => `<button type="button" class="v2-chip ${ym === k ? 'on' : ''}" data-act="v2-apym" data-v="${esc(k)}">${esc(t)}</button>`).join('')}</div>` : '';
  if (mode === 'stu'){
    // 第 11 条：还没有目标学校的学生也列出来，能直接加第一所
    const noT = DB.students.filter(s => s.active !== false && !all.some(t => t.student_id === s.id) && (ym === 'all' || s.target_ym === ym));
    if (S.v2chip.ap === 'none' && !noT.length) S.v2chip.ap = 'has';
    const apChip = S.v2chip.ap === 'none' ? 'none' : 'has';
    const sids = apChip === 'none' ? noT.map(s => s.id) : [...new Set(all.filter(inYm).map(t => t.student_id))];
    const items = sids.map(sid => { const ts = all.filter(t => t.student_id === sid), nx = ts.map(t => ({t, e: nextEventOf(t)})).filter(x => x.e).sort((a, b) => a.e.date.localeCompare(b.e.date))[0];
      return {k: sid, name: stu(sid).name, line: ts.length ? `${ts.length} 所${nx ? ` · ${esc(nx.e.label)} ${md(nx.e.date)}` : ''}` : '还没有目标学校', flag: nx ? [nx.e.days === 0 ? '今天' : `${nx.e.days} 天`, nx.e.days <= 7 ? 'bad' : nx.e.days <= 21 ? 'warn' : ''] : null, q: stu(sid).name + ts.map(t => t.school).join(' '), d: nx ? nx.e.date : '9999'}; })
      .sort((a, b) => a.d.localeCompare(b.d) || pyCmp(a.name, b.name));
    const cur = v2Pick('ap', items);
    const detail = cur ? `<div class="v2-card"><div class="v2-ph">${v2Ava(cur.name, true)}<div class="v2-pt"><h2>${esc(cur.name)}</h2><p>${esc(stu(cur.k).direction || stu(cur.k).track || '')}${stu(cur.k).target_ym ? ` · 目标 ${esc(tgtLabel(stu(cur.k).target_ym))}` : ''}</p></div>
      <div class="v2-acts">${isAdmin() ? `<button class="btn pri sm" data-act="tg-new" data-v="${cur.k}">${v2Ic('plus')}加一所学校</button>` : ''}<button class="btn sm" data-act="student" data-v="${cur.k}">学生档案 ›</button></div></div>
      ${v2Legacy(targetsView(cur.k, isAdmin()))}</div>` : '';
    return v2Head('升学与出愿', '', seg) + scopeNote() + ymChips
      + v2Tri({id: 'ap', label: '学生名单', items, sel: cur && cur.k, search: '查学生、学校…', chips: [['has', '有目标学校', new Set(all.filter(inYm).map(t => t.student_id)).size], ['none', '还没有目标', noT.length]], chip: apChip,
        count: apChip === 'none' ? '点学生，加第一所学校' : `${items.length} 个学生 · 日子近的排前面`, empty: apChip === 'none' ? '每个学生都有目标学校了' : '还没有学生加大学目标', detail});
  }
  // 全体看板
  const cols = V2_STAGES.map(([k, t]) => [k, t, all.filter(x => inYm(x) && v2Stage(x) === k).sort((a, b) => ((nextEventOf(a) || {}).date || '9999').localeCompare((nextEventOf(b) || {}).date || '9999'))]);
  const card = t => { const nx = nextEventOf(t), s = stu(t.student_id);
    const fl = v2StageFlag(t);
    return `<button type="button" class="v2-apc ${v2Stage(t) === 'done' ? 'done' : ''} ${fl ? 'flag' : ''}" data-act="v2-ap-open" data-v="${t.student_id}">${fl ? `<span class="tag ${fl[1]}">${fl[0]}</span>` : ''}<span class="v2-apw">${v2Ava(s.name)}<b>${esc(s.name)}</b><span class="tag ${TIER_CLS[t.tier] || 'mute'}">${esc(t.tier)}</span></span>
      <b class="v2-aps">${esc(t.school)}</b>
      <span class="v2-apm">${nx ? `${esc(nx.label)} ${md(nx.date)} · <em class="${nx.days <= 7 ? 'late' : ''}">${nx.days === 0 ? '今天' : nx.days + ' 天后'}</em>` : t.result_date ? `合格发表 ${md(t.result_date)}` : '还没有日期'}</span>
      <span class="v2-apm">${esc(t.status || '')}${t.doc_status ? ` · 资料${esc(t.doc_status)}` : ''}</span></button>`; };
  return v2Head('升学与出愿', fmtMD(TODAY), seg) + scopeNote() + ymChips
    + (all.length ? `<div class="v2-stagebar">${cols.map(([k, t, xs]) => `<button type="button" class="v2-chip ${xs.length ? '' : 'zero'}" data-act="v2-ap-jump" data-v="${k}">${t} <b>${xs.length}</b></button>`).join('')}</div>
      <div class="v2-board">${cols.map(([k, t, xs]) => `<section class="v2-bcol ${xs.length ? '' : 'empty'}" id="v2-st-${k}"><div class="v2-colh"><b>${t}</b><span>${xs.length}</span></div>${xs.length ? xs.map(card).join('') : '<div class="v2-empty">没有</div>'}</section>`).join('')}</div>
      <div class="muted xs">按状态和日期分：状态还不是「已提交」的在「准备材料」（过了出愿截止会标红，问一下交了没有）；已提交、笔试面试还没到的在「等考试」；考完等一次结果 / 合格发表的在「等放榜」（放榜日过了会提醒登记结果）；状态「已完成」的在「结果」。点卡片打开这个学生，在里面改。</div>`
      : '<div class="v2-empty big">还没有大学目标。在「按学生」或学生档案 →「出愿」里添加。</div>');
}

/* ═════════════ 通关点检（教务、老师：三列） ═════════════ */
function v2Checks(students, sub){
  if (!CK){ ckLoad().then(() => render()).catch(e => toast(e.message, true)); return v2Head('通关点检') + '<div class="v2-empty big">正在读取通关点检表…</div>'; }
  const edit = ckCanEdit();
  if (S.v2chip.ck === 'none' && S.v2sel.ck && ckListsOf(S.v2sel.ck).length) S.v2chip.ck = 'has';   // 刚建好表：跟着这个学生回到「有点检表」
  const chip = S.v2chip.ck || 'has';
  const info = s => { const ls = ckListsOf(s.id), st = ckStat({items: ls.flatMap(l => l.items)}), w = ls.reduce((a, l) => a + l.items.reduce((b, i) => b + (i.files || []).length, 0), 0); return {ls, st, w}; };
  const all = students.map(s => ({s, i: info(s)}));
  const list = all.filter(x => chip === 'none' ? !x.i.ls.length : x.i.ls.length).sort((a, b) => pyCmp(a.s.name, b.s.name));
  const items = list.map(({s, i}) => ({k: s.id, name: s.name, line: !i.ls.length ? '还没有建表' : !i.st.n ? '还没有关卡' : `已通关 ${i.st.pass}/${i.st.n}${i.st.cur ? ` · 现在：${esc(i.st.cur.name)}` : ' · 全部通关'}`, flag: i.ls.length ? [`${i.st.pct}%`, i.st.pct >= 100 ? 'ok' : ''] : null, q: s.name}));
  const cur = v2Pick('ck', items);
  let detail = '';
  if (cur){
    const s = stu(cur.k), i = info(s);
    detail = `<div class="v2-card v2-ck"><div class="v2-ph">${v2Ava(s.name, true)}<div class="v2-pt"><h2>${esc(s.name)}</h2><p>${i.ls.length ? `${i.ls.map(l => esc(l.title)).join('、')} · 已通关 ${i.st.pass}/${i.st.n}${i.w ? ` · 作品 ${i.w} 个` : ''}` : '还没有通关点检表'}</p></div>
      <div class="v2-acts">${isAdmin() ? `<button class="btn sm" data-act="student" data-v="${s.id}">学生档案 ›</button>` : `<button class="btn sm" data-act="v2-go-ts" data-v="${s.id}">我的学生 ›</button>`}</div></div>
      ${i.ls.map(l => ckList(l, edit)).join('')}${edit ? ckNewForm(s.id, i.ls.length) : ''}</div>`;
  }
  const nHas = all.filter(x => x.i.ls.length).length;
  return v2Head('通关点检', sub || '') + v2Tri({id: 'ck', label: '学生名单', items, sel: cur && cur.k, search: '查学生…',
    chips: [['has', '有点检表', nHas], ...(edit ? [['none', '还没建表', all.length - nHas]] : [])], chip, count: chip === 'none' ? '点学生，给他建一张表' : `${items.length} 个学生`,
    empty: chip === 'none' ? '每个学生都建好表了' : '还没有学生建通关点检表' + (edit ? '，在「还没建表」里给学生建' : ''), detail});
}
// 学生、家长：整张表，只能看
const v2SCheck = s => v2Head('通关点检', PRO() ? '老师打档后这里会更新' : '每一关的进度；作品可以在关卡后面上传') + v2Legacy(ckView(s.id) || '<div class="v2-empty big">还没有通关点检表</div>', true);

// 老师「我写过的」月份
document.addEventListener('change', e => { const el = e.target.closest?.('[data-change="v2-twm"]'); if (!el) return; S.v2twM = el.value; S.v2idx.tw = 0; render(); });

/* ───────── 第三批的按钮 ───────── */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || V2.ver !== 'new' || !document.body.classList.contains('v2')) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (k === 'v2-ap'){ S.v2ap = v; render(); }
  else if (k === 'v2-apym'){ S.v2apYm = v; render(); }
  else if (k === 'v2-ap-jump'){ document.getElementById('v2-st-' + v)?.scrollIntoView({behavior: 'smooth', block: 'start'}); }
  else if (k === 'v2-go-ts'){ S.tab = 'b'; S.v2sel.ts = v; S.v2q.ts = ''; S.v2chip.ts = 'all'; if (v2Phone()) S.v2open = 'ts'; render(); window.scrollTo(0, 0); }
  else if (k === 'v2-ap-open'){   // 看板上点一张卡片：切到「按学生」，打开这个学生
    S.v2ap = 'stu'; S.v2sel.ap = v; S.v2q.ap = ''; S.v2chip.ap = 'has'; S.v2idx.ap = 0;   // 2026-11-25：名单停在「还没有目标」时，会打开别的学生——切回「有目标学校」
    if (v2Phone()) S.v2open = 'ap'; render(); window.scrollTo(0, 0);
  }
});
