/* ══════════════════════════════════════════════════════════════
   院校库（出愿数据库）：专业 ＋ 各轮入试
   · 字段清单在 school_fields.js（由 教务系统/院校库字段清单.py 生成），这里按清单自动排版
   · 教务都能看、改、导入 Excel（模板：院校库导入模板.xlsx）
   · 学生「大学与出愿」可以从这里一键带入
   读 Excel 不用外部插件：.xlsx 本身是个压缩包，用浏览器自带的解压读里面的表格
   ══════════════════════════════════════════════════════════════ */
let PROG = null;                       // 院校库数据，用到时才读
const PF = {q:'', field:'', level:'', year:'', school_type:''};
const P_CORE = SF_P.filter(f => f.core).map(f => f.k), R_CORE = SF_R.filter(f => f.core).map(f => f.k);
const R_DATES = SF_R.filter(f => f.t === 'date').map(f => f.k);
const P_GROUPS = [...new Set(SF_P.map(f => f.g))];
// 专业 / 轮次的某一项（固定栏直接读，其他从 info 里读）
const pv = (p, k) => P_CORE.includes(k) ? (p[k] ?? '') : ((p.info || {})[k] ?? '');
const rv = (r, k) => R_CORE.includes(k) ? (r[k] ?? '') : ((r.info || {})[k] ?? '');

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
const staleTag = p => { const v = pv(p, 'verified_on'); return v && dBetween(v, TODAY) > 180 ? '<span class="tag warn">超过半年没核验</span>' : ''; };

