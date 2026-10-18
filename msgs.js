/* ══════════════════════════════════════════════════════════════
   「想和老师说的话」（学生留言，数据库第 31 步）
   · 学生：「我的」最上面写，选「只有教务老师能看到」或「教务老师和任课老师都能看到」；
           首页最下面有个入口；能看到自己写过的和「已读」
   · 教务：菜单「学生留言」——看、标已读、对任课老师屏蔽 / 取消屏蔽、删除
   · 任课老师：「我的学生」最上面，只看得到学生选了「任课老师也能看」、没被屏蔽的
   · 家长：看不到
   ══════════════════════════════════════════════════════════════ */
let MSGS = [];
async function msgLoad(){
  MSGS = [];
  if (!['admin','teacher','student','parent'].includes(DB.me.role)) return;
  try { MSGS = await rpc('msg_load') || []; } catch(e) { MSGS = []; }
}
const msgWhen = iso => { const t = new Date(iso).toLocaleString('sv-SE', {timeZone: 'Asia/Shanghai'}).slice(0, 16); return `${+t.slice(5,7)}/${+t.slice(8,10)} ${t.slice(11)}`; };
const msgUnread = () => ME().role === 'admin' ? msgShown().filter(m => !m.read_at).length : 0;
// 网页上能看到的留言（总管理切「Project K / Panda」时跟着筛）
const msgShown = () => MSGS.filter(m => DB.students.some(s => s.id === m.student_id) || ['student','parent'].includes(ME().role));
const msgWho = m => m.from_role === 'parent' ? '家长' : '学生';

/* ───────── 学生 ───────── */
function sMsgBox(s){
  const pr = ME().role === 'parent';
  return `<section class="card msg-box" id="m-msg"><h3 class="sh-h">想和老师说的话</h3>
    <div class="muted small">${pr ? '对孩子学习的想法、想了解的地方、希望调整的地方，都可以写在这里。' : '上课的感受、遇到的困难、想调整的地方，都可以写在这里。'}</div>
    <textarea id="msg-text" rows="4" maxlength="2000" placeholder="想说什么都可以，写完点「发送」"></textarea>
    <div class="msg-to">
      <label><input type="radio" name="msg-to" value="0" checked> 只有教务老师能看到</label>
      <label><input type="radio" name="msg-to" value="1"> 教务老师和任课老师都能看到</label>
    </div>
    <div class="row"><button class="btn pri" data-act="msg-send">发送</button></div>
    ${MSGS.length ? `<details class="msg-mine"><summary class="muted small">我写过的（${MSGS.length} 条）</summary>${MSGS.map(m => `<div class="msg-i">
      <div class="row xs"><span class="muted">${msgWhen(m.created_at)}</span><span class="muted">· ${m.to_teacher ? '教务和任课老师能看到' : '只有教务老师能看到'}</span>${m.read ? '<span class="tag ok" style="margin-left:auto">教务老师已读</span>' : ''}</div>
      <div class="msg-t">${esc(m.text)}</div></div>`).join('')}</details>` : ''}
  </section>`;
}
const sMsgEntry = () => `<button class="msg-entry" data-act="msg-go">${ME().role === 'parent' ? '对孩子的学习有什么想法？写给老师 ›' : '有什么想和老师说的？写在这里 ›'}</button>`;

