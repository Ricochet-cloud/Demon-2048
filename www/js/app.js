// 화면 전환 (홈 / 게임 / 프로필 / 도감 / 상점 / 설정 / 로그인)
// - 주소의 #이름 으로 화면을 구분해서 안드로이드 뒤로가기 버튼도 자연스럽게 동작해요
// - 새 화면을 만들면 index.html 에 <section data-screen="이름"> 을 추가하고 아래 SCREENS 에 이름만 넣어요
// - 로그인이 켜져 있으면(firebase-config.js 에 값이 있으면) 로그인 전에는 로그인 화면만 보여요
(() => {
  'use strict';

  const SCREENS = ['home', 'modes', 'game', 'profile', 'dex', 'shop', 'settings', 'event', 'vote', 'pvote', 'board', 'tips', 'login'];
  // 상점 물건(프로필 사진·프레임·칭호·배경·이름·테마)의 이름과 가격은 js/shopdata.js 에서 바꿔요.
  // 프로필 사진은 images/avatars/<id>.webp, price 가 있으면 상점에서 골드로 사야 쓸 수 있어요 (없으면 처음부터 무료)
  const SHOP = window.SHOP;   // 상점 물건 목록은 js/shopdata.js
  const AVATARS = SHOP.avatars;
  const avatarSrc = (id) => { const a = AVATARS.find((x) => x.id === id); return `./images/avatars/${id}.webp${a && a.ver ? '?v=' + a.ver : ''}`; };
  const knownAvatar = (id) => AVATARS.some((a) => a.id === id);
  // 쓸 수 있는 사진: 무료이거나, 샀거나, 이미 지금 쓰고 있는 사진 (이전에 고른 사진은 그대로 써요)
  const ownsAvatar = (a) => !a.price || G.owns('avatar:' + a.id) || a.id === C.avatar;
  // 프레임(사진 테두리) — CSS 는 app.css 의 .fr-<id>. price 없으면 무료
  const FRAMES = SHOP.frames;
  // 칭호 — price 가 있으면 상점에서 사고, when 이 있으면 조건을 채우면 저절로 얻어요 (diligent 는 미션을 다 받을 때 gold.js 가 줘요)
  const best = () => readSaved().bestTile || 0;
  const dexHalf = () => best() >= 128;      // 도감 절반 (가장 긴 도감 14칸 중 7칸 = 128 타일)
  const dexFull = () => best() >= 8192;     // 그림 있는 도감 하나를 다 채움
  // 업적 칭호의 조건 (shopdata.js 의 cond 이름과 짝이에요)
  const CONDS = { win2048: () => best() >= 2048, dexHalf, dexFull };
  // 이벤트 전적 칭호 (shopdata.js 를 건드리지 않고 여기서 정해요). 조건은 AppBetting.stats() 로 확인해요
  const evStat = () => (window.AppBetting && window.AppBetting.stats ? window.AppBetting.stats() : { w: 0, l: 0, streak: 0, best: 0 });
  Object.assign(CONDS, { evPlay1: () => { const s = evStat(); return s.w + s.l >= 1; }, evWin3: () => evStat().w >= 3, evWin10: () => evStat().w >= 10, evStreak3: () => evStat().best >= 3, bestWin1: () => G.ownedList().some((x) => String(x).startsWith('pw:')) });
  const EV_TITLES = [
    { id: 'evfirst', name: '첫 승부', cond: 'evPlay1', how: '이벤트에 한 번 참가하기 (결과가 나온 뒤)' },
    { id: 'evwin3', name: '예언가', cond: 'evWin3', how: '이벤트에서 3번 이기기' },
    { id: 'evstreak3', name: '연승 행진', cond: 'evStreak3', how: '이벤트 3연승' },
    { id: 'evwin10', name: '승부사', cond: 'evWin10', how: '이벤트에서 10번 이기기' },
    { id: 'bestprofile', name: '베스트 프로필', cond: 'bestWin1', how: '프로필 투표에서 1등 하기' }
  ];
  const TITLES = SHOP.titles.concat(EV_TITLES.filter((e) => !SHOP.titles.some((t) => t.id === e.id))).map((t) => (t.cond ? Object.assign({}, t, { when: CONDS[t.cond] || (() => false) }) : t));
  // 카드 배경 (우리 기록의 내 줄과 프로필 카드) — CSS 는 app.css 의 .bg-<id>
  const BGS = SHOP.bgs;
  // 이름 꾸미기 (닉네임 색과 효과) — CSS 는 app.css 의 .nm-<id>
  const NAMEFX = SHOP.nameFx;
  const bgOf = (id) => BGS.find((b) => b.id === id);
  const fxOf = (id) => NAMEFX.find((b) => b.id === id);
  const ownsBg = (b) => G.owns('bg:' + b.id) || b.id === C.bg;
  const ownsFx = (b) => G.owns('name:' + b.id) || b.id === C.nameFx;
  const frameOf = (id) => FRAMES.find((f) => f.id === id);
  const titleOf = (id) => TITLES.find((t) => t.id === id);
  const SE = window.AppSeason;   // 시즌 (season.js)
  // 랭크 — 최고 점수 기준 (기준 점수는 여기만 고치면 돼요). 한 번 오르면 최고 점수가 기준이라 내려가지 않아요
  const RANKS = [
    { id: 'bronze', name: '브론즈', min: 2000, reward: 100 },       // reward: 시즌이 끝났을 때 이 랭크로 마치면 받는 골드
    { id: 'silver', name: '실버', min: 5000, reward: 200 },
    { id: 'gold', name: '골드', min: 12000, reward: 400 },
    { id: 'platinum', name: '플래티넘', min: 25000, reward: 700 },
    { id: 'diamond', name: '다이아', min: 50000, reward: 1200 }
  ];
  const rankOf = (score) => { let r = null; RANKS.forEach((x) => { if ((score || 0) >= x.min) r = x; }); return r; };
  function rankBadge(score) {
    const r = rankOf(score), el = document.createElement('span');
    el.className = 'rk ' + (r ? 'rk-' + r.id : 'rk-none');
    el.textContent = r ? r.name : '언랭크';
    el.title = r ? `최고 점수 ${r.min.toLocaleString('ko-KR')}점 이상` : `최고 점수 ${RANKS[0].min.toLocaleString('ko-KR')}점부터 랭크가 생겨요`;
    return el;
  }
  const ownsFrame = (f) => !f.price || G.owns('frame:' + f.id) || f.id === C.frame;
  const ownsTitle = (t) => (t.when ? t.when() : false) || G.owns('title:' + t.id) || t.id === C.title;
  const STORE_KEY = 'game2048.v1';   // game.js 와 같은 키
  const $ = (id) => document.getElementById(id);
  const A = window.AppAuth;
  const C = window.AppCloud;
  const T = window.AppThemes;
  const G = window.AppGold;
  const W = window.AppWeekly;
  const B = window.AppBetting;   // 배팅 이벤트 (betting.js)

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  const current = () => { const n = location.hash.slice(1); return SCREENS.includes(n) ? n : 'home'; };

  // 지금 실제로 보여줄 화면 (로그인 상태에 따라 달라져요)
  function effective() {
    const name = current();
    if (!A.enabled) return name === 'login' ? 'home' : name;
    if (!A.ready) return 'boot';
    if (!A.user) return 'login';
    return name === 'login' ? 'home' : name;
  }

  // 홈 맨 위 공지 배너 (events/notices.json). 읽는 동안에는 지금 있는 걸 그대로 보여줘요
  const NT = window.AppNotice;
  function refreshNotice() {
    const draw = () => NT.render($('homeNotice'), $('noticeTrack'), document.querySelector('.screen--home'));
    draw(); NT.load().then(draw).catch(() => {});
  }

  // 홈 알림 카드 (events/alerts.json) — 사용자가 닫으면 그 알림은 다시 안 나와요
  function refreshAlerts() {
    const AL = window.AppAlert; if (!AL) return;
    const draw = () => AL.render($('homeAlerts'));
    draw(); AL.load().then(draw).catch(() => {});
  }

  // 골드 선물 카드 (events/gifts.json) — 로그인한 사람에게만 보이고, 받기를 누르면 골드가 들어와요 (선물마다 한 번)
  function refreshGifts() {
    const GF = window.AppGift, box = $('homeGifts'); if (!GF || !box) return;
    const env = {
      uid: A.enabled && A.user && C.enabled ? A.user.uid : '',
      owns: (k) => G.owns(k),
      claim: (id, gold) => G.claimGift(id, gold),
      done: (gold) => { toastMsg(`선물! 골드 ${gold.toLocaleString('ko-KR')}을 받았어요`); refreshHome(); }
    };
    GF.render(box, env); GF.load().then(() => GF.render(box, env)).catch(() => {});
  }

  function refreshHome() {
    refreshNotice();
    refreshAlerts();
    refreshGifts();
    // 로그인했는데 닉네임이 아직 없으면 안내
    $('homeHint').hidden = !(C.enabled && C.loaded && (!C.nickname || !(knownAvatar(C.avatar) || C.photo)));
    const th = T.dexTheme(), got = T.discovered(readSaved().bestTile, th).length;
    $('homeDex').textContent = `${got} / ${th.values.length}`;
    $('homeGold').textContent = G.gold;
    $('homeShopTag').hidden = G.claimable() === 0;
    refreshStartTag();   // 이벤트 보상·참여, 없으면 오늘의 도전
    refreshSeasonReward();
    refreshHomeRank();
  }

  // ---------- 시즌 보상 ----------
  // 지난 시즌을 마친 랭크에 따라 골드를 한 번 받아요 (바로 지난 시즌만, 받으면 'sr:시즌' 표시가 남아요)
  function seasonRewardInfo() {
    const s = readSaved(), pk = SE.prevKey(SE.key());
    const r = s.pseason === pk ? rankOf(s.pbest) : null;
    return r && !G.owns('sr:' + pk) ? { key: pk, rank: r } : null;
  }
  function refreshSeasonReward() {
    const box = $('seasonReward'), info = A.enabled && C.enabled && C.loaded ? seasonRewardInfo() : null;
    box.hidden = !info;
    if (!info) return;
    $('seasonRewardTitle').textContent = `${SE.monthNo(info.key)}월 시즌 보상`;
    $('seasonRewardText').textContent = `${info.rank.name} 랭크로 마쳤어요! 골드 ${info.rank.reward.toLocaleString('ko-KR')}을 받을 수 있어요.`;
  }
  $('seasonRewardBtn').addEventListener('click', async () => {
    const info = seasonRewardInfo(); if (!info) return;
    $('seasonRewardBtn').disabled = true;
    try { await G.claimSeason(info.key, info.rank.reward); toastMsg(`${SE.monthNo(info.key)}월 시즌 보상! 골드 ${info.rank.reward.toLocaleString('ko-KR')}을 받았어요`); }
    catch (e) { toastMsg(e.user ? e.message : '받지 못했어요. 인터넷 연결을 확인해 주세요.'); }
    $('seasonRewardBtn').disabled = false; refreshSeasonReward();
  });

  // ---------- 응원 ----------
  const CHEER_MSGS = ['화이팅!', '오늘도 한 판?', '대단해요!', '곧 따라잡을게요', '쉬엄쉬엄 해요'];
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } };
  const sentToday = () => { const s = lsGet('game2048.cheer.v1', {}); return s.day === G.dayKey() ? s.to || [] : []; };
  const markSent = (uid) => lsSet('game2048.cheer.v1', { day: G.dayKey(), to: [...sentToday(), uid] });
  const seenToday = () => { const s = lsGet('game2048.cheerseen.v1', {}); return s.day === G.dayKey() ? s.ids || [] : []; };
  let cheerIds = [];

  async function renderHomeCheers(list) {
    const box = $('cheerBox');
    try {
      const cheers = (await C.loadCheers(G.dayKey())).filter((c) => !seenToday().includes(c.id));
      cheerIds = cheers.map((c) => c.id);
      const wrap = $('cheerList'); wrap.textContent = '';
      cheers.forEach((c) => {
        const u = list.find((x) => x.uid === c.from) || {};
        const row = document.createElement('div'); row.className = 'cheer';
        row.appendChild(avatarEl(u.avatar, u.nickname, u.frame, u.photo));
        const t = document.createElement('div'); t.className = 'cheer__txt';
        const n = document.createElement('b'); n.textContent = u.nickname || '이름 없음';
        t.appendChild(n); t.appendChild(document.createTextNode(c.msg || '화이팅!'));
        row.appendChild(t); wrap.appendChild(row);
      });
      box.hidden = cheers.length === 0;
    } catch (e) { box.hidden = true; }
  }
  $('cheerOk').addEventListener('click', () => { lsSet('game2048.cheerseen.v1', { day: G.dayKey(), ids: [...seenToday(), ...cheerIds] }); $('cheerBox').hidden = true; });

  // 홈의 작은 '우리 기록' 카드 (로그인했고 기록을 받았을 때만)
  let homeRankSeq = 0;
  async function refreshHomeRank() {
    const card = $('homeRank'), seq = ++homeRankSeq;
    if (!(A.enabled && A.user && C.loaded && !C.failed)) { card.hidden = true; $('cheerBox').hidden = true; return; }
    try {
      const list = await C.loadAll();
      if (seq !== homeRankSeq || effective() !== 'home') return;
      renderRank(list.sort((a, b) => SE.bestOf(b) - SE.bestOf(a)).slice(0, 3), $('homeRankList'), true);
      $('homeSeason').textContent = `${SE.monthNo(SE.key())}월 시즌 · ${SE.leftText()}`;
      renderHomeCheers(list);
      refreshEventBtn(list);
      refreshVoteTag(list);
      card.hidden = list.length === 0;
    } catch (e) { card.hidden = true; }
  }


  // ---------- 배팅 이벤트 ----------
  const nf = (n) => Number(n).toLocaleString('ko-KR');
  const toastMsg = (msg) => { const t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // 게임 모드 목록의 '이벤트' 줄: 보여줄 이벤트가 있을 때만 나와요 (보상 받을 게 있는지는 기록을 받을 때 알아 둬요)
  let evClaimable = false;
  function refreshEventBtn(list) {
    const ev = B.ready && A.enabled && C.enabled ? B.current() : null;
    if (ev && list) evClaimable = B.phase(ev) === 'ended' && B.mine(ev, list, C.uid).claimable;
    if (effective() === 'modes') refreshModes();
    refreshHomeEvent(ev, list);
    // 지금 보여주는 이벤트가 아닌 앞 이벤트에서 이긴 보상이 남아 있으면 저절로 받아요 (새 이벤트가 시작돼도 놓치지 않게)
    if (list && B.ready && A.enabled && C.enabled) B.claimOld(list, ev && ev.id).then((got) => { if (got.length) toastMsg(`지난 이벤트 보상! 골드 ${got.reduce((n, e) => n + e.reward, 0).toLocaleString('ko-KR')}을 받았어요`); }).catch(() => {});
  }
  // 홈 '게임 시작' 옆 표시: 이벤트 보상이 있거나 편을 아직 안 골랐으면 그걸 먼저, 아니면 오늘의 도전
  let homeEvTag = '';
  function refreshStartTag() {
    const t = homeEvTag || (window.Game2048.challengeState().done ? '' : '오늘의 도전');
    const tag = $('homeChallengeTag');
    tag.hidden = !t; tag.textContent = t;
  }
  function refreshHomeEvent(ev, list) {
    let t = '';
    if (ev && list) {
      const ph = B.phase(ev), my = B.mine(ev, list, C.uid);
      if (my.claimable) t = '이벤트 보상';
      else if (ph === 'live' && !my.side) t = '이벤트 참여';
    }
    homeEvTag = t;
    refreshStartTag();
  }
  const modeEvent = () => (B.ready && A.enabled && C.enabled ? B.current() : null);

  function sideFace(side) {
    const f = el('div', 'evface');
    f.style.setProperty('--c', side.color);
    if (side.image) { const i = document.createElement('img'); i.src = side.image; i.alt = ''; i.draggable = false; f.appendChild(i); }
    else f.textContent = [...side.name][0];
    return f;
  }

    // 대결 바: 처음 들어오면 어느 쪽이 이기는지 바로 안 보이게 왔다 갔다 하다가 진짜 비율에 자리 잡고, 진행 중에는 계속 움찔움찔해요
  let tugged = '';
  window.addEventListener('hashchange', () => { if (location.hash !== '#event') tugged = ''; });
  function barFight(bar, ba, bb, pa, tug, realText, leadEl, live) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const set = (v) => { const x = Math.max(6, Math.min(94, v)); ba.style.width = x + '%'; bb.style.width = (100 - x) + '%'; };
    let alive = true;
    const later = (fn, ms) => setTimeout(() => { if (alive && bar.isConnected) fn(); else alive = false; }, ms);
    const idle = () => {
      if (!live || reduce) return;
      const d = (Math.random() < .5 ? -1 : 1) * (1 + Math.random() * 1.6);
      set(pa + d); later(() => { set(pa); later(idle, 1400 + Math.random() * 1800); }, 320);
    };
    if (!tug) { later(idle, 1200); return; }
    bar.classList.add('evbar--tug'); set(50);
    const P = [0, .08, .22, .4, .65, 1], A = [17, 15, 11, 8, 5, 0];
    let k = 0;
    const step = () => {
      if (k >= P.length) { bar.classList.remove('evbar--tug'); leadEl.textContent = realText; later(idle, 1400); return; }
      set(50 + (pa - 50) * P[k] + (k % 2 ? -1 : 1) * A[k]); k++; later(step, k === P.length ? 700 : 430);
    };
    later(step, 500);
  }

