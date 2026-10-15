/* 老师履历预览（确认后正式上线；这个文件不在加载清单里） */
/* ══════════════════════════════════════════════════════════════
   老师履历（数据库第 23 步）—— 只有教务和老师本人看得到，学生、家长拿不到
   · 名片：照片、日文名、一句话、标签、性别 / 生日 / 电话 / 邮箱
   · 学历、工作经历：可以加好几条，每条都能删
   · 上传：照片 1 张、简历原件（PDF / Word / 图片）最多 5 个、代表作品最多 12 个
   · 教务：老师档案卡片 →「履历」弹窗；老师：「我的」页
   ══════════════════════════════════════════════════════════════ */
let CVS = {};   // 老师 id → {cv, files}
async function cvLoad(){
  CVS = {};
  if (!['admin','teacher'].includes(DB.me.role)) return;
  try { CVS = await rpc('cv_load') || {}; } catch(e) { CVS = {}; }
}
const cvOf = tid => (CVS[tid] && CVS[tid].cv) || {};
const cvFiles = (tid, kind) => ((CVS[tid] && CVS[tid].files) || []).filter(f => f.kind === kind);
const cvAge = b => { if (!/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return ''; const [y, m, d] = b.split('-').map(Number), [ty, tm, td] = TODAY.split('-').map(Number); return ty - y - ((tm < m || (tm === m && td < d)) ? 1 : 0); };
const cvSize = n => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const cvExt = f => (f.name.split('.').pop() || '').toUpperCase().slice(0, 4);

// 头像：有照片用照片，没有就用名字最后一个字
function cvPhoto(t, big){
  const p = cvFiles(t.id, 'cvp')[0];
  return p ? `<a class="cv-ph ${big || ''}" href="${fileUrl(p)}" target="_blank" rel="noopener"><img src="${fileUrl(p)}" alt="${esc(t.name)}的照片"></a>`
           : `<span class="cv-ph ${big || ''} none">${esc((t.name || '?').replace('老师', '').slice(-1))}</span>`;
}
// 老师档案卡片上的一小段摘要
function cvBrief(t){
  const c = cvOf(t.id), e = (c.edu || [])[0], j = (c.jobs || [])[0], n = cvFiles(t.id, 'cv').length;
  return `<dt>学历</dt><dd>${e ? esc([e.school, e.degree].filter(Boolean).join(' · ')) : '<span class="muted">还没填</span>'}</dd>
    <dt>最近工作</dt><dd>${j ? esc([j.org, j.role].filter(Boolean).join(' · ')) : '<span class="muted">还没填</span>'}</dd>
    <dt>简历原件</dt><dd>${n ? `<span class="tag ok">已上传 ${n} 个</span>` : '<span class="muted">还没上传</span>'}</dd>`;
}
function cvFileRow(f){
  return `<div class="cv-file"><a href="${fileUrl(f)}" target="_blank" rel="noopener"><span class="fpdf">${esc(cvExt(f))}</span><span class="cv-fn">${esc(f.name)}</span></a>
    <span class="muted xs">${cvSize(f.size || 0)} · ${esc(f.uploaded_by)} ${String(f.created_at).slice(0, 10)}</span>
    <button class="btn sm danger" data-act="cv-fdel" data-v="${f.id}">删除</button></div>`;
}
const cvEntry = (title, sub, period, note) => `<div class="cv-i"><div class="cv-p">${esc(period || '')}</div><div class="cv-b"><b>${esc(title || '')}</b>${sub ? `<div class="cv-r">${esc(sub)}</div>` : ''}${note ? `<div class="cv-n">${esc(note)}</div>` : ''}</div></div>`;

// 整份履历（只读）＋ 上传
function cvView(t){
  const c = cvOf(t.id), cvs = cvFiles(t.id, 'cv'), works = cvFiles(t.id, 'cvw'), age = cvAge(c.birthday);
  const info = [['性别', c.gender], ['生日', c.birthday ? `${c.birthday}${age !== '' ? `（${age} 岁）` : ''}` : ''], ['电话', c.phone], ['邮箱', c.email]].filter(x => x[1]);
  const empty = !c.tagline && !(c.edu || []).length && !(c.jobs || []).length;
  return `<section class="card cv-head">${cvPhoto(t, 'big')}
    <div class="cv-id"><div class="cv-name">${esc(t.name)}${c.ja ? `<span class="muted">${esc(c.ja)}</span>` : ''}</div>
      ${c.tagline ? `<div class="cv-tl">${esc(c.tagline)}</div>` : ''}
      ${(c.tags || []).length ? `<div class="cv-tags">${c.tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      ${info.length ? `<dl class="kv small cv-info">${info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      <div class="row" style="margin-top:6px">${uploadBtn('cvp', t.id, cvFiles(t.id, 'cvp').length ? '换照片' : '上传照片', 'image/*')}<button class="btn pri sm" data-act="cv-edit" data-v="${t.id}">编辑履历</button></div>
    </div></section>
  ${empty ? `<div class="note">履历还没填。点「编辑履历」按块填写；手上有电子版简历的，先在「简历原件」里传上来。</div>` : ''}
  <div class="cv-grid">
    <div class="cv-col">
      <section class="card"><h3 class="cv-h">工作经历</h3>${(c.jobs || []).length ? c.jobs.map(j => cvEntry(j.org, j.role, j.period, j.note)).join('') : '<div class="muted small">还没填</div>'}</section>
    </div>
    <div class="cv-col">
      <section class="card"><div class="row"><h3 class="cv-h" style="margin-right:auto">简历原件</h3>${uploadBtn('cv', t.id, '上传简历', 'image/*,.pdf,application/pdf,.doc,.docx')}</div>
        <div class="muted xs">PDF、Word、图片都可以，一个文件最大 20MB。</div>
        ${cvs.length ? cvs.map(cvFileRow).join('') : '<div class="muted small" style="margin-top:6px">还没上传</div>'}</section>
      <section class="card"><h3 class="cv-h">学历</h3>${(c.edu || []).length ? c.edu.map(e => cvEntry(e.school, e.degree, e.period, e.note)).join('') : '<div class="muted small">还没填</div>'}</section>
      <section class="card"><div class="row"><h3 class="cv-h" style="margin-right:auto">代表作品</h3>${uploadBtn('cvw', t.id, '上传作品')}</div>
        ${works.length ? `<div class="cv-works">${works.map(f => `<span class="fitem"><a href="${fileUrl(f)}" target="_blank" rel="noopener" title="${esc(f.name)}">${isImg(f) ? `<img src="${fileUrl(f)}" alt="${esc(f.name)}" loading="lazy">` : `<span class="fpdf">PDF</span><span class="fname">${esc(f.name)}</span>`}</a><button class="fdel" data-act="cv-fdel" data-v="${f.id}" aria-label="删除这个作品">×</button></span>`).join('')}</div>` : '<div class="muted small">还没上传</div>'}</section>
      ${c.memo ? `<section class="card"><h3 class="cv-h">备注</h3><div class="cv-n">${esc(c.memo)}</div></section>` : ''}
    </div>
  </div>
  <div class="muted xs">履历只有教务和老师本人看得到，学生和家长看不到。</div>`;
}
// 教务：老师档案卡片上点「履历」
function cvModal(tid){
  const t = tea(tid); lastModal = () => cvModal(tid);
  openModal(`${mHead(`${esc(t.name)} · 履历`)}${cvView(t)}`, 'xl');
}

/* ───────── 编辑：按块填写，学历 / 工作经历可以加好几条 ───────── */
let CVF = null;   // 正在编辑的 {tid, d}
const CV_EDU = [['school','学校'],['period','时间','例：2019–2023'],['degree','学位 / 专业'],['note','说明']];
const CV_JOB = [['org','单位'],['period','时间','例：2024.12–至今'],['role','职位'],['note','说明']];
function cvRead(){
  if (!CVF || !document.getElementById('cvf-ja')) return;
  const d = CVF.d;
  ['ja','tagline','gender','birthday','phone','email','memo'].forEach(k => d[k] = val('cvf-' + k).trim());
  d.tags = val('cvf-tags').split(/[、，,\s]+/).map(x => x.trim()).filter(Boolean);
  ['edu','jobs'].forEach(g => (d[g] || []).forEach((e, i) => (g === 'edu' ? CV_EDU : CV_JOB).forEach(([k]) => e[k] = val(`cvf-${g}-${i}-${k}`).trim())));
}
function cvBlock(g, fields, label){
  const list = CVF.d[g] || [];
  return `<div class="cv-eg"><div class="row"><b style="margin-right:auto">${label}</b><button class="btn sm" data-act="cv-add" data-v="${g}">＋ 加一条</button></div>
    ${list.length ? list.map((e, i) => `<div class="cv-ei"><div class="row"><span class="muted xs" style="margin-right:auto">第 ${i + 1} 条</span>
      ${i ? `<button class="btn sm" data-act="cv-up" data-v="${g}|${i}" aria-label="往上移">↑</button>` : ''}<button class="btn sm danger" data-act="cv-del" data-v="${g}|${i}">删除这条</button></div>
      <div class="fields">${fields.filter(f => f[0] !== 'note').map(([k, t, ph]) => `<label class="field"><span>${t}</span><input type="text" id="cvf-${g}-${i}-${k}" value="${esc(e[k] || '')}" ${ph ? `placeholder="${ph}"` : ''}></label>`).join('')}</div>
      <label class="field"><span>说明</span><textarea id="cvf-${g}-${i}-note" rows="3">${esc(e.note || '')}</textarea></label></div>`).join('')
      : '<div class="muted small">还没有，点「＋ 加一条」。</div>'}</div>`;
}
function cvForm(){
  const t = tea(CVF.tid), d = CVF.d;
  lastModal = cvForm;
  openModal(`${mHead(`编辑履历 · ${esc(t.name)}`)}
  <div class="fields"><label class="field"><span>日文名 / 读音</span><input type="text" id="cvf-ja" value="${esc(d.ja || '')}" placeholder="例：チン イケン"></label>
    <label class="field"><span>性别</span><input type="text" id="cvf-gender" value="${esc(d.gender || '')}"></label>
    <label class="field"><span>生日</span><input type="date" id="cvf-birthday" value="${esc(d.birthday || '')}"></label></div>
  <label class="field"><span>一句话介绍</span><input type="text" id="cvf-tagline" value="${esc(d.tagline || '')}" placeholder="例：擅长漫画、角色设计与古风技法"></label>
  <label class="field"><span>标签（用顿号或空格隔开）</span><input type="text" id="cvf-tags" value="${esc((d.tags || []).join('、'))}" placeholder="例：漫画、角色设计、分镜"></label>
  <div class="fields"><label class="field"><span>电话</span><input type="tel" id="cvf-phone" value="${esc(d.phone || '')}"></label>
    <label class="field"><span>邮箱</span><input type="email" id="cvf-email" value="${esc(d.email || '')}"></label></div>
  ${cvBlock('jobs', CV_JOB, '工作经历（新的放上面）')}
  ${cvBlock('edu', CV_EDU, '学历')}
  <label class="field"><span>备注</span><textarea id="cvf-memo" rows="2">${esc(d.memo || '')}</textarea></label>
  <div class="row"><button class="btn pri" data-act="cv-save">保存履历</button><button class="btn" data-act="cv-cancel">不保存，返回</button></div>`, 'wide');
}
const cvBack = tid => { CVF = null; if (ME().role === 'teacher') closeModal(); else cvModal(tid); };

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v;
  if (!k.startsWith('cv-')) return;
  try {
    if (k === 'cv-open') cvModal(v);
    if (k === 'cv-edit') { CVF = {tid: v, d: JSON.parse(JSON.stringify(cvOf(v)))}; cvForm(); }
    if (k === 'cv-add') { cvRead(); (CVF.d[v] ??= []).push({}); cvForm(); }
    if (k === 'cv-del') { cvRead(); const [g, i] = v.split('|'); const e0 = CVF.d[g][+i];
      if (Object.values(e0).some(x => x) && !confirm('删除这一条？（点「保存履历」后才真正删掉）')) return;
      CVF.d[g].splice(+i, 1); cvForm(); }
    if (k === 'cv-up') { cvRead(); const [g, i] = v.split('|'), L_ = CVF.d[g]; [L_[+i - 1], L_[+i]] = [L_[+i], L_[+i - 1]]; cvForm(); }
    if (k === 'cv-cancel') cvBack(CVF.tid);
    if (k === 'cv-save') { cvRead(); const tid = CVF.tid;
      await act('cv_save', {tid, d: CVF.d}, '履历已保存'); cvBack(tid); }
    if (k === 'cv-fdel') { if (!confirm('删除这个文件？删掉后找不回来。')) return;
      await act('cv_file_delete', {fid: v}, '已删除'); reopenModal(); }
  } catch(err) { /* act() 已经提示过 */ }
});

function pgTeachers(){
  return `<div class="ph"><h2>老师档案</h2><button class="btn pri" data-act="teacher-form">＋ 新增老师</button></div>
  <div class="hint">点「履历」看、填老师的简历和资料（学生和家长看不到）；老师也可以在自己链接的「我的」里填。</div>
  ${DB.teachers.length ? `<div class="grid2 cards-fix">${DB.teachers.map(t => { const cs = DB.courses.filter(c=>c.teacher_id===t.id), ym = TODAY.slice(0,7);
    const ms = lsOfT(t.id).filter(l=>l.date.startsWith(ym)), p = teacherRealLink(t);
    const done = ms.filter(l=>paidH(l)>0), plan = ms.filter(l=>l.status==='scheduled'), pn = ms.filter(isPend).length;
    const hDone = +done.reduce((a,l)=>a+paidH(l),0).toFixed(1), hPlan = +plan.reduce((a,l)=>a+dur(l),0).toFixed(1);
    const names = [...new Set(cs.map(c=>stu(c.student_id).name))];
    return `<section class="card"><div class="row" style="margin-bottom:6px">${cvPhoto(t, 'sm')}<h3 style="margin-right:auto;font-size:16px">${esc(t.name)} ${tBookTag(t)}</h3>${t.subject?subjTag(t.subject):''}${t.loc?`<span class="tag mute">${esc(t.loc)}</span>`:''}</div>
    ${cvOf(t.id).tagline ? `<div class="small" style="margin:-2px 0 6px">${esc(cvOf(t.id).tagline)}</div>` : ''}
    <dl class="kv small">${cvBrief(t)}
    <dt>带的学生</dt><dd>${names.map(esc).join('、')||'—'}</dd>
    <dt>本月已上</dt><dd><b class="num">${hDone}</b> 小时 <span class="muted xs">（${done.length} 节）</span>${pn?` <span class="tag warn">${pn} 节待确认</span>`:''}</dd>
    <dt>本月应上</dt><dd><b class="num">${hPlan}</b> 小时 <span class="muted xs">（${plan.length} 节）</span></dd></dl>
    <div class="row" style="margin-top:8px"><button class="btn pri sm" data-act="cv-open" data-v="${t.id}">履历</button><button class="btn sm" data-act="teacher-form" data-v="${t.id}">编辑</button>${p?`<button class="btn sm" data-act="copy-link" data-v="${p.key}">复制老师链接</button>`:''}${ownerFullLinkBtn(t)}</div></section>`}).join('')}</div>` : '<div class="card empty">还没有老师。点右上角「新增老师」开始。</div>'}`;
}


function tMe(t){
  const ls = lsOfT(t.id).filter(l=>l.date.startsWith(S.teaMonth) && paidH(l)>0), h = ls.reduce((a,l)=>a+paidH(l),0);
  const months = [TODAY.slice(0,7), ymShift(TODAY.slice(0,7),-1), ymShift(TODAY.slice(0,7),-2)];
  return `<h3 class="dg" style="margin-top:0">我的履历</h3>${cvView(t)}
  <section class="card"><div class="row" style="margin-bottom:4px"><h3 style="font-size:16px;margin-right:auto">课时记录</h3><select id="tea-m" data-change="team">${months.map(v=>`<option value="${v}" ${v===S.teaMonth?'selected':''}>${ymLabel(v)}</option>`).join('')}</select></div>
  <div class="muted xs" style="margin-bottom:4px">自动记录，不用再整理清单发给教务。${ls.length?` 这个月：${payBadge(t.id, S.teaMonth)}`:''}</div>
  ${ls.length?`<div class="list">${ls.map(l=>`<div class="li small"><span class="num">${sMD(l.date)}</span><span class="num">${timeFor(l,t.tz)}</span><span class="grow">${esc(stu(course(l.course_id).student_id).name)}</span><span class="num">${paidH(l)}h</span>${l.status==='leave'?'<span class="tag seal">请假</span>':''}</div>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:4px"><b class="num">共 ${h} 小时</b></div>`:'<div class="empty">这个月还没有上完的课</div>'}</section>`;
}

function teacherForm(id){
  const t = id ? tea(id) : {name:'', subject:'', loc:'', tz:'JP', edu:'', exp:'', good:'', active:true};
  openModal(`${mHead(id?'编辑老师':'新增老师')}
  <div class="fields"><label class="field"><span>姓名 *</span><input type="text" id="tf-name" value="${esc(t.name)}" placeholder="例：陆老师"></label>
  <label class="field"><span>主要科目</span><input type="text" id="tf-subject" value="${esc(t.subject)}" placeholder="可以从列表选，也可以直接写" list="subj-list"><datalist id="subj-list">${SUBJECTS.map(x => `<option value="${x}">`).join('')}</datalist></label>
  <label class="field"><span>所在地</span><input type="text" id="tf-loc" value="${esc(t.loc)}" placeholder="例：北京"></label>
  <input type="hidden" id="tf-tz" value="CN">
  ${id?`<label class="field"><span>状态</span><select id="tf-active"><option value="true" ${t.active?'selected':''}>在职</option><option value="false" ${t.active?'':'selected'}>离职</option></select></label>`:''}</div>
  ${id ? '<div class="muted xs">学历、工作经历、简历原件在老师卡片上的「履历」里填。</div>' : ''}
  ${id?'<div class="muted xs">老师离职后，记得到「链接与权限」里停用他的链接。</div>':'<div class="muted xs">保存后会自动生成这位老师的专属链接。</div>'}
  ${ownerTeacherField(t)}
  <div class="row"><button class="btn pri" data-act="save-teacher" data-v="${id||''}">保存</button>${id && isTop()?`<button class="btn danger sm" style="margin-left:auto" data-act="teacher-del" data-v="${id}">删除这位老师</button>`:''}</div>`);
}

function uploadBtn(purpose, ref, label, accept = 'image/*,.pdf,application/pdf'){
  const id = `up-${purpose}-${ref}`;
  return `<label class="btn sm" for="${id}" style="display:inline-block">${label}</label><input type="file" id="${id}" accept="${accept}" ${purpose === 'cvp' ? '' : 'multiple'} data-change="file-up" data-purpose="${purpose}" data-ref="${ref}" hidden>`;
}

// 照片上传前压缩：长边最多 1800 像素，转成 JPEG

window.__cvPreview = 2;
