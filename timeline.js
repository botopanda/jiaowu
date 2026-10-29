/* ══════════════════════════════════════════════════════════════
   学生档案「按时间看」（2026-10-28）
   · 选一段时间（本月 / 上个月 / 近 3 个月 / 全部 / 自选起止），把这段时间里发生的事按日期排成一条线：
     每节课（本节内容、状态、反馈、作业）、成绩、跟进、私下备注、学生 / 家长留言、请假改期申请；
     每个月开头带这个月的小结、月计划和月度回访
   · 可以只看某几类；可以复制成文字（面谈前看、整理给家长）
   · 原来的「反馈」「跟进记录」「私下备注」三个页签并到这里（旧入口都会跳到这里）
   ══════════════════════════════════════════════════════════════ */
const TL_KINDS = [['les', '上课与反馈'], ['score', '成绩'], ['fu', '跟进'], ['note', '备注与留言'], ['req', '请假改期']];
const TL_RANGES = [['m', '本月'], ['pm', '上个月'], ['3m', '近 3 个月'], ['all', '全部'], ['c', '自选']];
const tlMonthEnd = m => { const [y, mo] = m.split('-').map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`; };
const tlCn = iso => { const t = new Date(iso).toLocaleString('sv-SE', {timeZone: 'Asia/Shanghai'}); return [t.slice(0, 10), t.slice(11, 16)]; };
const tlClip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const tlMD = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)} 周${WD[pd(d).getDay()]}`;

function tlRange(){
  const r = S.tl || (S.tl = {k: 'm', off: []}), ym = TODAY.slice(0, 7), pv = ymShift(ym, -1);
  if (r.k === 'pm') return [`${pv}-01`, tlMonthEnd(pv)];
  if (r.k === '3m') return [`${ymShift(ym, -2)}-01`, tlMonthEnd(ym)];
  if (r.k === 'all') return ['0000-01-01', '9999-12-31'];
  if (r.k === 'c') return [r.a || `${ym}-01`, r.b || TODAY];
  return [`${ym}-01`, tlMonthEnd(ym)];
}

// 这段时间里的所有事，最新的在前
function tlEvents(sid, a, b){
  const ev = [], inR = d => d && d >= a && d <= b;
  lsOfS(sid).forEach(l => inR(l.date) && ev.push({k: 'les', d: l.date, t: l.start, l}));
  scoresOf(sid).forEach(x => inR(x.date) && ev.push({k: 'score', d: x.date, t: '', x}));
  fusOf(sid).forEach(f => inR(f.date) && ev.push({k: 'fu', d: f.date, t: f.time || '', f}));
  DB.notes.filter(n => n.student_id === sid).forEach(n => { const [d, t] = tlCn(n.created_at); inR(d) && ev.push({k: 'note', d, t, n}); });
  (typeof MSGS !== 'undefined' ? MSGS : []).filter(m => m.student_id === sid).forEach(m => { const [d, t] = tlCn(m.created_at); inR(d) && ev.push({k: 'note', d, t, m}); });
  DB.requests.forEach(q => { const l = L(q.lesson_id), c = l && course(l.course_id); if (!c || c.student_id !== sid || !q.created_at) return;
    const [d, t] = tlCn(q.created_at); inR(d) && ev.push({k: 'req', d, t, q, l}); });
  return ev.sort((x, y) => (y.d + y.t).localeCompare(x.d + x.t));
}

// 小结：上了几节、几小时、请假、作业交了几次
function tlStats(evs){
  const ls = evs.filter(e => e.k === 'les').map(e => e.l), done = ls.filter(isDone);
  const fs = ls.map(fbOf).filter(Boolean);
  return {n: done.length, h: +done.reduce((s, l) => s + realH(l), 0).toFixed(1), leave: ls.filter(l => l.status === 'leave').length,
    plan: ls.filter(l => l.status === 'scheduled' && !isDone(l) && !isPend(l)).length,
    hw: fs.filter(f => f.hw_sub).length, hwAll: fs.filter(f => (f.hw || '').trim()).length,
    score: evs.filter(e => e.k === 'score').length, fu: evs.filter(e => e.k === 'fu').length};
}
const tlStatTxt = st => [`上课 ${st.n} 节（${st.h} 小时）`, st.leave ? `请假 ${st.leave} 次` : '', st.hwAll ? `作业交了 ${st.hw}/${st.hwAll}` : '',
  st.score ? `成绩 ${st.score} 次` : '', st.fu ? `跟进 ${st.fu} 条` : '', st.plan ? `还有 ${st.plan} 节没上` : ''].filter(Boolean);

function tlLesStatus(l){
  const t = isDone(l) ? '<span class="tag ok">已上</span>' : l.status === 'leave' ? '<span class="tag seal">请假</span>' : l.status === 'cancelled' ? '<span class="tag mute">取消</span>'
    : isPend(l) ? '<span class="tag warn">待确认</span>' : '<span class="tag blue">待上课</span>';
  return t + (l.moved ? ' <span class="tag warn">调过课</span>' : '') + (l.makeup ? ' <span class="tag blue">补课</span>' : '');
}
const tlHwTag = f => `<span class="tag ${f.hw_fb ? 'ok' : f.hw_sub ? 'blue' : 'mute'}">${f.hw_fb ? '已批改' : f.hw_sub ? '已交' : '未交'}</span>`;

function tlItem(e){
  const head = (icon, title, right = '') => `<div class="tl-h"><span class="tl-k">${icon}</span>${title}${right ? `<span class="tl-r">${right}</span>` : ''}</div>`;
  if (e.k === 'les'){
    const l = e.l, c = course(l.course_id), f = fbOf(l), t = tea(c.teacher_id);
    return `<div class="tl-i les">${head('课', `<b class="num">${l.start}–${l.end}</b> ${subjTag(c.subject)}${l.kind ? `<span class="muted"> · ${esc(l.kind)}</span>` : ''} <span class="muted">${esc(t.name)}${/老师$/.test(t.name) ? '' : '老师'}</span>`, tlLesStatus(l))}
      ${l.topic ? `<div class="tl-b"><span class="tl-l">本节</span>${esc(l.topic)}</div>` : ''}
      ${f ? `<div class="tl-b"><span class="tl-l">授课</span>${esc(tlClip(f.content, 90))}</div>${(f.hw || '').trim() ? `<div class="tl-b"><span class="tl-l">作业</span>${esc(tlClip(f.hw, 60))} ${tlHwTag(f)}</div>` : ''}
        <details class="tl-more"><summary>看完整反馈${f.status === 'pending' ? '（还没审批）' : ''}</summary>${fbCard(f)}</details>`
        : isPend(l) && !t.staff ? '<div class="tl-b muted">老师还没写反馈</div>' : ''}</div>`;
  }
  if (e.k === 'score'){ const x = e.x;
    return `<div class="tl-i">${head('分', `<b>${esc(x.metric || '成绩')}</b> <b class="num">${esc(x.score)}${x.full_score ? ' / ' + esc(x.full_score) : ''}</b>`, `<span class="tag gold">${esc(x.kind || '测评')}</span>`)}
      ${x.note ? `<div class="tl-b muted">${esc(x.note)}</div>` : ''}</div>`; }
  if (e.k === 'fu'){ const f = e.f;
    return `<div class="tl-i">${head('跟', `<b>${esc(f.type || '跟进')}</b>${f.subject ? ' ' + subjTag(f.subject) : ''}${f.time ? ` <span class="muted num">${esc(f.time)}</span>` : ''}`,
      `<span class="tag ${f.confirm === '已确认' ? 'ok' : f.confirm === '需调整' ? 'seal' : 'mute'}">${esc(f.confirm || '待确认')}</span> <button class="btn sm" data-act="fu-edit" data-v="${f.id}">编辑</button>`)}
      ${f.task ? `<div class="tl-b">${esc(f.task)}${f.result ? ` → <b>${esc(f.result)}</b>` : ''}</div>` : ''}${f.student_fb ? `<div class="tl-b muted">学生：${esc(f.student_fb)}</div>` : ''}
      ${f.judgment ? `<div class="tl-b muted">判断：${esc(f.judgment)}</div>` : ''}${f.next_action ? `<div class="tl-b">下一步：${esc(f.next_action)}${f.next_date ? `（${fmtYMD(f.next_date)}）` : ''}</div>` : ''}</div>`; }
  if (e.k === 'note' && e.n){ const n = e.n;
    return `<div class="tl-i">${head('记', `<b>私下备注</b> <span class="muted">${esc(n.author || '')}</span>`, `<span class="muted xs">学生家长看不到</span> <button class="btn sm" data-act="note-del" data-v="${n.id}">删除</button>`)}
      <div class="tl-b" style="white-space:pre-wrap">${esc(n.text)}</div></div>`; }
  if (e.k === 'note' && e.m){ const m = e.m;
    return `<div class="tl-i">${head('言', `<b>${m.from_role === 'parent' ? '家长' : '学生'}留言</b>`, `${m.read_at ? '<span class="tag mute">已读</span>' : '<span class="tag warn">未读</span>'}${m.hidden_by ? ' <span class="tag mute">已对老师屏蔽</span>' : ''}`)}
      <div class="tl-b" style="white-space:pre-wrap">${esc(m.text)}</div></div>`; }
  if (e.k === 'req'){ const q = e.q, l = e.l, c = course(l.course_id);
    return `<div class="tl-i">${head('假', `<b>${esc(q.type)}申请</b> <span class="muted">${fmtMD(l.date)} ${l.start} 那节 ${esc(c.subject)}</span>`,
      `<span class="tag ${q.status === 'accepted' ? 'ok' : q.status === 'pending' ? 'warn' : 'seal'}">${q.status === 'accepted' ? '已同意' : q.status === 'pending' ? '待处理' : '未同意'}</span>`)}
      ${q.reason ? `<div class="tl-b">理由：${esc(q.reason)}${q.wish ? ` · 希望：${esc(q.wish)}` : ''}</div>` : ''}${q.reply ? `<div class="tl-b muted">回复：${esc(q.reply)}</div>` : ''}</div>`; }
  return '';
}

function tlTab(sid){
  const r = S.tl || (S.tl = {k: 'm', off: []}), [a, b] = tlRange(), all = tlEvents(sid, a, b), off = new Set(r.off || []);
  const evs = all.filter(e => !off.has(e.k)), st = tlStats(all);
  // 按月分组：有事情的月份，加上这段时间里有月计划 / 月度回访的月份
  const plansIn = m => DB.courses.some(c => c.student_id === sid && planText(c.id, m)), rv = m => reviewOf(sid, m);
  const months = new Set(all.map(e => e.d.slice(0, 7)));
  [...new Set([...DB.plans.map(p => p.ym), ...reviewsOf(sid).map(x => x.ym)])].forEach(m => { if (m >= a.slice(0, 7) && m <= b.slice(0, 7) && (plansIn(m) || rv(m))) months.add(m); });
  const ms = [...months].sort().reverse();
  const bar = `<div class="tl-bar"><div class="seg" role="group" aria-label="时间段">${TL_RANGES.map(([k, t]) => `<button class="${r.k === k ? 'on' : ''}" data-act="tl-r" data-v="${sid}|${k}">${t}</button>`).join('')}</div>
    ${r.k === 'c' ? `<span class="row tl-c"><input type="date" id="tl-a" value="${a}"><span class="muted">至</span><input type="date" id="tl-b" value="${b}"><button class="btn sm" data-act="tl-go" data-v="${sid}">看这段</button></span>` : ''}
    <button class="btn sm" data-act="tl-copy" data-v="${sid}" style="margin-left:auto">复制成文字</button></div>`;
  const sum = `<div class="tl-sum"><b>${r.k === 'all' ? '全部记录' : `${fmtYMD(a)} – ${fmtYMD(b)}`}</b>${tlStatTxt(st).map(x => `<span>${x}</span>`).join('')}</div>`;
  const chips = `<div class="tl-chips"><span class="muted xs">显示：</span>${TL_KINDS.map(([k, t]) => `<button class="chip ${off.has(k) ? '' : 'on'}" data-act="tl-f" data-v="${sid}|${k}" aria-pressed="${!off.has(k)}">${t}<span class="num">${all.filter(e => e.k === k).length}</span></button>`).join('')}</div>`;
  const add = isAdmin() ? `<div class="row tl-add"><button class="btn sm" data-act="fu-new" data-v="${sid}">＋ 记一条跟进</button><button class="btn sm" data-act="stu-tab" data-v="${sid}|score">＋ 记成绩</button>
    <details class="tl-note"><summary class="btn sm">＋ 写私下备注</summary><div class="tl-note-f"><textarea id="note-new" placeholder="只有老师和教务能看到，例：家长希望多练记述"></textarea><button class="btn pri sm" data-act="note-add" data-v="${sid}">保存备注</button></div></details></div>` : '';
  const body = ms.map(m => {
    const me = evs.filter(e => e.d.startsWith(m)), mst = tlStats(all.filter(e => e.d.startsWith(m))), rr = rv(m);
    const days = [...new Set(me.map(e => e.d))];
    return `<section class="tl-m"><div class="tl-mh"><b>${ymLabel(m)}</b><span class="muted small">${tlStatTxt(mst).join(' · ') || '这个月没有课'}</span></div>
      ${!rr && isAdmin() && m <= TODAY.slice(0, 7) && me.length ? `<div class="tl-mx"><button class="btn sm" data-act="rv-open" data-v="${sid}|${m}">＋ 写${+m.slice(5)}月家长反馈（可以 AI 生成）</button></div>` : ''}
      ${plansIn(m) || rr ? `<div class="tl-mx">${plansIn(m) ? `<details><summary>这个月的计划</summary>${mpView(sid, m)}</details>` : ''}${rr ? `<details><summary>月度家长反馈 <span class="tag ${rr.status === '已完成' ? 'ok' : rr.status === '需调整' ? 'seal' : 'mute'}">${esc(rr.status || '待跟进')}</span></summary>${reviewCard(rr, {edit: isAdmin()})}</details>` : ''}</div>` : ''}
      ${days.map(d => `<div class="tl-d"><div class="tl-dd ${d === TODAY ? 'today' : ''}">${tlMD(d)}</div><div class="tl-dl">${me.filter(e => e.d === d).map(tlItem).join('')}</div></div>`).join('') || '<div class="muted small tl-none">这个月没有要显示的记录（可能被上面的「显示」筛掉了）</div>'}</section>`;
  }).join('');
  return `${bar}${sum}${chips}${add}${body || `<div class="card empty">这段时间没有记录。换个时间段看看，比如「全部」。</div>`}`;
}

// 复制成文字：按现在的时间段和筛选
function tlText(sid){
  const r = S.tl || {k: 'm', off: []}, [a, b] = tlRange(), all = tlEvents(sid, a, b), off = new Set(r.off || []), evs = all.filter(e => !off.has(e.k));
  const out = [`${stu(sid).name} · ${r.k === 'all' ? '全部记录' : `${a} 至 ${b}`}`, tlStatTxt(tlStats(all)).join(' · ')];
  const months = [...new Set(evs.map(e => e.d.slice(0, 7)))].sort().reverse();
  months.forEach(m => {
    out.push('', `【${ymLabel(m)}】`);
    DB.courses.filter(c => c.student_id === sid && planText(c.id, m)).forEach(c => out.push(`计划（${c.subject}）：${planText(c.id, m)}`));
    evs.filter(e => e.d.startsWith(m)).forEach(e => {
      const d = tlMD(e.d);
      if (e.k === 'les'){ const l = e.l, c = course(l.course_id), f = fbOf(l);
        const st = isDone(l) ? '已上' : l.status === 'leave' ? '请假' : l.status === 'cancelled' ? '取消' : isPend(l) ? '待确认' : '待上课';
        out.push(`${d} ${l.start}–${l.end} ${c.subject}${l.kind ? '·' + l.kind : ''}（${tea(c.teacher_id).name}）${st}`);
        if (l.topic) out.push(`  本节：${l.topic}`);
        if (f){ out.push(`  授课：${tlClip(f.content, 200)}`); if ((f.hw || '').trim()) out.push(`  作业：${tlClip(f.hw, 120)}（${f.hw_fb ? '已批改' : f.hw_sub ? '已交' : '未交'}）`); } }
      else if (e.k === 'score') out.push(`${d} 成绩：${e.x.metric || ''} ${e.x.score}${e.x.full_score ? '/' + e.x.full_score : ''}（${e.x.kind || ''}）${e.x.note ? ' ' + e.x.note : ''}`);
      else if (e.k === 'fu') out.push(`${d} 跟进（${e.f.type || ''}）：${e.f.task || ''}${e.f.result ? ' → ' + e.f.result : ''}${e.f.next_action ? '；下一步：' + e.f.next_action : ''}`);
      else if (e.k === 'note' && e.n) out.push(`${d} 私下备注：${e.n.text}`);
      else if (e.k === 'note' && e.m) out.push(`${d} ${e.m.from_role === 'parent' ? '家长' : '学生'}留言：${e.m.text}`);
      else if (e.k === 'req') out.push(`${d} ${e.q.type}申请（${tlMD(e.l.date)} 那节）：${e.q.reason || ''}`);
    });
  });
  return out.join('\n');
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const k = btn.dataset.act;
  if (k === 'rv-open') S.rvFromTl = !!btn.closest('.tl-m');   // 从「按时间看」打开的月度回访，保存后回到这里 if (!['tl-r', 'tl-f', 'tl-go', 'tl-copy'].includes(k)) return;
  const [sid, x] = (btn.dataset.v || '').split('|'), r = S.tl || (S.tl = {k: 'm', off: []});
  if (k === 'tl-r'){ r.k = x; studentModal(sid, 'tl'); }
  if (k === 'tl-f'){ const off = new Set(r.off || []); off.has(x) ? off.delete(x) : off.add(x); r.off = [...off]; studentModal(sid, 'tl'); }
  if (k === 'tl-go'){ const a = val('tl-a'), b = val('tl-b'); if (!a || !b){ toast('请选好开始和结束日期', true); return; }
    r.a = a <= b ? a : b; r.b = a <= b ? b : a; studentModal(sid, 'tl'); }
  if (k === 'tl-copy') copyText(tlText(sid), '已复制，可以粘贴到微信或文档里');
});
