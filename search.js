/* ══════════════════════════════════════════════════════════════
   模糊搜索：简体 / 繁体 / 日文汉字互通，英文、罗马字、简称也能搜到学校
   fz(文字) 把文字变成「搜索用的样子」；fzHit(搜索词, 内容) 判断搜不搜得到
   ══════════════════════════════════════════════════════════════ */
// 同一个字的不同写法：每组第一个字当标准写法
const FZ_GROUPS = ('稻稲 艺芸藝 术術 东東 学學 庆慶 应応應 义義 筑築 广広廣 岛島嶋 冈岡 滨浜濱 国國 际際 馆館舘 关関關 桥橋 业業 农農 乐楽樂 ' +
 '电電 机機 图図圖 书書 摄撮 剧劇 视視 觉覚覺 产産 经経經 济済濟 营営營 环環 传伝傳 发発發 达達 丰豊 华華 纪紀 绘絵繪 动動 读読讀 ' +
 '专専專 门門 实実實 验験驗 试試 选選 县県縣 圣聖 爱愛 贺賀 饰飾 德徳 龙竜龍 驹駒 泽沢澤 藏蔵 樱桜櫻 亚亜亞 细細 叶葉 马馬 长長 儿児兒 ' +
 '冲沖 绳縄繩 设設 计計 画畫 会會 体體 数數 声聲 历歴歷 团団團 园園 远遠 铁鉄鐵 钢鋼 镜鏡 银銀 铃鈴 阳陽 阴陰 队隊 湾灣 台臺 万萬 与與 ' +
 '两両兩 严厳嚴 临臨 为為 乡郷鄉 买買 乱亂 亿億 仪儀 众衆 优優 伦倫 伤傷 佛仏 侨僑 债債 党黨 兴興 军軍 净浄 减減 则則 创創 别別 剑剣劍 ' +
 '劝勧 务務 劳労勞 势勢 区區 医醫 协協 单単單 卖売賣 卫衛 厅庁廳 压圧壓 参參 双雙 变変變 号號 后後 员員 响響 问問 围囲圍 圆円圓 坏壊 ' +
 '块塊 坚堅 坛壇 处処 备備 复復 头頭 奋奮 奖奨 妇婦 宁寧 宝寶 审審 宪憲 宫宮 宽寛 对対對 寻尋 导導 寿壽 将將 尔爾 层層 岁歳 岭嶺 峡峽 ' +
 '币幣 师師 带帯帶 帮幇 庄荘 库庫 庙廟 废廃 开開 异異 弃棄 张張 弹弾彈 强強 归帰歸 当當 录録 径徑 忆憶 态態 总総總 恋戀 恶悪惡 惊驚 ' +
 '惯慣 戏戯戲 战戦戰 户戸 执執 扩拡擴 扫掃 护護 报報 担擔 拟擬 择択擇 挂掛 挥揮 损損 换換 据拠據 收収 敌敵 断斷 无無 旧舊 时時 显顕顯 ' +
 '晓暁 暂暫 杀殺 杂雑雜 权権權 条條 来來 杨楊 极極 构構 枪槍 标標 样様 树樹 梦夢 检検檢 楼樓 欢歓 欧歐 残殘 毕畢 气気氣 汉漢 污汚 决決 ' +
 '沟溝 浅淺 测測 浓濃 涉渉 温溫 满満滿 灭滅 灯燈 灵霊靈 热熱 烟煙 牵牽 状狀 犹猶 独獨 狭狹 献獻 现現 畅暢 疗療 监監 盖蓋 盐塩鹽 盘盤 ' +
 '矿鉱 码碼 础礎 礼禮 离離 种種 称稱 积積 稳穏 穷窮 竞競 笔筆 简簡 类類 粮糧 红紅 级級 纯純 纲綱 纳納 纸紙 线線 练練 组組 织織 终終 ' +
 '结結 给給 络絡 统統 继継繼 绩績 续続續 维維 综総綜 绿緑綠 编編 缘縁 网網 罗羅 职職 联聯 肃粛 胜勝 脑脳腦 腾騰 舍舎 舰艦 节節 苏蘇 ' +
 '范範 荣栄榮 药薬藥 获獲 萨薩 蓝藍 虑慮 补補 见見 观観觀 规規 览覧 触觸 订訂 认認 让譲 训訓 议議 讯訊 记記 讲講 论論 访訪 证証證 评評 ' +
 '识識 诉訴 词詞 译訳譯 诗詩 诚誠 话話 询詢 该該 详詳 语語 误誤 说説 请請 诸諸 课課 谁誰 调調 谈談 谋謀 谢謝 谱譜 贝貝 负負 贡貢 财財 ' +
 '责責 质質 贩販 贫貧 购購 贯貫 贸貿 费費 资資 赏賞 赛賽 赞賛 趋趨 跃躍 践踐 车車 轨軌 转転轉 轮輪 软軟 轻軽輕 载載 较較 辅輔 辈輩 辑輯 ' +
 '输輸 辩弁 边辺邊 过過 运運 还還 进進 连連 适適 递逓 遗遺 邮郵 邻隣 郑鄭 释釈 里裏 针針 钟鐘 铭銘 销銷 锋鋒 错錯 锻鍛 镇鎮 闭閉 间間 ' +
 '闻聞 阁閣 阅閲 阶階 陆陸 陈陳 险険 隐隠 难難 雾霧 韩韓 页頁 项項 顺順 须須 顾顧 预預 领領 频頻 题題 颜顔 风風 飞飛 鱼魚 鲜鮮 鸟鳥 ' +
 '鸣鳴 鹤鶴 齐斉齊 齿歯齒 龄齢 写寫 泪涙 渐漸 览覽 禅禪 恒恆 研硏 将').split(' ');
