/* ══════════════════════════════════════════════════════════════
   文件上传（作业照片、上课笔记、批改文件）和工资审核 / 结算
   依赖 app.js 里的工具和数据。
   ══════════════════════════════════════════════════════════════ */
const PURPOSE_LABEL = {hw: '作业', note: '上课笔记', grade: '批改', hwref: '作业图片'};
const fileUrl = f => `${SB_URL}/storage/v1/object/public/files/${f.path}`;
const filesOf = (ref, purpose) => (DB.files || []).filter(f => f.ref === ref && (!purpose || f.purpose === purpose));
const isImg = f => /^image\//.test(f.mime || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.path);

// 文件列表：照片显示小图，PDF 显示文件名；点开在新窗口看
function fileList(ref, purpose, label){
  const fs = filesOf(ref, purpose);
  if (!fs.length) return '';
  const canDel = f => isTop() || f.mine;   // 2026-11-19：按链接编号认是不是自己传的（同名不会认错）
  return `<div class="files">${label ? `<span class="muted xs">${label}</span>` : ''}${fs.map(f => `<span class="fitem">
    <a href="${fileUrl(f)}" target="_blank" rel="noopener" title="${esc(f.name)}">${isImg(f) ? `<img src="${fileUrl(f)}" alt="${esc(f.name)}" loading="lazy">` : `<span class="fpdf">PDF</span><span class="fname">${esc(f.name)}</span>`}</a>
    ${canDel(f) ? `<button class="fdel" data-act="file-del" data-v="${f.id}" aria-label="删除这个文件">×</button>` : ''}</span>`).join('')}</div>`;
}
// 上传按钮
function uploadBtn(purpose, ref, label, accept = 'image/*,.pdf,application/pdf'){
  const id = `up-${purpose}-${ref}`;
  return `<label class="btn sm" for="${id}" style="display:inline-block">${label}</label><input type="file" id="${id}" accept="${accept}" ${purpose === 'cvp' ? '' : 'multiple'} data-change="file-up" data-purpose="${purpose}" data-ref="${ref}" hidden>`;
}

// 照片上传前压缩：长边最多 1800 像素，转成 JPEG
async function shrink(file){
  if (!/^image\//.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg'});
  } catch(e) { return file; }   // 浏览器读不了（比如有些 HEIC），就原样上传
}
const MIME_BY_EXT = {pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif'};
async function uploadOne(file, purpose, ref){
  const f = await shrink(file), isCv = /^cv/.test(purpose), max = isCv ? 20 : 10;   // 老师履历的文件（cv / cvp / cvw）走单独的通道
  if (f.size > max * 1024 * 1024) throw new Error(`「${file.name}」超过 ${max}MB，请压缩后再传`);
  const ext = (f.name.split('.').pop() || '').toLowerCase() || (f.type === 'application/pdf' ? 'pdf' : 'jpg');
  const path = await rpc(isCv ? 'cv_ticket' : 'file_ticket', isCv ? {kind: purpose, tid: ref, ext} : {purpose, ref, ext});
  let r;
  try {
    r = await fetch(`${SB_URL}/storage/v1/object/files/${path}`, {
      method: 'POST', headers: {apikey: SB_KEY, 'Content-Type': f.type || MIME_BY_EXT[ext] || 'application/octet-stream', 'x-upsert': 'false'}, body: f,
    });
  } catch(e) { throw new Error(`「${file.name}」没传上去，网络不太稳定，请换个网络或稍后再试`); }
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch(e) {} throw new Error('上传没成功，请稍后再试' + (m ? `（${m}）` : '')); }
  await rpc(isCv ? 'cv_done' : 'file_done', {fpath: path, fname: file.name, fmime: f.type || MIME_BY_EXT[ext] || '', fsize: f.size});
}
document.addEventListener('change', async e => {
  const el = e.target;
  if (!el.dataset || el.dataset.change !== 'file-up' || !el.files.length) return;
  const files = [...el.files], purpose = el.dataset.purpose, ref = el.dataset.ref;
  document.body.classList.add('busy'); toast(`正在上传 ${files.length} 个文件…`);
  const fails = [];
  try {
    for (const f of files) { try { await uploadOne(f, purpose, ref); } catch(err) { fails.push(`「${f.name}」${err.message}`); } }
    try { await load(); render(); reopenModal(); } catch(err) {}
    if (fails.length) toast(`${files.length - fails.length} 个传上了，${fails.length} 个没传上：${fails.join('；')}。只要再选没传上的那几个就行`, true, 9000);
    else toast({hw: '作业已上传，老师能看到了', hwref: '作业图片已上传，学生能看到了', ck: '作品已上传', cv: '简历已上传', cvp: '照片已更新', cvw: '作品已上传'}[purpose] || '已上传，学生能看到了');
  } catch(err) { toast(err.message, true); }
  finally { document.body.classList.remove('busy'); el.value = ''; }
});

