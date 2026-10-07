/* ══════════════════════════════════════════════════════════════
   升学跟进：档案资料、成绩记录、大学目标与出愿时间、月度回访、跟进记录
   按「学生个人档案与升学跟进系统」表格的模型做。依赖 app.js 里的工具和数据。
   ══════════════════════════════════════════════════════════════ */
const OPT = {
  direction: ['文科','理科','艺术','SGU','其他','未确定'],
  grade: ['高一上','高一下','高二上','高二下','高三上','高三下','高中毕业'],
  gender: ['男','女','其他','不填写'],
  uniType: ['国公立大学','私立大学','均可'],
  pref: ['大学排名','地区优先','专业偏好','学费政策'],
  region: ['东京都内','大阪可','京都可','关东地区','关西地区','无地区限制','其他'],
  majors: {
    '文科': ['经济学','经营学','商学','会计学','金融学','法学','政治学','国际关系','公共政策','社会学','社会福祉','心理学','教育学','文学','语言学','外国语','历史学','哲学/宗教学','文化/人类学','传媒/新闻','国际教养','地域研究','旅游/酒店','体育/健康科学','其他文科专业'],
    '理科': ['数学','物理','化学','生物','地球科学','信息/计算机','数据科学/AI','电子电气','机械','材料','化学工程','土木','建筑','环境','能源','航空航天','船舶海洋','农学','食品科学','森林科学','水产学','生命科学/生物工程','医学','牙学','药学','兽医学','护理/保健','体育科学','其他理科专业'],
    '艺术': ['日本画','油画','雕塑','工艺','视觉传达','平面设计','产品设计','工业设计','环境/空间设计','建筑设计','服装/纺织','动画','漫画','影像/电影','摄影','游戏设计','角色设计','音乐-器乐','音乐-声乐','音乐-作曲','音乐制作','舞台/表演','文化财保存/修复','艺术学/美术史','其他艺术专业'],
    'SGU': ['International Relations','Liberal Arts','Economics/Business','Social Sciences','Political Science/Public Policy','Japanese/Asian Studies','Media/Communication','Sustainability/Environmental Studies','Computer Science/Data Science/AI','Engineering','Natural Sciences','Life Sciences','Agriculture/Food','Public Health','Interdisciplinary Studies','Other English-taught Program'],
    '未确定': ['尚未确定','文理交叉','艺术与设计','英语学位项目','需要面谈后确认'],
  },
  metric: ['EJU日语','EJU数学1','EJU数学2','EJU物理','EJU化学','EJU生物','EJU文综','TOEFL','IELTS','SAT/ACT','JLPT','A-Level','AP','IB','校内成绩'],
  fullScore: {'EJU日语':400,'EJU数学1':200,'EJU数学2':200,'EJU物理':100,'EJU化学':100,'EJU生物':100,'EJU文综':200,'TOEFL':120,'IELTS':9,'SAT/ACT':1600},
  scoreKind: ['初始测评','阶段模考','正式考试','校内测验','其他'],
  docStatus: ['待梳理','资料收集中','已确认','已放弃'],
  applyStatus: ['未开始','准备中','已提交','已完成','需调整'],
  tier: ['冲刺','目标','保底'],
  reviewStatus: ['待跟进','已完成','需调整','暂缓'],
  fuType: ['听写','阶段测试','模考','作业检查','面谈','家长沟通','学习计划调整','其他'],
  subject: ['日语','英语','数学','文综','理综','历史','经济','政治','地理','物理','化学','生物','升学指导','综合'],
  confirm: ['待确认','已确认','需调整','暂缓'],
};
const DATE_KEYS = [['apply_start','出愿开始'],['apply_end','出愿截止'],['docs_due','材料截止'],['written_date','笔试'],['interview_date','面试'],['result_date','合格发表'],['procedure_due','手续截止']];
const opts = (list, cur, blank='—') => `<option value="">${blank}</option>` + list.map(x=>`<option ${x===cur?'selected':''}>${esc(x)}</option>`).join('');
const fld = (id, label, val, attrs='') => `<label class="field"><span>${label}</span><input type="text" id="${id}" value="${esc(val||'')}" ${attrs}></label>`;
const sel_ = (id, label, list, cur, blank) => `<label class="field"><span>${label}</span><select id="${id}">${opts(list, cur, blank)}</select></label>`;
const dt = (id, label, val) => `<label class="field"><span>${label}</span><input type="date" id="${id}" value="${esc(val||'')}"></label>`;
const ta = (id, label, val, ph='') => `<label class="field"><span>${label}</span><textarea id="${id}" placeholder="${esc(ph)}">${esc(val||'')}</textarea></label>`;
const TIER_CLS = {'冲刺':'seal','目标':'gold','保底':'ok'};
const scoresOf = sid => (DB.scores||[]).filter(x => x.student_id===sid);
const targetsOf = sid => (DB.targets||[]).filter(x => x.student_id===sid);
const reviewsOf = sid => (DB.reviews||[]).filter(x => x.student_id===sid);
const fusOf = sid => (DB.followups||[]).filter(x => x.student_id===sid);
const reviewOf = (sid, ym) => reviewsOf(sid).find(r => r.ym===ym);
const ageOf = b => { if (!b) return ''; const d=pd(b), t=pd(TODAY); let a=t.getFullYear()-d.getFullYear(); if (t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) a--; return a; };
const fmtYMD = s => s ? `${+s.slice(5,7)}/${+s.slice(8,10)}` : '';
const tgtLabel = ym => ym && /^\d{4}-\d{2}$/.test(ym) ? `${ym.slice(0,4)}年${+ym.slice(5)}月` : (ym || '—');

