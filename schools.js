/* ══════════════════════════════════════════════════════════════
   院校库（出愿数据库）：专业 ＋ 各轮入试日期
   · 教务都能看、改、导入 Excel（模板：院校库导入模板.xlsx）
   · 学生「大学与出愿」可以从这里一键带入
   读 Excel 不用外部插件：.xlsx 本身是个压缩包，用浏览器自带的解压读里面的表格
   ══════════════════════════════════════════════════════════════ */
let PROG = null;                       // 院校库数据，用到时才读
const PF = {q:'', field:'', level:'', year:''};
const PROG_LEVEL = ['学部','大学院','研究生','专门学校'];
const PROG_FIELDS = [['year','入学年度'],['level','类别'],['field','方向'],['school','学校'],['region','地区'],['faculty','学部・研究科'],['dept','学科・专攻・コース'],
  ['exam_way','考试方式'],['jp_req','日语要求'],['en_req','英语要求'],['other_req','其他成绩要求'],['portfolio','作品集・材料要求'],['plan_req','研究计划书要求'],
  ['professor','事先联系教授'],['fee','检定料'],['url','官方链接'],['verified','核验状态'],['note','备注']];
const ROUND_FIELDS = [['name','入试名称'],['apply_start','出愿开始'],['apply_end','出愿截止'],['docs_due','材料必着'],['written_date','笔试日'],['interview_date','面试日'],
  ['result_date','合格发表'],['procedure_due','手续截止'],['content','本轮考试内容'],['note','本轮备注']];
const R_DATES = ['apply_start','apply_end','docs_due','written_date','interview_date','result_date','procedure_due'];

async function progLoad(force){
  if (PROG && !force) return PROG;
  PROG = await rpc('programs_load') || [];
  return PROG;
}
const dS = d => !d ? '' : d.slice(0,4)===TODAY.slice(0,4) ? `${+d.slice(5,7)}/${+d.slice(8,10)}` : `${d.slice(2,4)}/${+d.slice(5,7)}/${+d.slice(8,10)}`;
const progName = p => [p.faculty, p.dept].filter(Boolean).join(' ');
// 下一轮：还没过截止的第一轮
function nextRound(p){
  const r = (p.rounds||[]).find(r => (r.apply_end || r.apply_start || r.result_date || '9999') >= TODAY);
  if (!r) return (p.rounds||[]).length ? '<span class="tag mute">本年度各轮已截止</span>' : '';
  const open = r.apply_start && r.apply_start <= TODAY && (!r.apply_end || r.apply_end >= TODAY);
  if (open) return `<span class="tag seal">${esc(r.name||'')} 出愿中 · ${dS(r.apply_end)} 截止（还有 ${dBetween(TODAY, r.apply_end)} 天）</span>`;
  if (r.apply_start) return `<span class="tag warn">${esc(r.name||'')} · ${dS(r.apply_start)} 开始出愿</span>`;
  return `<span class="tag mute">${esc(r.name||'')}</span>`;
}