/* ───────── 教务：「学生留言」页 ───────── */
function pgMsgs(){
  const list = msgShown(), un = list.filter(m => !m.read_at).length;
  return `<div class="ph"><h2>学生留言</h2>${un ? `<button class="btn sm" data-act="msg-all-read">全部标为已读（${un}）</button>` : ''}</div>${scopeNote()}
  <div class="note">学生和家长在自己的链接里写的「想和老师说的话」。学生写的家长看不到，家长写的学生看不到。学生选了「任课老师也能看到」的，那位学生的任课老师也看得到；不想让老师看的点「对任课老师屏蔽」。</div>
  ${list.length ? `<div class="list">${list.map(m => { const s = stu(m.student_id), toT = m.to_teacher && !m.hidden_by;
    return `<section class="card msg-a ${m.read_at ? '' : 'unread'}"><div class="row"><b>${esc(s.name)}${m.from_role === 'parent' ? '的家长' : ''}</b><span class="tag ${m.from_role === 'parent' ? 'gold' : 'mute'}">${msgWho(m)}写的</span><span class="muted small">${msgWhen(m.created_at)}</span>
        <span class="tag ${toT ? 'warn' : 'mute'}">${toT ? '任课老师也能看到' : m.to_teacher ? '已对任课老师屏蔽' : '只有教务能看到'}</span>
        ${m.read_at ? `<span class="muted xs" style="margin-left:auto">${esc(m.read_by || '')} 已读</span>` : '<span class="tag seal" style="margin-left:auto">未读</span>'}</div>
      <div class="msg-t">${esc(m.text)}</div>
      ${m.hidden_by ? `<div class="muted xs">${esc(m.hidden_by)} 对任课老师屏蔽了这条</div>` : ''}
      <div class="row">${m.read_at ? `<button class="btn sm" data-act="msg-do" data-v="${m.id}|unread">标为未读</button>` : `<button class="btn pri sm" data-act="msg-do" data-v="${m.id}|read">标为已读</button>`}
        ${m.to_teacher ? (m.hidden_by ? `<button class="btn sm" data-act="msg-do" data-v="${m.id}|unhide">取消屏蔽（任课老师又能看到）</button>` : `<button class="btn sm" data-act="msg-do" data-v="${m.id}|hide">对任课老师屏蔽</button>`) : ''}
        <button class="btn sm danger" style="margin-left:auto" data-act="msg-do" data-v="${m.id}|delete">删除</button></div></section>`; }).join('')}</div>`
    : '<div class="card empty">还没有学生留言</div>'}`;
}

/* ───────── 任课老师：「我的学生」最上面 ───────── */
function msgTeacherBox(){
  const list = msgShown().slice(0, 20);
  return list.length ? `<section class="card"><h3 style="font-size:15px">学生想和老师说的话</h3><div class="muted xs">学生或家长选了「任课老师也能看到」的留言。教务老师也能看到。</div>
    ${list.map(m => `<div class="msg-i"><div class="row xs"><b>${esc(stu(m.student_id).name)}${m.from_role === 'parent' ? '的家长' : ''}</b><span class="muted">${msgWhen(m.created_at)}</span></div><div class="msg-t">${esc(m.text)}</div></div>`).join('')}</section>` : '';
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act; if (!k.startsWith('msg-')) return;
  try {
    if (k === 'msg-go') { S.tab = 'e'; render(); setTimeout(() => document.getElementById('m-msg')?.scrollIntoView({block: 'start'}), 50); }
    if (k === 'msg-send') {
      const txt = val('msg-text').trim(), toT = document.querySelector('input[name="msg-to"]:checked')?.value === '1';
      if (!txt) { toast('先写点什么再发送', true); return; }
      if (toT && !confirm('这条留言你选了「任课老师也能看到」，确定发送吗？')) return;
      await act('msg_send', {txt, to_teacher: toT}, toT ? '已发送，教务老师和任课老师能看到' : '已发送，只有教务老师能看到');
    }
    if (k === 'msg-do') {
      const [id, what] = a.dataset.v.split('|');
      if (what === 'delete' && !confirm('删除这条留言？删掉后学生那边也看不到了，不能恢复。')) return;
      await act('msg_admin', {mid: id, what}, {read: '已标为已读', unread: '已标为未读', hide: '已屏蔽，任课老师看不到这条了', unhide: '已取消屏蔽', delete: '已删除'}[what]);
    }
    if (k === 'msg-all-read') {
      const ids = msgShown().filter(m => !m.read_at).map(m => m.id);
      document.body.classList.add('busy');
      try { for (const id of ids) await rpc('msg_admin', {mid: id, what: 'read'}); } finally { document.body.classList.remove('busy'); }
      await load(); render(); toast(`已把 ${ids.length} 条标为已读`);
    }
  } catch(err) { /* act() 已经提示过 */ }
});