// 上传或删除后，如果是在弹窗里操作的，重新打开同一个弹窗
let lastModal = null;
function reopenModal(){ if (lastModal && document.querySelector('.modal')) lastModal(); }

/* ───────── 工资：审核 / 结算 ───────── */
const payOf = (tid, ym) => (DB.pay || []).find(p => p.teacher_id === tid && p.ym === ym && (p.book || 'K') === curBook()) || {};
// 这个月这位老师在哪几本账有课（「全部」视图里分开显示状态）
const payBooks = (tid, ym) => [...new Set(lsOfT(tid).filter(l => l.date.startsWith(ym) && paidH(l) > 0).map(l => stu(course(l.course_id).student_id).private ? 'mine' : 'K'))].sort();
const payOfBook = (tid, ym, bk) => (DB.pay || []).find(p => p.teacher_id === tid && p.ym === ym && (p.book || 'K') === bk) || {};
const payDone = (tid, ym, f) => isOwner() && S.book === 'all' ? (payBooks(tid, ym).length > 0 && payBooks(tid, ym).every(b => payOfBook(tid, ym, b)[f])) : !!payOf(tid, ym)[f];
function payBadge(tid, ym){
  if (isOwner() && S.book === 'all') return payBooks(tid, ym).map(b => { const p = payOfBook(tid, ym, b);
    return `<span class="tag ${p.settled_at ? 'ok' : p.reviewed_at ? 'blue' : 'mute'}">${b === 'mine' ? 'Panda' : 'K'}：${p.settled_at ? '已结算' : p.reviewed_at ? '已审核' : '未审核'}</span>`; }).join('');
  const p = payOf(tid, ym);
  return p.settled_at ? '<span class="tag ok">已结算</span>' : p.reviewed_at ? '<span class="tag blue">已审核</span>' : '<span class="tag mute">未审核</span>';
}
// 第 59 步：结算时把这个月这位老师的逐节明细存下来（时长、单价、金额），以后改了课也看得出当时发了多少
function payDetail(tid, ym){
  const rows = lsOfT(tid).filter(l => l.date.startsWith(ym) && paidH(l) > 0).map(l => { const c = course(l.course_id);
    return {id: l.id, sid: c.student_id, d: l.date, s: l.start, e: l.end, stu: stu(c.student_id).name, subj: c.subject, h: paidH(l), rate: c.rate || 0, cur: curOf(c), st: l.status}; });
  const amt = {}; rows.forEach(r => amt[r.cur] = (amt[r.cur] || 0) + curRound(r.h * r.rate, r.cur));
  return {v: 1, h: +rows.reduce((a, r) => a + r.h, 0).toFixed(2), amt, rows};
}
const payNum = x => Number.isFinite(+x) ? +x : 0, payCur = c => c === 'JPY' ? 'JPY' : 'CNY';   // 2026-11-21：明细里的数字一律当数字显示
const payAmtTxt = a => sumMoney(Object.entries(a && typeof a === 'object' ? a : {}).map(([c, v]) => [payNum(v), payCur(c)]));
// 结算以后又改了课（时长、单价、删课、补课）：和存下的明细比
function payDiff(tid, ym){
  if (isOwner() && S.book === 'all') return null;   // 「全部」视图把两本账加在一起，不和单本账的明细比
  const p = payOf(tid, ym); if (!p.settled_at || !p.snap || !Array.isArray(p.snap.rows)) return null;
  const was = p.snap, now = payDetail(tid, ym), key = r => [r.h, r.rate, r.cur].join('|');
  const wm = new Map(was.rows.map(r => [r.id, r])), nm = new Map(now.rows.map(r => [r.id, r]));
  const gone = was.rows.filter(r => !nm.has(r.id)), added = now.rows.filter(r => !wm.has(r.id)), changed = now.rows.filter(r => wm.has(r.id) && key(wm.get(r.id)) !== key(r));
  return gone.length || added.length || changed.length ? {was, now, gone, added, changed} : null;
}
const payDiffTag = (tid, ym) => payDiff(tid, ym) ? '<span class="tag seal">结算后有改动</span>' : '';
function payDiffBox(tid, ym){
  const x = payDiff(tid, ym); if (!x) return '';
  const one = r => `${esc(sMD(String(r.d || '')))} ${esc(r.s)} ${esc(r.stu)} ${esc(r.subj)} ${payNum(r.h)} 小时 × ${money(payNum(r.rate), payCur(r.cur))}`;
  return `<div class="note warn" style="margin-top:8px"><b>结算以后，这个月的课有改动。</b>结算时：${payAmtTxt(x.was.amt)}（${x.was.rows.length} 节 ${payNum(x.was.h)} 小时）；现在按课表算：${payAmtTxt(x.now.amt)}（${x.now.rows.length} 节 ${x.now.h} 小时）。
    ${x.gone.length ? `<div>结算时有、现在没有了：${x.gone.map(one).join('；')}</div>` : ''}${x.added.length ? `<div>结算以后多出来的：${x.added.map(one).join('；')}</div>` : ''}
    ${x.changed.length ? `<div>改了时长或单价：${x.changed.map(r => { const w = x.was.rows.find(y => y.id === r.id); return `${esc(sMD(String(r.d || '')))} ${esc(r.stu)} ${payNum(w.h)} 小时 × ${money(payNum(w.rate), payCur(w.cur))} → ${payNum(r.h)} 小时 × ${money(payNum(r.rate), payCur(r.cur))}`; }).join('；')}</div>` : ''}
    <div class="muted xs">已经发出去的按结算时的算。要按现在的重新算，点「撤销结算」再结算一次；或者差额放到下个月补。</div></div>`;
}
function payButtons(tid, ym){
  if (isOwner() && S.book === 'all') return '<span class="muted xs">右上角切到「Project K」或「Panda」再审核、结算</span>';
  const p = payOf(tid, ym);
  if (p.settled_at) return `<span class="muted xs">${esc(p.settled_by || '')} ${bjAt(p.settled_at).slice(5,10).replace('-','/')} 结算</span><button class="btn sm" data-act="pay" data-v="${tid}|${ym}|settled|0">撤销结算</button>`;
  if (p.reviewed_at) return `<span class="muted xs">${esc(p.reviewed_by || '')} 已审核</span><button class="btn gold sm" data-act="pay" data-v="${tid}|${ym}|settled|1">结算完成</button><button class="btn sm" data-act="pay" data-v="${tid}|${ym}|reviewed|0">撤销审核</button>`;
  return `<button class="btn pri sm" data-act="pay" data-v="${tid}|${ym}|reviewed|1">审核通过</button>`;
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const v = a.dataset.v;
  try {
    if (a.dataset.act === 'file-del') { e.preventDefault(); await act('file_delete', {fid: v}, '已删除'); reopenModal(); }
    if (a.dataset.act === 'pay') { e.stopPropagation(); const [tid, ym, what, on] = v.split('|');
      await act('pay_mark', {tid, month: ym, what, on_: on === '1', ...(isOwner() ? {ledger: curBook()} : {}), ...(what === 'settled' && on === '1' ? {detail: payDetail(tid, ym)} : {})}, what === 'settled' ? (on === '1' ? '已标记结算完成' : '已撤销结算') : (on === '1' ? '已审核' : '已撤销审核')); }
    if (a.dataset.act === 'makeup') { const [lid, on] = v.split('|'); await act('admin_update_lesson', {lid, d: {makeup: on === '1'}}, ME().role==='teacher' ? '已提交申请，教务批准后生效' : on === '1' ? '已标为补课' : '已取消补课标记'); lessonModal(lid); }
  } catch(err) { /* act() 已经提示过 */ }
});