/* ───────── 页面 ───────── */
function pgSchools(){
  const head = `<div class="ph"><h2>院校库</h2><span class="row"><a class="btn sm" href="院校库导入模板.xlsx" download>下载 Excel 模板</a>
    <label class="btn sm" for="prog-file">导入 Excel</label><input type="file" id="prog-file" accept=".xlsx,.csv" data-change="prog-import" hidden>
    <button class="btn pri" data-act="prog-new">＋ 添加专业</button></span></div>
  <div class="hint">一个专业一张卡片，下面是各轮入试的日期。学生的「大学与出愿」可以直接从这里带入。导入时，同年度、同学校、同学部学科的会更新，其他的新增。</div>`;
  if (!PROG){
    progLoad().then(() => { if (S.page==='schools') render(); }).catch(e => toast(e.message, true));
    return head + '<div class="card empty">正在读取院校库…</div>';
  }
  const uniq = k => [...new Set(PROG.map(p => p[k]).filter(Boolean))];
  const sel = (id, label, list, cur) => `<select id="${id}" aria-label="${label}"><option value="">${label}：全部</option>${list.map(x => `<option ${String(x)===String(cur)?'selected':''}>${esc(String(x))}</option>`).join('')}</select>`;
  return head + `<div class="row"><input type="search" id="pf-q" placeholder="搜学校、学部、学科、关键词" value="${esc(PF.q)}" style="flex:1;min-width:200px">
    ${sel('pf-year','年度',uniq('year'),PF.year)}${sel('pf-level','类别',uniq('level'),PF.level)}${sel('pf-field','方向',uniq('field'),PF.field)}</div>
  <div id="pg-list">${progList()}</div>`;
}
function progFiltered(){
  const q = PF.q.trim().toLowerCase();
  return PROG.filter(p => (!PF.year || String(p.year)===PF.year) && (!PF.level || p.level===PF.level) && (!PF.field || p.field===PF.field)
    && (!q || [p.school,p.faculty,p.dept,p.field,p.region,p.exam_way,p.note].join(' ').toLowerCase().includes(q)));
}
function progList(){
  const list = progFiltered();
  if (!PROG.length) return `<div class="card empty">院校库还是空的。点右上角「下载 Excel 模板」，填好后「导入 Excel」；也可以「添加专业」一个个录。</div>`;
  if (!list.length) return '<div class="card empty">没有符合条件的专业</div>';
  return `<div class="muted xs" style="margin:2px 0 6px">共 ${list.length} 个专业</div>` + list.map(progCard).join('');
}
function progCard(p){
  const used = (DB.targets||[]).filter(t => t.program_id===p.id).length;
  const kv = PROG_FIELDS.filter(([k]) => !['year','level','field','school','region','faculty','dept','url'].includes(k) && p[k]).map(([k,l]) => `<dt>${l}</dt><dd style="white-space:pre-wrap">${esc(p[k])}</dd>`).join('');
  const rs = p.rounds||[];
  return `<details class="card pg-card"><summary><div class="row"><b class="pg-school">${esc(p.school)}</b><span>${esc(progName(p))}</span>
      <span class="tag mute">${p.year}</span><span class="tag blue">${esc(p.level)}</span>${p.field?`<span class="tag gold">${esc(p.field)}</span>`:''}${p.region?`<span class="tag mute">${esc(p.region)}</span>`:''}
      ${used?`<span class="tag ok">${used} 位学生在报</span>`:''}<span style="margin-left:auto">${nextRound(p)}</span></div></summary>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      ${rs.length ? `<div class="tw"><table class="rt"><thead><tr><th>入试</th><th>出愿</th><th>材料必着</th><th>笔试</th><th>面试</th><th>合格发表</th><th>手续截止</th><th>考试内容</th></tr></thead><tbody>
        ${rs.map(r => `<tr class="${(r.apply_end||'9999') < TODAY ? 'muted' : ''}"><td><b>${esc(r.name||'')}</b></td><td class="num">${dS(r.apply_start)}${r.apply_start||r.apply_end?'–':''}${dS(r.apply_end)}</td><td class="num">${dS(r.docs_due)}</td><td class="num">${dS(r.written_date)}</td><td class="num">${dS(r.interview_date)}</td><td class="num">${dS(r.result_date)}</td><td class="num">${dS(r.procedure_due)}</td><td class="xs">${esc(r.content||'')}${r.note?`<div class="muted">${esc(r.note)}</div>`:''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="muted small">还没有填入试日期</div>'}
      ${kv ? `<dl class="kv small">${kv}</dl>` : ''}
      <div class="row">${p.url?`<a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">官方页面</a>`:''}<span class="muted xs">${p.updated_by?`${esc(p.updated_by)} ${String(p.updated_at||'').slice(0,10)} 更新`:''}</span>
        <span style="margin-left:auto" class="row"><button class="btn sm" data-act="prog-edit" data-v="${p.id}">编辑</button><button class="btn sm danger" data-act="prog-del" data-v="${p.id}">删除</button></span></div>
    </div></details>`;
}

/* ───────── 添加 / 编辑 ───────── */
function progForm(p){
  p = p || {year: (+TODAY.slice(0,4) + (TODAY.slice(5,7) >= '04' ? 1 : 0)), level:'学部', rounds:[{}]};
  const f = (k, l, ph='') => `<label class="field"><span>${l}</span><input type="text" id="pg-${k}" value="${esc(p[k]??'')}" placeholder="${ph}"></label>`;
  const t = (k, l, ph='') => `<label class="field"><span>${l}</span><textarea id="pg-${k}" style="min-height:48px" placeholder="${ph}">${esc(p[k]||'')}</textarea></label>`;
  openModal(`${mHead(p.id ? '编辑专业' : '添加专业')}
  <div class="fields">${f('year','入学年度','2027')}<label class="field"><span>类别</span><select id="pg-level">${PROG_LEVEL.map(x=>`<option ${x===p.level?'selected':''}>${x}</option>`).join('')}</select></label>${f('field','方向','例：动画')}${f('region','地区','例：东京')}</div>
  <div class="fields">${f('school','学校 *','例：東京工芸大学')}${f('faculty','学部・研究科','例：芸術学部')}${f('dept','学科・专攻・コース','例：アニメーション学科')}</div>
  <b class="small">入试轮次 <span class="muted xs" style="font-weight:400">每一期各一行，日期没公布可以先空着</span></b>
  <div id="pg-rounds" style="display:flex;flex-direction:column;gap:8px">${(p.rounds||[]).map((r,i) => `<div class="card small pg-round" data-i="${i}" data-id="${r.id||''}">
    <div class="row"><input type="text" class="pr-name" value="${esc(r.name||'')}" placeholder="入试名称，例：留学生选拔 I期" style="flex:1"><button class="btn sm danger" data-act="pr-del" data-v="${i}">删掉这一轮</button></div>
    <div class="fields">${R_DATES.map(k => `<label class="field"><span>${ROUND_FIELDS.find(x=>x[0]===k)[1]}</span><input type="date" class="pr-${k}" value="${r[k]||''}"></label>`).join('')}</div>
    <div class="fields"><label class="field"><span>本轮考试内容</span><input type="text" class="pr-content" value="${esc(r.content||'')}" placeholder="例：小论文＋面试"></label><label class="field"><span>本轮备注</span><input type="text" class="pr-note" value="${esc(r.note||'')}"></label></div></div>`).join('')}</div>
  <div><button class="btn sm" data-act="pr-add">＋ 加一轮</button></div>
  <b class="small">要求</b>
  ${t('exam_way','考试方式','例：小论文＋面试；映像学科不考素描')}
  <div class="fields">${t('jp_req','日语要求','例：JLPT N2 或 EJU 日语 220+')}${t('en_req','英语要求','')}${t('other_req','其他成绩要求','例：EJU 文综')}</div>
  ${t('portfolio','作品集・材料要求','例：A4、40 页以内、1 册')}
  <div class="fields">${t('plan_req','研究计划书要求（大学院）','')}${t('professor','事先联系教授（大学院）','例：需要，出愿前取得内诺')}</div>
  <div class="fields">${f('fee','检定料','例：35,000 円')}${f('url','官方链接','https://')}${f('verified','核验状态','例：已确认 2027 募集要项（2026/9/10）')}</div>
  ${t('note','备注','')}
  <div class="row"><button class="btn pri" data-act="prog-save" data-v="${p.id||''}">保存</button></div>`, 'xl');
}
function progCollect(){
  const d = {};
  PROG_FIELDS.forEach(([k]) => { const el = document.getElementById('pg-'+k); if (el) d[k] = el.value.trim(); });
  d.rounds = [...document.querySelectorAll('.pg-round')].map(el => {
    const r = {name: el.querySelector('.pr-name').value.trim(), content: el.querySelector('.pr-content').value.trim(), note: el.querySelector('.pr-note').value.trim()};
    if (el.dataset.id) r.id = el.dataset.id;
    R_DATES.forEach(k => r[k] = el.querySelector('.pr-'+k).value);
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
  <input type="search" id="pk-q" placeholder="搜学校、学部、学科" autofocus>
  <div class="muted xs">点某一轮，就把这一轮的日期和要求带进出愿目标；带进去以后还可以改。</div>
  <div id="pk-list" style="display:flex;flex-direction:column;gap:6px">${PROG.length ? PROG.map(p => `<div class="card small pk-item" data-s="${esc([p.school,p.faculty,p.dept,p.field].join(' ').toLowerCase())}">
    <div class="row"><b>${esc(p.school)}</b><span>${esc(progName(p))}</span><span class="tag mute">${p.year}</span>${p.field?`<span class="tag gold">${esc(p.field)}</span>`:''}</div>
    <div class="row" style="margin-top:4px">${(p.rounds||[]).length ? p.rounds.map(r => `<button class="btn sm" data-act="pk-pick" data-v="${p.id}|${r.id}">${esc(r.name||'（未命名）')}${r.apply_end?` · ${dS(r.apply_end)} 截止`:''}</button>`).join('') : `<button class="btn sm" data-act="pk-pick" data-v="${p.id}|">带入（还没有轮次）</button>`}</div></div>`).join('') : '<div class="empty">院校库还是空的，先到左侧「院校库」导入</div>'}</div>
  <div class="row"><button class="btn sm" data-act="pk-back">返回</button></div>`, true);
}
function tgCollect(){
  const g = id => document.getElementById(id)?.value ?? '';
  const d = {tier:g('tg-tier'), seq:g('tg-seq'), school:g('tg-school'), exam_way:g('tg-way'), requirement:g('tg-req'), score_req:g('tg-score'), status:g('tg-status'), doc_status:g('tg-doc'), next_step:g('tg-next'), program_id:g('tg-pid'), round_id:g('tg-rid')};
  DATE_KEYS.forEach(([k]) => d[k] = g('tg-'+k));
  return d;
}

/* ───────── Excel / CSV 读取 ───────── */
async function readXlsx(buf){
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
  // 共享文字（跳过日文注音 rPh）
  const shared = [];
  const ss = await read('xl/sharedStrings.xml');
  if (ss) for (const si of xml(ss).getElementsByTagName('si')) {
    let t = '';
    for (const ch of si.childNodes) { if (ch.nodeName === 't') t += ch.textContent; else if (ch.nodeName === 'r') for (const x of ch.childNodes) if (x.nodeName === 't') t += x.textContent; }
    shared.push(t);
  }
  // 找工作表：优先叫「出愿数据库」「院校库」的，否则第一张
  const wb = xml(await read('xl/workbook.xml')), rels = xml(await read('xl/_rels/workbook.xml.rels') || '<x/>');
  const sheets = [...wb.getElementsByTagName('sheet')];
  const pick = sheets.find(s => /出愿数据库|院校库/.test(s.getAttribute('name'))) || sheets[0];
  let target = 'xl/worksheets/sheet1.xml';
  if (pick) { const rid = pick.getAttribute('r:id'); const rel = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
    if (rel) { const t = rel.getAttribute('Target'); target = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); } }
  const sh = await read(target); if (!sh) throw new Error('Excel 里找不到工作表');
  const colIdx = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const row of xml(sh).getElementsByTagName('row')) {
    const arr = [];
    for (const c of row.getElementsByTagName('c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let val = v;
      if (t === 's') val = shared[+v] ?? '';
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
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
const H_ALIAS = {'学校名称':'school','大学':'school','志愿校名称':'school','学部研究科':'faculty','学部':'faculty','研究科':'faculty','学科专攻コース':'dept','学科':'dept','专业':'dept','专攻':'dept',
  '年度':'year','入学年度':'year','类别':'level','方向':'field','地区':'region','入试名称':'name','轮次':'name','入试':'name','考试日':'written_date','考试时间':'written_date',
  '作品集要求':'portfolio','作品集材料要求':'portfolio','官方来源':'url','核验':'verified'};
function headerMap(row){
  const m = {};
  const all = [...PROG_FIELDS.map(([k,l]) => ['p.'+k, l]), ...ROUND_FIELDS.map(([k,l]) => ['r.'+k, l])];
  row.forEach((h, i) => {
    const n = normH(typeof h === 'object' ? h?.num : h); if (!n) return;
    let hit = all.find(([, l]) => normH(l) === n);
    if (!hit && H_ALIAS[n]) { const k = H_ALIAS[n]; hit = all.find(([key]) => key === 'p.'+k) || all.find(([key]) => key === 'r.'+k); }
    if (hit && !Object.values(m).includes(hit[0])) m[i] = hit[0];
  });
  return m;
}
// 日期：Excel 日期数字、2026/10/23、2026-10-23、2026年10月23日
function toDate(v){
  if (v == null || v === '') return {d: ''};
  if (typeof v === 'object') { const n = +v.num; if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000); return {d: d.toISOString().slice(0,10)}; } v = v.num; }
  const m = String(v).match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (m) return {d: `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`};
  return {d: '', bad: String(v).trim()};
}
function rowsToPrograms(rows){
  const hi = rows.findIndex(r => r && r.some(c => typeof c === 'string' && /^\s*[＊*]?\s*(学校|学校名称|大学|志愿校名称)/.test(c)));
  if (hi < 0) throw new Error('表里找不到「学校」这一列的表头，请用系统给的模板');
  const map = headerMap(rows[hi]), warn = [], groups = new Map();
  if (!Object.values(map).includes('p.school')) throw new Error('表里找不到「学校」这一列');
  const txt = v => v == null ? '' : typeof v === 'object' ? String(v.num) : String(v).trim();
  rows.slice(hi + 1).forEach((r, ri) => {
    if (!r || !r.some(c => txt(c))) return;
    const p = {}, rd = {}; let hasRound = false;
    Object.entries(map).forEach(([i, key]) => {
      const [kind, k] = key.split('.'), v = r[i];
      if (kind === 'r' && R_DATES.includes(k)) { const x = toDate(v); rd[k] = x.d; if (x.bad) { rd._bad = (rd._bad||[]).concat(`${ROUND_FIELDS.find(f=>f[0]===k)[1]}：${x.bad}`); } if (x.d || x.bad) hasRound = true; }
      else if (kind === 'r') { rd[k] = txt(v); if (rd[k]) hasRound = true; }
      else p[k] = txt(v);
    });
    if (!p.school) { warn.push(`第 ${hi + ri + 2} 行没有填学校，跳过了`); return; }
    p.year = String(p.year || '').replace(/[^\d]/g, '').slice(0,4) || String(+TODAY.slice(0,4) + 1);
    if (p.level && !PROG_LEVEL.includes(p.level)) { warn.push(`第 ${hi + ri + 2} 行「类别」写的是「${p.level}」，已按「学部」处理`); p.level = '学部'; }
    if (rd._bad) { warn.push(`第 ${hi + ri + 2} 行有日期认不出来（${rd._bad.join('；')}），已经放进「本轮备注」`); rd.note = [rd.note, ...rd._bad].filter(Boolean).join('；'); delete rd._bad; }
    const key = [p.year, p.school, p.faculty||'', p.dept||''].join('|');
    if (!groups.has(key)) groups.set(key, {...p, rounds: []});
    const g = groups.get(key);
    Object.entries(p).forEach(([k, v]) => { if (v && !g[k]) g[k] = v; });   // 同一专业的多行：前面空着的用后面的补
    if (hasRound) g.rounds.push(rd);
  });
  return {list: [...groups.values()], warn};
}
let IMPORT_PENDING = null;
async function progImportFile(file){
  try {
    const rows = /\.csv$/i.test(file.name) ? readCsv(await file.text()) : await readXlsx(await file.arrayBuffer());
    const {list, warn} = rowsToPrograms(rows);
    if (!list.length) { toast('表里没有可以导入的内容', true); return; }
    await progLoad().catch(() => {});
    const exist = new Set((PROG||[]).map(p => [p.year, p.school, p.faculty, p.dept].join('|')));
    const nUpd = list.filter(p => exist.has([p.year, p.school, p.faculty||'', p.dept||''].join('|'))).length;
    IMPORT_PENDING = list;
    openModal(`${mHead('导入院校库')}
    <div class="stats"><div class="stat"><small>专业</small><b>${list.length}</b></div><div class="stat"><small>入试轮次</small><b>${list.reduce((a,p)=>a+p.rounds.length,0)}</b></div>
      <div class="stat"><small>新增</small><b>${list.length - nUpd}</b></div><div class="stat"><small>更新已有</small><b>${nUpd}</b></div></div>
    ${nUpd ? '<div class="note">「更新已有」的专业：资料换成表里的，<b>入试轮次整组换成表里的</b>。</div>' : ''}
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
    if (k === 'pr-add') { const d = progCollect(); d.id = a.closest('.modal').querySelector('[data-act="prog-save"]').dataset.v || undefined; d.rounds.push({}); progForm(d); }
    if (k === 'pr-del') { const d = progCollect(); d.id = a.closest('.modal').querySelector('[data-act="prog-save"]').dataset.v || undefined; d.rounds.splice(+v, 1); progForm(d); }
    if (k === 'prog-save') {
      const d = progCollect(); if (!d.school) { toast('请填写学校', true); return; }
      d.rounds = d.rounds.filter(r => r.name || R_DATES.some(x => r[x]) || r.content);
      if (v) d.id = v;
      await act('program_save', {d}, '已保存'); await progLoad(true); closeModal(); render();
    }
    if (k === 'prog-del') {
      const p = PROG.find(x => x.id === v);
      if (!confirm(`删除「${p.school} ${progName(p)}」？学生出愿目标里已经带入的内容不会受影响。`)) return;
      await act('program_delete', {xid: v}, '已删除'); await progLoad(true); render();
    }
    if (k === 'prog-import-go') {
      const list = IMPORT_PENDING; if (!list) return;
      document.body.classList.add('busy'); let n = 0, u = 0;
      try { for (let i = 0; i < list.length; i += 40) { const r = await rpc('programs_import', {rows: list.slice(i, i + 40)}); n += r.new; u += r.updated; } }
      finally { document.body.classList.remove('busy'); }
      IMPORT_PENDING = null; await progLoad(true); closeModal(); render(); toast(`导入完成：新增 ${n} 个，更新 ${u} 个`);
    }
    if (k === 'tg-pick') progPicker(...v.split('|'));
    if (k === 'pk-back') { const t = TG_DRAFT; targetForm(t.sid, t.tid || undefined, t.d); }
    if (k === 'pk-pick') {
      const [pid, rid] = v.split('|'), p = PROG.find(x => x.id === pid), r = (p.rounds||[]).find(x => x.id === rid) || {}, t = TG_DRAFT;
      const pre = {...t.d, school: `${p.school}／${progName(p)}`, exam_way: r.name || '', requirement: p.exam_way || '',
        score_req: [p.jp_req, p.en_req, p.other_req].filter(Boolean).join('；'), program_id: pid, round_id: rid || ''};
      DATE_KEYS.forEach(([dk]) => pre[dk] = (r[dk] || ''));
      if (!pre.docs_due && r.docs_due) pre.docs_due = r.docs_due;
      targetForm(t.sid, t.tid || undefined, pre); toast('已带入，看一下再保存');
    }
  } catch(err) { /* act() 已经提示过 */ }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'pf-q') { PF.q = el.value; const box = document.getElementById('pg-list'); if (box) { box.innerHTML = progList(); labelTables(); } }
  if (el.id === 'pk-q') { const q = el.value.trim().toLowerCase(); document.querySelectorAll('.pk-item').forEach(x => x.style.display = !q || x.dataset.s.includes(q) ? '' : 'none'); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (['pf-year','pf-level','pf-field'].includes(el.id)) { PF[el.id.slice(3)] = el.value; const box = document.getElementById('pg-list'); if (box) box.innerHTML = progList(); labelTables(); }
  if (el.dataset && el.dataset.change === 'prog-import' && el.files.length) { progImportFile(el.files[0]); el.value = ''; }
});