/* ───────── 页面 ───────── */
function pgSchools(){
  const head = `<div class="ph"><h2>院校库</h2><span class="row"><a class="btn sm" href="院校库导入模板.xlsx" download>下载 Excel 模板</a>
    <label class="btn sm" for="prog-file">导入 Excel</label><input type="file" id="prog-file" accept=".xlsx,.csv" data-change="prog-import" hidden>
    <button class="btn pri" data-act="prog-new">＋ 添加专业</button></span></div>
  <div class="hint">一个专业一张卡片，点开看全部资料和各轮入试日期。学生的「大学与出愿」可以直接从这里带入。导入时，同年度、同学校、同学部学科的会更新，其他的新增。</div>`;
  if (!PROG){
    progLoad().then(() => { if (S.page==='schools') render(); }).catch(e => toast(e.message, true));
    return head + '<div class="card empty">正在读取院校库…</div>';
  }
  const uniq = k => [...new Set(PROG.map(p => String(pv(p, k))).filter(Boolean))].sort();
  const sel = (k, label) => `<select id="pf-${k}" aria-label="${label}"><option value="">${label}：全部</option>${uniq(k).map(x => `<option ${x===PF[k]?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
  return head + `<div class="row"><input type="search" id="pf-q" placeholder="搜学校、学部、学科、关键词" value="${esc(PF.q)}" style="flex:1;min-width:200px">
    ${sel('year','年度')}${sel('level','类别')}${sel('field','方向')}${sel('school_type','学校类型')}</div>
  <div id="pg-list">${progList()}</div>`;
}
function progFiltered(){
  const q = PF.q.trim().toLowerCase();
  return PROG.filter(p => ['year','level','field','school_type'].every(k => !PF[k] || String(pv(p, k)) === PF[k])
    && (!q || [p.school, p.faculty, p.dept, p.field, p.region, ...Object.values(p.info || {})].join(' ').toLowerCase().includes(q)));
}
function progList(){
  if (!PROG.length) return `<div class="card empty">院校库还是空的。点右上角「下载 Excel 模板」，填好后「导入 Excel」；也可以「添加专业」一个个录。</div>`;
  const list = progFiltered();
  if (!list.length) return '<div class="card empty">没有符合条件的专业</div>';
  return `<div class="muted xs" style="margin:2px 0 6px">共 ${list.length} 个专业</div>` + list.map(progCard).join('');
}
const SHOWN_IN_HEAD = ['year','level','field','school','region','faculty','dept','school_type','intake','campus','url','url2'];
function progCard(p){
  const used = (DB.targets||[]).filter(t => t.program_id===p.id).length, rs = p.rounds || [];
  const rExtra = SF_R.filter(f => !f.core);
  const groups = P_GROUPS.map(g => {
    const items = SF_P.filter(f => f.g === g && !SHOWN_IN_HEAD.includes(f.k) && pv(p, f.k));
    return items.length ? `<div class="pg-grp"><div class="pg-gt">${g}</div><dl class="kv small">${items.map(f => `<dt>${f.l}</dt><dd style="white-space:pre-wrap">${esc(String(pv(p, f.k)))}</dd>`).join('')}</dl></div>` : '';
  }).join('');
  return `<details class="card pg-card"><summary><div class="row"><b class="pg-school">${esc(p.school)}</b><span>${esc(progName(p))}</span>
      <span class="tag mute">${p.year}${pv(p,'intake')&&pv(p,'intake')!=='4月'?' · '+esc(pv(p,'intake'))+'入学':''}</span><span class="tag blue">${esc(p.level)}</span>${p.field?`<span class="tag gold">${esc(p.field)}</span>`:''}
      ${pv(p,'school_type')?`<span class="tag mute">${esc(pv(p,'school_type'))}</span>`:''}${p.region?`<span class="tag mute">${esc(p.region)}</span>`:''}
      ${used?`<span class="tag ok">${used} 位学生在报</span>`:''}${staleTag(p)}<span style="margin-left:auto">${nextRound(p)}</span></div></summary>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
      ${rs.length ? `<div class="tw"><table class="rt"><thead><tr><th>入试</th><th>出愿</th><th>材料必着</th><th>一次发表</th><th>笔试</th><th>面试</th><th>合格发表</th><th>手续截止</th><th>考试内容</th></tr></thead><tbody>
        ${rs.map(r => `<tr class="${(r.apply_end||'9999') < TODAY ? 'muted' : ''}"><td><b>${esc(r.name||'')}</b>${rv(r,'r_mode')?`<div class="xs">${esc(rv(r,'r_mode'))}${rv(r,'r_place')?' · '+esc(rv(r,'r_place')):''}</div>`:''}</td>
          <td class="num">${dS(r.apply_start)}${r.apply_start||r.apply_end?'–':''}${dS(r.apply_end)}</td><td class="num">${dS(r.docs_due)}</td><td class="num">${dS(r.first_result)}</td><td class="num">${dS(r.written_date)}</td><td class="num">${dS(r.interview_date)}</td><td class="num">${dS(r.result_date)}</td><td class="num">${dS(r.procedure_due)}</td>
          <td class="xs">${esc(rv(r,'content'))}${rExtra.filter(f => !['r_mode','r_place','content'].includes(f.k) && rv(r, f.k)).map(f => `<div class="muted">${esc(rv(r, f.k))}</div>`).join('')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="muted small">还没有填入试日期</div>'}
      ${pv(p,'campus')?`<div class="small"><span class="muted">校区：</span>${esc(pv(p,'campus'))}</div>`:''}
      <div class="pg-grps">${groups}</div>
      <div class="row">${pv(p,'url')?`<a class="btn sm" href="${esc(pv(p,'url'))}" target="_blank" rel="noopener">官方入试页面</a>`:''}${pv(p,'url2')?`<a class="btn sm" href="${esc(pv(p,'url2'))}" target="_blank" rel="noopener">募集要项 PDF</a>`:''}
        <span class="muted xs">${p.updated_by?`${esc(p.updated_by)} ${String(p.updated_at||'').slice(0,10)} 更新`:''}</span>
        <span style="margin-left:auto" class="row"><button class="btn sm" data-act="prog-edit" data-v="${p.id}">编辑</button><button class="btn sm danger" data-act="prog-del" data-v="${p.id}">删除</button></span></div>
    </div></details>`;
}

/* ───────── 添加 / 编辑 ───────── */
function sfInput(f, val, cls){
  const id = cls ? '' : `id="pg-${f.k}"`, c = cls ? `class="${cls}-${f.k}"` : '';
  const ph = f.h ? `placeholder="${esc(f.h)}"` : '';
  if (f.t === 'select') return `<label class="field"><span>${f.l}</span><select ${id} ${c}><option value="">—</option>${f.o.map(o => `<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}${val && !f.o.includes(val) ? `<option selected>${esc(val)}</option>` : ''}</select></label>`;
  if (f.t === 'date') return `<label class="field"><span>${f.l}</span><input type="date" ${id} ${c} value="${esc(val||'')}"></label>`;
  if (f.t === 'area') return `<label class="field"><span>${f.l}</span><textarea ${id} ${c} style="min-height:48px" ${ph}>${esc(val||'')}</textarea></label>`;
  return `<label class="field"><span>${f.l}</span><input type="text" ${id} ${c} value="${esc(val??'')}" ${ph}></label>`;
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
  <div class="row"><button class="btn pri" data-act="prog-save" data-v="${p.id||''}">保存</button></div>`, 'xl');
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
  <input type="search" id="pk-q" placeholder="搜学校、学部、学科">
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
  if (typeof v === 'object') { const n = +v.num; if (n > 20000 && n < 80000) return {d: new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000).toISOString().slice(0,10)}; v = v.num; }
  const m = String(v).match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (m) return {d: `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`};
  return {d: '', bad: String(v).trim()};
}
function rowsToPrograms(rows){
  const hi = rows.findIndex(r => r && r.some(c => typeof c === 'string' && /^\s*[＊*]?\s*(学校|学校名称|大学|志愿校名称)\s*[＊*]?\s*$/.test(c)));
  if (hi < 0) throw new Error('表里找不到「学校」这一列的表头，请用系统给的模板');
  const map = headerMap(rows[hi]), warn = [], groups = new Map();
  const txt = v => v == null ? '' : typeof v === 'object' ? String(v.num) : String(v).trim();
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
    p.year = String(p.year || '').replace(/[^\d]/g, '').slice(0,4) || String(+TODAY.slice(0,4) + 1);
    if (p.level && !['学部','大学院','研究生','专门学校'].includes(p.level)) { warn.push(`第 ${line} 行「类别」写的是「${p.level}」，已按「学部」处理`); p.level = '学部'; }
    const key = [p.year, p.school, p.faculty||'', p.dept||''].join('|');
    if (!groups.has(key)) groups.set(key, {...p, info: {...p.info}, rounds: []});
    const g = groups.get(key);
    P_CORE.forEach(k => { if (p[k] && !g[k]) g[k] = p[k]; });
    Object.entries(p.info).forEach(([k, v]) => { if (v && !g.info[k]) g.info[k] = v; });   // 同一专业的多行：前面空着的用后面的补
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
    if (k === 'pr-add' || k === 'pr-del') {
      const d = progCollect(); d.id = a.closest('.modal').querySelector('[data-act="prog-save"]').dataset.v || undefined;
      if (k === 'pr-add') d.rounds.push({info:{}}); else d.rounds.splice(+v, 1);
      progForm(d);
    }
    if (k === 'prog-save') {
      const d = progCollect(); if (!d.school) { toast('请填写学校', true); return; }
      d.rounds = d.rounds.filter(r => r.name || R_DATES.some(x => r[x]) || Object.keys(r.info).length);
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
      catch(err) { toast(err.message, true); return; }
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
      DATE_KEYS.forEach(([dk]) => pre[dk] = (r[dk] || ''));
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
  if (/^pf-(year|level|field|school_type)$/.test(el.id)) { PF[el.id.slice(3)] = el.value; const box = document.getElementById('pg-list'); if (box) { box.innerHTML = progList(); labelTables(); } }
  if (el.dataset && el.dataset.change === 'prog-import' && el.files.length) { progImportFile(el.files[0]); el.value = ''; }
});
