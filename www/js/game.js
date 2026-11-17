// 2048 단독 버전 (서버·로그인 없이 기기 안에서만 동작해요)
// - 최고 점수/최고 타일, 진행 중인 판은 localStorage 에 저장돼서 앱을 껐다 켜도 이어져요
// - ES module 을 쓰지 않아서 file:// 나 Android WebView 에서도 그대로 열려요
(() => {
  'use strict';

  // ============ 설정 (숫자는 여기서만 바꾸면 돼요) ============
  const SIZE = 4;
  const WIN_TILE = 2048;
  const SWIPE_MIN = 24;     // 이 거리(px) 이상 밀어야 스와이프로 인정
  const ANIM_MS = 110;      // 타일 이동 시간
  const FOUR_RATE = 0.1;    // 새 타일이 4 로 나올 확률
  const STORE_KEY = 'game2048.v1';
  // 타일 이미지 (파일 이름이 타일 숫자예요. 2048 을 넘는 타일은 big). 없으면 색깔 타일로 나와요.
  const IMG = {};
  [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384].forEach((n) => { IMG[n] = `./images/${n}.webp`; });
  IMG.big = './images/big.webp';

  const $ = (id) => document.getElementById(id);

  // ============ 저장 ============
  let saved = { best: 0, bestTile: 0, plays: 0, game: null };
  // 기록이 바뀌면 알려줘요 (클라우드 저장 쪽에서 이 이벤트를 들어요)
  const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* 무시 */ } };
  try { saved = Object.assign(saved, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* 저장소를 못 써도 게임은 돼요 */ }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) { /* 무시 */ }
  }

  // ============ 게임 ============
  const DIRS = { left: [0, -1], up: [-1, 0], right: [0, 1], down: [1, 0] };
  let tiles = [];          // { v, r, c, el }
  let score = 0, maxTile = 0;
  let over = false, locked = false, winShown = false;
  let undoSnap = null, undoLeft = 1;
  let toastTimer = null;

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function setPos(t) { t.el.style.setProperty('--r', t.r); t.el.style.setProperty('--c', t.c); }

  function paint(t) {
    t.el.dataset.v = t.v > WIN_TILE ? 'big' : String(t.v);
    t.el.firstChild.textContent = t.v;
    t.el.classList.toggle('long', String(t.v).length >= 4);
    const img = IMG[t.v] || (t.v > WIN_TILE ? IMG.big : null);
    t.el.classList.toggle('has-img', !!img);
    // CSS 변수 안의 url() 은 CSS 파일 위치 기준이라, 페이지 기준 절대 주소로 바꿔 넣어요
    if (img) t.el.style.setProperty('--img', `url("${new URL(img, document.baseURI).href}")`);
    else t.el.style.removeProperty('--img');
  }

  function makeTile(v, r, c, cls) {
    const el = document.createElement('div');
    el.className = 'tile' + (cls ? ' ' + cls : '');
    el.appendChild(document.createElement('span'));
    const t = { v, r, c, el };
    paint(t); setPos(t);
    $('tiles').appendChild(el);
    tiles.push(t);
    if (v > maxTile) maxTile = v;
    return t;
  }

  function cellMap() {
    const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles.forEach((t) => { m[t.r][t.c] = t; });
    return m;
  }

  function addRandomTile() {
    const m = cellMap(), empty = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!m[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    makeTile(Math.random() < FOUR_RATE ? 4 : 2, r, c, 'is-new');
  }

  function canMove() {
    const m = cellMap();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (!m[r][c]) return true;
      if (c + 1 < SIZE && m[r][c + 1] && m[r][c + 1].v === m[r][c].v) return true;
      if (r + 1 < SIZE && m[r + 1][c] && m[r + 1][c].v === m[r][c].v) return true;
    }
    return false;
  }

  const snapshot = () => ({ tiles: tiles.map((t) => ({ v: t.v, r: t.r, c: t.c })), score, maxTile });

  function restore(s) {
    $('tiles').innerHTML = ''; tiles = []; maxTile = 0;
    s.tiles.forEach((t) => makeTile(t.v, t.r, t.c));
    score = s.score; maxTile = s.maxTile;
  }

  function move(dirName) {
    if (locked || over) return;
    const [dr, dc] = DIRS[dirName];
    const m = cellMap(), before = snapshot();
    let moved = false;
    const dead = [], grown = [];

    for (let i = 0; i < SIZE; i++) {
      const line = [];
      for (let k = 0; k < SIZE; k++) {
        const idx = (dr + dc > 0) ? SIZE - 1 - k : k;   // 움직이는 쪽 가장자리 칸부터
        line.push(dr === 0 ? [i, idx] : [idx, i]);
      }
      const out = [];
      let merged = null;
      line.forEach(([r, c]) => {
        const t = m[r][c];
        if (!t) return;
        const last = out[out.length - 1];
        if (last && last.v === t.v && merged !== last) {
          t.r = last.r; t.c = last.c;
          dead.push(t);
          last.v *= 2; grown.push(last); merged = last;
          score += last.v; moved = true;
        } else {
          const [tr, tc] = line[out.length];
          if (t.r !== tr || t.c !== tc) moved = true;
          t.r = tr; t.c = tc; out.push(t);
        }
      });
    }

    if (!moved) return;
    undoSnap = before; locked = true;
    emit('game2048:move');
    tiles.forEach(setPos);
    updateHud();

    setTimeout(() => {
      dead.forEach((t) => t.el.remove());
      tiles = tiles.filter((t) => !dead.includes(t));
      grown.forEach((t) => {
        paint(t);
        if (t.v > maxTile) maxTile = t.v;
        t.el.classList.remove('is-pop'); void t.el.offsetWidth; t.el.classList.add('is-pop');
      });
      if (grown.length) emit('game2048:merge', { values: grown.map((t) => t.v) });
      addRandomTile();
      locked = false;
      afterMove();
    }, ANIM_MS);
  }

  function afterMove() {
    recordBest();
    if (maxTile >= WIN_TILE && !winShown) { winShown = true; saveGame(); updateHud(); showModal('🎉 2048 달성!', true); emit('game2048:win'); return; }
    if (!canMove()) {
      over = true; saved.plays = (saved.plays || 0) + 1;
      saveGame(); updateHud(); showModal('게임 오버', false); emit('game2048:over'); emit('game2048:record'); return;
    }
    saveGame(); updateHud();
  }

  // ============ 기록 · 저장 ============
  function recordBest() {
    let changed = false;
    if (score > saved.best) { saved.best = score; changed = true; }
    if (maxTile > saved.bestTile) { saved.bestTile = maxTile; changed = true; }
    if (changed) { save(); emit('game2048:record'); }
  }

  function saveGame() {
    // 끝난 판은 이어하지 않고 지워요 (다음에 켜면 새 판)
    saved.game = over ? null : { ...snapshot(), undoLeft, winShown };
    save();
  }

  // ============ 화면 ============
  function updateHud() {
    $('score').textContent = score;
    $('maxTile').textContent = maxTile || '-';
    $('best').textContent = Math.max(saved.best, score) || '-';
    $('undoBtn').textContent = `↩ 되돌리기 (${undoLeft})`;
    $('undoBtn').disabled = undoLeft <= 0 || !undoSnap || over;
  }

  function showModal(title, win) {
    $('modalTitle').textContent = title;
    $('modalStats').innerHTML = `점수 <b>${score}</b> · 최고 타일 <b>${maxTile}</b><br>최고 점수 <b>${Math.max(saved.best, score)}</b>`;
    $('modalNote').textContent = win && maxTile >= WIN_TILE ? '계속해서 더 높이 도전할 수 있어요!' : '';
    $('continueBtn').style.display = win ? '' : 'none';
    $('modal').classList.add('show');
  }

  function newGame() {
    $('modal').classList.remove('show');
    $('tiles').innerHTML = '';
    tiles = []; score = 0; maxTile = 0; over = false; locked = false; winShown = false;
    undoSnap = null; undoLeft = 1;
    addRandomTile(); addRandomTile();
    saveGame(); updateHud();
  }

  function undo() {
    if (locked || over || undoLeft <= 0 || !undoSnap) return;
    restore(undoSnap); undoSnap = null; undoLeft--;
    emit('game2048:undo');
    saveGame(); updateHud();
  }

  // 지난 판 이어하기 (저장된 값이 이상하면 무시하고 새 판)
  function resume() {
    const g = saved.game;
    try {
      if (!g || !Array.isArray(g.tiles) || !g.tiles.length) return false;
      if (!g.tiles.every((t) => Number.isInteger(t.r) && Number.isInteger(t.c) && t.r >= 0 && t.r < SIZE && t.c >= 0 && t.c < SIZE && t.v >= 2)) return false;
      restore(g);
      undoLeft = g.undoLeft === 0 ? 0 : 1; winShown = !!g.winShown; undoSnap = null;
      if (!canMove()) { over = true; saved.game = null; save(); showModal('게임 오버', false); }
      updateHud();
      return true;
    } catch (e) { return false; }
  }

  function start() {
    const bg = $('cells');
    for (let i = 0; i < SIZE * SIZE; i++) bg.appendChild(Object.assign(document.createElement('div'), { className: 'cell' }));
    if (!resume()) newGame();

    window.addEventListener('keydown', (e) => {
      const map = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', a: 'left', w: 'up', d: 'right', s: 'down' };
      const d = map[e.key];
      if (!d || $('modal').classList.contains('show')) return;
      if (!$('screen-game').classList.contains('active')) return;   // 게임 화면일 때만 키 입력 받기
      e.preventDefault(); move(d);
    });

    const board = $('board');
    let sx = 0, sy = 0, tracking = false;
    board.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
    board.addEventListener('pointercancel', () => { tracking = false; });
    board.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });

    $('undoBtn').addEventListener('click', undo);
    $('restartBtn').addEventListener('click', newGame);
    $('againBtn').addEventListener('click', newGame);
    $('continueBtn').addEventListener('click', () => $('modal').classList.remove('show'));
  }

  // 다른 파일(cloud.js)이 기록을 읽고 합칠 수 있게 열어 둬요 — 기록은 올라가기만 해요
  window.Game2048 = {
    records() { return { best: saved.best || 0, bestTile: saved.bestTile || 0, plays: saved.plays || 0 }; },
    apply(r) {
      saved.best = Math.max(saved.best || 0, r.best || 0);
      saved.bestTile = Math.max(saved.bestTile || 0, r.bestTile || 0);
      saved.plays = Math.max(saved.plays || 0, r.plays || 0);
      save(); updateHud();
    }
  };

  start();
})();
