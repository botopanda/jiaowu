/* ══════════════════════════════════════════════════════════════
   文件上传（作业照片、上课笔记、批改文件）和工资审核 / 结算
   依赖 app.js 里的工具和数据。
   ══════════════════════════════════════════════════════════════ */
const PURPOSE_LABEL = {hw: '作业', note: '上课笔记', grade: '批改'};
const fileUrl = f => `${SB_URL}/storage/v1/object/public/files/${f.path}`;
const filesOf = (ref, purpose) => (DB.files || []).filter(f => f.ref === ref && (!purpose || f.purpose === purpose));
const isImg = f => /^image\//.test(f.mime || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.path);

// 文件列表：照片显示小图，PDF 显示文件名；点开在新窗口看
function fileList(ref, purpose, label){
  const fs = filesOf(ref, purpose);
  if (!fs.length) return '';
  const canDel = f => isTop() || f.uploaded_by === ME().name;
  return `<div class="files">${label ? `<span class="muted xs">${label}</span>` : ''}${fs.map(f => `<span class="fitem">
    <a href="${fileUrl(f)}" target="_blank" rel="noopener" title="${esc(f.name)}">${isImg(f) ? `<img src="${fileUrl(f)}" alt="${esc(f.name)}" loading="lazy">` : `<span class="fpdf">PDF</span><span class="fname">${esc(f.name)}</span>`}</a>
    ${canDel(f) ? `<button class="fdel" data-act="file-del" data-v="${f.id}" aria-label="删除这个文件">×</button>` : ''}</span>`).join('')}</div>`;
}
// 上传按钮
function uploadBtn(purpose, ref, label){
  const id = `up-${purpose}-${ref}`;
  return `<label class="btn sm" for="${id}" style="display:inline-block">${label}</label><input type="file" id="${id}" accept="image/*,.pdf,application/pdf" multiple data-change="file-up" data-purpose="${purpose}" data-ref="${ref}" hidden>`;
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
async function uploadOne(file, purpose, ref){
  const f = await shrink(file);
  if (f.size > 10 * 1024 * 1024) throw new Error(`「${file.name}」超过 10MB，请压缩后再传`);
  const ext = (f.name.split('.').pop() || '').toLowerCase() || (f.type === 'application/pdf' ? 'pdf' : 'jpg');
  const path = await rpc('file_ticket', {purpose, ref, ext});
  const r = await fetch(`${SB_URL}/storage/v1/object/files/${path}`, {
    method: 'POST', headers: {apikey: SB_KEY, 'Content-Type': f.type || 'application/octet-stream', 'x-upsert': 'false'}, body: f,
  });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch(e) {} throw new Error('上传没成功，请稍后再试' + (m ? `（${m}）` : '')); }
  await rpc('file_done', {fpath: path, fname: file.name, fmime: f.type, fsize: f.size});
}
document.addEventListener('change', async e => {
  const el = e.target;
  if (!el.dataset || el.dataset.change !== 'file-up' || !el.files.length) return;
  const files = [...el.files], purpose = el.dataset.purpose, ref = el.dataset.ref;
  document.body.classList.add('busy'); toast(`正在上传 ${files.length} 个文件…`);
  try {
    for (const f of files) await uploadOne(f, purpose, ref);
    await load(); render(); reopenModal();
    toast(purpose === 'hw' ? '作业已上传，老师能看到了' : '已上传，学生能看到了');
  } catch(err) { toast(err.message, true); }
  finally { document.body.classList.remove('busy'); el.value = ''; }
});

// 上传或删除后，如果是在弹窗里操作的，重新打开同一个弹窗
let lastModal = null;
function reopenModal(){ if (lastModal && document.querySelector('.modal')) lastModal(); }

/* ───────── 工资：审核 / 结算 ───────── */
const payOf = (tid, ym) => (DB.pay || []).find(p => p.teacher_id === tid && p.ym === ym) || {};
function payBadge(tid, ym){
  const p = payOf(tid, ym);
  return p.settled_at ? '<span class="tag ok">已结算</span>' : p.reviewed_at ? '<span class="tag blue">已审核</span>' : '<span class="tag mute">未审核</span>';
}
function payButtons(tid, ym){
  const p = payOf(tid, ym);
  if (p.settled_at) return `<span class="muted xs">${esc(p.settled_by || '')} ${p.settled_at.slice(5,10).replace('-','/')} 结算</span><button class="btn sm" data-act="pay" data-v="${tid}|${ym}|settled|0">撤销结算</button>`;
  if (p.reviewed_at) return `<span class="muted xs">${esc(p.reviewed_by || '')} 已审核</span><button class="btn gold sm" data-act="pay" data-v="${tid}|${ym}|settled|1">结算完成</button><button class="btn sm" data-act="pay" data-v="${tid}|${ym}|reviewed|0">撤销审核</button>`;
  return `<button class="btn pri sm" data-act="pay" data-v="${tid}|${ym}|reviewed|1">审核通过</button>`;
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const v = a.dataset.v;
  try {
    if (a.dataset.act === 'file-del') { e.preventDefault(); await act('file_delete', {fid: v}, '已删除'); reopenModal(); }
    if (a.dataset.act === 'pay') { e.stopPropagation(); const [tid, ym, what, on] = v.split('|');
      await act('pay_mark', {tid, month: ym, what, on_: on === '1'}, what === 'settled' ? (on === '1' ? '已标记结算完成' : '已撤销结算') : (on === '1' ? '已审核' : '已撤销审核')); }
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
      if (!confirm(`删除 ${ymLabel(ym)} 的月度回访？学生的自我评价也会一起删掉。`)) return;
      await act('review_delete', {sid, month: ym}, '已删除'); if (document.querySelector('.modal')) reopenModal();
    }
    if (k === 'link-del') {
      const p = (DB.people || []).find(x => x.id === v);
      if (!confirm(`删除「${p ? p.name : ''}」的专属链接？删掉后这条链接马上打不开。\n（只是想暂时不让用，点「停用」就行，以后还能恢复。）`)) return;
      await act('admin_link_delete', {pid: v}, '已删除');
    }
  } catch(err) { /* act() 已经提示过 */ }
});