function drawEvent(ev, list) {
    const body = $('evBody'); body.textContent = '';
    const ph = B.phase(ev), t = B.tally(ev, list), my = B.mine(ev, list, C.uid), tot = t.a.val + t.b.val;
    const blind = !!ev.stake && ph !== 'ended' && !my.side;   // 골드 걸기는 참가하기 전까지 편별 점수·인원을 숨겨요 (골라서 건 뒤에는 보여요)
    const card = el('div', 'card evcard');
    if (ev.image) { const i = document.createElement('img'); i.className = 'ev__banner'; i.src = ev.image; i.alt = ''; i.draggable = false; i.addEventListener('error', () => i.remove()); card.appendChild(i); }
    card.appendChild(el('h2', 'ev__title', ev.title));
    if (ev.desc) card.appendChild(el('p', 'ev__desc', ev.desc));
    const left = B.leftText(ev);
    card.appendChild(el('p', 'ev__meta', `${B.period(ev)}${left ? ' · ' + left : ''}${ev.reward ? ' · 이긴 편 골드 ' + nf(ev.reward) : ''}`));

    const vs = el('div', 'evvs');
    [t.a, t.b].forEach((x, i) => {
      const s = el('div', 'evside' + (i ? ' evside--r' : '') + (my.side === x.side.id ? ' evside--me' : '') + (ph === 'ended' && t.winners.includes(x.side.id) ? ' evside--win' : ''));
      s.style.setProperty('--c', x.side.color);
      s.appendChild(sideFace(x.side));
      s.appendChild(el('b', 'evside__name', x.side.name));
      s.appendChild(el('span', 'evside__score', blind ? '비공개' : `${ev.avg ? '평균 ' : ''}${nf(x.val)}점`));
      s.appendChild(el('small', 'evside__n', `${blind ? '' : x.members.length + '명'}${!blind && ev.stake ? ' · 건 골드 ' + nf(x.gold) : ''}${my.side === x.side.id ? (blind ? '내 편' : ' · 내 편') : ''}`));
      vs.appendChild(s);
      if (!i) vs.appendChild(el('div', 'evvs__vs', 'VS'));
    });
    card.appendChild(vs);

    const bar = el('div', 'evbar');
    const pa = tot ? Math.max(6, Math.min(94, t.a.val / tot * 100)) : 50;
    const ba = el('i', 'evbar__a'), bb = el('i', 'evbar__b');
    ba.style.width = pa + '%'; ba.style.background = t.a.side.color; bb.style.width = (100 - pa) + '%'; bb.style.background = t.b.side.color;
    bar.appendChild(ba); bar.appendChild(bb); if (!blind) card.appendChild(bar);
    const tug = !blind && tot > 0 && ph !== 'upcoming' && tugged !== ev.id && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (tug) tugged = ev.id;
    const realLead = blind && ph === 'live' ? `블라인드 이벤트예요. 참가 ${t.a.members.length + t.b.members.length}명 · 편을 고르고 골드를 걸면 현재 상황이 보여요`
      : ev.stake && ph === 'ended' && !my.refunded && t.winners.length === 1 && t.a.gold && t.b.gold ? `${t.lead.side.name} 편이 이겼어요! 진 편이 잃은 골드의 절반을 이긴 편이 건 금액대로 나눠 가졌어요`
      : ev.stake && ph === 'ended' && (t.winners.length !== 1 || !t.a.gold || !t.b.gold) ? '무승부이거나 한쪽에만 걸어서, 건 골드를 모두 돌려받아요'
      : ph === 'upcoming' ? '아직 시작 전이에요. 시작하면 점수가 쌓여요'
      : !tot ? '아직 아무도 점수를 모으지 못했어요'
      : !t.lead ? (ph === 'ended' ? '무승부! 두 편 모두 이겼어요' : '똑같아요! 팽팽해요')
      : ph === 'ended' ? `${t.lead.side.name} 편이 이겼어요!`
      : `${t.lead.side.name} 편이 ${nf(Math.abs(t.a.val - t.b.val))}점 앞서고 있어요`;
    const lead = tug ? '팽팽하게 겨루는 중…' : realLead;
    const leadEl = el('p', 'ev__lead', lead); card.appendChild(leadEl);
    if (!blind && tot > 0) barFight(bar, ba, bb, pa, tug, realLead, leadEl, ph === 'live');

    const act = el('div', 'evact');
    if (ph === 'ended') {
      if (my.claimable) {
        const amount = ev.stake ? my.payout : ev.reward;
        const b = el('button', 'btn btn--wide', `${ev.stake ? '정산 받기' : '보상 받기'} · 골드 ${nf(amount)}`); b.type = 'button';
        b.addEventListener('click', async () => {
          b.disabled = true;
          try { await G.claimEvent(ev.id, amount); toastMsg(ev.stake ? `정산 골드 ${nf(amount)}을 받았어요` : `이겼어요! 골드 ${nf(amount)}을 받았어요`); }
          catch (e) { toastMsg(e.user ? e.message : '받지 못했어요. 잠시 뒤에 다시 해 주세요.'); }
          refreshEvent();
        });
        act.appendChild(b);
      } else if (ev.stake && my.side) act.appendChild(el('p', 'ev__state', my.claimed ? `정산을 받았어요 (골드 ${nf(my.payout)})` : '정산할 골드가 없어요'));
      else act.appendChild(el('p', 'ev__state', my.win && my.claimed ? '보상을 받았어요' : my.win ? '이겼어요!' : my.side ? (t.winners.length ? '아쉽게 졌어요' : '결과가 없어요') : '이번 이벤트에는 참가하지 않았어요'));
    } else if (my.side) {
      const mine = ev.sides.find((s) => s.id === my.side);
      act.appendChild(el('p', 'ev__state', `내 편: ${mine.name}${ev.stake ? ` · 건 골드 ${nf(my.stake)}` : ''}${ph === 'live' ? ` · 내 점수 ${nf(my.score)}점` : ''}`));
    } else {
      act.appendChild(el('p', 'ev__ask', ev.stake ? '어느 편이 이길까요? 골드를 걸고 한 번 고르면 바꿀 수 없어요' : '어느 편이 이길까요? 한 번 고르면 바꿀 수 없어요'));
      let amt = null;
      if (ev.stake) {
        const wrap = el('div', 'evstake');
        amt = document.createElement('input'); amt.type = 'number'; amt.className = 'field evstake__in'; amt.inputMode = 'numeric';
        amt.min = ev.stake.min; amt.max = ev.stake.max; amt.step = 1; amt.value = ev.stake.min; amt.setAttribute('aria-label', '걸 골드');
        wrap.appendChild(el('span', null, '걸 골드')); wrap.appendChild(amt);
        wrap.appendChild(el('small', null, `${nf(ev.stake.min)}~${nf(ev.stake.max)} · 보유 ${nf(G.gold)}`));
        act.appendChild(wrap);
        act.appendChild(el('p', 'ev__rule', '이기면 건 골드와 함께 진 편이 잃은 골드의 절반을 나눠 받고, 지면 건 골드의 절반을 돌려받아요. 현재 상황은 편을 고르고 골드를 건 뒤에 볼 수 있어요.'));
      }
      const row = el('div', 'evpick');
      ev.sides.forEach((s) => {
        const b = el('button', 'btn evpick__btn', `${s.name} 편 들기`); b.type = 'button'; b.style.setProperty('--c', s.color);
        b.addEventListener('click', async () => {
          const stake = amt ? Math.floor(Number(amt.value)) : 0;
          if (amt && !(stake >= ev.stake.min && stake <= ev.stake.max)) { toastMsg(`골드는 ${nf(ev.stake.min)}~${nf(ev.stake.max)} 사이로 걸 수 있어요.`); return; }
          if (!window.confirm(`${s.name} 편에 ${amt ? '골드 ' + nf(stake) + '을 걸고 ' : ''}정할까요?\n한 번 정하면 바꿀 수 없어요.`)) return;
          row.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          try { const got = await B.join(ev, s.id, stake); toastMsg(got && got.length ? `앞 이벤트 보상 골드 ${got.reduce((n, e) => n + e.reward, 0).toLocaleString('ko-KR')}을 받고, ${s.name} 편이 됐어요!` : `${s.name} 편이 됐어요!`); }
          catch (e) { toastMsg(e.user ? e.message : '정하지 못했어요. 인터넷 연결을 확인해 주세요.'); }
          refreshEvent();
        });
        row.appendChild(b);
      });
      act.appendChild(row);
    }
    card.appendChild(act);
    body.appendChild(card);

    // 응원단: 편마다 누가 얼마나 모았는지 (골드 걸기는 끝난 뒤에 공개)
    if (blind) { body.appendChild(el('p', 'ev__rule evblind', '편별 점수와 응원단, 건 골드는 편을 고르고 골드를 건 뒤에 보여요.')); return; }
    const teams = el('div', 'card evteams');
    teams.appendChild(el('h2', null, '응원단'));
    const cols = el('div', 'evteams__cols');
    [t.a, t.b].forEach((x) => {
      const col = el('div', 'evteam'); col.style.setProperty('--c', x.side.color);
      col.appendChild(el('h3', null, x.side.name));
      if (!x.members.length) col.appendChild(el('p', 'evteam__none', '아직 없어요'));
      x.members.forEach((m) => {
        const r = el('div', 'evmem' + (m.user.uid === C.uid ? ' evmem--me' : ''));
        r.appendChild(avatarEl(m.user.avatar, m.user.nickname, m.user.frame, m.user.photo));
        const nm = el('span', 'evmem__name', m.user.nickname || '이름 없음');
        r.appendChild(nm); if (ev.stake) r.appendChild(el('small', 'evmem__gold', `골드 ${nf(m.gold)}`)); r.appendChild(el('b', null, nf(m.score)));
        col.appendChild(r);
      });
      cols.appendChild(col);
    });
    teams.appendChild(cols); body.appendChild(teams);
  }

  let evSeq = 0;
  async function refreshEvent() {
    const seq = ++evSeq, note = $('evNote'), body = $('evBody');
    const say = (m) => { body.textContent = ''; note.hidden = !m; note.textContent = m || ''; };
    if (!(A.enabled && C.enabled)) { say('로그인하면 이벤트에 참가할 수 있어요'); return; }
    if (!C.loaded) { say(C.failed ? '기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요' : '불러오는 중이에요'); return; }
    try {
      await B.load(true);
      if (seq !== evSeq || effective() !== 'event') return;
      const ev = B.current();
      if (!ev) { say('지금은 열린 이벤트가 없어요'); return; }
      await B.flush();   // 방금 얻은 점수까지 올린 뒤에 불러와요
      const list = await C.loadAll();
      if (seq !== evSeq || effective() !== 'event') return;
      note.hidden = true; drawEvent(ev, list); refreshEventBtn(list);
    } catch (e) { console.warn('이벤트 불러오기 실패', e); if (seq === evSeq) say('이벤트를 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요'); }
  }
  window.addEventListener('events:ready', () => { const n = effective(); if (n === 'home') refreshHomeRank(); if (n === 'modes') refreshModes(); if (n === 'profile' || n === 'board') refreshProfile(); });


  // ---------- 테마 투표 ----------
  const V = window.AppVote;
  // 진행 중인 투표가 있는데 아직 안 했으면 게임 모드 목록에 표시
  const voteInfo = { sub: '', tag: false };   // 게임 모드 목록의 '테마 투표' 줄에 쓸 값
  function refreshVoteTag(list) {
    const p = V.ready && A.enabled && C.enabled ? V.current() : null;
    voteInfo.sub = p ? p.title : '';
    voteInfo.tag = !!(p && list && V.phase(p) === 'live' && !V.mineOf(p, list, C.uid));
    if (effective() === 'modes') refreshModes();
  }

  function drawVote(poll, users, ideaList) {
    const body = $('voteBody'); body.textContent = '';
    if (poll) {
      const ph = V.phase(poll), t = V.tally(poll, users), my = V.mineOf(poll, users, C.uid);
      const card = el('div', 'card votecard');
      card.appendChild(el('h2', null, poll.title));
      const left = V.leftText(poll);
      card.appendChild(el('p', 'vote__meta', `${V.period(poll)}${left ? ' · ' + left : ''}${ph === 'live' ? ` · ${nf(t.total)}명 투표` : ''}`));
      if (ph === 'ended') card.appendChild(el('p', 'vote__lead', t.winners.length ? `뽑힌 테마: ${poll.options.filter((o) => t.winners.includes(o.id)).map((o) => o.name).join(', ')}` : '투표한 사람이 없어요'));
      if (ph === 'upcoming') card.appendChild(el('p', 'vote__lead', '아직 시작 전이에요'));
      t.rows.forEach((r) => {
        const o = r.option, win = ph === 'ended' && t.winners.includes(o.id), pct = t.total ? Math.round(r.votes / t.total * 100) : 0;
        const row = el('div', 'vopt' + (my === o.id ? ' vopt--me' : '') + (win ? ' vopt--win' : ''));
        if (o.image) { const i = document.createElement('img'); i.className = 'vopt__img'; i.src = o.image; i.alt = ''; i.draggable = false; i.addEventListener('error', () => i.remove()); row.appendChild(i); }
        const info = el('div', 'vopt__info');
        const nm = el('b', null, o.name); if (win) nm.appendChild(el('small', 'vopt__crown', '1위')); info.appendChild(nm);
        if (o.desc) info.appendChild(el('span', 'vopt__desc', o.desc));
        const bar = el('div', 'vbar'), fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill); info.appendChild(bar);
        info.appendChild(el('small', 'vopt__n', `${nf(r.votes)}표 · ${pct}%`));
        row.appendChild(info);
        if (ph === 'live') {
          const b = el('button', 'btn btn--sub vopt__btn', my === o.id ? '내 선택' : my ? '바꾸기' : '투표'); b.type = 'button'; b.disabled = my === o.id;
          b.addEventListener('click', async () => {
            if (my && !window.confirm(`${o.name} 로 바꿔서 투표할까요?`)) return;
            b.disabled = true;
            try { await V.vote(poll, o.id); toastMsg(`${o.name} 에 투표했어요!`); } catch (e) { toastMsg(e.user ? e.message : '투표하지 못했어요.'); }
            refreshVote();
          });
          row.appendChild(b);
        }
        card.appendChild(row);
      });
      body.appendChild(card);
    }
    // 아이디어 게시판
    const day = G.dayKey(), mine = ideaList.filter((i) => i.uid === C.uid && i.id.includes('_' + day + '_')), box = el('div', 'card ideas');
    box.appendChild(el('h2', null, '이런 테마 어때요?'));
    box.appendChild(el('p', null, `다음에 만들었으면 하는 타일 테마를 적어 주세요 (하루 ${V.perDay}개까지). 좋은 아이디어는 투표로 올라가요.`));
    const form = el('form', 'ideaform'); form.noValidate = true;
    const inp = el('input', 'field'); inp.type = 'text'; inp.maxLength = V.ideaMax; inp.placeholder = '예) 귀여운 고양이 / 우주 / 한복'; inp.autocomplete = 'off';
    const btn = el('button', 'btn', '올리기'); btn.type = 'submit';
    form.appendChild(inp); form.appendChild(btn); box.appendChild(form);
    box.appendChild(el('p', 'idea__cnt', `오늘 ${mine.length} / ${V.perDay}`));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); btn.disabled = true;
      try { await V.addIdea(inp.value, day, mine); inp.value = ''; toastMsg('올렸어요!'); } catch (err) { toastMsg(err.user ? err.message : '올리지 못했어요.'); }
      btn.disabled = false; refreshVote();
    });
    const listEl = el('div', 'ideas__list');
    if (!ideaList.length) listEl.appendChild(el('p', 'idea__none', '아직 아이디어가 없어요. 첫 번째로 올려 보세요!'));
    ideaList.forEach((i) => {
      const u = users.find((x) => x.uid === i.uid) || {};
      const row = el('div', 'idea' + (i.uid === C.uid ? ' idea--me' : ''));
      row.appendChild(avatarEl(u.avatar, u.nickname, u.frame, u.photo));
      const tx = el('div', 'idea__txt');
      const who = el('b', null, u.nickname || '이름 없음'); who.appendChild(el('small', null, ago(i.at))); tx.appendChild(who);
      tx.appendChild(el('span', null, i.text)); row.appendChild(tx);
      if (i.uid === C.uid) {
        const d = el('button', 'idea__del', '삭제'); d.type = 'button'; d.setAttribute('aria-label', '내 아이디어 지우기');
        d.addEventListener('click', async () => { if (!window.confirm('이 아이디어를 지울까요?')) return; try { await C.removeIdea(i.id); } catch (e) { toastMsg('지우지 못했어요.'); } refreshVote(); });
        row.appendChild(d);
      }
      listEl.appendChild(row);
    });
    box.appendChild(listEl); body.appendChild(box);
  }

  let voteSeq = 0;
  async function refreshVote() {
    const seq = ++voteSeq, note = $('voteNote'), body = $('voteBody');
    const say = (m) => { body.textContent = ''; note.hidden = !m; note.textContent = m || ''; };
    if (!(A.enabled && C.enabled)) { say('로그인하면 투표하고 아이디어를 올릴 수 있어요'); return; }
    if (!C.loaded) { say(C.failed ? '기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요' : '불러오는 중이에요'); return; }
    try {
      await V.load(true);
      const [users, ideaList] = await Promise.all([C.loadAll(), V.ideas()]);
      if (seq !== voteSeq || effective() !== 'vote') return;
      note.hidden = true; drawVote(V.current(), users, ideaList); refreshVoteTag(users);
    } catch (e) { console.warn('투표 불러오기 실패', e); if (seq === voteSeq) say('불러오지 못했어요. 잠시 뒤에 다시 열어 주세요'); }
  }
  window.addEventListener('polls:ready', () => { if (effective() === 'home') refreshHomeRank(); });

  // ---------- 도감 (만든 타일 모으기) ----------
  let dexThemeId = null;   // 도감에서 보고 있는 테마 (지금 쓰는 테마가 기본)
  let dexCat = null, dexCatAuto = true;   // 도감 분류 칩 (처음엔 보고 있는 테마의 분류, 직접 고르면 그대로 유지)

  function refreshDex() {
    const th = T.byId(dexThemeId || T.dexTheme().id);
    const best = readSaved().bestTile || 0;
    const got = T.discovered(best, th);
    const chips = $('dexThemes');
    chips.textContent = '';
    if (dexCat === null || themeCat(th.id) !== dexCat && dexCatAuto) dexCat = themeCat(th.id);
    const cats = THEME_CATS.filter((c) => c !== '기본');   // 도감에서는 기본 숫자 테마가 없어서 12귀월은 '귀멸' 쪽에 넣어요
    const catOf = (id) => (themeCat(id) === '기본' ? '귀멸' : themeCat(id));
    const row1 = document.createElement('div'); row1.className = 'chips dexcats';
    cats.forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (c === (dexCat === '기본' ? '귀멸' : dexCat) ? ' on' : ''); b.textContent = c;
      b.addEventListener('click', () => { dexCat = c; dexCatAuto = false; refreshDex(); });
      row1.appendChild(b);
    });
    const row2 = document.createElement('div'); row2.className = 'dexthemes';
    const curCat = dexCat === '기본' ? '귀멸' : dexCat;
    T.list.filter((t) => !t.plain && (curCat === '전체' || catOf(t.id) === curCat)).forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (t.id === th.id ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', () => { dexThemeId = t.id; refreshDex(); });
      row2.appendChild(b);
    });
    chips.appendChild(row1); chips.appendChild(row2);
    $('dexCount').textContent = `${got.length} / ${th.values.length}`;
    const grid = $('dexGrid'), canPhoto = A.enabled && !!A.user && C.enabled;
    grid.textContent = '';
    const cells = th.values.map((v) => ({ v, label: th.names[v] || '', img: T.imgOf(v, th), on: v <= best }));
    const bigFrom = th.values[th.values.length - 1] * 2;
    cells.push({ v: bigFrom + '+', label: th.bigName, img: T.imgOf(bigFrom, th), on: best >= bigFrom });
    cells.forEach((c) => {
      const f = document.createElement('figure');
      f.className = 'dex__cell' + (c.on ? '' : ' locked');
      const img = document.createElement('img');
      img.src = c.img; img.alt = ''; img.draggable = false;
      const cap = document.createElement('figcaption');
      const num = document.createElement('b'); num.textContent = c.v;
      cap.appendChild(num); cap.appendChild(document.createTextNode(c.on ? c.label : '???'));
      f.appendChild(img); f.appendChild(cap);
      // 해금한 타일을 누르면 그 그림을 프로필 사진으로 쓸 수 있어요 (로그인했을 때만)
      if (c.on && canPhoto) {
        f.classList.add('pickable'); f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', `${c.label || c.v} 타일을 프로필 사진으로`);
        const go = () => cropOpen(null, c.img);
        f.addEventListener('click', go);
        f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
      grid.appendChild(f);
    });
    $('dexNote').textContent = canPhoto ? '처음 만든 타일이 여기에 등록돼요. 해금한 타일을 누르면 프로필 사진으로 쓸 수 있어요.' : '처음 만든 타일이 여기에 등록돼요.';
  }

  // ---------- 상점 (미션 · 테마) ----------
  let shopTab = 'mission';
  const TABS = [{ id: 'mission', name: '미션' }, { id: 'deco', name: '꾸미기' }, { id: 'joker', name: '조커카드' }, { id: 'theme', name: '타일 테마' }];
  let decoTab = 'avatar';
  const DECO = [{ id: 'avatar', name: '사진' }, { id: 'frame', name: '프레임' }, { id: 'title', name: '칭호' }, { id: 'bg', name: '배경' }, { id: 'name', name: '이름' }];

  function showMsg(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(showMsg.t); showMsg.t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // 연속 출석 카드 (하루에 한 판 이상 끝내면 출석)
  function renderStreak() {
    const st = G.streak();
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '연속 출석'; card.appendChild(h);
    const big = document.createElement('p'); big.className = 'streak__n';
    big.textContent = st.n > 0 ? `${st.n}일째` : '아직 이어진 출석이 없어요';
    const sub = document.createElement('span'); sub.className = 'streak__sub'; sub.textContent = st.today ? '오늘 출석 완료' : '오늘 한 판을 끝내면 출석돼요';
    big.appendChild(sub); card.appendChild(big);
    Object.keys(st.rewards).map(Number).forEach((m) => {
      const state = m <= st.claimed ? 'claimed' : (st.n >= m && m === st.next ? 'ready' : 'doing');
      const row = document.createElement('div'); row.className = 'mission mission--' + state;
      const txt = document.createElement('div'); txt.className = 'mission__txt';
      const nm = document.createElement('b'); nm.textContent = `${m}일 연속`;
      const rw = document.createElement('span'); rw.className = 'gold gold--sm'; rw.textContent = '+' + st.rewards[m];
      txt.appendChild(nm); txt.appendChild(rw); row.appendChild(txt);
      if (state === 'ready') {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn mission__btn'; b.textContent = '받기';
        b.addEventListener('click', async () => {
          b.disabled = true;
          try { const got = await G.claimStreak(); showMsg(`골드 ${got}을 받았어요!`); }
          catch (err) { showMsg(err.user ? err.message : '받지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
          if (effective() === 'shop') refreshShop();
        });
        row.appendChild(b);
      } else {
        const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = state === 'claimed' ? '받음' : `${Math.max(0, m - st.n)}일 남음`;
        row.appendChild(tag);
      }
      card.appendChild(row);
    });
    const note = document.createElement('p'); note.className = 'dex__note'; note.textContent = '하루라도 건너뛰면 1일부터 다시 시작해요.';
    card.appendChild(note);
    return card;
  }

  function renderMissions() {
    const box = $('missionList');
    box.textContent = '';
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '오늘 미션'; card.appendChild(h);
    G.missions().forEach((m) => {
      const row = document.createElement('div'); row.className = 'mission mission--' + m.state;
      const txt = document.createElement('div'); txt.className = 'mission__txt';
      const nm = document.createElement('b'); nm.textContent = m.name;
      const rw = document.createElement('span'); rw.className = 'gold gold--sm'; rw.textContent = '+' + m.reward;
      txt.appendChild(nm); txt.appendChild(rw);
      row.appendChild(txt);
      if (m.state === 'ready') {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn mission__btn'; b.textContent = '받기';
        b.addEventListener('click', async () => {
          b.disabled = true;
          try { const got = await G.claim(m.id); showMsg(`골드 ${got}을 받았어요!`); }
          catch (err) { showMsg(err.user ? err.message : '받지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
          if (effective() === 'shop') refreshShop();
        });
        row.appendChild(b);
      } else {
        const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = m.state === 'claimed' ? '받음' : '진행 중';
        row.appendChild(tag);
      }
      card.appendChild(row);
    });
    const note = document.createElement('p'); note.className = 'dex__note'; note.textContent = '미션은 매일 오전 6시에 새로 바뀌어요.';
    card.appendChild(note);
    box.appendChild(card);
    box.appendChild(renderStreak());
  }

  async function buy(label, price, itemId, doneMsg) {
    if (!window.confirm(`${label} — ${price}골드에 살까요?`)) return;
    try { await G.spend(price, itemId); showMsg(`${label} 구매 완료! ${doneMsg || '프로필에서 고를 수 있어요.'}`); }
    catch (err) { showMsg(err.user ? err.message : '사지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
    if (effective() === 'shop') refreshShop();
  }
  function buyTag(own, price, onBuy) {
    const frag = document.createDocumentFragment();
    if (own) { const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = '보유'; frag.appendChild(tag); return frag; }
    const pr = document.createElement('span'); pr.className = 'gold gold--sm' + (G.gold < price ? ' gold--short' : ''); pr.textContent = price;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn buy__btn'; btn.textContent = '구매';
    btn.addEventListener('click', () => { btn.disabled = true; onBuy(); });
    frag.appendChild(pr); frag.appendChild(btn);
    return frag;
  }

  function renderFrames() {
    const box = $('decoShop');
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '프레임'; card.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'buys';
    FRAMES.filter((f) => f.price && !f.off).forEach((f) => {
      const own = ownsFrame(f);
      const item = document.createElement('div'); item.className = 'buy' + (own ? ' own' : '');
      item.appendChild(avatarEl(C.avatar, C.nickname, f.id, C.photo));
      const nm = document.createElement('b'); nm.textContent = f.name; item.appendChild(nm);
      item.appendChild(buyTag(own, f.price, () => buy(`${f.name} 프레임`, f.price, 'frame:' + f.id)));
      grid.appendChild(item);
    });
    card.appendChild(grid); box.appendChild(card);
  }

  // 배경·이름 꾸미기 미리보기 한 칸
  function bgPreview(bgId, fxId) {
    const d = document.createElement('div');
    d.className = 'bgpv' + (bgOf(bgId) ? ' bg-' + bgId : '');
    const n = document.createElement('span');
    n.className = fxOf(fxId) ? 'nm-' + fxId : '';
    n.textContent = C.nickname || '닉네임';
    d.appendChild(n);
    return d;
  }
  function renderBuyGrid(title, list, prefix, ownFn, preview) {
    const box = $('decoShop');
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = title; card.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'buys buys--wide';
    list.forEach((x) => {
      const own = ownFn(x);
      const item = document.createElement('div'); item.className = 'buy' + (own ? ' own' : '');
      item.appendChild(preview(x));
      const nm = document.createElement('b'); nm.textContent = x.name; item.appendChild(nm);
      item.appendChild(buyTag(own, x.price, () => buy(`${x.name} ${title}`, x.price, prefix + x.id)));
      grid.appendChild(item);
    });
    card.appendChild(grid); box.appendChild(card);
  }

  function renderTitles() {
    const box = $('decoShop');
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '칭호'; card.appendChild(h);
    let grp = null;
    TITLES.filter((t) => t.price && !t.off).concat(TITLES.filter((t) => !t.price && !t.off)).forEach((t) => {
      const g = t.group || '업적';
      if (g !== grp) { grp = g; const hh = document.createElement('h3'); hh.className = 'shop__group'; hh.textContent = g; card.appendChild(hh); }
      const own = ownsTitle(t);
      const row = document.createElement('div'); row.className = 'mission titlerow';
      const txt = document.createElement('div'); txt.className = 'mission__txt';
      const nm = document.createElement('b'); nm.textContent = t.name; txt.appendChild(nm);
      if (!t.price) { const how = document.createElement('span'); how.className = 'dex__note'; how.textContent = '얻는 법 · ' + t.how; txt.appendChild(how); }
      row.appendChild(txt);
      if (t.price) row.appendChild(buyTag(own, t.price, () => buy(`${t.name} 칭호`, t.price, 'title:' + t.id)));
      else { const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = own ? '보유' : '잠김'; row.appendChild(tag); }
      card.appendChild(row);
    });
    box.appendChild(card);
  }

  // 조커카드 상점
  const JOKER_INFO = [
    { id: 'undo', name: '되돌리기', desc: '직전에 움직인 한 수를 되돌려요' },
    { id: 'erase', name: '지우기', desc: '고른 타일 하나를 없애요' },
    { id: 'shuffle', name: '섞기', desc: '보드 위 타일 위치를 무작위로 섞어요' },
    { id: 'upgrade', name: '올리기', desc: '고른 타일을 한 단계 올려요 (2는 4가 돼요)' }
  ];
  async function buyJokerCard(x) {
    const price = G.JOKER_PRICE[x.id];
    if (!window.confirm(`${x.name} 조커카드 1장 — ${price}골드에 살까요?`)) return;
    try { await G.buyJoker(x.id); showMsg(`${x.name} 조커카드를 샀어요!`); }
    catch (err) { showMsg(err.user ? err.message : '사지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
    if (effective() === 'shop') refreshShop();
  }
  function renderJokerShop() {
    const box = $('jokerShop');
    box.textContent = '';
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '조커카드'; card.appendChild(h);
    const have = G.jokers();
    JOKER_INFO.forEach((x) => {
      const price = G.JOKER_PRICE[x.id];
      const row = document.createElement('div'); row.className = 'mission jkrow';
      const img = document.createElement('img'); img.src = `./images/jokers/${x.id}.webp`; img.alt = ''; img.draggable = false; img.className = 'jkrow__img';
      const txt = document.createElement('div'); txt.className = 'mission__txt';
      const nm = document.createElement('b'); nm.textContent = `${x.name} · 보유 ${have[x.id]}장`;
      const ds = document.createElement('span'); ds.className = 'dex__note'; ds.textContent = x.desc;
      txt.appendChild(nm); txt.appendChild(ds);
      const pr = document.createElement('span'); pr.className = 'gold gold--sm' + (G.gold < price ? ' gold--short' : ''); pr.textContent = price;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn buy__btn'; btn.textContent = '구매';
      btn.addEventListener('click', () => { btn.disabled = true; buyJokerCard(x); });
      row.appendChild(img); row.appendChild(txt); row.appendChild(pr); row.appendChild(btn);
      card.appendChild(row);
    });
    const note = document.createElement('p'); note.className = 'dex__note';
    note.textContent = '조커카드는 일반 모드에서만 쓸 수 있고, 한 판에 3장까지예요. 쓴 판의 기록에는 (조커사용) 표시가 붙어요.';
    card.appendChild(note); box.appendChild(card);
  }

  function renderDeco() {
    const tabs = $('decoTabs');
    tabs.textContent = '';
    DECO.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (t.id === decoTab ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', () => { decoTab = t.id; refreshShop(); });
      tabs.appendChild(b);
    });
    $('decoShop').textContent = '';
    if (decoTab === 'avatar') renderAvatars();
    else if (decoTab === 'frame') renderFrames();
    else if (decoTab === 'bg') renderBuyGrid('카드 배경', BGS.filter((x) => !x.off), 'bg:', ownsBg, (x) => bgPreview(x.id, ''));
    else if (decoTab === 'name') renderBuyGrid('이름 꾸미기', NAMEFX.filter((x) => !x.off), 'name:', ownsFx, (x) => bgPreview('', x.id));
    else renderTitles();
  }

  function renderAvatars() {
    const box = $('decoShop');
    box.textContent = '';
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '프로필 사진'; card.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'buys';
    AVATARS.filter((a) => a.price && !a.off).forEach((a) => {
      const own = ownsAvatar(a);
      const item = document.createElement('div'); item.className = 'buy' + (own ? ' own' : '');
      const img = document.createElement('img'); img.src = avatarSrc(a.id); img.alt = ''; img.draggable = false;
      const nm = document.createElement('b'); nm.textContent = a.name;
      item.appendChild(img); item.appendChild(nm);
      if (own) { const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = '보유'; item.appendChild(tag); }
      else {
        const price = document.createElement('span'); price.className = 'gold gold--sm' + (G.gold < a.price ? ' gold--short' : ''); price.textContent = a.price;
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn buy__btn'; btn.textContent = '구매';
        btn.addEventListener('click', async () => {
          if (!window.confirm(`${a.name} 사진을 ${a.price}골드에 살까요?`)) return;
          btn.disabled = true;
          try { await G.spend(a.price, 'avatar:' + a.id); showMsg(`${a.name} 사진을 얻었어요! 프로필에서 고를 수 있어요.`); }
          catch (err) { showMsg(err.user ? err.message : '사지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
          if (effective() === 'shop') refreshShop();
        });
        item.appendChild(price); item.appendChild(btn);
      }
      grid.appendChild(item);
    });
    card.appendChild(grid);
    box.appendChild(card);
  }

  // 테마 분류 (상점 테마 탭의 칩) — 각 테마의 cat (shopdata.js), 없으면 '일본'
  const THEME_CATS = ['전체', '귀멸', '일본', '기본'];
  const themeCat = (id) => T.byId(id).cat || '일본';
  let themeFilter = '전체';

  function themePreview(t, vals) {
    const prev = document.createElement('div'); prev.className = 'theme-card__prev';
    vals.forEach((v) => {
      if (t.plain) {   // 그림이 없는 테마는 실제 게임과 같은 색깔 타일로 미리보기
        const n = document.createElement('div'); n.className = 'tile tilepv'; n.dataset.v = v;
        n.appendChild(document.createElement('span')).textContent = v;
        prev.appendChild(n);
      } else {
        const i = document.createElement('img'); i.src = T.imgOf(v, t); i.alt = ''; i.draggable = false; prev.appendChild(i);
      }
    });
    return prev;
  }
  // 쓸 수 있는 테마: 무료이거나, 샀거나, 지금 쓰고 있는 테마 (가격이 새로 붙어도 쓰던 사람은 계속 써요)
  const ownsTheme = (t) => !t.price || G.owns('theme:' + t.id) || t.id === T.get().id;
  function useTheme(id) { const t = T.byId(id); if (!ownsTheme(t)) return; T.set(id); dexThemeId = null; refreshShop(); }

  function renderThemes() {
    const box = $('themeList');
    box.textContent = '';
    const cur = T.get();
    // 1) 지금 쓰는 테마는 맨 위에 크게
    const top = document.createElement('div'); top.className = 'card theme-card on';
    const head = document.createElement('div'); head.className = 'theme-card__head';
    const h = document.createElement('h2'); h.textContent = cur.name; head.appendChild(h);
    const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = '사용 중'; head.appendChild(tag);
    const desc = document.createElement('p'); desc.className = 'theme-card__desc'; desc.textContent = cur.desc;
    top.appendChild(head); top.appendChild(desc); top.appendChild(themePreview(cur, [2, 32, 512, 2048]));
    box.appendChild(top);
    // 3) 분류 칩
    const chips = document.createElement('div'); chips.className = 'chips themechips';
    THEME_CATS.forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (c === themeFilter ? ' on' : ''); b.textContent = c;
      b.addEventListener('click', () => { themeFilter = c; renderThemes(); });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    // 2) 나머지는 두 줄 격자 (미리보기 2장)
    const grid = document.createElement('div'); grid.className = 'themegrid';
    T.list.filter((t) => t.id !== cur.id && !t.off && (themeFilter === '전체' || themeCat(t.id) === themeFilter)).forEach((t) => {
      const card = document.createElement('div'); card.className = 'card themecell';
      const nm = document.createElement('b'); nm.textContent = t.name;
      card.appendChild(themePreview(t, [2, 512])); card.appendChild(nm);
      if (ownsTheme(t)) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn themecell__btn'; btn.textContent = '바꾸기';
        btn.addEventListener('click', () => useTheme(t.id));
        card.appendChild(btn);
      } else {
        const row = document.createElement('div'); row.className = 'themecell__buy';
        row.appendChild(buyTag(false, t.price, () => buy(`${t.name} 테마`, t.price, 'theme:' + t.id, '아래 목록에서 "바꾸기"를 누르면 써요.')));
        card.appendChild(row);
      }
      grid.appendChild(card);
    });
    if (!grid.children.length) { const e = document.createElement('p'); e.className = 'dex__note'; e.textContent = '이 분류에는 바꿀 수 있는 테마가 없어요.'; grid.appendChild(e); }
    box.appendChild(grid);
  }

  function refreshShop() {
    $('shopGold').textContent = G.gold;
    const tabs = $('shopTabs');
    tabs.textContent = '';
    TABS.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (t.id === shopTab ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', () => { shopTab = t.id; refreshShop(); });
      tabs.appendChild(b);
    });
    $('missionList').hidden = shopTab !== 'mission';
    $('decoPane').hidden = shopTab !== 'deco';
    $('jokerShop').hidden = shopTab !== 'joker';
    $('themeList').hidden = shopTab !== 'theme';
    if (shopTab === 'mission') renderMissions(); else if (shopTab === 'deco') renderDeco(); else if (shopTab === 'joker') renderJokerShop(); else renderThemes();
  }

  // ---------- 프로필 사진 ----------
  // 직접 올린 사진(data URL)이 있으면 그걸 먼저 보여줘요. 형식을 확인해서 이상한 값은 무시해요
  const PHOTO_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  function avatarEl(id, nickname, frame, photo) {
    const box = document.createElement('div');
    box.className = 'avatar' + (frameOf(frame) ? ' fr-' + frame : '');
    if (photo && PHOTO_RE.test(photo)) {
      const img = document.createElement('img');
      img.src = photo; img.alt = ''; img.draggable = false;
      box.appendChild(img);
    } else if (knownAvatar(id)) {
      const img = document.createElement('img');
      img.src = avatarSrc(id); img.alt = ''; img.draggable = false;
      box.appendChild(img);
    } else {
      box.textContent = [...String(nickname || '?')][0];   // 사진을 안 골랐으면 닉네임 첫 글자
    }
    return box;
  }

  // 프로필 사진 고르는 창: 분류 칩 + 이름 찾기 + 작은 칸 (사진이 많아도 한눈에)
  // 분류는 shopdata 의 avatars 항목에 group 을 적으면 그 이름으로, 없으면 "기본" / "상점에서 산 것" 으로 나뉘어요
  let avGroup = 'all', avQuery = '', avScrolled = false;
  const avGroupOf = (a) => a.group || (a.price ? '상점에서 산 것' : '기본');

  function renderAvatarPicker() {
    const pick = $('avatarPick');
    pick.textContent = '';
    const prev = $('photoPrev'); prev.textContent = '';
    prev.appendChild(avatarEl(C.avatar, C.nickname, C.frame, C.photo));
    $('photoClear').hidden = !C.photo;

    const owned = AVATARS.filter(ownsAvatar);
    const groups = [];
    owned.forEach((a) => { const g = avGroupOf(a); if (groups.indexOf(g) < 0) groups.push(g); });
    if (avGroup !== 'all' && groups.indexOf(avGroup) < 0) avGroup = 'all';

    const manyGroups = groups.length > 1, manyItems = owned.length >= 10;
    $('avatarBar').hidden = !(manyGroups || manyItems);
    const chips = $('avatarChips');
    chips.textContent = '';
    chips.hidden = !manyGroups;
    [['all', '전체', owned.length]].concat(groups.map((g) => [g, g, owned.filter((a) => avGroupOf(a) === g).length])).forEach(([id, name, n]) => {
      const c = document.createElement('button');
      c.type = 'button'; c.dataset.avgroup = id; c.className = 'chip' + (id === avGroup ? ' on' : '');
      c.setAttribute('role', 'tab'); c.setAttribute('aria-selected', id === avGroup ? 'true' : 'false');
      c.textContent = `${name} ${n}`;
      chips.appendChild(c);
    });
    const find = $('avatarFind');
    find.hidden = !manyItems;
    if (document.activeElement !== find) find.value = avQuery;

    const q = avQuery.trim().toLowerCase();
    const list = owned.filter((a) => (avGroup === 'all' || avGroupOf(a) === avGroup) && (!q || a.name.toLowerCase().indexOf(q) >= 0));
    list.forEach((a) => {
      const sel = a.id === C.avatar && !C.photo;   // 내 사진이 설정돼 있으면 상점 사진은 선택 표시를 빼요
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.avatar = a.id;
      b.className = sel ? 'on' : '';
      b.setAttribute('aria-label', a.name);
      b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      const img = document.createElement('img');
      img.src = avatarSrc(a.id); img.alt = ''; img.draggable = false; img.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = a.name;
      b.appendChild(img); b.appendChild(label);
      pick.appendChild(b);
    });
    if (!list.length) { const e = document.createElement('p'); e.className = 'pickempty'; e.textContent = '찾는 사진이 없어요.'; pick.appendChild(e); }
    $('avatarCount').textContent = owned.length > list.length ? `${owned.length}장 중 ${list.length}장 보는 중` : `${owned.length}장`;
    if (!avScrolled) {   // 처음 열 때만 지금 쓰는 사진이 보이는 곳으로
      const on = pick.querySelector('button.on');
      if (on) { avScrolled = true; pick.scrollTop = Math.max(0, on.offsetTop - pick.offsetTop - 8); }
    }
  }

  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('#avatarChips .chip');
    if (!c) return;
    avGroup = c.dataset.avgroup; renderAvatarPicker(); $('avatarPick').scrollTop = 0;
  });
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'avatarFind') { avQuery = e.target.value; renderAvatarPicker(); }
  });

  function renderFramePicker() {
    const pick = $('framePick');
    pick.textContent = '';
    const none = document.createElement('button');
    none.type = 'button'; none.dataset.frame = ''; none.className = C.frame ? '' : 'on';
    none.setAttribute('aria-pressed', C.frame ? 'false' : 'true');
    none.appendChild(avatarEl(C.avatar, C.nickname, '', C.photo)); none.appendChild(document.createElement('span')).textContent = '없음';
    pick.appendChild(none);
    styleFilter('framePick', 'frame', FRAMES.filter(ownsFrame)).forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.frame = f.id; b.className = f.id === C.frame ? 'on' : '';
      b.setAttribute('aria-pressed', f.id === C.frame ? 'true' : 'false');
      b.appendChild(avatarEl(C.avatar, C.nickname, f.id, C.photo)); b.appendChild(document.createElement('span')).textContent = f.name;
      pick.appendChild(b);
    });
  }

  function renderTitlePicker() {
    const pick = $('titlePick');
    pick.textContent = '';
    const opts = [{ id: '', name: '없음' }].concat(TITLES.filter(ownsTitle));
    opts.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.title = t.id; b.className = 'chip' + (t.id === C.title ? ' on' : '');
      b.setAttribute('aria-pressed', t.id === C.title ? 'true' : 'false'); b.textContent = t.name;
      pick.appendChild(b);
    });
  }

  // 프레임·카드 배경·이름 꾸미기 분류 (목록에 없는 새 물건은 '기타'. 관리 도구에서 물건에 group 을 적으면 그 이름으로 나뉘어요)
  const STYLE_GROUPS = {
    frame: { '기본': 'silver gold gilded steel round scroll royal ink stitch', '자연': 'sakura wave ice wisteria bamboo leaf vine aurora sunset moon', '불·번개': 'flame thunder ember blood sun spark', '네온·빛': 'neon starlight glass prism rainbow circuit glitch ghost', '귀여움': 'candy heart choco cane squish pixel' },
    bg: { '귀멸': 'check asanoha sakura butterfly water flame thunder infinity moon blood sun seigaiha hanji', '자연': 'dusk snow grove deep autumn cloud sunrise rain mist dune tidal firefly lava', '밤·우주': 'galaxy meteor polar crystal', '도시·무늬': 'neon lantern circuit synth berry bubble kraft' },
    fx: { '색': 'gold sakura water wisteria red mint orange silver pink sky lime lavender peach emerald coral lemon ice violet', '그라데이션': 'dusk candy ocean twilight boreal chrome duo', '불·번개': 'flame thunder ember', '움직임·특수': 'rainbow moon sun neon gilt holo glitchfx outline popfx twinkle' }
  };
  const styleGroupOf = (kind, x) => x.group || Object.keys(STYLE_GROUPS[kind]).find((g) => STYLE_GROUPS[kind][g].split(' ').includes(x.id)) || '기타';
  const styleSel = { frame: '전체', bg: '전체', fx: '전체' };
  const STYLE_MIN = 9;   // 이만큼 이상 가졌을 때만 분류 칩을 보여줘요
  // 칩 줄을 목록 위에 만들고, 지금 고른 분류에 맞는 물건만 돌려줘요
  function styleFilter(boxId, kind, owned) {
    const box = $(boxId);
    let bar = box.previousElementSibling && box.previousElementSibling.classList.contains('stylebar') ? box.previousElementSibling : null;
    if (!bar) { bar = document.createElement('div'); bar.className = 'stylebar chips'; box.parentNode.insertBefore(bar, box); }
    const groups = [];
    owned.forEach((x) => { const g = styleGroupOf(kind, x); if (!groups.includes(g)) groups.push(g); });
    const order = Object.keys(STYLE_GROUPS[kind]);
    groups.sort((x, y) => (order.indexOf(x) + 1 || 99) - (order.indexOf(y) + 1 || 99));
    if (!groups.includes(styleSel[kind])) styleSel[kind] = '전체';
    bar.textContent = '';
    bar.hidden = owned.length < STYLE_MIN;
    box.classList.toggle('stylepick--scroll', owned.length >= STYLE_MIN);
    ['전체'].concat(groups).forEach((g) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (g === styleSel[kind] ? ' on' : '');
      b.textContent = g === '전체' ? `전체 ${owned.length}` : `${g} ${owned.filter((x) => styleGroupOf(kind, x) === g).length}`;
      b.addEventListener('click', () => { styleSel[kind] = g; refreshProfile(); });
      bar.appendChild(b);
    });
    return styleSel[kind] === '전체' || bar.hidden ? owned : owned.filter((x) => styleGroupOf(kind, x) === styleSel[kind]);
  }

  function renderStylePicker(boxId, list, own, cur, attr, usesBg) {
    const pick = $(boxId);
    pick.textContent = '';
    const mk = (id, name) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset[attr] = id; b.className = id === cur ? 'on' : '';
      b.setAttribute('aria-pressed', id === cur ? 'true' : 'false');
      b.appendChild(bgPreview(usesBg ? id : '', usesBg ? '' : id));
      b.appendChild(document.createElement('span')).textContent = name;
      pick.appendChild(b);
    };
    mk('', '없음');
    styleFilter(boxId, usesBg ? 'bg' : 'fx', list.filter(own)).forEach((x) => mk(x.id, x.name));
  }

  function renderMe() {
    const av = $('meAvatar'); av.textContent = ''; av.appendChild(avatarEl(C.avatar, C.nickname, C.frame, C.photo));
    $('meName').textContent = C.nickname || '이름 없음';
    $('meName').className = 'me__name' + (fxOf(C.nameFx) ? ' nm-' + C.nameFx : '');
    $('meCard').className = 'card' + (bgOf(C.bg) ? ' bg-' + C.bg : '');
    const t = titleOf(C.title); $('meTitle').textContent = t ? t.name : ''; $('meTitle').hidden = !t;
    $('meBio').textContent = C.bio; $('meBio').hidden = !C.bio;
    renderMeRank(); renderMeEv();
  }

  // 프로필 카드의 이벤트 전적 (참가한 적이 없으면 숨겨요)
  function renderMeEv() {
    const es = evStat(), box = $('meEv');
    box.hidden = !(es.w + es.l);
    box.textContent = `이벤트 ${es.w}승 ${es.l}패` + (es.streak >= 2 ? ` · ${es.streak}연승 중` : '');
  }

  // 프로필의 랭크 줄: 뱃지 + 다음 랭크까지 남은 점수
  function renderMeRank() {
    const box = $('meRank'); if (!box) return;
    const sc = readSaved().best || 0, r = rankOf(sc), next = RANKS.find((x) => x.min > sc);
    box.textContent = '';
    box.appendChild(rankBadge(sc));
    const info = document.createElement('span'); info.className = 'rkinfo';
    info.textContent = next ? `${next.name}까지 ${(next.min - sc).toLocaleString('ko-KR')}점` : '최고 랭크예요!';
    box.appendChild(info);
    const bar = document.createElement('div'); bar.className = 'rkprog';
    const fill = document.createElement('i');
    const lo = r ? r.min : 0;
    fill.style.width = (next ? Math.max(4, Math.min(100, Math.round((sc - lo) / (next.min - lo) * 100))) : 100) + '%';
    bar.appendChild(fill); box.appendChild(bar);
  }

  // ---------- 우리 기록 (닉네임·점수 목록) ----------
  function ago(ts) {
    try {
      const sec = Math.max(0, (Date.now() - ts.toDate().getTime()) / 1000);
      if (sec < 60) return '방금 전';
      if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
      if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
      return `${Math.floor(sec / 86400)}일 전`;
    } catch (e) { return ''; }
  }

  // 다른 사람 줄 밑의 응원 버튼 (누르면 한마디를 골라요, 하루에 한 사람에게 한 번)
  function cheerRow(u) {
    const row = document.createElement('div'); row.className = 'cheerrow';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn--sub cheerrow__btn';
    const opts = document.createElement('div'); opts.className = 'cheerrow__opts'; opts.hidden = true;
    const sent = () => { btn.textContent = '오늘 응원했어요'; btn.disabled = true; opts.hidden = true; };
    if (sentToday().includes(u.uid)) sent(); else btn.textContent = '응원 보내기';
    btn.addEventListener('click', () => { opts.hidden = !opts.hidden; });
    CHEER_MSGS.forEach((m) => {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = m;
      c.addEventListener('click', async () => {
        opts.hidden = true; btn.disabled = true;
        try { await C.sendCheer(u.uid, m, G.dayKey()); markSent(u.uid); sent(); showMsg('응원을 보냈어요!'); }
        catch (err) {
          if (/permission|insufficient|already/i.test(String(err && (err.code || err.message)))) { markSent(u.uid); sent(); showMsg('오늘은 이미 응원을 보냈어요.'); }
          else { btn.disabled = false; showMsg('보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
        }
      });
      opts.appendChild(c);
    });
    row.appendChild(btn); row.appendChild(opts);
    return row;
  }

  // mode: 'best'(최고 점수) | 'week'(이번 주 누적 점수)
  function renderRank(list, box, compact, mode) {
    box = box || $('rankList');
    box.textContent = '';
    const week = mode === 'week', wk = week ? W.key() : '', chal = mode === 'ch', cd = chal ? window.AppChallenge.day() : '';
    const val = (u) => (week ? W.scoreOf(u, wk) : chal ? window.AppChallenge.scoreOf(u, cd) : SE.bestOf(u));
    list.sort((a, b) => val(b) - val(a)).forEach((u, i) => {
      const item = document.createElement('div');
      item.className = 'rank__item' + (u.uid === C.uid ? ' rank__item--me' : '') + (bgOf(u.bg) ? ' bg-' + u.bg : '');
      const left = document.createElement('div');
      left.className = 'rank__who';
      const king = i === 0 && val(u) > 0;
      if (king) {
        item.classList.add('rank__item--king');
        const fw = document.createElement('div'); fw.className = 'kingflames';
        for (let k = 0; k < 9; k++) fw.appendChild(document.createElement('i'));
        item.appendChild(fw);
      }
      left.appendChild(avatarEl(u.avatar, u.nickname, u.frame, u.photo));
      const txt = document.createElement('div');
      txt.className = 'rank__txt';
      const nm = document.createElement('div');
      nm.className = 'rank__name';
      const nmt = document.createElement('span');
      nmt.className = fxOf(u.nameFx) ? 'nm-' + u.nameFx : '';
      nmt.textContent = u.nickname || '이름 없음'; nm.appendChild(nmt);
      if (rankOf(SE.bestOf(u))) nm.appendChild(rankBadge(SE.bestOf(u)));
      if (u.uid === C.uid) { const t = document.createElement('small'); t.textContent = '나'; nm.appendChild(t); }
      if (king) { const t = document.createElement('small'); t.className = 'rank__king'; t.textContent = '패왕'; nm.appendChild(t); }
      if ((week || chal) && i === 0 && val(u) > 0) { const t = document.createElement('small'); t.className = 'rank__first'; t.textContent = '1등'; nm.appendChild(t); }
      const sub = document.createElement('span');
      sub.className = 'rank__sub';
      sub.textContent = `플레이 ${u.plays || 0}회${u.updatedAt ? ' · ' + ago(u.updatedAt) : ''}`;
      txt.appendChild(nm);
      const tt = titleOf(u.title);
      if (tt) { const e = document.createElement('span'); e.className = 'rank__title'; e.textContent = tt.name; txt.appendChild(e); }
      if (u.bio) { const e = document.createElement('span'); e.className = 'rank__bio'; e.textContent = u.bio; txt.appendChild(e); }
      const es = window.AppBetting && window.AppBetting.stats ? window.AppBetting.stats(u.owned || []) : null;
      if (es && es.w + es.l) { const e = document.createElement('span'); e.className = 'rank__ev'; e.textContent = `이벤트 ${es.w}승 ${es.l}패` + (es.streak >= 2 ? ` · ${es.streak}연승` : ''); txt.appendChild(e); }
      if (!compact) txt.appendChild(sub);
      left.appendChild(txt);
      const right = document.createElement('div');
      right.className = 'rank__score';
      const b = document.createElement('b'); b.textContent = val(u);
      right.appendChild(b); right.appendChild(document.createTextNode(week ? '이번 주' : chal ? (val(u) > 0 ? '오늘' : '아직 안 했어요') : `최고 타일 ${u.bestTile || '-'}`));
      if (!week && !chal && u.bestJk && SE.bestOf(u)) { const jm = document.createElement('small'); jm.className = 'jkmark'; jm.textContent = '조커 사용'; right.appendChild(jm); }
      item.appendChild(left); item.appendChild(right);
      box.appendChild(item);
      if (!compact && u.uid !== C.uid) box.appendChild(cheerRow(u));
    });
  }

  let rankTab = 'best';
  function renderRankTabs() {
    const box = $('rankTabs');
    box.textContent = '';
    [{ id: 'best', name: '최고 점수' }, { id: 'week', name: '주간 순위' }, { id: 'ch', name: '오늘의 도전' }].forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (t.id === rankTab ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', () => { rankTab = t.id; refreshRank(); });
      box.appendChild(b);
    });
  }

  async function refreshRank() {
    const msg = $('rankMsg');
    if (C.failed) { msg.textContent = '기록을 불러오지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.'; return; }
    if (!C.loaded) { msg.textContent = '기록을 불러오는 중이에요...'; return; }
    renderRankTabs();
    const note = $('weekNote');
    try {
      if (rankTab === 'week') await W.flush();   // 방금 얻은 점수까지 올린 뒤에 불러와요
      const list = await C.loadAll();
      renderRank(list, $('rankList'), false, rankTab);
      msg.textContent = '';
      note.hidden = rankTab === 'best';
      if (rankTab === 'ch') note.textContent = `하루 한 판, 모두 같은 시작 배치예요. 끝내면 ${window.AppChallenge.rewardDone}골드, 전날 1등은 다음 날 ${window.AppChallenge.rewardWin}골드를 받아요.`;
      if (rankTab === 'week') {
        const last = W.prevKey();
        const top = list.map((u) => ({ n: u.nickname || '이름 없음', s: W.scoreOf(u, last) })).sort((a, b) => b.s - a.s)[0];
        note.textContent = `매주 월요일 오전 6시에 새로 시작해요. 한 주 동안 모은 점수가 가장 높은 사람이 다음 주에 ${W.reward}골드를 받아요 (${W.minScore}점 이상).` +
          (top && top.s >= W.minScore ? ` 지난주 1등: ${top.n} (${top.s}점)` : '');
      }
    } catch (e) { msg.textContent = '기록을 불러오지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.'; }
  }

  function refreshProfile() {
    const s = readSaved();
    $('seasonLine').textContent = `${SE.monthNo(SE.key())}월 시즌 · ${SE.leftText()} · 매달 1일 오전 6시에 점수와 랭크가 새로 시작해요`;
    $('boardSeason').textContent = `${SE.monthNo(SE.key())}월 시즌 · ${SE.leftText()}`;
    $('pfPastRow').hidden = !(s.pseason && s.pbest);
    if (s.pseason && s.pbest) $('pfPast').textContent = `${s.pbest.toLocaleString('ko-KR')} (${SE.monthNo(s.pseason)}월${rankOf(s.pbest) ? ' · ' + rankOf(s.pbest).name : ''})`;
    $('pfBest').textContent = s.best || '-';
    if (s.best && s.bestJk) { const jm = document.createElement('small'); jm.className = 'jkmark'; jm.textContent = '(조커사용)'; $('pfBest').appendChild(jm); }
    $('pfTile').textContent = s.bestTile || '-';
    $('pfPlays').textContent = s.plays || '-';
    const online = A.enabled && !!A.user;
    $('nickCard').hidden = !online;
    $('avatarCard').hidden = !online;
    $('boardCard').hidden = !online;
    ['meCard', 'frameCard', 'titleCard', 'bioCard', 'bgCard', 'nameCard', 'tileCard'].forEach((id) => { $(id).hidden = !online; });
    if (online) {
      renderMe(); renderFramePicker(); renderTitlePicker(); renderTilePicker();
      renderStylePicker('bgPick', BGS, ownsBg, C.bg, 'bg', true); renderStylePicker('namePick', NAMEFX, ownsFx, C.nameFx, 'fx', false);
      if (document.activeElement !== $('bioInput')) $('bioInput').value = C.bio;
      renderAvatarPicker();
      if (document.activeElement !== $('nickInput')) $('nickInput').value = C.nickname;
      refreshRank();
    }
    $('guestCard').hidden = online;   // 로그인 없이 쓰는 중일 때만 안내 문구
    $('boardGuest').hidden = online;
    $('pfTabs').hidden = !online;
    applyPfTab();
  }

  // 프로필의 '타일' 탭: 가진 타일 테마를 보고 바로 바꿔요 (사는 건 상점)
  function renderTilePicker() {
    const box = $('tilePick'); box.textContent = '';
    const cur = T.get();
    T.list.filter((t) => !t.off && (t.id === cur.id || ownsTheme(t))).forEach((t) => {
      const on = t.id === cur.id;
      const cell = document.createElement('div'); cell.className = 'card themecell' + (on ? ' on' : '');
      const nm = document.createElement('b'); nm.textContent = t.name;
      cell.appendChild(themePreview(t, [2, 512])); cell.appendChild(nm);
      if (on) { const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = '사용 중'; cell.appendChild(tag); }
      else {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn themecell__btn'; btn.textContent = '바꾸기';
        btn.addEventListener('click', () => { T.set(t.id); dexThemeId = null; refreshProfile(); });
        cell.appendChild(btn);
      }
      box.appendChild(cell);
    });
  }

  // 프로필 꾸미기 탭 (사진 / 프레임 / 칭호 / 배경 / 이름 / 정보). 카드의 hidden 은 로그인 여부로 따로 정해져요
  let pfTab = 'avatar';
  function applyPfTab() {
    document.querySelectorAll('#pfTabs .chip').forEach((b) => b.classList.toggle('on', b.dataset.tab === pfTab));
    document.querySelectorAll('.screen--profile .deco').forEach((c) => c.classList.toggle('on', c.dataset.tab === pfTab));
  }
  document.querySelectorAll('#pfTabs .chip').forEach((b) => b.addEventListener('click', () => { pfTab = b.dataset.tab; applyPfTab(); }));

  // 게임 모드 목록 — 새 모드는 여기에 { id, name, sub(), tag(), start() } 한 덩어리만 추가하면 돼요
  // (start 에서 window.Game2048.setMode('모드 id') 를 부르고 go('game') 으로 게임 화면으로 가요. 모드 규칙은 game.js 의 setMode 쪽에 추가해요)
  const MODES = [
    {
      id: 'normal', name: '일반',
      sub: () => { const g = readSaved().game; return g && g.score > 0 ? `진행 중인 판 이어하기 · ${g.score}점` : '끝없이 이어서 즐겨요'; },
      tag: () => '',
      start: () => { window.Game2048.setMode('normal'); go('game'); }
    },
    {
      id: 'challenge', name: '오늘의 도전',
      sub: () => { const c = window.Game2048.challengeState(); return c.done ? `완료 · ${c.score}점` : c.started ? `진행 중 · ${c.score}점` : '하루 한 판 · 모두 같은 판'; },
      tag: () => (window.Game2048.challengeState().done ? '' : '도전 가능'),
      start: () => { window.Game2048.setMode('challenge'); go('game'); }
    },
    {
      id: 'event', name: '배팅 이벤트', show: () => !!modeEvent(),
      sub: () => { const ev = modeEvent(); return ev ? `${ev.title} · ${B.period(ev)}` : ''; },
      tag: () => { const ev = modeEvent(); if (!ev) return ''; const ph = B.phase(ev); return ph === 'ended' ? (evClaimable ? '보상 받기' : '결과') : ph === 'live' ? '진행 중' : '곧 시작'; },
      start: () => go('event')
    },
    {
      id: 'pvote', name: '프로필 투표', show: () => !!(A.enabled && A.user && C.enabled),
      sub: () => (PV.mine(G.ownedList(), G.dayKey()) ? '오늘 투표했어요 · 내일 아침 6시에 결과' : '가장 잘 꾸민 프로필에 한 표'),
      tag: () => (PV.mine(G.ownedList(), G.dayKey()) ? '' : '투표하세요'),
      start: () => go('pvote')
    },
    {
      id: 'tilevote', name: '테마 투표',
      sub: () => voteInfo.sub || '다음 타일 테마를 투표로 정해요',
      tag: () => (voteInfo.tag ? '투표하세요' : ''),
      start: () => go('vote')
    },
    {
      id: 'tips', name: '게임 잘하는 법',
      sub: () => `2048 꿀팁 ${window.AppTips.TIPS.length}가지`,
      tag: () => '',
      start: () => go('tips')
    }
  ];

  // ============ 프로필 투표 (매일 가장 잘 꾸민 프로필에 한 표) ============
  const PV = window.AppPVote;
  const pvCache = { t: 0, list: null };
  async function pvUsers(force) {
    if (!force && pvCache.list && Date.now() - pvCache.t < 60e3) return pvCache.list;   // 1분 안에는 다시 읽지 않아요
    pvCache.list = await C.loadAll(); pvCache.t = Date.now();
    return pvCache.list;
  }
  // 꾸민 사람만 후보예요: 프레임·배경·이름 효과·칭호·내 사진 중 하나라도 바꿨으면
  const pvDecorated = (u) => !!(u.photo || fxOf(u.nameFx) || bgOf(u.bg) || titleOf(u.title) || (frameOf(u.frame) && frameOf(u.frame).price));

  function pvCard(u, votes) {
    const item = document.createElement('div');
    item.className = 'rank__item' + (bgOf(u.bg) ? ' bg-' + u.bg : '');
    const left = document.createElement('div'); left.className = 'rank__who';
    left.appendChild(avatarEl(u.avatar, u.nickname, u.frame, u.photo));
    const txt = document.createElement('div'); txt.className = 'rank__txt';
    const nm = document.createElement('div'); nm.className = 'rank__name';
    const nmt = document.createElement('span'); nmt.className = fxOf(u.nameFx) ? 'nm-' + u.nameFx : ''; nmt.textContent = u.nickname || '이름 없음'; nm.appendChild(nmt);
    if (rankOf(SE.bestOf(u))) nm.appendChild(rankBadge(SE.bestOf(u)));
    txt.appendChild(nm);
    const tt = titleOf(u.title);
    if (tt) { const e = document.createElement('span'); e.className = 'rank__title'; e.textContent = tt.name; txt.appendChild(e); }
    if (u.bio) { const e = document.createElement('span'); e.className = 'rank__bio'; e.textContent = u.bio; txt.appendChild(e); }
    left.appendChild(txt); item.appendChild(left);
    if (votes != null) { const r = document.createElement('div'); r.className = 'rank__score'; const b = document.createElement('b'); b.textContent = votes; r.appendChild(b); r.appendChild(document.createTextNode('표')); item.appendChild(r); }
    return item;
  }

  async function refreshPVote() {
    const body = $('pvBody'), note = $('pvNote');
    body.textContent = '';
    if (!(A.enabled && A.user && C.enabled)) { note.textContent = '로그인하면 투표할 수 있어요.'; return; }
    note.textContent = `가장 잘 꾸민 프로필에 하루 한 표! 내일 아침 6시에 결과가 나와요. 1등은 골드 ${PV.GOLD} + '베스트 프로필' 칭호를 받아요. 마감 전에는 다른 사람으로 바꿀 수 있어요.`;
    const loading = document.createElement('p'); loading.className = 'foot'; loading.textContent = '불러오는 중…'; body.appendChild(loading);
    let users;
    try { users = await pvUsers(); } catch (e) { loading.textContent = '불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.'; return; }
    if (current() !== 'pvote') return;
    body.textContent = '';
    const today = G.dayKey(), byUid = new Map(users.map((u) => [u.uid, u]));

    // 지난 결과 (어제)와 보상
    const yday = PV.shift(today, -1), yw = PV.winners(users, yday);
    const res = document.createElement('div'); res.className = 'card pvres';
    const rh = document.createElement('h2'); rh.textContent = '어제의 베스트 프로필'; res.appendChild(rh);
    if (yw.uids.length) {
      yw.uids.forEach((id) => { const u = byUid.get(id); if (u) res.appendChild(pvCard(u, yw.count)); });
    } else {
      const p = document.createElement('p'); p.className = 'foot'; p.textContent = yw.total ? '표가 모자라서 1등이 없었어요.' : '어제는 투표가 없었어요.'; res.appendChild(p);
    }
    const claim = PV.claimable(users, C.uid, G.ownedList(), today);
    if (claim) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn';
      b.textContent = `베스트 프로필 보상 · 골드 ${PV.GOLD} 받기`;
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await G.claimBest(claim, PV.GOLD); toastMsg(`베스트 프로필! 골드 ${PV.GOLD}을 받았어요`); refreshPVote(); }
        catch (e) { b.disabled = false; showMsg(e && e.user ? e.message : '받지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
      });
      res.appendChild(b);
    }
    body.appendChild(res);

    // 오늘 후보 (나는 빼요 · 꾸민 사람만)
    const cand = users.filter((u) => u.uid !== C.uid && pvDecorated(u));
    const mineId = PV.mine(G.ownedList(), today);
    const h = document.createElement('h2'); h.className = 'pvhead'; h.textContent = '오늘의 후보'; body.appendChild(h);
    if (!cand.length) { const p = document.createElement('p'); p.className = 'foot'; p.textContent = '아직 프로필을 꾸민 사람이 없어요. 상점에서 프레임·배경·이름 꾸미기를 바꿔 보세요!'; body.appendChild(p); return; }
    cand.forEach((u) => {
      body.appendChild(pvCard(u, null));
      const row = document.createElement('div'); row.className = 'cheerrow';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn--sub cheerrow__btn';
      const picked = mineId === u.uid;
      btn.textContent = picked ? '✓ 내가 고른 프로필' : (mineId ? '이 프로필로 바꾸기' : '이 프로필에 투표');
      btn.disabled = picked;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try { await G.castProfileVote(today, u.uid, PV.keepDays(today)); pvCache.list = null; showMsg(`${u.nickname || '이름 없음'}님에게 투표했어요!`); refreshPVote(); }
        catch (e) { btn.disabled = false; showMsg(e && e.user ? e.message : '투표하지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
      });
      row.appendChild(btn); body.appendChild(row);
    });
  }

  function refreshModes() {
    const box = $('modeList');
    box.textContent = '';
    MODES.filter((m) => !m.show || m.show()).forEach((m, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'menu__btn' + (i === 0 ? ' menu__btn--main' : '');
      const sp = document.createElement('span'); sp.textContent = m.name;
      const sub = document.createElement('small'); sub.className = 'menu__sub'; sub.textContent = m.sub();
      sp.appendChild(sub); b.appendChild(sp);
      const t = m.tag();
      if (t) { const e = document.createElement('em'); e.className = 'tag tag--alert'; e.textContent = t; b.appendChild(e); }
      b.addEventListener('click', m.start);
      box.appendChild(b);
    });
  }

  // 게임 잘하는 법: 꿀팁을 한 장씩 넘겨 봐요 (카드마다 작은 보드가 움직여요)
  let tipIdx = 0, tipStop = null;
  function showTip(i) {
    const TP = window.AppTips.TIPS;
    tipIdx = (i + TP.length) % TP.length;
    const t = TP[tipIdx];
    if (tipStop) { tipStop(); tipStop = null; }
    $('tipStep').textContent = `꿀팁 ${tipIdx + 1} / ${TP.length}`;
    $('tipTitle').textContent = t.title;
    $('tipDesc').textContent = t.desc;
    $('tipCap').textContent = '';
    $('tipBoard').hidden = !!t.jokers;
    const jk = $('tipJokers'); jk.hidden = !t.jokers; jk.textContent = '';
    if (t.jokers) {
      JOKER_INFO.forEach((x, n) => {
        const d = document.createElement('div'); d.className = 'tipjk'; d.style.animationDelay = `${n * 120}ms`;
        const im = document.createElement('img'); im.src = `./images/jokers/${x.id}.webp`; im.alt = ''; im.draggable = false;
        const b = document.createElement('b'); b.textContent = x.name;
        const sm = document.createElement('small'); sm.textContent = x.desc;
        d.appendChild(im); d.appendChild(b); d.appendChild(sm); jk.appendChild(d);
      });
    } else {
      $('tipBoard').textContent = '';
      const inner = document.createElement('div'); inner.className = 'board__inner'; $('tipBoard').appendChild(inner);
      tipStop = window.AppTips.play(inner, t.frames, $('tipCap'));
    }
    const dots = $('tipDots'); dots.textContent = '';
    TP.forEach((_, n) => { const d = document.createElement('i'); if (n === tipIdx) d.className = 'on'; dots.appendChild(d); });
    const card = $('tipCard'); card.classList.remove('tipcard--in'); void card.offsetWidth; card.classList.add('tipcard--in');
  }
  $('tipPrev').addEventListener('click', () => showTip(tipIdx - 1));
  $('tipNext').addEventListener('click', () => showTip(tipIdx + 1));
  (function () {
    let x0 = null;
    const card = $('tipCard');
    card.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) showTip(tipIdx + (dx < 0 ? 1 : -1)); }, { passive: true });
  })();

  function refreshSettings() {
    const online = A.enabled && !!A.user;
    $('stAccount').textContent = online ? `로그인: ${A.user.email}` : '로그인 없이 이 기기에서만 쓰는 중이에요.';
    $('logoutBtn').hidden = !online;
  }

  function render() {
    const name = effective();
    if (name !== 'boot' && name !== current()) history.replaceState({}, '', '#' + name);
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === name));
    window.scrollTo(0, 0);
    if (name === 'home') refreshHome();
    if (name === 'modes') refreshModes();
    if (name === 'tips') showTip(0); else if (tipStop) { tipStop(); tipStop = null; }
    if (name === 'profile' || name === 'board') refreshProfile();
    if (name === 'settings') refreshSettings();
    if (name === 'dex') { dexThemeId = null; dexCat = null; dexCatAuto = true; refreshDex(); }
    if (name === 'shop') refreshShop();
    if (name === 'event') refreshEvent();
    if (name === 'vote') refreshVote();
    if (name === 'pvote') refreshPVote();
    if (name === 'login') $('loginErr').textContent = '';
    window.dispatchEvent(new CustomEvent('screenchange', { detail: name }));   // 화면에 맞는 BGM 으로 바꿀 때 쓰여요
  }

  function go(name) {
    if (name === current()) return;
    history.pushState({ app: 1 }, '', '#' + name);
    render();
  }

  function back() {
    if (history.state && history.state.app) history.back();            // 앱 안에서 온 경우: 이전 화면으로
    else { history.replaceState({}, '', '#home'); render(); }           // 바로 열린 경우: 홈으로
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    if (e.target.closest('[data-back]')) back();
  });
  window.addEventListener('popstate', render);
  // 오늘의 도전
  window.addEventListener('game2048:exit', () => { if (effective() === 'game') back(); });
  // 골드·미션이 바뀌면 지금 보는 화면을 새로 그려요
  window.addEventListener('gold:change', () => { const n = effective(); if (n === 'home') refreshHome(); if (n === 'shop') refreshShop(); if (n === 'profile' || n === 'board') refreshProfile(); if (n === 'event') refreshEvent(); if (n === 'vote') refreshVote(); });
  A.onChange(render);

  // ---------- 로그인 / 로그아웃 ----------
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value, pw = $('loginPw').value;
    if (!email.trim() || !pw) { $('loginErr').textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
    $('loginBtn').disabled = true; $('loginErr').textContent = '';
    try { await A.signIn(email, pw); $('loginPw').value = ''; }
    catch (err) { $('loginErr').textContent = err.message; }
    finally { $('loginBtn').disabled = false; }
  });

  // ---------- 프로필 사진 고르기 ----------
  $('avatarPick').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-avatar]');
    if (!b) return;
    const msg = $('avatarMsg');
    msg.className = 'form-err'; msg.textContent = '';
    try {
      const a = AVATARS.find((x) => x.id === b.dataset.avatar);
      if (!a || !ownsAvatar(a)) throw new Error('상점에서 먼저 사야 해요.');
      await C.saveAvatar(b.dataset.avatar);
      renderAvatarPicker(); renderFramePicker(); renderMe(); refreshRank();
      msg.className = 'form-err form-ok'; msg.textContent = '바꿨어요.';
    } catch (err) {
      msg.textContent = '저장하지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.';
    }
  });

  // ---------- 내 사진 올리기 (정사각형으로 자르고 작게 줄여서 내 문서에 저장) ----------
  const PHOTO_MAX = 60000;   // cloud.js · 보안 규칙의 글자 수 상한과 같아요
  const CROP = 280;
  const crop = { img: null, zoom: 1, ox: 0, oy: 0, base: 1, drag: null };
  function cropDraw() {
    const cv = $('cropCanvas'), g = cv.getContext('2d'), im = crop.img;
    g.fillStyle = '#0c0806'; g.fillRect(0, 0, CROP, CROP);
    if (!im) return;
    const s = crop.base * crop.zoom, w = im.width * s, h = im.height * s;
    g.drawImage(im, CROP / 2 - w / 2 + crop.ox, CROP / 2 - h / 2 + crop.oy, w, h);
  }
  function cropClamp() {   // 사진이 칸을 항상 가득 채우게
    const s = crop.base * crop.zoom, mx = Math.max(0, (crop.img.width * s - CROP) / 2), my = Math.max(0, (crop.img.height * s - CROP) / 2);
    crop.ox = Math.max(-mx, Math.min(mx, crop.ox)); crop.oy = Math.max(-my, Math.min(my, crop.oy));
  }
  function cropOpen(file, src) {   // file: 올린 사진 / src: 앱 안의 그림 주소 (도감 타일)
    const url = src || URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      if (!src) URL.revokeObjectURL(url);
      crop.img = im; crop.base = Math.max(CROP / im.width, CROP / im.height); crop.zoom = 1; crop.ox = 0; crop.oy = 0;
      $('cropZoom').value = 100; $('cropNote').textContent = '끌어서 위치를 맞추세요';
      $('cropOk').disabled = false; $('cropper').classList.add('show'); cropDraw();
    };
    im.onerror = () => { if (!src) URL.revokeObjectURL(url); const m = $('avatarMsg'); m.className = 'form-err'; m.textContent = '이 사진은 열 수 없어요. 다른 사진을 골라 주세요.'; showMsg('이 그림은 열 수 없어요.'); };
    im.src = url;
  }
  function cropEncode() {   // 정사각형으로 잘라서 256px, 글자 수가 상한을 넘으면 품질 → 크기를 낮춰요
    const im = crop.img, k = crop.base * crop.zoom;
    for (const px of [256, 192, 128]) {
      const cv = document.createElement('canvas'); cv.width = cv.height = px;
      const g = cv.getContext('2d'), r = px / CROP, w = im.width * k * r, h = im.height * k * r;
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, px / 2 - w / 2 + crop.ox * r, px / 2 - h / 2 + crop.oy * r, w, h);
      for (const q of [0.86, 0.74, 0.62, 0.5]) {
        let d = cv.toDataURL('image/webp', q);
        if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/jpeg', q);   // webp 를 못 만드는 기기
        if (d.length <= PHOTO_MAX) return d;
      }
    }
    return '';
  }
  async function photoSet(d) {
    const msg = $('avatarMsg'); msg.className = 'form-err'; msg.textContent = '';
    try {
      await C.savePhoto(d);
      renderAvatarPicker(); renderFramePicker(); renderMe(); refreshRank(); refreshHome();
      msg.className = 'form-err form-ok'; msg.textContent = d ? '내 사진으로 바꿨어요.' : '내 사진을 내렸어요.';
      if (effective() === 'dex') showMsg(d ? '프로필 사진으로 바꿨어요!' : '내 사진을 내렸어요.');
    } catch (err) {
      msg.textContent = '저장하지 못했어요. 인터넷 연결이나 보안 규칙(photo 필드)을 확인해 주세요.';
    }
  }
  (() => {
    const cv = $('cropCanvas');
    cv.addEventListener('pointerdown', (e) => { crop.drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => {
      if (!crop.drag || !crop.img) return;
      const sc = CROP / cv.getBoundingClientRect().width;
      crop.ox = crop.drag.ox + (e.clientX - crop.drag.x) * sc; crop.oy = crop.drag.oy + (e.clientY - crop.drag.y) * sc;
      cropClamp(); cropDraw();
    });
    const end = () => { crop.drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    $('cropZoom').addEventListener('input', (e) => { crop.zoom = Number(e.target.value) / 100; if (crop.img) { cropClamp(); cropDraw(); } });
    $('photoFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) cropOpen(f); });
    $('cropCancel').addEventListener('click', () => { $('cropper').classList.remove('show'); crop.img = null; });
    $('cropOk').addEventListener('click', async () => {
      const d = cropEncode();
      if (!d) { $('cropNote').textContent = '사진을 작게 만들지 못했어요. 다른 사진으로 해 보세요.'; return; }
      $('cropOk').disabled = true;
      await photoSet(d);
      $('cropper').classList.remove('show'); crop.img = null;
    });
    $('photoClear').addEventListener('click', () => { if (window.confirm('내 사진을 내리고 상점 사진으로 돌아갈까요?')) photoSet(''); });
  })();

  // ---------- 프레임 · 칭호 · 상태 메시지 고르기 ----------
  function picker(boxId, msgId, attr, check, save) {
    $(boxId).addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-' + attr + ']');
      if (!b) return;
      const msg = $(msgId); msg.className = 'form-err'; msg.textContent = '';
      const id = b.dataset[attr];
      try {
        if (id && !check(id)) throw new Error('상점에서 먼저 사야 해요.');
        await save(id);
        refreshProfile();
        msg.className = 'form-err form-ok'; msg.textContent = '바꿨어요.';
      } catch (err) { msg.textContent = err.message && !/permission|insufficient/i.test(err.message) ? err.message : '저장하지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.'; }
    });
  }
  picker('framePick', 'frameMsg', 'frame', (id) => { const f = frameOf(id); return f && ownsFrame(f); }, (id) => C.saveFrame(id));
  picker('titlePick', 'titleMsg', 'title', (id) => { const t = titleOf(id); return t && ownsTitle(t); }, (id) => C.saveTitle(id));

  picker('bgPick', 'bgMsg', 'bg', (id) => { const b = bgOf(id); return b && ownsBg(b); }, (id) => C.saveBg(id));
  picker('namePick', 'nameMsg', 'fx', (id) => { const b = fxOf(id); return b && ownsFx(b); }, (id) => C.saveNameFx(id));

  $('bioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('bioMsg'); msg.className = 'form-err'; msg.textContent = '';
    $('bioBtn').disabled = true;
    try { await C.saveBio($('bioInput').value); msg.className = 'form-err form-ok'; msg.textContent = '저장했어요.'; renderMe(); refreshRank(); }
    catch (err) { msg.textContent = err.message && !/permission|insufficient/i.test(err.message) ? err.message : '저장하지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.'; }
    finally { $('bioBtn').disabled = false; }
  });

  // ---------- 닉네임 ----------
  $('nickForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('nickMsg');
    msg.className = 'form-err'; msg.textContent = '';
    $('nickBtn').disabled = true;
    try {
      await C.saveNickname($('nickInput').value);
      msg.className = 'form-err form-ok'; msg.textContent = '저장했어요.';
      renderMe(); refreshRank();
    } catch (err) {
      msg.textContent = err.message && !/permission|insufficient/i.test(err.message) ? err.message : '저장하지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.';
    } finally { $('nickBtn').disabled = false; }
  });

  // 클라우드 기록을 다 받아오면 지금 보고 있는 화면을 새로 그려요
  window.addEventListener('cloud:failed', () => { if (effective() === 'profile' || effective() === 'board') refreshProfile(); });
  window.addEventListener('cloud:ready', () => { const n = effective(); if (n === 'home') refreshHome(); if (n === 'profile' || n === 'board') refreshProfile(); if (n === 'dex') refreshDex(); if (n === 'event') refreshEvent(); if (n === 'vote') refreshVote(); });

  $('copyChatBtn').addEventListener('click', async () => {
    const url = $('copyChatBtn').dataset.url;
    try { await navigator.clipboard.writeText(url); toastMsg('링크를 복사했어요. 카카오톡에 붙여 넣어 열어 주세요'); }
    catch (e) {
      const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* 복사를 못 해요 */ }
      t.remove(); toastMsg(ok ? '링크를 복사했어요. 카카오톡에 붙여 넣어 열어 주세요' : url);
    }
  });
  $('logoutBtn').addEventListener('click', async () => {
    if (!window.confirm('로그아웃할까요?')) return;
    try { await A.signOut(); } catch (e) { /* 실패해도 화면은 그대로 */ }
  });

  if (!SCREENS.includes(location.hash.slice(1))) history.replaceState({}, '', '#home');
  render();
})();