/* ───────── 下一个要发生的出愿日期 ───────── */
function nextEventOf(t){
  const ev = DATE_KEYS.map(([k,l]) => [t[k], l]).filter(([d]) => d && d >= TODAY).sort((a,b) => a[0].localeCompare(b[0]));
  return ev[0] ? {date: ev[0][0], label: ev[0][1], days: dBetween(TODAY, ev[0][0])} : null;
}
function upcomingEvents(days=45){
  const out = [];
  (DB.targets||[]).forEach(t => DATE_KEYS.forEach(([k,l]) => { if (t[k] && t[k] >= TODAY && dBetween(TODAY,t[k]) <= days) out.push({t, date:t[k], label:l, days:dBetween(TODAY,t[k])}); }));
  return out.sort((a,b) => a.date.localeCompare(b.date));
}

/* ═════════════ 展示块（各端共用） ═════════════ */
function profileView(s){
  const row = (l, v) => v ? `<dt>${l}</dt><dd>${esc(v)}</dd>` : '';
  const majors = [s.major1, s.major2, s.major3, s.major_other].filter(Boolean).join('、');
  return `<dl class="kv small">
    ${row('编号', s.code)}${row('升学方向', s.direction || s.track)}${row('学年', s.grade)}${row('性别', s.gender)}
    ${s.birth ? `<dt>出生日期</dt><dd>${esc(s.birth)}（${ageOf(s.birth)} 岁）</dd>` : ''}${row('当前学校', s.school)}
    ${s.target_ym ? `<dt>目标入学</dt><dd>${tgtLabel(s.target_ym)}</dd>` : ''}</dl>
  ${[s.lv_jp,s.lv_en,s.lv_math,s.lv_bun,s.lv_ri,s.lv_sat,s.lv_ap,s.lv_note].some(Boolean) ? `<b class="small">现阶段各科水平</b><dl class="kv small">
    ${row('日语', s.lv_jp)}${row('英语', s.lv_en)}${row('数学', s.lv_math)}${row('文综', s.lv_bun)}${row('理综', s.lv_ri)}${row('SAT/ACT', s.lv_sat)}${row('A-Level/AP/IB', s.lv_ap)}${row('补充说明', s.lv_note)}</dl>` : ''}
  ${[s.uni_type,s.pref1,s.region,s.fee,majors].some(Boolean) ? `<b class="small">大学偏好</b><dl class="kv small">
    ${row('大学类型', s.uni_type)}${row('第一优先', s.pref1)}${row('第二优先', s.pref2)}${row('地区', s.region)}${row('学费/奖学金', s.fee)}${row('专业方向', majors)}</dl>` : ''}`;
}