const FZ_MAP = {};
FZ_GROUPS.forEach(g => { const cs = [...g]; cs.forEach(c => FZ_MAP[c] = cs[0]); });

// 学校的别名：日文正式名 | 中文 | 英文 | 罗马字 | 简称
const FZ_ALIASES = [
 '早稲田大学|早稻田大学|早大|waseda|waseda university',
 '慶應義塾大学|庆应义塾大学|庆应大学|庆应|慶応|keio|keio university',
 '東京大学|东京大学|东大|todai|university of tokyo|tokyo university',
 '京都大学|京大|kyodai|kyoto university',
 '一橋大学|一桥大学|一桥|hitotsubashi',
 '東京藝術大学|东京艺术大学|东艺|东京艺大|藝大|geidai|tokyo geidai|tokyo university of the arts',
 '武蔵野美術大学|武藏野美术大学|武美|武藏美|musabi|musashino art university',
 '多摩美術大学|多摩美术大学|多摩美|tamabi|tama art university',
 '女子美術大学|女子美术大学|女子美|joshibi',
 '東京造形大学|东京造形大学|造形大|zokei|tokyo zokei',
 '日本大学|日大|nihon university|nichidai',
 '日本大学芸術学部|日艺|日藝|nichigei',
 '東京工芸大学|东京工艺大学|东工艺|工艺大|kougei|t-kougei|tokyo polytechnic',
 '京都精華大学|京都精华大学|精华|seika|kyoto seika',
 '京都芸術大学|京都艺术大学|京艺|瓜生山|kua|kyoto university of the arts|kyoto university of art and design',
 '京都市立芸術大学|京都市立艺术大学|京都市艺|kcua',
 '大阪芸術大学|大阪艺术大学|大艺|osaka geidai|osaka university of arts',
 '神戸芸術工科大学|神户艺术工科大学|神户艺工|kobe design university|kdu',
 '成安造形大学|成安|seian',
 '名古屋芸術大学|名古屋艺术大学|名艺|nua',
 '東北芸術工科大学|东北艺术工科大学|东北艺工|tuad',
 '金沢美術工芸大学|金泽美术工艺大学|金美|kanabi',
 '愛知県立芸術大学|爱知县立艺术大学|爱知艺大|aichi geidai',
 '沖縄県立芸術大学|冲绳县立艺术大学|okigei',
 '文化学園大学|文化学园大学|文化服装|文化|bunka',
 '杉野服飾大学|杉野服饰大学|杉野|sugino',
 'デジタルハリウッド大学|数字好莱坞大学|数字好莱坞|dhw|digital hollywood',
 '宝塚大学|宝冢大学|takarazuka',
 '尚美学園大学|尚美学园|shobi',
 '城西国際大学|城西国际大学|josai international|jiu',
 '上智大学|sophia|sophia university',
 '立教大学|rikkyo',
 '明治大学|meiji|meiji university',
 '青山学院大学|青学|aoyama gakuin|aogaku',
 '中央大学|chuo|chuo university',
 '法政大学|hosei',
 '東京理科大学|东京理科大学|理科大|tus|tokyo university of science',
 '東京科学大学|东京科学大学|东工大|東京工業大学|东京工业大学|tokyo tech|science tokyo',
 '筑波大学|tsukuba',
 '大阪大学|阪大|handai|osaka university',
 '名古屋大学|名大|nagoya university',
 '東北大学|东北大学|tohoku',
 '九州大学|九大|kyushu university',
 '北海道大学|北大|hokkaido university',
 '神戸大学|神户大学|kobe university',
 '横浜国立大学|横滨国立大学|横国|ynu|yokohama national',
 '千葉大学|千叶大学|chiba university',
 'お茶の水女子大学|御茶水女子大学|御茶水|ochanomizu|ochadai',
 '東京外国語大学|东京外国语大学|东外大|tufs',
 '国際基督教大学|国际基督教大学|icu',
 '東京都立大学|东京都立大学|都立大|tmu',
 '大阪公立大学|omu|osaka metropolitan',
 '立命館大学|立命馆大学|立命馆|ritsumeikan',
 '同志社大学|doshisha',
 '関西大学|关西大学|关大|kandai|kansai university',
 '関西学院大学|关西学院大学|关学|kwansei|kangaku',
 '東洋大学|东洋大学|toyo university',
 '駒澤大学|驹泽大学|komazawa',
 '専修大学|专修大学|senshu',
 '帝京大学|teikyo',
 '国士舘大学|国士馆大学|kokushikan',
 '拓殖大学|takushoku',
 '桜美林大学|樱美林大学|樱美林|obirin|j. f. oberlin',
 '東海大学|东海大学|tokai',
 '近畿大学|近大|kindai',
 '龍谷大学|龙谷大学|ryukoku',
 '武蔵野大学|武藏野大学|musashino university',
 '東京音楽大学|东京音乐大学|tokyo college of music',
 '国立音楽大学|国立音乐大学|kunitachi',
 '洗足学園音楽大学|洗足|senzoku',
 '昭和音楽大学|昭和音乐大学|showa',
 '武蔵野音楽大学|武藏野音乐大学|musashino academia musicae',
 '桐朋学園大学|桐朋|toho gakuen',
].map(s => s.split('|'));

