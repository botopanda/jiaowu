/* ══════════════════════════════════════════════════════════════
   院校库（出愿数据库）：专业 ＋ 各轮入试
   · 字段清单在 school_fields.js（由 教务系统/院校库字段清单.py 生成），这里按清单自动排版
   · 教务都能看、改、导入 Excel（模板：院校库导入模板.xlsx）
   · 学生「大学与出愿」可以从这里一键带入
   读 Excel 不用外部插件：.xlsx 本身是个压缩包，用浏览器自带的解压读里面的表格
   ══════════════════════════════════════════════════════════════ */
let PROG = null;                       // 院校库数据，用到时才读
const PF = {q:'', field:'', level:'', year:'', school_type:'', track:'', visa:''};
const P_CORE = SF_P.filter(f => f.core).map(f => f.k), R_CORE = SF_R.filter(f => f.core).map(f => f.k);
const R_DATES = SF_R.filter(f => f.t === 'date').map(f => f.k);
const P_GROUPS = [...new Set(SF_P.map(f => f.g))];
// 专业 / 轮次的某一项（固定栏直接读，其他从 info 里读）
const pv = (p, k) => P_CORE.includes(k) ? (p[k] ?? '') : ((p.info || {})[k] ?? '');
// 院校库的网址只认 http / https 开头的（导入的表里如果混进别的协议，就不显示按钮；体检 C-13）
const webUrl = (p, k) => { const u = String(pv(p, k) || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };
const rv = (r, k) => R_CORE.includes(k) ? (r[k] ?? '') : ((r.info || {})[k] ?? '');

/* 没有留学签证能不能考（2026-11-25）：每一轮一个答案。另外按合格发表日自动算：没签证的学生考上后办 COE＋签证（通常 2〜3 个月）来不来得及 */
const VISA_TAG = {'能，不用来日本': ['没签证也能考 · 不用来日本', 'vz-ok'], '能，要来日本考': ['没签证也能考 · 要来日本考', 'vz-come'],
  '不能，报名时要有留学签证': ['报名时要有留学签证', 'vz-no'], '只收海外考生': ['只收海外考生', 'vz-abroad'],
  '只收海外考生，要来日本考': ['只收海外考生 · 要来日本考', 'vz-abroad']};   // 2026-11-25：只收住在海外的人，但考试要到日本现场考（Codex 第三次复查第 4 条）
const VISA_SIT = [['', '学生情况：全部'], ['has', '有留学签证（在日本）'], ['come', '没签证、能来日本考'], ['remote', '没签证、不来日本']];
// 入学时期（2026-11-25 全面检查）：同一个专业可能既有 4 月入学、又有 9 月入学的轮次，这一轮自己写了「本轮入学时期」就用它，没写用专业的
const roundIntake = (p, r) => (r && rv(r, 'r_intake')) || pv(p, 'intake') || '';
const progIntakes = p => [...new Set((p.rounds || []).map(r => roundIntake(p, r)).concat((p.rounds || []).length ? [] : [pv(p, 'intake')]).filter(Boolean))].sort((a, b) => intakeNo(a) - intakeNo(b));
function intakeNo(it){ const m = /^\s*(\d{1,2})\s*月\s*$/.exec(it); return m && +m[1] >= 1 && +m[1] <= 12 ? +m[1] : 99; }   // 月份从小到大，「其他」和认不出来的排最后
function progEntry(p, r){   // 入学日：年度＋入学时期，没写按 4 月；写「其他」的不知道是哪天，返回空
  const it = roundIntake(p, r);
  const m = /^\s*(\d{1,2})\s*月\s*$/.exec(it);   // 整格只写了一个月份才算（「4月或9月」这种不算）   // 写了几月就按几月算（表里也可能写「7月」）；写了别的认不出来的，不算时间；空着按 4 月
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${p.year}-${String(+m[1]).padStart(2, '0')}-01`;
  return it ? '' : `${p.year}-04-01`;
}
function visaLate(p, r){   // 0 来得及 / 1 时间紧（合格发表到入学不到 3 个月）/ 2 很可能来不及（不到 2 个月）
  const v = rv(r, 'r_visa'), ent = progEntry(p, r); if (!r.result_date || !v || v.startsWith('不能') || !ent) return 0;
  const d = dBetween(r.result_date, ent);
  return d < 60 ? 2 : d < 90 ? 1 : 0;
}
function visaOk(r, sit){   // 这一轮，这种情况的学生能不能考（没填的：有签证的算能考，没签证的不算）
  const v = rv(r, 'r_visa');
  if (!sit) return true;
  if (sit === 'has') return !v.startsWith('只收海外考生');
  return (sit === 'come' ? ['能，不用来日本', '能，要来日本考', '只收海外考生', '只收海外考生，要来日本考'] : ['能，不用来日本', '只收海外考生']).includes(v);
}
const visaHit = (p, sit) => !sit || (p.rounds || []).some(r => visaOk(r, sit));
function visaTags(p, r){
  const t = VISA_TAG[rv(r, 'r_visa')], late = visaLate(p, r);
  return (t ? `<span class="tag vz ${t[1]}">${t[0]}</span>` : '')
    + (late ? `<span class="tag ${late > 1 ? 'vz-late' : 'warn'}" title="没有留学签证的学生考上以后要办 COE 和签证，通常要 2〜3 个月">${late > 1 ? '没签证的话：办签证很可能来不及' : '没签证的话：办签证时间紧'}</span>` : '');
}
const visaSel = () => `<select id="pf-visa" aria-label="学生情况">${VISA_SIT.map(([v, l]) => `<option value="${v}" ${v === (PF.visa || '') ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

async function progLoad(force){
  if (PROG && !force) return PROG;
  PROG = await rpc('programs_load') || [];
  return PROG;
}
const dS = d => !d ? '' : d.slice(0,4)===TODAY.slice(0,4) ? `${+d.slice(5,7)}/${+d.slice(8,10)}` : `${d.slice(2,4)}/${+d.slice(5,7)}/${+d.slice(8,10)}`;
const progName = p => [p.faculty, p.dept].filter(Boolean).join(' ');
// 这一轮过了没有：有出愿截止日看截止日；截止日没填的，看后面的日子（材料必着 / 考试 / 合格发表）过了没有——只知道「出愿已经开始」不能算截止（2026-11-25）
const roundOver = r => r.apply_end ? r.apply_end < TODAY : [r.docs_due, r.written_date, r.interview_date, r.result_date].some(d => d && d < TODAY);
// 下一轮：先看正在出愿的（截止最近的那一轮），没有就看最快开始出愿的；表里的轮次不一定按日期排，所以按日期挑，不按先后挑（2026-11-25）
function nextRound(p){
  const rs = p.rounds || []; if (!rs.length) return '';
  const live = rs.filter(r => !roundOver(r));
  if (!live.length) return '<span class="tag mute">本年度各轮已截止</span>';
  const by = f => (a, b) => f(a).localeCompare(f(b));
  const open = live.filter(r => r.apply_start && r.apply_start <= TODAY).sort(by(r => r.apply_end || '9999'))[0];
  if (open) return open.apply_end ? `<span class="tag seal">${esc(open.name||'')} 出愿中 · ${dS(open.apply_end)} 截止（还有 ${dBetween(TODAY, open.apply_end)} 天）</span>`
    : `<span class="tag seal">${esc(open.name||'')} 出愿中 · 截止日没填</span>`;
  const r = live.filter(r => r.apply_start || r.apply_end).sort(by(r => r.apply_start || r.apply_end))[0] || live[0];
  if (r.apply_start) return `<span class="tag warn">${esc(r.name||'')} · ${dS(r.apply_start)} 开始出愿</span>`;
  if (r.apply_end) return `<span class="tag warn">${esc(r.name||'')} · ${dS(r.apply_end)} 截止</span>`;
  return `<span class="tag mute">${esc(r.name||'')}</span>`;
}
const staleTag = p => { const v = pv(p, 'verified_on'); return v && dBetween(v, TODAY) > 180 ? '<span class="tag warn">超过半年没核验</span>' : ''; };

/* ───────── 页面 ───────── */
function pgSchools(){
  PF.track = ''; PF.sort = '';   // 旧版没有「文理艺」按钮和排序：从新版切回来时，不能还留着看不见、清不掉的筛选（2026-11-25）
  const head =`<div class="ph"><h2>院校库</h2><span class="row"><a class="btn sm" href="院校库导入模板.xlsx" download>下载 Excel 模板</a>
    <label class="btn sm" for="prog-file">导入 Excel</label><input type="file" id="prog-file" accept=".xlsx,.csv" data-change="prog-import" hidden>
    <button class="btn pri" data-act="prog-new">＋ 添加专业</button></span></div>
  <div class="hint">一个专业一张卡片，点开看全部资料和各轮入试日期。学生的「大学与出愿」可以直接从这里带入。导入时，同年度、同学校、同学部学科的会更新，其他的新增。</div>`;
  if (!PROG){
    progLoad().then(() => { if (S.page==='schools') render(); }).catch(e => toast(e.message, true));
    return head + '<div class="card empty">正在读取院校库…</div>';
  }
  const sel = (k, label) => `<select id="pf-${k}" aria-label="${label}"><option value="">${label}：全部</option>${pfOpts(k).map(x => `<option ${x===PF[k]?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
  return head + `<div class="row"><input type="search" id="pf-q" placeholder="搜学校、学部、学科、关键词；中文、日文、英文都行，例：早稻田 / waseda" value="${esc(PF.q)}" style="flex:1;min-width:200px">
    ${sel('year','年度')}${sel('level','类别')}${sel('field','方向')}${sel('school_type','学校类型')}${visaSel()}</div>
  <div id="pg-list">${progList()}</div>`;
}
// 搜索用的内容（简繁日汉字统一、带上学校的中文名 / 英文名 / 简称），算一次记住
const progHay = p => p._hay || (p._hay = fz([p.school, p.faculty, p.dept, p.field, p.region, ...Object.entries(p.info || {}).filter(([k]) => k !== 'school_ord').map(([, v]) => v)].join(' ')) + ' ' + fzAliases(p.school + p.faculty));
/* 排列（2026-11-23）：学校按拼音（有中文校名用中文校名）；同一所学校里：类别（学部→大学院…）→ 校内分类 → 校内顺序 → 学部、学科名 → 年度新到旧。
   校内分类之间的先后：这一组里最小的「校内顺序」，用整个院校库算（筛选掉几个专业，组的位置也不变）；都没填顺序就按拼音，没分类的排最后。 */
const PROG_LV = ['学部', '大学院', '研究生', '专门学校'];
const progOrd = p => { const n = parseFloat(String(pv(p, 'school_ord')).replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))); return isFinite(n) ? n : Infinity; };
function progIdx(){   // 学校的排序名、各组的位置：整个院校库算一次，PROG 换了就重算
  if (PROG._idx) return PROG._idx;
  const cn = {}, gr = {};
  PROG.forEach(p => { if (!cn[p.school] && pv(p, 'school_cn')) cn[p.school] = pv(p, 'school_cn');
    const g = [p.school, p.level, pv(p, 'school_group')].join('|'); gr[g] = Math.min(gr[g] ?? Infinity, progOrd(p)); });
  return (PROG._idx = {cn, gr});
}
const progSchoolKey = p => progIdx().cn[p.school] || p.school;
function progCmpIn(a, b){
  const lv = p => { const i = PROG_LV.indexOf(p.level); return i < 0 ? 9 : i; }, ga = pv(a, 'school_group'), gb = pv(b, 'school_group');
  const gr = p => progIdx().gr[[p.school, p.level, pv(p, 'school_group')].join('|')];
  return (lv(a) - lv(b)) || (ga === gb ? 0 : !ga ? 1 : !gb ? -1 : (gr(a) - gr(b)) || pyCmp(ga, gb))
    || ((progOrd(a) - progOrd(b)) || 0) || pyCmp(a.faculty || '', b.faculty || '') || pyCmp(a.dept || '', b.dept || '') || (b.year - a.year);
}
const progCmpAll = (a, b) => pyCmp(progSchoolKey(a), progSchoolKey(b)) || (a.school < b.school ? -1 : a.school > b.school ? 1 : 0) || progCmpIn(a, b);
// 筛选用的值：「方向」可能写了两个（「机械、工学」），拆开算，选「工学」也能筛出来
const pfVals = (p, k) => k === 'field' ? String(pv(p, k)).split(/[、,，\/／]/).map(s => s.trim()).filter(Boolean) : [String(pv(p, k))];
const pfOpts = k => [...new Set(PROG.flatMap(p => pfVals(p, k)).filter(Boolean))].sort(k === 'field' ? pyCmp : undefined);
// 艺术（2026-11-25）：「文理艺」按考试方式分；学的是艺术类内容的（「方向」里写了设计、美术、音乐……），考试按文科 / 理科考，点「艺术」也查得出来
const ART_FIELD = /艺术|美术|设计|动画|漫画|游戏|影像|电影|写真|摄影|音乐|表演|戏剧|舞蹈|服装|时装|工艺|插画|书法|声优|造形/;
const artByField = p => pv(p, 'track') !== '艺术' && ART_FIELD.test(String(p.field || ''));
const trkHit = (p, t) => !t || pv(p, 'track') === t || (pv(p, 'track') === '文理皆可' && (t === '文科' || t === '理科')) || (t === '艺术' && artByField(p));   // 文理艺：选文科、理科时「文理皆可」两边都算
function progFiltered(){
  return PROG.filter(p => ['year','level','field','school_type'].every(k => !PF[k] || pfVals(p, k).includes(PF[k])) && trkHit(p, PF.track) && visaHit(p, PF.visa) && fzHit(PF.q, progHay(p)));
}
function progList(){
  if (typeof v2ProgList === 'function' && document.body.classList.contains('v2')) return v2ProgList();   // 新版：按学校分块、可切换排序（v2d.js）
  if (!PROG.length) return `<div class="card empty">院校库还是空的。点右上角「下载 Excel 模板」，填好后「导入 Excel」；也可以「添加专业」一个个录。</div>`;
  const list = progFiltered();
  if (!list.length) return '<div class="card empty">没有符合条件的专业</div>';
  return `<div class="muted xs" style="margin:2px 0 6px">共 ${list.length} 个专业</div>` + list.map(progCard).join('');
}
const SHOWN_IN_HEAD = ['year','level','track','field','school','school_cn','school_en','region','school_group','faculty','dept','school_ord','school_type','intake','campus','url','url2'];
/* 2026-11-25 全面检查：院校库到了 3,900 个专业、7,300 轮以后，每张卡片连里面的表格一起画，整页有 38 万个格子、13MB，每敲一个字要卡 1 秒多。
   改成：卡片先只画标题那一行，点开的时候才画里面（各轮日期、全部资料、编辑 / 删除按钮）。卡片上记着专业编号 data-pid。 */
function progCard(p, o = {}){   // o.inSchool：放在新版「学校块」里，校名、国公私、地区在块头上，卡片不再重复
  const used = (DB.targets||[]).filter(t => t.program_id===p.id).length, its = progIntakes(p);
  const itTag = its.length > 1 ? ' · ' + esc(its.join(' / ')) + '入学' : its[0] && its[0] !== '4月' ? ' · ' + esc(its[0]) + '入学' : '';
  return `<details class="card pg-card" data-pid="${p.id}"><summary><div class="row">${o.inSchool ? `<b class="pg-prog">${esc(progName(p) || '（没填学部学科）')}</b>` : `<b class="pg-school" title="${esc([pv(p,'school_cn'), pv(p,'school_en')].filter(Boolean).join(' / '))}">${esc(p.school)}</b>${pv(p,'school_group')?`<span class="muted">${esc(pv(p,'school_group'))}</span>`:''}<span>${esc(progName(p))}</span>`}
      <span class="tag mute">${p.year}${itTag}</span><span class="tag blue">${esc(p.level)}</span>${pv(p,'track')?`<span class="tag trk trk-${{'文科':'w','理科':'l','艺术':'y','文理皆可':'wl'}[pv(p,'track')]||'x'}">${esc(pv(p,'track'))}</span>`:''}${artByField(p)?`<span class="tag trk trk-y" title="考试按${esc(pv(p,'track')||'文科 / 理科')}考，学的是艺术类内容（设计、美术、音乐等）">艺术</span>`:''}${p.field?`<span class="tag gold">${esc(p.field)}</span>`:''}
      ${!o.inSchool && pv(p,'school_type')?`<span class="tag mute">${esc(pv(p,'school_type'))}</span>`:''}${!o.inSchool && p.region?`<span class="tag mute">${esc(p.region)}</span>`:''}
      ${used?`<span class="tag ok">${used} 位学生在报</span>`:''}${staleTag(p)}<span style="margin-left:auto">${nextRound(p)}</span></div></summary></details>`;
}
function progBody(p){
  const rs = p.rounds || [], rExtra = SF_R.filter(f => !f.core), mixIt = progIntakes(p).length > 1;
  const groups = P_GROUPS.map(g => {
    const items = SF_P.filter(f => f.g === g && !SHOWN_IN_HEAD.includes(f.k) && pv(p, f.k));
    return items.length ? `<div class="pg-grp"><div class="pg-gt">${g}</div><dl class="kv small">${items.map(f => `<dt>${f.l}</dt><dd style="white-space:pre-wrap">${esc(String(pv(p, f.k)))}</dd>`).join('')}</dl></div>` : '';
  }).join('');
  return `<div class="pg-body" style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
      ${rs.length ? `<div class="tw"><table class="rt"><thead><tr><th>入试</th><th>出愿</th><th>材料必着</th><th>一次发表</th><th>笔试</th><th>面试</th><th>合格发表</th><th>手续截止</th><th>考试内容</th></tr></thead><tbody>
        ${rs.map(r => { const no = PF.visa && !visaOk(r, PF.visa), vt = visaTags(p, r), unk = no && !rv(r, 'r_visa');
          return `<tr class="${(r.apply_end||'9999') < TODAY ? 'muted' : ''}${no ? ' rt-no' : ''}"${no ? ` title="${unk ? '这一轮学校没写清没有留学签证能不能考，要问学校' : '按上面选的学生情况，这一轮考不了'}"` : ''}><td><b>${esc(r.name||'')}</b>${mixIt && roundIntake(p, r) ? ` <span class="tag mute">${esc(roundIntake(p, r))}入学</span>` : ''}${rv(r,'r_mode')?`<div class="xs">${esc(rv(r,'r_mode'))}${rv(r,'r_place')?' · '+esc(rv(r,'r_place')):''}</div>`:''}${vt ? `<div class="vz-row">${vt}</div>` : ''}</td>
          <td class="num">${dS(r.apply_start)}${r.apply_start||r.apply_end?'–':''}${dS(r.apply_end)}</td><td class="num">${dS(r.docs_due)}</td><td class="num">${dS(r.first_result)}</td><td class="num">${dS(r.written_date)}</td><td class="num">${dS(r.interview_date)}</td><td class="num">${dS(r.result_date)}</td><td class="num">${dS(r.procedure_due)}</td>
          <td class="xs">${esc(rv(r,'content'))}${rExtra.filter(f => !['r_mode','r_place','content','r_visa','r_intake'].includes(f.k) && rv(r, f.k)).map(f => `<div class="muted">${esc(rv(r, f.k))}</div>`).join('')}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="muted small">还没有填入试日期</div>'}
      ${pv(p,'campus')?`<div class="small"><span class="muted">校区：</span>${esc(pv(p,'campus'))}</div>`:''}
      <div class="pg-grps">${groups}</div>
      <div class="row">${webUrl(p,'url')?`<a class="btn sm" href="${esc(webUrl(p,'url'))}" target="_blank" rel="noopener">官方入试页面</a>`:''}${webUrl(p,'url2')?`<a class="btn sm" href="${esc(webUrl(p,'url2'))}" target="_blank" rel="noopener">募集要项 PDF</a>`:''}
        <span class="muted xs">${p.updated_by?`${esc(p.updated_by)} ${String(p.updated_at||'').slice(0,10)} 更新`:''}</span>
        <span style="margin-left:auto" class="row"><button class="btn sm" data-act="prog-edit" data-v="${p.id}">编辑</button><button class="btn sm danger" data-act="prog-del" data-v="${p.id}">删除</button></span></div>
    </div>`;
}
// 点开卡片时才画里面：点标题那一下先画好（键盘回车也是点），程序直接把卡片打开的（toggle）也补上
function progFill(el){
  if (!el || el.querySelector(':scope > .pg-body')) return;
  const p = (PROG || []).find(x => x.id === el.dataset.pid); if (!p) return;
  el.insertAdjacentHTML('beforeend', progBody(p)); if (typeof labelTables === 'function') labelTables();
}
document.addEventListener('click', e => { const s = e.target.closest?.('.pg-card > summary'); if (s && !s.parentElement.open) progFill(s.parentElement); }, true);
document.addEventListener('toggle', e => { if (e.target.matches?.('.pg-card') && e.target.open) progFill(e.target); }, true);

/* ───────── 添加 / 编辑 ───────── */
function sfInput(f, val, cls){
  const id = cls ? '' : `id="pg-${f.k}"`, c = cls ? `class="${cls}-${f.k}"` : '';
  const ph = f.h ? `placeholder="${esc(f.h)}"` : '';
  if (f.t === 'select') return `<label class="field"><span>${f.l}</span><select ${id} ${c}><option value="">—</option>${f.o.map(o => `<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}${val && !f.o.includes(val) ? `<option selected>${esc(val)}</option>` : ''}</select></label>`;
  if (f.t === 'date') return `<label class="field"><span>${f.l}</span><input type="date" ${id} ${c} value="${esc(val||'')}"></label>`;
  if (f.t === 'area') return `<label class="field"><span>${f.l}</span><textarea ${id} ${c} style="min-height:48px" ${ph}>${esc(val||'')}</textarea></label>`;
  if (f.k === 'school_group') return `<label class="field"><span>${f.l}</span><input type="text" ${id} ${c} value="${esc(val??'')}" ${ph} list="dl-sgrp"><datalist id="dl-sgrp">${[...new Set((PROG || []).map(p => pv(p, 'school_group')).filter(Boolean))].sort(pyCmp).map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>`;
  return `<label class="field"><span>${f.l}</span><input type="text" ${id} ${c} value="${esc(val??'')}" ${f.k === 'school_ord' ? 'inputmode="decimal"' : ''} ${ph}></label>`;
}
function progForm(p){
  p = p || {year: (+TODAY.slice(0,4) + (TODAY.slice(5,7) >= '04' ? 1 : 0)), level:'学部', info:{}, rounds:[{}]};
  const block = g => { const fs = SF_P.filter(f => f.g === g); return `<b class="small">${g}</b><div class="fields pg-fields">${fs.map(f => sfInput(f, pv(p, f.k))).join('')}</div>`; };
  openModal(`${mHead(p.id ? '编辑专业' : '添加专业')}
  ${block('基本信息')}
  <b class="small">入试轮次 <span class="muted xs" style="font-weight:400">每一期各一块，日期没公布可以先空着</span></b>
  <div id="pg-rounds" style="display:flex;flex-direction:column;gap:8px">${(p.rounds||[]).map((r,i) => `<div class="card small pg-round" data-i="${i}" data-id="${r.id||''}">
    <div class="row"><input type="text" class="pr-name" value="${esc(r.name||'')}" placeholder="入试名称，例：留学生選抜 I期" style="flex:1"><button class="btn sm danger" data-act="pr-del" data-v="${i}">删掉这一轮</button></div>
    <div class="fields pg-fields">${SF_R.filter(f => f.k !== 'name').map(f => sfInput(f, rv(r, f.k), 'pr')).join('')}</div></div>`).join('')}</div>
  <div><button class="btn sm" data-act="pr-add">＋ 加一轮</button></div>
  ${P_GROUPS.filter(g => g !== '基本信息').map(block).join('')}
  <div class="row"><button class="btn pri" data-act="prog-save" data-v="${p.id||''}" data-ver="${esc(p.updated_at||'')}">保存</button></div>`, 'xl');
}
function progCollect(){
  const d = {info:{}};
  SF_P.forEach(f => { const el = document.getElementById('pg-'+f.k); if (!el) return; const v = el.value.trim(); if (f.core) d[f.k] = v; else if (v) d.info[f.k] = v; });
  d.rounds = [...document.querySelectorAll('.pg-round')].map(el => {
    const r = {info:{}};
    SF_R.forEach(f => { const x = el.querySelector('.pr-'+f.k); if (!x) return; const v = x.value.trim(); if (f.core) r[f.k] = v; else if (v) r.info[f.k] = v; });
    if (el.dataset.id) r.id = el.dataset.id;
    return r;
  });
  return d;
}

/* ───────── 学生「大学与出愿」：从院校库选 ───────── */
let TG_DRAFT = null;
async function progPicker(sid, tid){
  TG_DRAFT = {sid, tid, d: tgCollect()};
  try { await progLoad(); } catch(e) { toast(e.message, true); return; }
  openModal(`${mHead('从院校库选')}
  <input type="search" id="pk-q" placeholder="搜学校、学部、学科（中文、日文、英文都行）">
  <div class="muted xs">点某一轮，就把这一轮的日期和要求带进出愿目标；带进去以后还可以改。</div>
  <div id="pk-list" style="display:flex;flex-direction:column;gap:6px">${PROG.length ? PROG.slice().sort(progCmpAll).map(p => `<div class="card small pk-item" data-s="${esc(progHay(p))}">
    <div class="row"><b>${esc(p.school)}</b><span>${esc(progName(p))}</span><span class="tag mute">${p.year}</span>${p.field?`<span class="tag gold">${esc(p.field)}</span>`:''}</div>
    <div class="row" style="margin-top:4px">${(p.rounds||[]).length ? p.rounds.map(r => `<button class="btn sm" data-act="pk-pick" data-v="${p.id}|${r.id}">${esc(r.name||'（未命名）')}${r.apply_end?` · ${dS(r.apply_end)} 截止`:''}</button>`).join('') : `<button class="btn sm" data-act="pk-pick" data-v="${p.id}|">带入（还没有轮次）</button>`}</div></div>`).join('') : '<div class="empty">院校库还是空的，先到左侧「院校库」导入</div>'}</div>
  <div class="row"><button class="btn sm" data-act="pk-back">返回</button></div>`, true);
}
function tgCollect(){
  const g = id => document.getElementById(id)?.value ?? '';
  const d = {tier:g('tg-tier'), seq:g('tg-seq'), school:g('tg-school'), exam_way:g('tg-way'), requirement:g('tg-req'), score_req:g('tg-score'), status:g('tg-status'), doc_status:g('tg-doc'), next_step:g('tg-next'), program_id:g('tg-pid'), round_id:g('tg-rid')};
  DATE_KEYS.forEach(([k]) => d[k] = g('tg-'+k));
  const xi = tgExamInfo(); if (xi) d.exam_info = xi;   // 考试时间、备注（去院校库选完回来还在）
  d.updated_at = g('tg-ver');   // 打开窗口时这所学校的「最后改动时间」（第 46 步：保存时对不上就不保存）
  return d;
}

/* ───────── Excel / CSV 读取 ───────── */
let XLSX_1904 = false;   // 这份 Excel 用的是不是「1904 日期系统」（老的 Mac 版 Excel）：是的话日期数字要多加 1462 天
async function readXlsx(buf){
  XLSX_1904 = false;
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('这个文件打不开，请确认是 Excel（.xlsx）文件');
  const ents = {}; let p = dv.getUint32(eocd + 16, true);
  for (let i = 0, n = dv.getUint16(eocd + 10, true); i < n; i++){
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    ents[dec.decode(u8.subarray(p + 46, p + 46 + nlen))] = {method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true)};
    p += 46 + nlen + elen + clen;
  }
  const read = async name => {
    const e = ents[name]; if (!e) return null;
    const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true), data = u8.subarray(start, start + e.size);
    if (e.method === 0) return dec.decode(data);
    if (typeof DecompressionStream === 'undefined') throw new Error('这个浏览器太旧，读不了 Excel，请换新版 Chrome / Edge / Safari');
    return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const tags = (n, name) => n.getElementsByTagNameNS('*', name);   // 2026-11-23：<row> 和 <x:row> 都认
  // 共享文字（跳过日文注音 rPh）
  const shared = [];
  const ss = await read('xl/sharedStrings.xml');
  if (ss) for (const si of tags(xml(ss), 'si')) {
    let t = '';
    for (const ch of si.childNodes) { if (ch.localName === 't') t += ch.textContent; else if (ch.localName === 'r') for (const x of ch.childNodes) if (x.localName === 't') t += x.textContent; }
    shared.push(t);
  }
  // 找工作表：优先叫「出愿数据库」「院校库」的，否则第一张
  const wb = xml(await read('xl/workbook.xml')), rels = xml(await read('xl/_rels/workbook.xml.rels') || '<x/>');
  XLSX_1904 = /^(1|true)$/i.test(tags(wb, 'workbookPr')[0]?.getAttribute('date1904') || '');
  const sheets = [...tags(wb, 'sheet')];
  const pick =sheets.find(s => /出愿数据库|院校库/.test(s.getAttribute('name'))) || sheets[0];
  let target = 'xl/worksheets/sheet1.xml';
  if (pick) { const rid = pick.getAttribute('r:id') || pick.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'); const rel = [...tags(rels, 'Relationship')].find(r => r.getAttribute('Id') === rid);
    if (rel) { const t = rel.getAttribute('Target'); target = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); } }
  const sh = await read(target); if (!sh) throw new Error('Excel 里找不到工作表');
  const colIdx = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const row of tags(xml(sh), 'row')) {
    const arr = [];
    for (const c of tags(row, 'c')) {
      const t = c.getAttribute('t'), v = tags(c, 'v')[0]?.textContent ?? '';
      let val = v;
      if (t === 's') val = shared[+v] ?? '';
      else if (t === 'inlineStr') val = [...tags(c, 't')].map(x => x.textContent).join('');
      else if (t === 'n' || !t) val = v === '' ? '' : {num: v};
      arr[colIdx(c.getAttribute('r') || 'A1')] = val;
    }
    rows.push(arr);
  }
  return rows;
}
function readCsv(text){
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i+1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
// 表头 → 字段（去掉空格、星号、括号里的说明，再对名字）
const normH = h => String(h ?? '').replace(/[\s＊*]/g, '').replace(/[（(][^）)]*[）)]/g, '').replace(/[・·/／]/g, '');
const H_ALIAS = {'学校名称':'p.school','大学':'p.school','志愿校名称':'p.school','学部':'p.faculty','研究科':'p.faculty','学科':'p.dept','专业':'p.dept','专攻':'p.dept',
  '年度':'p.year','轮次':'r.name','入试':'r.name','考试日':'r.written_date','考试时间':'r.written_date','官方链接':'p.url','官方来源':'p.url','核验':'p.verified','作品集材料要求':'p.portfolio'};
function headerMap(row){
  const m = {}, all = [...SF_P.map(f => ['p.'+f.k, f.l]), ...SF_R.map(f => ['r.'+f.k, f.l])];
  row.forEach((h, i) => {
    const n = normH(typeof h === 'object' ? h?.num : h); if (!n) return;
    let hit = all.find(([, l]) => normH(l) === n)?.[0] || H_ALIAS[n];
    if (hit && !Object.values(m).includes(hit)) m[i] = hit;
  });
  return m;
}
// 日期：Excel 日期数字、2026/10/23、2026-10-23、2026年10月23日
function toDate(v){
  if (v == null || v === '') return {d: ''};
  if (typeof v === 'object') { const n = +v.num + (XLSX_1904 ? 1462 : 0); if (n > 20000 && n < 80000) return {d: new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000).toISOString().slice(0,10)}; v = v.num; }
  const m = String(v).match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (m) {   // 2026-11-25：日历上没有的日子（2027-02-30）不当日期，免得数据库整批退回
    const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3] && +m[1] >= 1990 && +m[1] <= 2100) return {d: t.toISOString().slice(0,10)};
  }
  return {d: '', bad: String(v).trim()};
}
function rowsToPrograms(rows){
  const hi = rows.findIndex(r => r && r.some(c => typeof c === 'string' && /^\s*[＊*]?\s*(学校|学校名称|大学|志愿校名称)\s*[＊*]?\s*$/.test(c)));
  if (hi < 0) throw new Error('表里找不到「学校」这一列的表头，请用系统给的模板');
  const map = headerMap(rows[hi]), warn = [], groups = new Map();
  const txt = v => v == null ? '' : typeof v === 'object' ? String(v.num) : String(v).trim();
  // 2026-11-25：没认出来的表头说一声（表头被改过的话，那一列不会导入；「学科」没认出来还会把几个专业并成一个）。「居住地限制」是以前的栏，已经不用了，不提
  const unk = [...rows[hi]].map((h, i) => [txt(h), i]).filter(([h, i]) => h && !(i in map) && normH(h) && normH(h) !== '居住地限制').map(([h]) => `「${h.replace(/\s+/g, '')}」`);
  if (unk.length) warn.push(`这 ${unk.length} 列的表头系统没认出来，这几列不会导入：${unk.slice(0, 8).join('')}${unk.length > 8 ? '……' : ''}。表头请用模板里原来的写法`);
  let nEx = 0; const exOld = new Set(), exLines = [];
  // 旧模板的示例：先把备注是「示例行…」的那一行是哪个专业找出来（表被重新排过序，示例的第二行跑到前面也认得出）
  const colOf = key => { const i = Object.keys(map).find(i => map[i] === key); return i == null ? -1 : +i; }, cNote = colOf('p.note');
  if (cNote >= 0) rows.slice(hi + 1).forEach(r => { if (r && /^示例行/.test(txt(r[cNote]))) exOld.add(['p.year', 'p.school', 'p.faculty', 'p.dept'].map(k => colOf(k) < 0 ? '' : txt(r[colOf(k)])).join('|')); });
  const def = key => { const [kind, k] = key.split('.'); return (kind === 'p' ? SF_P : SF_R).find(f => f.k === k); };
  rows.slice(hi + 1).forEach((r, ri) => {
    if (!r || !r.some(c => txt(c))) return;
    const line = hi + ri + 2, p = {info:{}}, rd = {info:{}}; let hasRound = false;
    Object.entries(map).forEach(([i, key]) => {
      const [kind, k] = key.split('.'), f = def(key), v = r[i];
      let val;
      if (f.t === 'date') {
        const x = toDate(v); val = x.d;
        if (x.bad) {   // 写不成日期的，放进备注，不丢
          const box = kind === 'r' ? rd.info : p.info, nk = kind === 'r' ? 'r_note' : 'note';
          box[nk] = [box[nk], `${f.l}：${x.bad}`].filter(Boolean).join('；');
          warn.push(`第 ${line} 行「${f.l}」写的是「${x.bad}」，不是日期，已经放进${kind === 'r' ? '「本轮备注」' : '「备注」'}`);
          if (kind === 'r') hasRound = true;
        }
      }
      else val = txt(v);
      if (f.t === 'select' && val && !f.o.includes(val) && !f.core) warn.push(`第 ${line} 行「${f.l}」写的是「${val}」，不在选项里（照样导入了）`);
      const put = (o, info) => { if (f.core) o[k] = val; else if (val) info[k] = info[k] ? `${val}；${info[k]}` : val; };   // 备注里已有挪进来的日期说明，就接在后面
      if (kind === 'r') { if (val) hasRound = true; put(rd, rd.info); } else put(p, p.info);
    });
    if (!p.school) { warn.push(`第 ${line} 行没有填学校，跳过了`); return; }
    if (/^\s*[（(【\[]?\s*示例/.test(p.school)) { nEx++; exLines.push(line); return; }   // 模板自带的示例行：不导入
    // 旧模板的两行示例（校名前面没有「（示例）」）：第一行备注是「示例行…」，第二行是同一个专业的「留学生選抜 II期 2027-02-01 开始」。
    //   只跳过这两行本身；同一个专业后面真的补了别的轮次，照样导入（Codex 复查第 10 条）
    const exKey = [p.year, p.school, p.faculty || '', p.dept || ''].join('|');
    if (/^示例行/.test(p.info.note || '')) { exOld.add(exKey); exLines.push(line); nEx++; return; }
    if (exOld.has(exKey) && rd.name === '留学生選抜 II期' && rd.apply_start === '2027-02-01') { exLines.push(line); nEx++; return; }
    const rowIt = p.info.intake || ''; if (hasRound) rd._it = rowIt;   // 这一行写的入学时期，先记着，后面看同一个专业里是不是有两种
    p.year =String(p.year || '').replace(/[^\d]/g, '').slice(0,4) || String(+TODAY.slice(0,4) + 1);
    if (p.level && !['学部','大学院','研究生','专门学校'].includes(p.level)) { warn.push(`第 ${line} 行「类别」写的是「${p.level}」，已按「学部」处理`); p.level = '学部'; }
    const key = [p.year, p.school, p.faculty||'', p.dept||''].join('|');
    if (!groups.has(key)) groups.set(key, {...p, info: {...p.info}, rounds: []});
    const g = groups.get(key);
    P_CORE.forEach(k => { if (p[k] && !g[k]) g[k] = p[k]; });
    Object.entries(p.info).forEach(([k, v]) => { if (v && !g.info[k]) g.info[k] = v; });   // 同一专业的多行：前面空着的用后面的补
    if (hasRound) g.rounds.push(rd);
  });
  let list = [...groups.values()];
  if (nEx) warn.push(`模板自带的示例没有导入（只是给你看怎么填的）${exLines.length ? '：第 ' + exLines.join('、') + ' 行' : ''}`);
  list.forEach(g => {
    // 同一个专业里既有 4 月入学又有 9 月入学的轮次：把每一行写的入学时期记到那一轮上（「本轮入学时期」）
    const its = new Set(g.rounds.map(r => r.info.r_intake || r._it).filter(Boolean));
    g.rounds.forEach(r => { if (its.size > 1 && !r.info.r_intake && r._it) r.info.r_intake = r._it; delete r._it; });
    const ns = g.rounds.map(r => (r.name || '') + '\u0001' + (r.info.r_intake || '')), dup = [...new Set(ns.filter((n, i) => ns.indexOf(n) !== i).map(n => n.split('\u0001')[0]))];   // 名称一样、入学时期不一样的不算重名
    if (dup.length) warn.push(`${g.school} ${[g.faculty, g.dept].filter(Boolean).join(' ')}：有重名的轮次（${dup.map(n => n || '没写名称').slice(0, 3).join('、')}），系统按表里的先后一个个对上；最好在名称里写清区别`);
  });
  return {list, warn};
}
let IMPORT_PENDING = null;
async function progImportFile(file){
  try {
    const isCsv = /\.csv$/i.test(file.name); if (isCsv) XLSX_1904 = false;
    const rows = isCsv ? readCsv(await file.text()) : await readXlsx(await file.arrayBuffer());
    const {list, warn} = rowsToPrograms(rows);
    if (!list.length) { toast(warn.length ? '表里没有可以导入的内容（' + warn[0] + '）' : '表里没有可以导入的内容', true); return; }
    // 2026-11-25：导入前把院校库重新读一遍（页面开了很久的话，手里的可能是旧的）。读不出来就不导入——
    //   不然已有的专业会被算成「新增」，而且「空着就保留」的校内分类、校内顺序、文理艺会被清掉
    try { await progLoad(true); } catch(e) { toast('院校库现在读不出来，先不导入（怕把已有的专业当成新的）。请稍后再试一次', true, 6000); return; }
    const old = new Map((PROG||[]).map(p => [[p.year, p.school, p.faculty, p.dept].join('|'), p]));
    list.forEach(p => {
      const o = old.get([p.year, p.school, p.faculty||'', p.dept||''].join('|'));
      if (p.info.school_ord && !isFinite(progOrd(p))) { warn.push(`${p.school} ${progName(p)}：「校内顺序」写的是「${p.info.school_ord}」，不是数字，没有导入这一项${o && pv(o, 'school_ord') ? '（保留原来的）' : ''}`); delete p.info.school_ord; }
      // 校内分类、校内顺序、文理艺空着的：不在这里拿网页手里的旧值去填了，原样空着交上去，由数据库在写入那一刻保留当时的值（第 69 步；Codex 复查第 5 条）
    });
    const exist = new Set(old.keys());
    const nUpd = list.filter(p => exist.has([p.year, p.school, p.faculty||'', p.dept||''].join('|'))).length;
    IMPORT_PENDING = list;
    openModal(`${mHead('导入院校库')}
    <div class="stats"><div class="stat"><small>专业</small><b>${list.length}</b></div><div class="stat"><small>入试轮次</small><b>${list.reduce((a,p)=>a+p.rounds.length,0)}</b></div>
      <div class="stat"><small>新增</small><b>${list.length - nUpd}</b></div><div class="stat"><small>更新已有</small><b>${nUpd}</b></div></div>
    ${nUpd ? '<div class="note">「更新已有」的专业：资料换成表里的，<b>入试轮次按名字对上（比如「Ⅰ期」）原地更新</b>，学生目标里选好的轮次不会断；表里没有的轮次会删掉。</div>' : ''}
    ${warn.length ? `<div class="note warn"><b>有 ${warn.length} 处要留意：</b><br>${warn.slice(0,12).map(esc).join('<br>')}${warn.length>12?`<br>……还有 ${warn.length-12} 处`:''}</div>` : ''}
    <div class="list">${list.slice(0,30).map(p => `<div class="li small"><div class="grow"><b>${esc(p.school)}</b> ${esc(progName(p))} <span class="muted">${p.year} · ${esc(p.level||'学部')}${p.field?' · '+esc(p.field):''}</span><br><span class="muted xs">${p.rounds.map(r => esc(r.name||'（未命名）') + (r.apply_end?` ${dS(r.apply_end)} 截止`:'')).join('、') || '没有轮次'}</span></div></div>`).join('')}${list.length>30?`<div class="muted xs">……共 ${list.length} 个</div>`:''}</div>
    <div class="row"><button class="btn pri" data-act="prog-import-go">确认导入</button><button class="btn" data-act="close">算了</button></div>`, true);
  } catch(e) { toast(e.message, true); }
}

/* ───────── 事件 ───────── */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const v = a.dataset.v, k = a.dataset.act;
  try {
    if (k === 'prog-new') progForm();
    if (k === 'prog-edit') progForm(JSON.parse(JSON.stringify(PROG.find(p => p.id === v))));
    if (k === 'pr-add' || k === 'pr-del') {
      const sv = a.closest('.modal').querySelector('[data-act="prog-save"]'), d = progCollect(); d.id = sv.dataset.v || undefined; d.updated_at = sv.dataset.ver || '';
      if (k === 'pr-add') d.rounds.push({info:{}}); else d.rounds.splice(+v, 1);
      progForm(d);
    }
    if (k === 'prog-save') {
      const d = progCollect(); if (!d.school) { toast('请填写学校', true); return; }
      if (d.info.school_ord && !isFinite(progOrd(d))) { toast('「校内顺序」请填数字，例如 10、20、30', true); return; }
      d.rounds = d.rounds.filter(r => r.name || R_DATES.some(x => r[x]) || Object.keys(r.info).length);
      // 2026-11-25：「添加专业」填的年度、学校、学部、学科和库里已有的一模一样——以前会悄悄盖掉原来那个专业、删掉它的轮次
      const yr = String(d.year || '').replace(/[^\d]/g, '') || '2027';
      if (!v && (PROG || []).some(x => String(x.year) === yr && x.school === d.school && (x.faculty || '') === (d.faculty || '') && (x.dept || '') === (d.dept || ''))) {
        toast('这个专业院校库里已经有了（年度、学校、学部、学科都一样）。请关掉这个窗口，在列表里找到它点「编辑」', true, 7000); return; }
      if (v) { d.id = v; if (a.dataset.ver) d.ver = a.dataset.ver; }   // 打开窗口时这个专业的「最后改动时间」：之后被别人改过、重新导入过，数据库就不让这份旧的盖上去（第 69 步）
      await act('program_save', {d}, '已保存'); await progLoad(true); closeModal(); render();
    }
    if (k === 'prog-del') {
      const p = PROG.find(x => x.id === v);
      if (!confirm(`删除「${p.school} ${progName(p)}」？学生出愿目标里已经带入的内容不会受影响。`)) return;
      await act('program_delete', {xid: v}, '已删除'); await progLoad(true); render();
    }
    if (k === 'prog-import-go') {
      const list = IMPORT_PENDING; if (!list) return;
      document.body.classList.add('busy'); let n = 0, u = 0, i = 0;
      try { for (; i < list.length; i += 40) { const r = await rpc('programs_import', {rows: list.slice(i, i + 40)}); n += r.new; u += r.updated; } }
      catch(err) {
        // 2026-11-25：一批 40 个，前面几批已经写进去了——说清楚做到哪了；重新导入不会重复（已有的会变成「更新」）
        const bad = list.slice(i, i + 40);
        toast(`导入到第 ${i + 1}〜${Math.min(i + 40, list.length)} 个专业（${bad[0].school}${bad.length > 1 ? ' 等' : ''}）时出错了：${err.message}。前面 ${i} 个已经导入（新增 ${n}、更新 ${u}），这一批和后面的还没有。改好以后把整份再导一次就行，不会重复`, true, 15000);
        if (i > 0) { try { await progLoad(true); render(); } catch(_) {} }
        return; }
      finally { document.body.classList.remove('busy'); }
      IMPORT_PENDING = null; await progLoad(true); closeModal(); render(); toast(`导入完成：新增 ${n} 个，更新 ${u} 个`);
    }
    if (k === 'tg-pick') progPicker(...v.split('|'));
    if (k === 'pk-back') { const t = TG_DRAFT; targetForm(t.sid, t.tid || undefined, t.d); }
    if (k === 'pk-pick') {
      const [pid, rid] = v.split('|'), p = PROG.find(x => x.id === pid), r = (p.rounds||[]).find(x => x.id === rid) || {}, t = TG_DRAFT;
      const pre = {...t.d, school: `${p.school}／${progName(p)}`, exam_way: r.name || '',
        requirement: [pv(p,'exam_way'), pv(p,'practical') && `实技：${pv(p,'practical')}`].filter(Boolean).join('；'),
        score_req: [pv(p,'jp_req'), pv(p,'eju_req'), pv(p,'en_req')].filter(Boolean).join('；'), program_id: pid, round_id: rid || ''};
      // 2026-11-25：改选了别的专业 / 别的轮次，日期换了的那一场，原来填的考试时间、备注不能跟着留下（会拼成一场不存在的考试）
      const xi = {...(t.d.exam_info || {})}; let dropped = 0;
      DATE_KEYS.forEach(([dk]) => { const nv = r[dk] || ''; if (xi[dk] && (xi[dk].time || xi[dk].note) && nv !== (t.d[dk] || '')) { delete xi[dk]; dropped++; } pre[dk] = nv; });
      pre.exam_info = xi;
      targetForm(t.sid, t.tid || undefined, pre); toast(dropped ? '已带入，看一下再保存。日期换了的那几场，原来填的考试时间、备注已经清掉' : '已带入，看一下再保存', false, dropped ? 6000 : undefined);
    }
  } catch(err) { /* act() 已经提示过 */ }
});
function progSearchGo(q){
  PF.q = q; clearTimeout(PF._t);
  const go = () => { const box = document.getElementById('pg-list'); if (box) { box.innerHTML = progList(); labelTables(); } };
  if ((PROG || []).length > 800) PF._t = setTimeout(go, 180); else go();
}
document.addEventListener('compositionend', e => { if (e.target.id === 'pf-q') progSearchGo(e.target.value); });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'pf-q') {   // 院校库大了以后（八百个专业以上）等手停一下再筛，输入法拼到一半不筛（2026-11-25）
    if (e.isComposing) return;
    progSearchGo(el.value);
  }
  if (el.id === 'pk-q') document.querySelectorAll('.pk-item').forEach(x => x.style.display = fzHit(el.value, x.dataset.s) ? '' : 'none');
});
document.addEventListener('change', e => {
  const el = e.target;
  if (/^pf-(year|level|field|school_type|visa)$/.test(el.id)) { PF[el.id.slice(3)] = el.value; const box = document.getElementById('pg-list'); if (box) { box.innerHTML = progList(); labelTables(); } }
  if (el.dataset && el.dataset.change === 'prog-import' && el.files.length) { progImportFile(el.files[0]); el.value = ''; }
});