// 一条成绩趋势的小折线（主题颜色）
function spark(points, w=120, h=34){
  if (points.length < 2) return '';
  const ys = points.map(p=>Number(p.score)), min = Math.min(...ys), max = Math.max(...ys), span = (max-min) || 1;
  const xy = ys.map((y,i) => [4 + i*(w-8)/(ys.length-1), h-5 - (y-min)/span*(h-10)]);
  const d = xy.map(([x,y],i) => `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx,ly] = xy[xy.length-1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="display:block"><path d="${d}" fill="none" stroke="var(--gold)" stroke-width="1.8" stroke-linejoin="round"/>${xy.map(([x,y])=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="var(--surface)" stroke="var(--gold)" stroke-width="1.2"/>`).join('')}<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="var(--gold)"/></svg>`;
}
function scoreTrend(sid){
  const by = {};
  scoresOf(sid).forEach(x => (by[x.metric] ??= []).push(x));
  const ms = Object.keys(by).sort((a,b) => OPT.metric.indexOf(a) - OPT.metric.indexOf(b));
  if (!ms.length) return '<div class="muted small">还没有成绩记录</div>';
  return `<div class="trend">${ms.map(m => { const ls = by[m].sort((a,b)=>a.date.localeCompare(b.date)), f = ls[0], l = ls[ls.length-1], diff = Number(l.score) - Number(f.score);
    return `<div class="tr-row"><div class="tr-m"><b>${esc(m)}</b><span class="muted xs">${ls.length} 次</span></div>
      <div class="tr-v num"><span class="muted xs">${fmtYMD(f.date)}</span> ${f.score} → <b>${l.score}</b>${l.full_score?`<span class="muted xs">/${l.full_score}</span>`:''}
      ${ls.length>1 ? `<span class="tag ${diff>0?'ok':diff<0?'seal':'mute'}">${diff>0?'+':''}${+diff.toFixed(1)}</span>` : ''}</div>
      <div class="tr-s">${spark(ls)}</div></div>`; }).join('')}</div>`;
}
function targetCard(t, edit){
  const nx = nextEventOf(t);
  return `<section class="card tg" style="display:flex;flex-direction:column;gap:6px">
    <div class="row"><span class="tag ${TIER_CLS[t.tier]}">${t.tier} ${t.seq}</span><b style="font-family:var(--f-disp);font-size:15px;margin-right:auto">${esc(t.school)}</b>
      <span class="tag ${t.status==='已完成'?'ok':t.status==='需调整'?'seal':t.status==='未开始'?'mute':'blue'}">${esc(t.status||'未开始')}</span>
      ${edit ? `<button class="btn sm" data-act="tg-edit" data-v="${t.id}">编辑</button>` : ''}</div>
    ${t.exam_way || t.requirement ? `<div class="small">${t.exam_way?`<span class="muted">入试方式</span> ${esc(t.exam_way)}　`:''}${t.requirement?`<span class="muted">入试要求</span> ${esc(t.requirement)}`:''}</div>` : ''}
    ${t.score_req ? `<div class="small"><span class="muted">分数要求</span> ${esc(t.score_req)}</div>` : ''}
    <div class="dates">${DATE_KEYS.map(([k,l]) => t[k] ? `<span class="dchip ${nx && nx.date===t[k] && nx.label===l ? 'next' : t[k] < TODAY ? 'past' : ''}"><small>${l}</small>${fmtYMD(t[k])}</span>` : '').join('') || '<span class="muted xs">日期待定</span>'}</div>
    ${nx ? `<div class="xs" style="color:${nx.days<=14?'var(--seal)':'var(--gold-text)'}">下一个：${nx.label} ${fmtMD(nx.date)}（还有 ${nx.days} 天）</div>` : ''}
    ${t.next_step ? `<div class="small"><span class="muted">下一步</span> ${esc(t.next_step)}</div>` : ''}
    <div class="muted xs">资料状态：${esc(t.doc_status||'待梳理')}</div></section>`;
}
function targetsView(sid, edit){
  const ts = targetsOf(sid);
  if (!ts.length) return `<div class="muted small">还没有大学目标</div>`;
  return OPT.tier.map(tr => { const g = ts.filter(t => t.tier===tr); return g.length ? `<div class="dg">${tr}大学</div>${g.map(t=>targetCard(t, edit)).join('')}` : ''; }).join('');
}
function reviewCard(r, opt={}){
  const sec = (l, v) => v ? `<div class="sec"><b>${l}</b><p>${esc(v)}</p></div>` : '';
  return `<article class="card fb small"><div class="row"><b style="font-family:var(--f-disp);font-size:15px;margin-right:auto">${ymLabel(r.ym)}</b>
    <span class="tag ${r.status==='已完成'?'ok':r.status==='需调整'?'seal':'mute'}">${esc(r.status||'待跟进')}</span>${opt.edit?`<button class="btn sm" data-act="rv-open" data-v="${r.student_id}|${r.ym}">编辑</button><button class="btn sm danger" data-act="rv-del" data-v="${r.student_id}|${r.ym}">删除</button>`:''}</div>
    ${sec('本月课程内容', r.content)}${sec('学生自我评价', r.self_eval)}${sec('老师评价', r.teacher_eval)}${sec('任务 / 跟进结论', r.conclusion)}${sec('下月重点', r.next_focus)}
    ${!r.content && !r.self_eval && !r.teacher_eval ? '<div class="muted">还没有内容</div>' : ''}</article>`;
}
function fuCard(f, edit){
  return `<div class="li small"><div class="grow"><div class="row"><b>${fmtYMD(f.date)} ${esc(f.time||'')}</b><span class="tag gold">${esc(f.type||'跟进')}</span>${f.subject?subjTag(f.subject):''}
      <span class="tag ${f.confirm==='已确认'?'ok':f.confirm==='需调整'?'seal':'mute'}">${esc(f.confirm||'待确认')}</span></div>
    ${f.task?`<div>${esc(f.task)}${f.result?` → <b>${esc(f.result)}</b>`:''}</div>`:''}
    ${f.student_fb?`<div class="muted">学生：${esc(f.student_fb)}</div>`:''}${f.judgment?`<div class="muted">判断：${esc(f.judgment)}</div>`:''}
    ${f.next_action?`<div>下一步：${esc(f.next_action)}${f.next_date?`（${fmtYMD(f.next_date)}）`:''}</div>`:''}</div>
    ${edit?`<button class="btn sm" data-act="fu-edit" data-v="${f.id}">编辑</button>`:''}</div>`;
}

/* ═════════════ 教务端：学生弹窗里的新分页 ═════════════ */
function studentTrackTab(id, tab){
  const s = stu(id), canEdit = isAdmin();
  if (tab==='profile') return `${profileView(s)}${canEdit?`<div class="row"><button class="btn pri sm" data-act="pf-open" data-v="${id}">编辑档案资料</button></div>`:''}`;
  if (tab==='score') return `<div class="hint" style="margin:0">每次考试或测评记一行，自动算出首次 → 最新和提升。学生和家长能看到。</div>${scoreTrend(id)}
    ${canEdit ? `<details class="card"><summary><b>＋ 记一次成绩</b></summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      <div class="fields">${dt('sc-date','考试日期',TODAY)}${sel_('sc-kind','考试/测评类型',OPT.scoreKind,'阶段模考')}<label class="field"><span>成绩指标</span><select id="sc-metric" data-change="sc-metric">${opts(OPT.metric,'','选择…')}</select></label>
      ${fld('sc-score','分数','','inputmode="decimal"')}${fld('sc-full','满分','','inputmode="decimal"')}${fld('sc-note','备注','')}</div>
      <div class="row"><button class="btn pri sm" data-act="sc-add" data-v="${id}">保存成绩</button></div></div></details>` : ''}
    ${scoresOf(id).length ? `<details class="card"><summary class="small"><b>全部记录（${scoresOf(id).length}）</b></summary><div class="list" style="margin-top:6px">${scoresOf(id).slice().reverse().map(x=>`<div class="li small"><span class="num">${x.date}</span><span class="grow">${esc(x.metric)} <b class="num">${x.score}</b>${x.full_score?`/${x.full_score}`:''} <span class="muted">${esc(x.kind||'')} ${esc(x.note||'')}</span></span>${canEdit?`<button class="btn sm danger" data-act="sc-del" data-v="${x.id}">删除</button>`:''}</div>`).join('')}</div></details>` : ''}`;
  if (tab==='target') return `<div class="hint" style="margin:0">冲刺、目标、保底各几所，每所的入试要求和出愿日程。学生和家长能看到。</div>
    ${canEdit?`<div class="row"><button class="btn pri sm" data-act="tg-new" data-v="${id}">＋ 添加大学</button></div>`:''}${targetsView(id, canEdit)}`;
  if (tab==='review'){
    const ym = TODAY.slice(0,7), cur = reviewOf(id, ym), past = reviewsOf(id).filter(r=>r.ym!==ym).slice().reverse();
    return `<div class="hint" style="margin:0">每月一条：学生在自己的链接里写自我评价，教务填其余部分。状态改成「已完成」后家长才能看到。</div>
      ${cur ? reviewCard(cur,{edit:canEdit}) : `<div class="card small">${ymLabel(ym)} 还没有月度回访。${canEdit?`<button class="btn pri sm" data-act="rv-open" data-v="${id}|${ym}">填写本月</button>`:''}</div>`}
      ${canEdit?`<div class="row"><select id="rv-ym">${[0,-1,-2,-3,1].map(n=>ymShift(ym,n)).map(m=>`<option value="${m}">${ymLabel(m)}</option>`).join('')}</select><button class="btn sm" data-act="rv-pick" data-v="${id}">填写 / 修改这个月</button></div>`:''}
      ${past.map(r=>reviewCard(r,{edit:canEdit})).join('')}`;
  }
  if (tab==='fu') return `<div class="hint" style="margin:0">课以外的跟进：听写、测试、模考、面谈、家长沟通、计划调整。只有教务和任课老师能看到。</div>
    ${canEdit?`<div class="row"><button class="btn pri sm" data-act="fu-new" data-v="${id}">＋ 记一条跟进</button></div>`:''}
    ${fusOf(id).length ? `<div class="card list">${fusOf(id).slice().reverse().map(f=>fuCard(f,canEdit)).join('')}</div>` : '<div class="muted small">还没有跟进记录</div>'}`;
  return '';
}

/* ═════════════ 教务端：新页面 ═════════════ */
function pgApply2(){
  const ev = upcomingEvents(60);
  const all = (DB.targets||[]).slice().sort((a,b)=> (nextEventOf(a)?.date||'9999').localeCompare(nextEventOf(b)?.date||'9999'));
  return `<div class="ph"><h2>升学与出愿</h2></div>${scopeNote()}
  <div class="hint">所有学生的大学目标和出愿日程。在学生档案 → 点学生 →「大学与出愿」里添加和修改。</div>
  <section class="card"><h3>接下来 60 天的日程</h3>${ev.length ? `<div class="list">${ev.map(e=>`<div class="li"><span class="tag ${e.days<=7?'seal':e.days<=21?'warn':'mute'}">${e.days===0?'今天':e.days+' 天'}</span><div class="grow"><b>${esc(stu(e.t.student_id).name)}</b> · ${esc(e.t.school)} <span class="tag ${TIER_CLS[e.t.tier]}">${e.t.tier}</span><br><span class="small">${e.label} ${fmtMD(e.date)}</span></div><button class="btn sm" data-act="student-tab" data-v="${e.t.student_id}|target">查看</button></div>`).join('')}</div>` : '<div class="empty">60 天内没有出愿日程</div>'}</section>
  ${all.length ? `<div class="tw"><table class="rt"><thead><tr><th>学生</th><th>级别</th><th>大学 / 专业</th><th>入试方式</th><th>下一个日期</th><th>出愿截止</th><th>状态</th><th>资料</th></tr></thead><tbody>
    ${all.map(t => { const nx = nextEventOf(t); return `<tr class="click" data-act="student-tab" data-v="${t.student_id}|target"><td><b>${esc(stu(t.student_id).name)}</b></td><td><span class="tag ${TIER_CLS[t.tier]}">${t.tier} ${t.seq}</span></td><td>${esc(t.school)}</td><td class="small">${esc(t.exam_way||'')}</td>
      <td class="small">${nx?`${nx.label} <span class="num">${fmtYMD(nx.date)}</span> <span class="tag ${nx.days<=14?'seal':'mute'}">${nx.days} 天</span>`:'—'}</td><td class="num">${t.apply_end||'—'}</td><td>${esc(t.status||'')}</td><td class="small">${esc(t.doc_status||'')}</td></tr>`; }).join('')}
  </tbody></table></div>` : '<div class="card empty">还没有大学目标</div>'}`;
}
function pgReviews(){
  const ym = S.rvMonth || (S.rvMonth = TODAY.slice(0,7));
  return `<div class="ph"><h2>月度回访</h2><select id="rv-month" data-change="rv-month">${[1,0,-1,-2,-3,-4,-5].map(n=>ymShift(TODAY.slice(0,7),n)).map(m=>`<option value="${m}" ${m===ym?'selected':''}>${ymLabel(m)}</option>`).join('')}</select></div>${scopeNote()}
  <div class="hint">每个学生每月一条。学生自评由学生在自己的链接里写；状态改成「已完成」后家长能看到。</div>
  <div class="tw"><table class="rt"><thead><tr><th>编号</th><th>学生</th><th>课次</th><th>学生自评</th><th>老师评价</th><th>下月重点</th><th>状态</th><th></th></tr></thead><tbody>
  ${DB.students.filter(s=>s.active!==false).map(s => { const r = reviewOf(s.id, ym), st = monthStats(s.id, ym);
    return `<tr><td class="num">${esc(s.code||'')}</td><td><b>${esc(s.name)}</b></td><td class="num">${st.actual}</td>
    <td>${r?.self_eval?'<span class="tag ok">已写</span>':'<span class="tag mute">未写</span>'}</td><td>${r?.teacher_eval?'<span class="tag ok">已写</span>':'<span class="tag warn">未写</span>'}</td>
    <td class="small">${esc((r?.next_focus||'').slice(0,24))}</td><td><span class="tag ${r?.status==='已完成'?'ok':r?.status==='需调整'?'seal':'mute'}">${esc(r?.status||'未开始')}</span></td>
    <td><button class="btn sm" data-act="rv-open" data-v="${s.id}|${ym}">${r?'修改':'填写'}</button></td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function pgFollowups(){
  const all = (DB.followups||[]);
  const due = all.filter(f => f.next_date && f.confirm!=='已确认').sort((a,b)=>a.next_date.localeCompare(b.next_date));
  const recent = all.slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).slice(0,30);
  return `<div class="ph"><h2>跟进记录</h2><select id="fu-stu"><option value="">选择学生…</option>${DB.students.map(s=>`<option value="${s.id}">${esc(s.code||'')} ${esc(s.name)}</option>`).join('')}</select><button class="btn pri" data-act="fu-new-pick">＋ 记一条跟进</button></div>${scopeNote()}
  <div class="hint">听写、阶段测试、模考、作业检查、面谈、家长沟通、学习计划调整。只有教务和任课老师能看到。</div>
  <section class="card"><h3>待跟进（按下次日期）</h3>${due.length ? `<div class="list">${due.map(f=>`<div class="li small"><span class="tag ${f.next_date<TODAY?'seal':dBetween(TODAY,f.next_date)<=7?'warn':'mute'}">${f.next_date<TODAY?'已过 '+dBetween(f.next_date,TODAY)+' 天':dBetween(TODAY,f.next_date)+' 天后'}</span><div class="grow"><b>${esc(stu(f.student_id).name)}</b> · ${esc(f.next_action||f.task||'')}</div><button class="btn sm" data-act="fu-edit" data-v="${f.id}">更新</button></div>`).join('')}</div>` : '<div class="empty">没有待跟进的事</div>'}</section>
  <section class="card"><h3>最近的记录</h3>${recent.length ? `<div class="list">${recent.map(f=>`<div class="li small"><b style="min-width:52px">${esc(stu(f.student_id).name)}</b><div class="grow">${fuCard(f,true).replace(/^<div class="li small">/,'<div>').replace(/<\/div>$/,'')}</div></div>`).join('')}</div>` : '<div class="empty">还没有跟进记录</div>'}</section>`;
}

/* ═════════════ 教务端：编辑弹窗 ═════════════ */
function profileForm(id){
  const s = stu(id), allMajors = [...new Set(Object.values(OPT.majors).flat())];
  openModal(`${mHead(`${esc(s.name)} · 档案资料`)}
  <datalist id="dl-major">${allMajors.map(m=>`<option value="${esc(m)}">`).join('')}</datalist>
  <b class="small">基本信息</b>
  <div class="fields">${sel_('pf-direction','升学方向',OPT.direction,s.direction)}${sel_('pf-grade','学年',OPT.grade,s.grade)}${sel_('pf-gender','性别',OPT.gender,s.gender)}
    ${dt('pf-birth','出生日期',s.birth)}${fld('pf-school','当前学校',s.school,'placeholder="例：国内高中"')}
    <label class="field"><span>目标入学</span><input type="month" id="pf-target" value="${esc(/^\d{4}-\d{2}$/.test(s.target_ym||'')?s.target_ym:'')}"></label></div>
  <b class="small">现阶段各科水平</b>
  <div class="fields">${fld('pf-jp','日语',s.lv_jp,'placeholder="例：N2左右；EJU日语240"')}${fld('pf-en','英语',s.lv_en,'placeholder="例：TOEFL 65"')}${fld('pf-math','数学',s.lv_math)}
    ${fld('pf-bun','文综',s.lv_bun)}${fld('pf-ri','理综',s.lv_ri,'placeholder="例：物理65、化学60"')}${fld('pf-sat','SAT/ACT',s.lv_sat)}${fld('pf-ap','A-Level/AP/IB',s.lv_ap)}</div>
  ${ta('pf-note','补充说明',s.lv_note,'例：物理力学较稳，有机化学需加强')}
  <b class="small">大学偏好</b>
  <div class="fields">${sel_('pf-uni','大学类型',OPT.uniType,s.uni_type)}${sel_('pf-p1','第一优先',OPT.pref,s.pref1)}${sel_('pf-p2','第二优先',OPT.pref,s.pref2)}
    ${sel_('pf-region','地区',OPT.region,s.region)}${fld('pf-fee','学费/奖学金要求',s.fee)}</div>
  <div class="fields">${fld('pf-m1','专业方向 1',s.major1,'list="dl-major"')}${fld('pf-m2','专业方向 2',s.major2,'list="dl-major"')}${fld('pf-m3','专业方向 3',s.major3,'list="dl-major"')}${fld('pf-mo','其他专业',s.major_other)}</div>
  <div class="muted xs">专业方向可以从列表里选，也可以直接打字。</div>
  <div class="row"><button class="btn pri" data-act="pf-save" data-v="${id}">保存</button></div>`, true);
}
function targetForm(sid, tid){
  const t = tid ? (DB.targets||[]).find(x=>x.id===tid) : {tier:'目标', seq: targetsOf(sid).filter(x=>x.tier==='目标').length+1, status:'未开始', doc_status:'待梳理'};
  openModal(`${mHead(tid?'编辑大学目标':'添加大学目标')}
  <div class="fields">${sel_('tg-tier','级别',OPT.tier,t.tier,'选择…')}${fld('tg-seq','序号',t.seq,'inputmode="numeric"')}${fld('tg-school','大学 / 专业 *',t.school,'placeholder="例：早稻田大学／社会科学部"')}</div>
  <div class="fields">${fld('tg-way','入试方式',t.exam_way,'placeholder="例：留学生入试 / EJU利用"')}${fld('tg-req','入试要求',t.requirement,'placeholder="例：EJU、英语成绩、面试"')}${fld('tg-score','分数要求',t.score_req,'placeholder="例：EJU日语300+"')}</div>
  <b class="small">出愿时间</b>
  <div class="fields">${DATE_KEYS.map(([k,l])=>dt('tg-'+k,l,t[k])).join('')}</div>
  <div class="fields">${sel_('tg-status','出愿状态',OPT.applyStatus,t.status)}${sel_('tg-doc','资料状态',OPT.docStatus,t.doc_status)}${fld('tg-next','下一步',t.next_step,'placeholder="例：整理志望理由书"')}</div>
  <div class="row"><button class="btn pri" data-act="tg-save" data-v="${sid}|${tid||''}">保存</button>${tid?`<span id="tg-del-row"><button class="btn danger sm" data-act="tg-del-ask" data-v="${tid}">删除这所</button></span>`:''}</div>`, true);
}
function reviewForm(sid, ym){
  const r = reviewOf(sid, ym) || {}, st = monthStats(sid, ym);
  const auto = DB.courses.filter(c=>c.student_id===sid).map(c=>planText(c.id, ym) ? `${c.subject}：${planText(c.id, ym)}` : '').filter(Boolean).join('；');
  openModal(`${mHead(`${esc(stu(sid).name)} · ${ymLabel(ym)} 月度回访`)}
  <div class="muted small">这个月：上课 ${st.actual} 次${st.leave?`，请假 ${st.leave} 次`:''}，作业提交 ${st.hwOk}%</div>
  <div class="note"><b>学生自我评价：</b>${r.self_eval ? esc(r.self_eval) : '<span class="muted">学生还没写（学生在自己的链接「月度」里填）</span>'}</div>
  ${ta('rv-content','本月课程内容',r.content || auto,'例：日语：N2长文、复合助词；数学：函数与数列')}
  ${ta('rv-teacher','老师评价',r.teacher_eval,'')}
  ${ta('rv-concl','任务 / 跟进结论',r.conclusion,'例：完成 8 次课程与两次阶段复盘')}
  ${ta('rv-next','下月重点',r.next_focus,'')}
  <div class="fields">${sel_('rv-status','状态',OPT.reviewStatus,r.status||'待跟进')}${fld('rv-note','补充说明',r.note)}</div>
  <div class="muted xs">状态选「已完成」后，家长能在自己的链接里看到这份回访。</div>
  <div class="row"><button class="btn pri" data-act="rv-save" data-v="${sid}|${ym}">保存</button></div>`, true);
}
function fuForm(sid, fid){
  const f = fid ? (DB.followups||[]).find(x=>x.id===fid) : {date:TODAY, confirm:'待确认'};
  sid = sid || f.student_id;
  openModal(`${mHead(`${esc(stu(sid).name)} · ${fid?'修改跟进':'记一条跟进'}`)}
  <div class="fields">${dt('fu-date','日期',f.date)}<label class="field"><span>时间</span><input type="time" id="fu-time" value="${esc(f.time||'')}"></label>${sel_('fu-type','跟进类型',OPT.fuType,f.type,'选择…')}${sel_('fu-subj','科目',OPT.subject,f.subject)}</div>
  ${fld('fu-task','任务 / 检查内容',f.task,'placeholder="例：N2核心词汇100词听写"')}
  <div class="fields">${fld('fu-result','完成情况 / 结果',f.result,'placeholder="例：88/100"')}${fld('fu-sfb','学生反馈',f.student_fb)}</div>
  ${fld('fu-judge','老师判断',f.judgment,'placeholder="例：易错词集中在近义词辨析"')}
  <div class="fields">${fld('fu-next','下一步行动',f.next_action,'placeholder="例：两周后复测易错词"')}${dt('fu-ndate','下次日期',f.next_date)}${sel_('fu-confirm','确认状态',OPT.confirm,f.confirm)}</div>
  ${fld('fu-note','补充说明',f.note)}
  <div class="row"><button class="btn pri" data-act="fu-save" data-v="${sid}|${fid||''}">保存</button>${fid?`<span id="fu-del-row"><button class="btn danger sm" data-act="fu-del-ask" data-v="${fid}">删除</button></span>`:''}</div>`, true);
}

/* ═════════════ 学生 / 家长手机端：升学、月度 ═════════════ */
function sTrack(s){
  return `<h2 style="font-size:19px">升学</h2>
  ${s.target_ym || s.direction ? `<div class="card small">${s.direction?`<span class="tag gold">${esc(s.direction)}</span> `:''}${s.target_ym?`目标入学 <b>${tgtLabel(s.target_ym)}</b>`:''}${[s.major1,s.major2,s.major3].filter(Boolean).length?`<div class="muted" style="margin-top:4px">专业方向：${esc([s.major1,s.major2,s.major3].filter(Boolean).join('、'))}</div>`:''}</div>` : ''}
  <div class="dg">成绩变化</div><div class="card">${scoreTrend(s.id)}</div>
  <div class="dg">大学目标与出愿日程</div>${targetsView(s.id, false)}`;
}
function sMonthly(s){
  const ym = TODAY.slice(0,7), r = reviewOf(s.id, ym) || {}, past = reviewsOf(s.id).filter(x=>x.ym!==ym).slice().reverse();
  return `<h2 style="font-size:19px">月度回访</h2>
  <section class="card" style="display:flex;flex-direction:column;gap:8px"><b style="font-family:var(--f-disp)">${ymLabel(ym)} · 我的自我评价</b>
    <div class="muted xs">这个月学得怎么样？哪里进步了、哪里还觉得吃力、下个月想加强什么。老师和教务会看到。</div>
    <textarea id="self-eval" placeholder="例：词汇有进步，但有机反应链容易混淆">${esc(r.self_eval||'')}</textarea>
    <div class="row"><button class="btn pri sm" data-act="self-save" data-v="${ym}">${r.self_eval?'更新':'提交'}</button>${r.self_eval?'<span class="tag ok">已写</span>':''}</div></section>
  ${r.teacher_eval || r.next_focus ? reviewCard({...r, ym, student_id:s.id}) : ''}
  <div class="card">${boardView(s.id)}</div>
  ${past.map(x=>reviewCard(x)).join('')}`;
}
function pMonthly(s){
  const rs = reviewsOf(s.id).slice().reverse();
  return `<h2 style="font-size:19px">月度回访</h2><div class="muted xs">教务老师整理完成后显示在这里，包括孩子的自我评价和老师评价。</div><div class="card">${boardView(s.id)}</div>${rs.map(r=>reviewCard(r)).join('') || '<div class="empty">还没有月度回访</div>'}`;
}

/* ═════════════ 老师：学生详情里的升学信息（只读） ═════════════ */
function teacherTrackBlock(sid){
  const s = stu(sid), r = reviewOf(sid, TODAY.slice(0,7)), fus = fusOf(sid).slice(-3).reverse();
  return `<details class="card"><summary><b>学生档案与升学</b> <span class="muted xs">（成绩、大学目标、跟进记录）</span></summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
    ${profileView(s)}${boardView(sid)}<b class="small">成绩变化</b>${scoreTrend(sid)}<b class="small">大学目标</b>${targetsView(sid,false)}
    ${r ? `<b class="small">本月回访</b>${reviewCard(r)}` : ''}
    ${fus.length ? `<b class="small">最近跟进</b><div class="list">${fus.map(f=>fuCard(f,false)).join('')}</div>` : ''}</div></details>`;
}

/* ═════════════ 交互（新功能） ═════════════ */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const v = a.dataset.v, k = a.dataset.act;
  try {
  switch(k){
    case 'student-tab': { const [id,t]=v.split('|'); studentModal(id,t); break; }
    case 'pf-open': profileForm(v); break;
    case 'pf-save': {
      const d = {direction:val('pf-direction'), grade:val('pf-grade'), gender:val('pf-gender'), birth:val('pf-birth'), school:val('pf-school'), target_ym:val('pf-target'),
        lv_jp:val('pf-jp'), lv_en:val('pf-en'), lv_math:val('pf-math'), lv_bun:val('pf-bun'), lv_ri:val('pf-ri'), lv_sat:val('pf-sat'), lv_ap:val('pf-ap'), lv_note:val('pf-note'),
        uni_type:val('pf-uni'), pref1:val('pf-p1'), pref2:val('pf-p2'), region:val('pf-region'), fee:val('pf-fee'), major1:val('pf-m1'), major2:val('pf-m2'), major3:val('pf-m3'), major_other:val('pf-mo')};
      await act('admin_save_profile', {sid:v, d}, '档案资料已保存'); studentModal(v,'profile'); break; }
    case 'sc-add': { const d={student_id:v, date:val('sc-date'), kind:val('sc-kind'), metric:val('sc-metric'), score:val('sc-score').trim(), full_score:val('sc-full').trim(), note:val('sc-note')};
      if(!d.metric||!d.score){toast('请选成绩指标并填分数',true);break;} if(isNaN(Number(d.score))){toast('分数只能填数字',true);break;}
      await act('score_save', {d}, '成绩已记录'); studentModal(v,'score'); break; }
    case 'sc-del': { const x=(DB.scores||[]).find(y=>y.id===v); await act('score_delete', {xid:v}, '已删除'); studentModal(x.student_id,'score'); break; }
    case 'tg-new': targetForm(v); break;
    case 'tg-edit': { const t=(DB.targets||[]).find(x=>x.id===v); targetForm(t.student_id, v); break; }
    case 'tg-save': { const [sid,tid]=v.split('|'); if(!val('tg-school').trim()){toast('请填写大学／专业',true);break;} if(!val('tg-tier')){toast('请选择级别',true);break;}
      const d={student_id:sid, tier:val('tg-tier'), seq:val('tg-seq'), school:val('tg-school'), exam_way:val('tg-way'), requirement:val('tg-req'), score_req:val('tg-score'), status:val('tg-status'), doc_status:val('tg-doc'), next_step:val('tg-next')};
      DATE_KEYS.forEach(([kk])=>d[kk]=val('tg-'+kk)); if(tid) d.id=tid;
      await act('target_save', {d}, '已保存'); studentModal(sid,'target'); break; }
    case 'tg-del-ask': document.getElementById('tg-del-row').innerHTML=`<span class="small">确定删除？</span><button class="btn danger sm" data-act="tg-del" data-v="${v}">删除</button>`; break;
    case 'tg-del': { const t=(DB.targets||[]).find(x=>x.id===v); await act('target_delete', {xid:v}, '已删除'); studentModal(t.student_id,'target'); break; }
    case 'rv-open': { const [sid,ym]=v.split('|'); reviewForm(sid, ym); break; }
    case 'rv-pick': reviewForm(v, val('rv-ym')); break;
    case 'rv-save': { const [sid,ym]=v.split('|'); const d={content:val('rv-content'), teacher_eval:val('rv-teacher'), conclusion:val('rv-concl'), next_focus:val('rv-next'), status:val('rv-status'), note:val('rv-note')};
      await act('review_save', {sid, month:ym, d}, d.status==='已完成'?'已保存，家长现在能看到':'已保存'); if (S.page==='reviews') closeModal(); else studentModal(sid,'review'); break; }
    case 'self-save': { const t=val('self-eval').trim(); if(!t){toast('先写一点自我评价',true);break;} await act('review_self', {month:v, txt:t}, '已提交，谢谢！'); break; }
    case 'fu-new': fuForm(v); break;
    case 'fu-new-pick': { const sid=val('fu-stu'); if(!sid){toast('先选择学生',true);break;} fuForm(sid); break; }
    case 'fu-edit': fuForm(null, v); break;
    case 'fu-save': { const [sid,fid]=v.split('|'); if(!val('fu-date')){toast('请填写日期',true);break;}
      const d={student_id:sid, date:val('fu-date'), time:val('fu-time'), type:val('fu-type'), subject:val('fu-subj'), task:val('fu-task'), result:val('fu-result'), student_fb:val('fu-sfb'), judgment:val('fu-judge'), next_action:val('fu-next'), next_date:val('fu-ndate'), confirm:val('fu-confirm'), note:val('fu-note')};
      if(fid) d.id=fid; await act('followup_save', {d}, '跟进已保存'); if (S.page==='followups') closeModal(); else studentModal(sid,'fu'); break; }
    case 'fu-del-ask': document.getElementById('fu-del-row').innerHTML=`<span class="small">确定删除？</span><button class="btn danger sm" data-act="fu-del" data-v="${v}">删除</button>`; break;
    case 'fu-del': { const f=(DB.followups||[]).find(x=>x.id===v); await act('followup_delete', {xid:v}, '已删除'); if (S.page==='followups') closeModal(); else studentModal(f.student_id,'fu'); break; }
    case 'stu-del-ask': document.getElementById('stu-del-row').innerHTML=`<span class="small" style="color:var(--seal)">删除后，${esc(stu(v).name)} 的课程、课表、反馈、成绩、出愿和链接都会一起删掉，不能恢复。</span><button class="btn seal sm" data-act="stu-del" data-v="${v}">确定删除</button><button class="btn sm" data-act="close">算了</button>`; break;
    case 'stu-del': { await act('admin_delete_student', {sid:v}, r=>`已删除 ${r}`); closeModal(); break; }
  }
  } catch(err){ /* act() 已经提示过 */ }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  if (el.dataset.change==='sc-metric'){ const f = OPT.fullScore[el.value]; const fi = document.getElementById('sc-full'); if (fi && f && !fi.value) fi.value = f; }
  if (el.dataset.change==='rv-month'){ S.rvMonth = el.value; render(); }
});
