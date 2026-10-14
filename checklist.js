/* ══════════════════════════════════════════════════════════════
   通关点检表（美术生）
   · 按阶段分组的关卡，每关四档：学习中 / 基本掌握 / 通关 / 优秀；到「通关」自动记通关日
   · 教务、任课老师能打档、改关卡；学生、家长只看
   · 模板：先有「动漫方向（角色设计）」81 关（世珍课程规划表）；学生的表也能另存为模板
   ══════════════════════════════════════════════════════════════ */
let CK = null;                                     // {templates, lists}，用到时才读
const CK_LV = [['学习中','#4f7396'],['基本掌握','#c4762f'],['通关','#2a8a5e'],['优秀','#b8953a']];
let CK_EDIT = false;                               // 「编辑关卡」模式

async function ckLoad(force){
  if (CK && !force) return CK;
  CK = await rpc('checks_load') || {templates: [], lists: []};
  return CK;
}
const ckCanEdit = () => ['admin','teacher'].includes(ME().role);
const ckListsOf = sid => (CK ? CK.lists : []).filter(l => l.student_id === sid);
const ckStat = l => {
  const n = l.items.length, pass = l.items.filter(i => i.level >= 3).length;
  const cur = l.items.find(i => i.level < 3);          // 现在在哪一关：第一个还没通关的
  return {n, pass, pct: n ? Math.round(pass / n * 100) : 0, cur};
};