/* ───────── 删除：课程、老师、私下备注、月度回访、链接 ───────── */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const v = a.dataset.v, k = a.dataset.act;
  if (!['course-del','teacher-del','note-del','rv-del','link-del'].includes(k)) return;
  try {
    if (k === 'course-del') {
      const c = course(v), n = DB.lessons.filter(l => l.course_id === v).length;
      if (!confirm(`删除「${stu(c.student_id).name} · ${tea(c.teacher_id).name} · ${c.subject}」这门课？` + (n ? `\n已经排好的 ${n} 节课也会一起删掉。` : ''))) return;
      await act('admin_delete_course', {cid: v}, '已删除这门课'); studentModal(c.student_id);
    }
    if (k === 'teacher-del') {
      if (!confirm(`删除老师「${tea(v).name}」？\n他的专属链接会一起失效。`)) return;
      await act('admin_delete_teacher', {tid: v}, '已删除'); closeModal();
    }
    if (k === 'note-del') {
      if (!confirm('删除这条备注？')) return;
      await act('note_delete', {nid: v}, '已删除'); reopenModal();
    }
    if (k === 'rv-del') {
      const [sid, ym] = v.split('|');
      if (!confirm(`删除 ${ymLabel(ym)} 的月度家长反馈？学生的自我评价也会一起删掉。`)) return;
      await act('review_delete', {sid, month: ym}, '已删除'); if (document.querySelector('.modal')) reopenModal();
    }
    if (k === 'link-del') {
      const p = (DB.people || []).find(x => x.id === v);
      if (!confirm(`删除「${p ? p.name : ''}」的专属链接？删掉后这条链接马上打不开。\n（只是想暂时不让用，点「停用」就行，以后还能恢复。）`)) return;
      await act('admin_link_delete', {pid: v}, '已删除');
    }
  } catch(err) { /* act() 已经提示过 */ }
});

