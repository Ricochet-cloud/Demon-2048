// 화면 전환 (홈 / 게임 / 프로필 / 도감 / 상점 / 설정 / 로그인)
// - 주소의 #이름 으로 화면을 구분해서 안드로이드 뒤로가기 버튼도 자연스럽게 동작해요
// - 새 화면을 만들면 index.html 에 <section data-screen="이름"> 을 추가하고 아래 SCREENS 에 이름만 넣어요
// - 로그인이 켜져 있으면(firebase-config.js 에 값이 있으면) 로그인 전에는 로그인 화면만 보여요
(() => {
  'use strict';

  const SCREENS = ['home', 'modes', 'game', 'profile', 'dex', 'shop', 'settings', 'login'];
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
  const TITLES = SHOP.titles.map((t) => (t.cond ? Object.assign({}, t, { when: CONDS[t.cond] || (() => false) }) : t));
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
  const ownsFrame = (f) => !f.price || G.owns('frame:' + f.id) || f.id === C.frame;
  const ownsTitle = (t) => (t.when ? t.when() : false) || G.owns('title:' + t.id) || t.id === C.title;
  const STORE_KEY = 'game2048.v1';   // game.js 와 같은 키
  const $ = (id) => document.getElementById(id);
  const A = window.AppAuth;
  const C = window.AppCloud;
  const T = window.AppThemes;
  const G = window.AppGold;
  const W = window.AppWeekly;

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

  function refreshHome() {
    // 로그인했는데 닉네임이 아직 없으면 안내
    $('homeHint').hidden = !(C.enabled && C.loaded && (!C.nickname || !knownAvatar(C.avatar)));
    const th = T.dexTheme(), got = T.discovered(readSaved().bestTile, th).length;
    $('homeDex').textContent = `${got} / ${th.values.length}`;
    $('homeGold').textContent = G.gold;
    $('homeShopTag').hidden = G.claimable() === 0;
    $('homeChallengeTag').hidden = window.Game2048.challengeState().done;   // 오늘의 도전을 아직 안 했으면 표시
    refreshHomeRank();
  }

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
        row.appendChild(avatarEl(u.avatar, u.nickname, u.frame));
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
      renderRank(list.sort((a, b) => (b.best || 0) - (a.best || 0)).slice(0, 3), $('homeRankList'), true);
      renderHomeCheers(list);
      card.hidden = list.length === 0;
    } catch (e) { card.hidden = true; }
  }

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
    const grid = $('dexGrid');
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
      grid.appendChild(f);
    });
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

  async function buy(label, price, itemId, done) {
    if (!window.confirm(`${label} — ${price}골드에 살까요?`)) return;
    try { await G.spend(price, itemId); showMsg(`${label} 구매 완료! 프로필에서 고를 수 있어요.`); }
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
      item.appendChild(avatarEl(C.avatar, C.nickname, f.id));
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
  function useTheme(id) { T.set(id); dexThemeId = null; refreshShop(); }

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
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn themecell__btn'; btn.textContent = '바꾸기';
      btn.addEventListener('click', () => useTheme(t.id));
      card.appendChild(themePreview(t, [2, 512])); card.appendChild(nm); card.appendChild(btn);
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
  function avatarEl(id, nickname, frame) {
    const box = document.createElement('div');
    box.className = 'avatar' + (frameOf(frame) ? ' fr-' + frame : '');
    if (knownAvatar(id)) {
      const img = document.createElement('img');
      img.src = avatarSrc(id); img.alt = ''; img.draggable = false;
      box.appendChild(img);
    } else {
      box.textContent = [...String(nickname || '?')][0];   // 사진을 안 골랐으면 닉네임 첫 글자
    }
    return box;
  }

  function renderAvatarPicker() {
    const pick = $('avatarPick');
    pick.textContent = '';
    AVATARS.filter(ownsAvatar).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.avatar = a.id;
      b.className = a.id === C.avatar ? 'on' : '';
      b.setAttribute('aria-label', a.name);
      b.setAttribute('aria-pressed', a.id === C.avatar ? 'true' : 'false');
      const img = document.createElement('img');
      img.src = avatarSrc(a.id); img.alt = ''; img.draggable = false;
      const label = document.createElement('span');
      label.textContent = a.name;
      b.appendChild(img); b.appendChild(label);
      pick.appendChild(b);
    });
  }

  function renderFramePicker() {
    const pick = $('framePick');
    pick.textContent = '';
    const none = document.createElement('button');
    none.type = 'button'; none.dataset.frame = ''; none.className = C.frame ? '' : 'on';
    none.setAttribute('aria-pressed', C.frame ? 'false' : 'true');
    none.appendChild(avatarEl(C.avatar, C.nickname)); none.appendChild(document.createElement('span')).textContent = '없음';
    pick.appendChild(none);
    FRAMES.filter(ownsFrame).forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.frame = f.id; b.className = f.id === C.frame ? 'on' : '';
      b.setAttribute('aria-pressed', f.id === C.frame ? 'true' : 'false');
      b.appendChild(avatarEl(C.avatar, C.nickname, f.id)); b.appendChild(document.createElement('span')).textContent = f.name;
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
    list.filter(own).forEach((x) => mk(x.id, x.name));
  }

  function renderMe() {
    const av = $('meAvatar'); av.textContent = ''; av.appendChild(avatarEl(C.avatar, C.nickname, C.frame));
    $('meName').textContent = C.nickname || '이름 없음';
    $('meName').className = 'me__name' + (fxOf(C.nameFx) ? ' nm-' + C.nameFx : '');
    $('meCard').className = 'card' + (bgOf(C.bg) ? ' bg-' + C.bg : '');
    const t = titleOf(C.title); $('meTitle').textContent = t ? t.name : ''; $('meTitle').hidden = !t;
    $('meBio').textContent = C.bio; $('meBio').hidden = !C.bio;
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
    const val = (u) => (week ? W.scoreOf(u, wk) : chal ? window.AppChallenge.scoreOf(u, cd) : (u.best || 0));
    list.sort((a, b) => val(b) - val(a)).forEach((u, i) => {
      const item = document.createElement('div');
      item.className = 'rank__item' + (u.uid === C.uid ? ' rank__item--me' : '') + (bgOf(u.bg) ? ' bg-' + u.bg : '');
      const left = document.createElement('div');
      left.className = 'rank__who';
      left.appendChild(avatarEl(u.avatar, u.nickname, u.frame));
      const txt = document.createElement('div');
      txt.className = 'rank__txt';
      const nm = document.createElement('div');
      nm.className = 'rank__name';
      const nmt = document.createElement('span');
      nmt.className = fxOf(u.nameFx) ? 'nm-' + u.nameFx : '';
      nmt.textContent = u.nickname || '이름 없음'; nm.appendChild(nmt);
      if (u.uid === C.uid) { const t = document.createElement('small'); t.textContent = '나'; nm.appendChild(t); }
      if ((week || chal) && i === 0 && val(u) > 0) { const t = document.createElement('small'); t.className = 'rank__first'; t.textContent = '1등'; nm.appendChild(t); }
      const sub = document.createElement('span');
      sub.className = 'rank__sub';
      sub.textContent = `플레이 ${u.plays || 0}회${u.updatedAt ? ' · ' + ago(u.updatedAt) : ''}`;
      txt.appendChild(nm);
      const tt = titleOf(u.title);
      if (tt) { const e = document.createElement('span'); e.className = 'rank__title'; e.textContent = tt.name; txt.appendChild(e); }
      if (u.bio) { const e = document.createElement('span'); e.className = 'rank__bio'; e.textContent = u.bio; txt.appendChild(e); }
      if (!compact) txt.appendChild(sub);
      left.appendChild(txt);
      const right = document.createElement('div');
      right.className = 'rank__score';
      const b = document.createElement('b'); b.textContent = val(u);
      if (!week && !chal && u.bestJk) { const jm = document.createElement('small'); jm.className = 'jkmark'; jm.textContent = '(조커사용)'; b.appendChild(jm); }
      right.appendChild(b); right.appendChild(document.createTextNode(week ? '이번 주' : chal ? (val(u) > 0 ? '오늘' : '아직 안 했어요') : `최고 타일 ${u.bestTile || '-'}`));
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
    $('pfBest').textContent = s.best || '-';
    if (s.best && s.bestJk) { const jm = document.createElement('small'); jm.className = 'jkmark'; jm.textContent = '(조커사용)'; $('pfBest').appendChild(jm); }
    $('pfTile').textContent = s.bestTile || '-';
    $('pfPlays').textContent = s.plays || '-';
    const online = A.enabled && !!A.user;
    $('nickCard').hidden = !online;
    $('avatarCard').hidden = !online;
    $('boardCard').hidden = !online;
    ['meCard', 'frameCard', 'titleCard', 'bioCard', 'bgCard', 'nameCard'].forEach((id) => { $(id).hidden = !online; });
    if (online) {
      renderMe(); renderFramePicker(); renderTitlePicker();
      renderStylePicker('bgPick', BGS, ownsBg, C.bg, 'bg', true); renderStylePicker('namePick', NAMEFX, ownsFx, C.nameFx, 'fx', false);
      if (document.activeElement !== $('bioInput')) $('bioInput').value = C.bio;
      renderAvatarPicker();
      if (document.activeElement !== $('nickInput')) $('nickInput').value = C.nickname;
      refreshRank();
    }
    $('guestCard').hidden = online;   // 로그인 없이 쓰는 중일 때만 안내 문구
  }

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
    }
  ];

  function refreshModes() {
    const box = $('modeList');
    box.textContent = '';
    MODES.forEach((m, i) => {
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
    if (name === 'profile') refreshProfile();
    if (name === 'settings') refreshSettings();
    if (name === 'dex') { dexThemeId = null; dexCat = null; dexCatAuto = true; refreshDex(); }
    if (name === 'shop') refreshShop();
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
  window.addEventListener('gold:change', () => { const n = effective(); if (n === 'home') refreshHome(); if (n === 'shop') refreshShop(); });
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
  window.addEventListener('cloud:failed', () => { if (effective() === 'profile') refreshProfile(); });
  window.addEventListener('cloud:ready', () => { const n = effective(); if (n === 'home') refreshHome(); if (n === 'profile') refreshProfile(); if (n === 'dex') refreshDex(); });

  $('logoutBtn').addEventListener('click', async () => {
    if (!window.confirm('로그아웃할까요?')) return;
    try { await A.signOut(); } catch (e) { /* 실패해도 화면은 그대로 */ }
  });

  if (!SCREENS.includes(location.hash.slice(1))) history.replaceState({}, '', '#home');
  render();
})();
