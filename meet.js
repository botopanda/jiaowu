/* ══════════════════════════════════════════════════════════════
   老师的上课链接（腾讯会议）（2026-11-18，数据库第 50 步）
   · 老师：自己链接的「我的」最上面填；可以把腾讯会议的整段邀请直接粘贴进来，自动挑出链接和会议号
   · 教务管理：「老师档案」卡片上点「上课链接」替老师填
   · 学生：首页「下一节课」、课表里当天的课、「我的 → 我的老师」、电脑左侧「我的老师」都有「进入腾讯会议」
   ══════════════════════════════════════════════════════════════ */

// 只认 https:// 开头的链接（数据库也会挡一次）
const meetOk = t => !!(t && typeof t.meet_url === 'string' && /^https:\/\/[^\s<>"'`]+$/.test(t.meet_url));
const meetName = t => /tencent|voovmeeting/i.test(t.meet_url || '') ? '腾讯会议' : '上课链接';
const MEET_IC = '<svg class="meet-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>';
// 「进入腾讯会议」按钮（新窗口打开）；withNote：后面带上会议号 / 密码
function meetBtn(t, o = {}){
  if (!meetOk(t)) return o.empty || '';
  return `<span class="meet-wrap"><a class="btn gold ${o.big ? '' : 'sm'} meet-go" href="${esc(t.meet_url)}" target="_blank" rel="noopener noreferrer">${MEET_IC}${o.label || '进入' + meetName(t)}</a>${o.withNote !== false && t.meet_note ? `<span class="muted xs meet-note">${esc(t.meet_note)}</span>` : ''}</span>`;
}

// 粘贴整段腾讯会议邀请：挑出链接、会议号、密码
function meetParse(txt){
  const s = String(txt || '');
  const url = (s.match(/https:\/\/[^\s<>"'`，。、；）)】]+/) || [''])[0];
  const no = (s.match(/(?:#腾讯会议|会议号|会议 ?ID|Meeting ID)[：:\s]*(\d[\d\s-]{6,16}\d)/i) || [])[1];
  const pw = (s.match(/(?:会议密码|入会密码|密码)[：:\s]*([A-Za-z0-9]{3,12})/) || [])[1];
  return {url, note: [no ? `会议号 ${no.replace(/\s+/g, ' ').trim()}` : '', pw ? `密码 ${pw}` : ''].filter(Boolean).join('，')};
}

// 填写表单（老师自己用 tid 为空；教务替老师填带上 tid）
const meetForm = (t, tid) => `
  <label class="field"><span>会议链接</span><input type="text" id="mt-url" inputmode="url" autocomplete="off" value="${esc(t.meet_url || '')}" placeholder="https://meeting.tencent.com/…（整段邀请直接粘贴也行）"></label>
  <label class="field"><span>会议号 / 密码（可以不填）</span><input type="text" id="mt-note" autocomplete="off" maxlength="120" value="${esc(t.meet_note || '')}" placeholder="例：会议号 123 456 789，密码 1234"></label>
  <div class="row"><button class="btn pri sm" data-act="mt-save" data-v="${tid || ''}">保存</button>${meetOk(t) ? `${meetBtn(t, {label: '打开试试', withNote: false})}<button class="btn sm danger" data-act="mt-clear" data-v="${tid || ''}">清空</button>` : ''}</div>`;

// 老师「我的」最上面
function meetSelfCard(t){
  return `<section class="card meet-card"><div class="row"><h3 style="font-size:16px;margin-right:auto">${MEET_IC}我的上课链接</h3>${meetOk(t) ? '<span class="tag ok">已填</span>' : '<span class="tag warn">还没填</span>'}</div>
  <div class="muted xs">填好后，学生在自己的页面上点「进入腾讯会议」就能进你的会议室。建议填腾讯会议里固定不变的会议室链接（比如「个人会议室」），就不用每节课换。可以把腾讯会议的整段邀请直接粘贴进来，会自动挑出链接和会议号。</div>
  ${meetForm(t, '')}</section>`;
}

// 教务：老师档案卡片上「上课链接」
function meetModal(tid){
  const t = tea(tid);
  openModal(`${mHead(`${esc(t.name)} · 上课链接`)}
  <div class="muted xs">学生在自己的页面上会看到「进入腾讯会议」按钮（只有上这位老师课的学生和家长看得到）。老师也可以在自己链接的「我的」里填。</div>
  ${meetForm(t, tid)}`);
}

// 学生「我的」里：我的老师和上课链接
function meetTeacherList(s){
  const by = {};
  DB.courses.filter(c => c.student_id === s.id && c.active !== false).forEach(c => (by[c.teacher_id] ??= []).push(c.subject));
  const ids = Object.keys(by);
  if (!ids.length) return '';
  return `<h3 class="sh-sec" id="m-teacher">${PRO() ? '孩子的老师' : '我的老师'}</h3>
  <div class="sx-list meet-list">${ids.map(tid => { const t = tea(tid);
    return `<div class="meet-row"><div class="grow"><b>${esc(tName(tid))}</b> <span class="muted small">${by[tid].map(esc).join('、')}</span></div>${PRO() ? (meetOk(t) ? '<span class="muted xs">有上课链接</span>' : '') : meetBtn(t, {empty: '<span class="muted xs">老师还没填上课链接</span>'})}</div>`; }).join('')}</div>`;
}

// 粘贴整段邀请：自动拆开填好
document.addEventListener('paste', e => {
  if (e.target?.id !== 'mt-url') return;
  const txt = e.clipboardData?.getData('text') || '', m = meetParse(txt);
  if (!m.url || txt.trim() === m.url) return;
  e.preventDefault(); e.target.value = m.url;
  const n = document.getElementById('mt-note'); if (n && !n.value.trim() && m.note) n.value = m.note;
});

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act, v = a.dataset.v || '';
  if (k === 'mt-open') meetModal(v);
  if (k === 'mt-save' || k === 'mt-clear') {
    let url = k === 'mt-clear' ? '' : val('mt-url').trim(), note = k === 'mt-clear' ? '' : val('mt-note').trim();
    if (url && !/^https:\/\//.test(url)) { const m = meetParse(url); if (m.url) { url = m.url; if (!note) note = m.note; } }   // 手机上粘贴整段邀请时也拆开
    if (url && !/^https:\/\/[^\s<>"'`]+$/.test(url)) { toast('会议链接要以 https:// 开头，请直接复制腾讯会议里的会议链接', true); return; }
    if (k === 'mt-clear' && !confirm('清空上课链接？学生那边的「进入腾讯会议」按钮会消失。')) return;
    try {
      await act('teacher_meet_save', {tid: v || null, url, note}, url ? '已保存，学生那边能看到「进入腾讯会议」了' : '已清空');
      if (v) closeModal();
    } catch (err) {}
  }
});