/* ───────── 数据备份：把能看到的全部数据下载成一个文件 ───────── */
// 第 60 步：每天的自动存档有没有在跑
let BKS = null, BKS_AT = 0, BKS_ING = false;
async function bksLoad(){ try { BKS = await rpc('backup_status') || {}; } catch(e) { BKS = {err: e.message}; } BKS_AT = Date.now(); BKS_ING = false; if (S.page === 'sys' && S.sysTab === 'backup' && !document.querySelector('.modal')) render(); }
function bksLine(){
  if (!isTop()) return '';
  if (!BKS_ING && Date.now() - BKS_AT > 60000) { BKS_ING = true; setTimeout(bksLoad); }   // 一分钟内看过就不再问
  if (!BKS) return '<div class="muted small">正在看每天的自动存档…</div>';
  if (BKS.err) return `<div class="note warn">没查到每天自动存档的情况：${esc(BKS.err)}</div>`;
  const h = BKS.last ? (Date.now() - Date.parse(BKS.last)) / 3600e3 : Infinity, when = BKS.last ? bjAt(BKS.last) : '';
  const bad = BKS.job === 0 || h > 36;
  return `<div class="note ${bad ? 'warn' : ''}">服务器每天自动存一份全部数据（保留 14 天，误删时可以找回）。${BKS.last ? `最近一次：<b>${+when.slice(5,7)}月${+when.slice(8,10)}日 ${when.slice(11)}</b>（北京时间），最近 14 天存了 ${BKS.n14} 份。` : '<b>还没有自动存过。</b>'}
    ${BKS.job === 0 ? '<br><b>每天自动存档的定时任务没有在运行</b>，请告诉 Claude 检查。' : h > 36 ? '<br><b>已经超过一天半没有自动存档了</b>，请告诉 Claude 检查。' : ''}</div>`;
}
function pgBackup(){
  let last = ''; try { last = localStorage.getItem('jw_backup') || ''; } catch(e) {}
  const all = DB_ALL || DB;
  return `<div class="ph"><h2>数据备份</h2></div>
  ${bksLine()}
  <div class="note">上面的自动存档放在数据库里面，万一整个数据库出问题会一起没。所以还是建议<b>每周点一次</b>下面的按钮，把备份文件存到电脑或网盘里。万一数据被误删，可以拿这个文件找我恢复。</div>
  <section class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="stats"><div class="stat"><small>学生</small><b>${all.students.length}</b></div><div class="stat"><small>老师</small><b>${all.teachers.length}</b></div>
      <div class="stat"><small>课次</small><b>${all.lessons.length}</b></div><div class="stat"><small>课后反馈</small><b>${all.feedbacks.length}</b></div></div>
    <div class="row"><button class="btn pri" data-act="backup">导出全部数据（下载备份文件）</button>
      <span class="muted small">${last ? `上次导出：${esc(last)}` : '还没有导出过'}</span></div>
    <div class="muted xs">包括：学生、老师、课程、课表、反馈、作业、请假申请、月计划、成绩、出愿目标、月度家长反馈（含面谈原始纪要、任课老师说的）、跟进记录、通关点检表、院校库、链接、AI 写法要求、老师履历（照片和文件只记地址）、学生留言、单词记录、点检模板内容。<br>
      上传的照片和 PDF 本身不在这个文件里（文件里只记录它们的地址），照片仍然保存在服务器上。${isOwner() && S.book !== 'all' ? '<br><b>注意：</b>现在是「' + (S.book === 'mine' ? 'Panda' : 'Project K') + '」视图，导出的仍然是全部数据。' : ''}</div>
  </section>`;
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act="backup"]'); if (!a) return;
  document.body.classList.add('busy');
  try {
    // 2026-11-19：每一类都读到了才导出；有一类没读出来就不导出、不记「上次导出」
    let schools, checks;
    try { schools = await rpc('programs_load') || []; } catch(err) { throw new Error('院校库没读出来（' + err.message + '），请稍后再试'); }
    try { checks = await rpc('checks_load'); } catch(err) { throw new Error('通关点检表没读出来（' + err.message + '），请稍后再试'); }
    if (isAdmin()) { await rvxLoad(); if (!RVX.ok) throw new Error('面谈原始纪要没读出来，请稍后再试'); }
    const need = async (fn, label) => { try { return await rpc(fn); } catch(err) { throw new Error(label + '没读出来（' + err.message + '），请稍后再试'); } };
    const teacher_cv = await need('cv_load', '老师履历'), messages = await need('msg_load', '学生留言'), words = await need('word_load', '单词记录'), lesson_changes = await need('changes_load', '老师排课申请');
    const data = {exported_at: new Date().toISOString(), by: ME().name, system: '学生教务管理系统', data: Object.assign({}, DB_ALL || DB, {changes: lesson_changes}), checklists: checks, schools, review_raw: RVX.raw || [], ai_review_rules: RVX.rules || '', teacher_cv, messages, words,
      ...(isOwner() ? {ai_review_rules_mine: RVX.rules_mine || ''} : {})};
    const blob = new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'});
    const day = TODAY || new Date().toISOString().slice(0, 10);
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `教务系统备份_${day}.json`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    const stamp = `${day} ${new Date().toTimeString().slice(0, 5)}`;
    try { localStorage.setItem('jw_backup', stamp); } catch(err) {}
    toast('备份文件已经开始下载，下载好以后存到电脑或网盘'); render();
  } catch(err) { toast('导出没成功：' + err.message, true); }
  finally { document.body.classList.remove('busy'); }
});
