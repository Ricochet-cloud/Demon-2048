// 화면 전환 (홈 / 게임 / 프로필 / 도감 / 상점 / 설정 / 로그인)
// - 주소의 #이름 으로 화면을 구분해서 안드로이드 뒤로가기 버튼도 자연스럽게 동작해요
// - 새 화면을 만들면 index.html 에 <section data-screen="이름"> 을 추가하고 아래 SCREENS 에 이름만 넣어요
// - 로그인이 켜져 있으면(firebase-config.js 에 값이 있으면) 로그인 전에는 로그인 화면만 보여요
(() => {
  'use strict';

  const SCREENS = ['home', 'game', 'profile', 'dex', 'shop', 'settings', 'login'];
  // 프로필 사진 목록 — images/avatars/<id>.webp. price 가 있으면 상점에서 골드로 사야 쓸 수 있어요 (없으면 처음부터 무료)
  // 사진을 늘리려면 여기에 한 줄 추가하고 파일을 넣어요. 가격은 여기서만 바꾸면 돼요.
  const AVATARS = [
    { id: 'tanjiro', name: '탄지로' }, { id: 'nezuko', name: '네즈코' }, { id: 'zenitsu', name: '젠이츠' },
    { id: 'inosuke', name: '이노스케' }, { id: 'mitsuri', name: '미츠리' }, { id: 'rengoku', name: '렌고쿠' },
    { id: 'murata', name: '무라타', price: 50 }, { id: 'rui', name: '루이', price: 100 }, { id: 'enmu', name: '엔무', price: 100 },
    { id: 'daki', name: '다키', price: 120 }, { id: 'gyutaro', name: '규타로', price: 120 }, { id: 'tamayo', name: '타마요', price: 150 },
    { id: 'akaza', name: '아카자', price: 150 }, { id: 'douma', name: '도우마', price: 150 }, { id: 'kokushibo', name: '코쿠시보', price: 200 },
    { id: 'muzan', name: '키부츠지 무잔', price: 300 }
  ];
  const avatarSrc = (id) => `./images/avatars/${id}.webp`;
  const knownAvatar = (id) => AVATARS.some((a) => a.id === id);
  // 쓸 수 있는 사진: 무료이거나, 샀거나, 이미 지금 쓰고 있는 사진 (이전에 고른 사진은 그대로 써요)
  const ownsAvatar = (a) => !a.price || G.owns('avatar:' + a.id) || a.id === C.avatar;
  // 프레임(사진 테두리) — CSS 는 app.css 의 .fr-<id>. price 없으면 무료
  const FRAMES = [
    { id: 'silver', name: '은색' }, { id: 'gold', name: '금색', price: 80 }, { id: 'sakura', name: '벚꽃', price: 120 },
    { id: 'wave', name: '물결', price: 120 }, { id: 'flame', name: '불꽃', price: 200 }
  ];
  // 칭호 — price 가 있으면 상점에서 사고, when 이 있으면 조건을 채우면 저절로 얻어요 (diligent 는 미션을 다 받을 때 gold.js 가 줘요)
  const best = () => readSaved().bestTile || 0;
  const dexHalf = () => best() >= 128;      // 도감 절반 (가장 긴 도감 14칸 중 7칸 = 128 타일)
  const dexFull = () => best() >= 8192;     // 그림 있는 도감 하나를 다 채움
  const TITLES = [
    { id: 'beginner', name: '귀살대 신입', price: 50 }, { id: 'hashira', name: '주 보좌', price: 100 }, { id: 'flame', name: '불꽃의 후예', price: 150 },
    { id: 'win2048', name: '2048 달성자', when: () => best() >= 2048, how: '2048 타일 만들기' },
    { id: 'collector', name: '수집가', when: dexHalf, how: '도감 절반 채우기' },
    { id: 'master', name: '도감 마스터', when: dexFull, how: '도감 전부 채우기' },
    { id: 'diligent', name: '성실한 대원', how: '하루 미션 전부 받기' }
  ];
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
    const g = readSaved().game;
    const el = $('homeResume');
    if (g && g.score > 0) { el.textContent = `진행 중인 판 이어하기 · ${g.score}점`; el.hidden = false; }
    else el.hidden = true;
    // 로그인했는데 닉네임이 아직 없으면 안내
    $('homeHint').hidden = !(C.enabled && C.loaded && (!C.nickname || !knownAvatar(C.avatar)));
    const th = T.dexTheme(), got = T.discovered(readSaved().bestTile, th).length;
    $('homeDex').textContent = `${got} / ${th.values.length}`;
    $('homeGold').textContent = G.gold;
    $('homeShopTag').hidden = G.claimable() === 0;
  }

  // ---------- 도감 (만든 타일 모으기) ----------
  let dexThemeId = null;   // 도감에서 보고 있는 테마 (지금 쓰는 테마가 기본)

  function refreshDex() {
    const th = T.byId(dexThemeId || T.dexTheme().id);
    const best = readSaved().bestTile || 0;
    const got = T.discovered(best, th);
    const chips = $('dexThemes');
    chips.textContent = '';
    T.list.filter((t) => !t.plain).forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (t.id === th.id ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', () => { dexThemeId = t.id; refreshDex(); });
      chips.appendChild(b);
    });
    $('dexCount').textContent = `${got.length} / ${th.values.length}`;
    const grid = $('dexGrid');
    grid.textContent = '';
    const cells = th.values.map((v) => ({ v, label: th.names[v] || '', img: T.imgOf(v, th), on: v <= best }));
    const bigFrom = th.values[th.values.length - 1] * 2;
    cells.push({ v: bigFrom + '+', label: th.bigName, img: th.dir + 'big.webp', on: best >= bigFrom });
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
  const TABS = [{ id: 'mission', name: '미션' }, { id: 'deco', name: '꾸미기' }, { id: 'theme', name: '타일 테마' }];
  let decoTab = 'avatar';
  const DECO = [{ id: 'avatar', name: '사진' }, { id: 'frame', name: '프레임' }, { id: 'title', name: '칭호' }];

  function showMsg(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(showMsg.t); showMsg.t = setTimeout(() => t.classList.remove('show'), 2200);
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
    FRAMES.filter((f) => f.price).forEach((f) => {
      const own = ownsFrame(f);
      const item = document.createElement('div'); item.className = 'buy' + (own ? ' own' : '');
      item.appendChild(avatarEl(C.avatar, C.nickname, f.id));
      const nm = document.createElement('b'); nm.textContent = f.name; item.appendChild(nm);
      item.appendChild(buyTag(own, f.price, () => buy(`${f.name} 프레임`, f.price, 'frame:' + f.id)));
      grid.appendChild(item);
    });
    card.appendChild(grid); box.appendChild(card);
  }

  function renderTitles() {
    const box = $('decoShop');
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '칭호'; card.appendChild(h);
    TITLES.forEach((t) => {
      const own = ownsTitle(t);
      const row = document.createElement('div'); row.className = 'mission' + (own ? ' mission--claimed' : '');
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
    if (decoTab === 'avatar') renderAvatars(); else if (decoTab === 'frame') renderFrames(); else renderTitles();
  }

  function renderAvatars() {
    const box = $('decoShop');
    box.textContent = '';
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h2'); h.textContent = '프로필 사진'; card.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'buys';
    AVATARS.filter((a) => a.price).forEach((a) => {
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

  function renderThemes() {
    const box = $('themeList');
    box.textContent = '';
    const cur = T.get().id;
    T.list.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card theme-card' + (t.id === cur ? ' on' : '');
      const head = document.createElement('div'); head.className = 'theme-card__head';
      const h = document.createElement('h2'); h.textContent = t.name;
      head.appendChild(h);
      if (t.id === cur) { const tag = document.createElement('em'); tag.className = 'tag'; tag.textContent = '사용 중'; head.appendChild(tag); }
      const desc = document.createElement('p'); desc.className = 'theme-card__desc'; desc.textContent = t.desc;
      const prev = document.createElement('div'); prev.className = 'theme-card__prev';
      [2, 32, 512, 2048].forEach((v) => {
        if (t.plain) {   // 그림이 없는 테마는 실제 게임과 같은 색깔 타일로 미리보기
          const n = document.createElement('div'); n.className = 'tile tilepv'; n.dataset.v = v;
          n.appendChild(document.createElement('span')).textContent = v;
          prev.appendChild(n);
        } else {
          const i = document.createElement('img'); i.src = T.imgOf(v, t); i.alt = ''; i.draggable = false; prev.appendChild(i);
        }
      });
      card.appendChild(head); card.appendChild(desc); card.appendChild(prev);
      if (t.id !== cur) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn--wide'; b.textContent = '이 테마로 바꾸기';
        b.addEventListener('click', () => { T.set(t.id); dexThemeId = null; refreshShop(); });
        card.appendChild(b);
      }
      box.appendChild(card);
    });
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
    $('themeList').hidden = shopTab !== 'theme';
    if (shopTab === 'mission') renderMissions(); else if (shopTab === 'deco') renderDeco(); else renderThemes();
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

  function renderMe() {
    const av = $('meAvatar'); av.textContent = ''; av.appendChild(avatarEl(C.avatar, C.nickname, C.frame));
    $('meName').textContent = C.nickname || '이름 없음';
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

  function renderRank(list) {
    const box = $('rankList');
    box.textContent = '';
    list.sort((a, b) => (b.best || 0) - (a.best || 0)).forEach((u) => {
      const item = document.createElement('div');
      item.className = 'rank__item' + (u.uid === C.uid ? ' rank__item--me' : '');
      const left = document.createElement('div');
      left.className = 'rank__who';
      left.appendChild(avatarEl(u.avatar, u.nickname, u.frame));
      const txt = document.createElement('div');
      txt.className = 'rank__txt';
      const nm = document.createElement('div');
      nm.className = 'rank__name';
      nm.textContent = u.nickname || '이름 없음';
      if (u.uid === C.uid) { const t = document.createElement('small'); t.textContent = '나'; nm.appendChild(t); }
      const sub = document.createElement('span');
      sub.className = 'rank__sub';
      sub.textContent = `플레이 ${u.plays || 0}회${u.updatedAt ? ' · ' + ago(u.updatedAt) : ''}`;
      txt.appendChild(nm);
      const tt = titleOf(u.title);
      if (tt) { const e = document.createElement('span'); e.className = 'rank__title'; e.textContent = tt.name; txt.appendChild(e); }
      if (u.bio) { const e = document.createElement('span'); e.className = 'rank__bio'; e.textContent = u.bio; txt.appendChild(e); }
      txt.appendChild(sub);
      left.appendChild(txt);
      const right = document.createElement('div');
      right.className = 'rank__score';
      const b = document.createElement('b'); b.textContent = u.best || 0;
      right.appendChild(b); right.appendChild(document.createTextNode(`최고 타일 ${u.bestTile || '-'}`));
      item.appendChild(left); item.appendChild(right);
      box.appendChild(item);
    });
  }

  async function refreshRank() {
    const msg = $('rankMsg');
    if (C.failed) { msg.textContent = '기록을 불러오지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.'; return; }
    if (!C.loaded) { msg.textContent = '기록을 불러오는 중이에요...'; return; }
    try { renderRank(await C.loadAll()); msg.textContent = ''; }
    catch (e) { msg.textContent = '기록을 불러오지 못했어요. 인터넷 연결이나 보안 규칙을 확인해 주세요.'; }
  }

  function refreshProfile() {
    const s = readSaved();
    $('pfBest').textContent = s.best || '-';
    $('pfTile').textContent = s.bestTile || '-';
    $('pfPlays').textContent = s.plays || '-';
    const online = A.enabled && !!A.user;
    $('nickCard').hidden = !online;
    $('avatarCard').hidden = !online;
    $('boardCard').hidden = !online;
    ['meCard', 'frameCard', 'titleCard', 'bioCard'].forEach((id) => { $(id).hidden = !online; });
    if (online) {
      renderMe(); renderFramePicker(); renderTitlePicker();
      if (document.activeElement !== $('bioInput')) $('bioInput').value = C.bio;
      renderAvatarPicker();
      if (document.activeElement !== $('nickInput')) $('nickInput').value = C.nickname;
      refreshRank();
    }
    $('guestCard').hidden = online;   // 로그인 없이 쓰는 중일 때만 안내 문구
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
    if (name === 'profile') refreshProfile();
    if (name === 'settings') refreshSettings();
    if (name === 'dex') { dexThemeId = null; refreshDex(); }
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