// 一个学生的全部点检表（还没读到时先显示「读取中」，读完自动重画）
function ckBlock(sid, mode){
  if (!CK){
    ckLoad().then(() => { if (lastModal && document.querySelector('.modal')) lastModal(); else render(); }).catch(e => toast(e.message, true));
    return '<div class="muted small">正在读取通关点检表…</div>';
  }
  const ls = ckListsOf(sid), edit = ckCanEdit() && mode !== 'view';
  let out = ls.map(l => ckList(l, edit)).join('');
  if (edit) out += ckNewForm(sid, ls.length);
  else if (!ls.length) out = '<div class="muted small">还没有通关点检表</div>';
  return out;
}
function ckSummary(l){
  const st = ckStat(l);
  return `<div class="ck-sum"><div class="ck-bar"><i style="width:${st.pct}%"></i></div>
    <span class="small">已通关 <b class="num">${st.pass}</b> / ${st.n} 关（${st.pct}%）</span>${st.cur ? `<span class="muted small">现在：${esc(st.cur.stage)} · ${esc(st.cur.name)}</span>` : st.n ? '<span class="tag ok">全部通关</span>' : ''}</div>`;
}
function ckList(l, edit){
  const stages = []; l.items.forEach(i => { const g = stages.find(x => x.stage === i.stage); g ? g.items.push(i) : stages.push({stage: i.stage, items: [i]}); });
  let no = 0;
  return `<section class="card ck-card"><div class="row"><h3 style="margin-right:auto;font-size:16px">${esc(l.title)}</h3>
      ${edit ? `<button class="btn sm ${CK_EDIT?'pri':''}" data-act="ck-edit">${CK_EDIT ? '完成编辑' : '编辑关卡'}</button>` : ''}</div>
    ${ckSummary(l)}
    <div class="ck-legend muted xs">${CK_LV.map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}<span>点一下打档，再点一下退回上一档；到「通关」自动记通关日</span></div>
    ${stages.map(g => { const done = g.items.filter(i => i.level >= 3).length;
      return `<div class="ck-stage"><div class="ck-st"><b>${esc(g.stage || '（未分阶段）')}</b><span class="muted xs">${done}/${g.items.length}</span></div>
      ${g.items.map(i => { no++; return `<div class="ck-row ${i.level >= 3 ? 'pass' : ''}">
        <span class="ck-no num">${no}</span>
        <span class="ck-name">${esc(i.name)}${i.note ? `<span class="muted xs"> · ${esc(i.note)}</span>` : ''}</span>
        <span class="ck-plan num muted">${esc(i.plan)}</span>
        <span class="ck-lv">${CK_LV.map(([t, c], k) => `<button class="ck-b ${i.level >= k + 1 ? 'on' : ''}" style="--c:${c}" ${edit ? `data-act="ck-lv" data-v="${i.id}|${k + 1}|${i.level}"` : 'disabled'} title="${t}">${t}</button>`).join('')}</span>
        <span class="ck-day num ${i.passed_on ? '' : 'muted'}">${i.passed_on ? sMD(i.passed_on) : '—'}</span>
        ${edit && CK_EDIT ? `<span class="ck-ops"><button class="btn sm" data-act="ck-item-edit" data-v="${i.id}">改</button><button class="btn sm" data-act="ck-item-add" data-v="${l.id}|${i.id}">＋</button><button class="btn sm danger" data-act="ck-item-del" data-v="${i.id}">删</button></span>` : ''}</div>`; }).join('')}</div>`; }).join('')}
    ${edit && CK_EDIT ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="ck-item-add" data-v="${l.id}|">＋ 在最后加一关</button><button class="btn sm" data-act="ck-rename" data-v="${l.id}">改表名</button>
      ${isAdmin() ? `<button class="btn sm" data-act="ck-tpl-save" data-v="${l.id}">另存为模板</button><button class="btn sm danger" style="margin-left:auto" data-act="ck-del" data-v="${l.id}">删除整张表</button>` : ''}</div>` : ''}
  </section>`;
}
function ckNewForm(sid, has){
  const ts = CK.templates || [];
  return `<section class="card ck-new"><b class="small">${has ? '再建一张通关点检表' : '给这位学生建通关点检表'}</b>
    <div class="row"><select id="ck-tpl-${sid}">${ts.map(t => `<option value="${t.id}">模板：${esc(t.name)}（${t.n} 关）</option>`).join('')}<option value="">空白表（自己加关卡）</option></select>
      <input type="text" id="ck-title-${sid}" placeholder="表名，例：通关点检表" style="flex:1;min-width:140px">
      <button class="btn pri sm" data-act="ck-new" data-v="${sid}">建立</button></div>
    ${isAdmin() && ts.length ? `<div class="muted xs">模板：${ts.map(t => `${esc(t.name)} <button class="link-btn" data-act="ck-tpl-del" data-v="${t.id}">删除</button>`).join('　')}</div>` : ''}</section>`;
}

// 家长 / 学生看的简版：进度条＋按阶段一行一行
function ckView(sid){
  if (!CK){ ckLoad().then(render).catch(() => {}); return ''; }
  const ls = ckListsOf(sid); if (!ls.length) return '';
  return ls.map(l => ckList(l, false)).join('');
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v;
  if (!k.startsWith('ck-')) return;
  const redraw = async () => { await ckLoad(true); if (lastModal && document.querySelector('.modal')) lastModal(); else render(); };
  try {
    if (k === 'ck-edit') { CK_EDIT = !CK_EDIT; await redraw(); }
    if (k === 'ck-lv') {
      const [iid, lv, cur] = v.split('|'), want = +cur === +lv ? +lv - 1 : +lv;   // 再点同一档 → 退回上一档
      await rpc('check_level', {iid, lv: want}); await redraw();
    }
    if (k === 'ck-new') {
      const tpl = val('ck-tpl-' + v) || null, title = val('ck-title-' + v).trim() || '通关点检表';
      await rpc('check_create', {sid: v, title, tpl}); toast('已建立'); await redraw();
    }
    if (k === 'ck-item-add') {
      const [lid, after] = v.split('|'), l = CK.lists.find(x => x.id === lid), ref = l.items.find(i => i.id === after) || l.items[l.items.length - 1];
      const name = prompt('关卡名称', ''); if (!name) return;
      const stage = prompt('属于哪个阶段', ref ? ref.stage : '') ?? '';
      const plan = prompt('计划月份（可以不填），例：2027.03', '') ?? '';
      await rpc('check_item_save', {d: {checklist_id: lid, after: after || '', name, stage, plan}}); await redraw();
    }
    if (k === 'ck-item-edit') {
      const it = CK.lists.flatMap(l => l.items).find(i => i.id === v);
      const name = prompt('关卡名称', it.name); if (name === null) return;
      const stage = prompt('阶段', it.stage); if (stage === null) return;
      const plan = prompt('计划月份', it.plan); if (plan === null) return;
      const note = prompt('备注（可以不填）', it.note || ''); if (note === null) return;
      await rpc('check_item_save', {d: {id: v, name, stage, plan, note}}); await redraw();
    }
    if (k === 'ck-item-del') { if (!confirm('删掉这一关？')) return; await rpc('check_item_delete', {iid: v}); await redraw(); }
    if (k === 'ck-rename') { const l = CK.lists.find(x => x.id === v), t = prompt('表名', l.title); if (!t) return; await rpc('check_list_update', {lid: v, title: t}); await redraw(); }
    if (k === 'ck-del') { if (!confirm('删除整张通关点检表？打过的档都会一起删掉，不能恢复。')) return; await rpc('check_list_delete', {lid: v}); toast('已删除'); await redraw(); }
    if (k === 'ck-tpl-save') { const l = CK.lists.find(x => x.id === v), n = prompt('模板名称（同名会覆盖）', l.title); if (!n) return; await rpc('check_template_save', {lid: v, name: n}); toast('已存成模板'); await redraw(); }
    if (k === 'ck-tpl-del') { if (!confirm('删除这个模板？已经建好的学生点检表不受影响。')) return; await rpc('check_template_delete', {tid: v}); await redraw(); }
  } catch(err) { toast(err.message, true); }
});