// 变成搜索用的样子：全角半角统一、小写、去空格和符号、片假名变平假名、各种写法的汉字统一
function fz(s){
  s = String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s・·\/,，、。.()（）\-ー－_「」『』【】]/g, '');
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    const h = (c >= 0x30a1 && c <= 0x30f6) ? String.fromCharCode(c - 0x60) : ch;   // カ → か
    out += FZ_MAP[h] || h;
  }
  return out;
}
const FZ_ALIAS_N = FZ_ALIASES.map(a => ({key: fz(a[0]), all: a.map(fz)}));
// 一所学校的全部别名（按学校名对上内置名单）
function fzAliases(school){
  const n = fz(school);
  return FZ_ALIAS_N.filter(a => n.includes(a.key)).flatMap(a => a.all).join(' ');
}
// 搜索词按空格分开，每个词都要搜得到
var fzHit = function(query, hay){
  const words = String(query || '').trim().split(/[\s　]+/).map(fz).filter(Boolean);
  return !words.length || words.every(w => hay.includes(w));
}

// 专业词中日对照：搜其中任何一个，等于搜这一组
const FZ_TERMS = [
 '动画|アニメ|animation', '漫画|マンガ|まんが|comic|manga', '电影|映画|film|cinema', '影像|映像|video|media', '摄影|写真|photo',
 '设计|デザイン|design', '美术|美術|fine art', '艺术|芸術|藝術|art', '表演|演剧|演劇|舞台|theatre|theater|drama', '舞蹈|舞踊|dance',
 '游戏|ゲーム|game', '插画|イラスト|illustration', '角色|キャラクター|character', '服装|ファッション|服飾|fashion', '建筑|建築|architecture',
 '媒体|メディア|media', '音乐|音楽|music', '视觉|ビジュアル|visual', '情报|情報|信息|information', '数字|デジタル|digital',
 '工艺|工芸|craft', '雕塑|彫刻|sculpture', '油画|油画|油絵|oil painting', '日本画|日本画', '版画|版画', '陶艺|陶芸|ceramic',
 '纺织|テキスタイル|textile', '产品|プロダクト|product', '空间|空間|space', '环境|環境|environment', '传播|コミュニケーション|communication',
 '经营|経営|商学|business|management', '经济|経済|economics', '文学|文学|literature', '社会|社会|sociology', '国际|国際|international',
 '研究生|研究生|research student', '大学院|研究科|graduate', '学部|undergraduate', '留学生|外国人|international student',
].map(s => s.split('|').map(fz));
function fzWord(w){ const g = FZ_TERMS.find(t => t.some(x => x && (x === w || (w.length >= 2 && x.startsWith(w))))); return g ? g.filter(Boolean) : [w]; }
fzHit = function(query, hay){
  const words = String(query || '').trim().split(/[\s　]+/).map(fz).filter(Boolean);
  return !words.length || words.every(w => hay.includes(w) || fzWord(w).some(x => hay.includes(x)));
};
