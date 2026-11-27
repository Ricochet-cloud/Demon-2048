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
  // 타일 이미지는 js/themes.js 의 테마가 정해요 (파일 이름이 타일 숫자, 범위를 넘으면 big). 없으면 색깔 타일로 나와요.

  const $ = (id) => document.getElementById(id);

  // ============ 저장 ============
  let saved = { best: 0, bestTile: 0, plays: 0, game: null, challenge: null, runs: {} };   // challenge: 오늘의 도전 { day, game, done, score, tile }
  // 기록이 바뀌면 알려줘요 (클라우드 저장 쪽에서 이 이벤트를 들어요)
  const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* 무시 */ } };
  try { saved = Object.assign(saved, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* 저장소를 못 써도 게임은 돼요 */ }
  // 시즌: 최고 점수는 한 달마다 새로 시작해요 (season.js). 지난 시즌 기록은 pseason/pbest 에 남아요
  function rollover() {
    const cur = window.AppSeason ? window.AppSeason.key() : '';
    if (!cur) return false;
    if (!saved.season) { saved.season = cur; return true; }   // 시즌이 생기기 전 기록은 이번 시즌으로 이어가요
    if (saved.season === cur) return false;
    if ((saved.best || 0) > 0 && (!saved.pseason || saved.season > saved.pseason || (saved.season === saved.pseason && saved.best > (saved.pbest || 0)))) { saved.pseason = saved.season; saved.pbest = saved.best; }
    saved.season = cur; saved.best = 0; saved.bestJk = false;
    return true;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) { /* 무시 */ }
  }

  if (rollover()) save();   // 앱을 연 사이에 달이 바뀌었으면 새 시즌으로

  // ============ 게임 ============
  const DIRS = { left: [0, -1], up: [-1, 0], right: [0, 1], down: [1, 0] };
  let tiles = [];          // { v, r, c, el }
  let score = 0, maxTile = 0;
  let over = false, locked = false, winShown = false;
  let undoSnap = null;
  let jk = 0, picking = null;   // 이번 판에 쓴 조커 수 / 지우기·올리기에서 타일을 고르는 중인 조커
  const JOKER_MAX = 3;          // 한 판에 쓸 수 있는 조커 수
  let toastTimer = null;
  // 모드: 'normal' 평소 게임 / 'challenge' 오늘의 도전 (하루 한 판, 모두 같은 시작과 같은 새 타일 순서)
  let mode = 'normal', rngState = 0;
  // 기록 도전 모드: 'timeattack' 3분 안에 최고 점수 / 'limit' 100수 안에 최고 점수. 조커 없이, 이어하기 없이 한 번에 끝나요
  const RUN_SECONDS = 180, RUN_MOVES = 100;
  const RUN_KIND = { timeattack: 'ta', limit: 'ml' };
  const isRun = () => mode === 'timeattack' || mode === 'limit';
  let runMoves = 0, runStart = 0, runTimer = null;
  const weekNow = () => (window.AppWeekly ? window.AppWeekly.key() : today());
  const today = () => (window.AppGold ? window.AppGold.dayKey() : new Date().toISOString().slice(0, 10));
  function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rand() {
    if (mode !== 'challenge') return Math.random();
    rngState = (rngState + 0x6D2B79F5) >>> 0;
    let t = rngState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

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
    const img = window.AppThemes.imgOf(t.v);
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
    const [r, c] = empty[Math.floor(rand() * empty.length)];
    makeTile(rand() < FOUR_RATE ? 4 : 2, r, c, 'is-new');
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

  const snapshot = () => ({ tiles: tiles.map((t) => ({ v: t.v, r: t.r, c: t.c })), score, maxTile, rs: rngState });

  function restore(s) {
    $('tiles').innerHTML = ''; tiles = []; maxTile = 0;
    s.tiles.forEach((t) => makeTile(t.v, t.r, t.c));
    score = s.score; maxTile = s.maxTile;
    if (Number.isInteger(s.rs)) rngState = s.rs >>> 0;   // 되돌리면 새 타일 순서도 되돌아가요
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
    if (isRun()) { runMoves++; if (mode === 'timeattack' && !runStart) startClock(); }
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
      if (grown.length) {
        emit('game2048:merge', { values: grown.map((t) => t.v) });
        // 처음 만든 타일이면 도감에 새로 등록돼요 (최고 타일은 이 다음에 기록돼요)
        const top = Math.max(...grown.map((t) => t.v));
        if (top > (saved.bestTile || 0)) {
          const th = window.AppThemes.get(), nm = th.names[top];
          toast(nm ? `새 타일 발견! ${top} · ${nm}` : `새 타일 발견! ${top}`);
          emit('game2048:discover', { value: top });
        }
      }
      addRandomTile();
      locked = false;
      afterMove();
    }, ANIM_MS);
  }

  function afterMove() {
    if (isRun()) { runAfterMove(); return; }
    emit('game2048:score', { score, gain: undoSnap ? Math.max(0, score - undoSnap.score) : 0 });
    recordBest();
    if (maxTile >= WIN_TILE && !winShown) { winShown = true; saveGame(); updateHud(); showModal('🎉 2048 달성!', true); emit('game2048:win'); return; }
    if (!canMove()) {
      over = true; saved.plays = (saved.plays || 0) + 1;
      if (mode === 'challenge') endChallenge();
      saveGame(); updateHud(); showModal(mode === 'challenge' ? '오늘의 도전 끝' : '게임 오버', false); emit('game2048:over'); emit('game2048:record'); return;
    }
    saveGame(); updateHud();
  }

  // ============ 기록 · 저장 ============
  function recordBest() {
    let changed = rollover();   // 켜 둔 채로 달이 바뀐 경우
    if (changed) updateHud();
    if (score > saved.best) { saved.best = score; saved.bestJk = mode === 'normal' && jk > 0; changed = true; }   // 조커를 쓴 판의 기록은 (조커사용) 표시가 붙어요
    if (maxTile > saved.bestTile) { saved.bestTile = maxTile; changed = true; }
    if (changed) { save(); emit('game2048:record'); }
  }

  function saveGame() {
    if (isRun()) return;   // 기록 도전 판은 저장하지 않아요 (일반 판이 덮어써지면 안 돼요)
    // 끝난 판은 이어하지 않고 지워요 (다음에 켜면 새 판)
    const g = over ? null : { ...snapshot(), jk, winShown };
    if (mode === 'challenge') { if (saved.challenge) saved.challenge.game = g; }
    else saved.game = g;
    save();
  }

  // ============ 화면 ============
  function updateHud() {
    $('score').textContent = score;
    $('maxTile').textContent = maxTile || '-';
    if (isRun()) {
      const left = mode === 'timeattack' ? Math.max(0, RUN_SECONDS - (runStart ? Math.floor((Date.now() - runStart) / 1000) : 0)) : RUN_MOVES - runMoves;
      $('bestLbl').textContent = mode === 'timeattack' ? '남은 시간' : '남은 수';
      $('best').textContent = mode === 'timeattack' ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : String(left);
      $('best').parentNode.classList.toggle('hud__box--low', mode === 'timeattack' ? left <= 10 : left <= 10);
    } else {
      $('bestLbl').textContent = '최고 점수';
      $('best').textContent = Math.max(saved.best, score) || '-';
      $('best').parentNode.classList.remove('hud__box--low');
    }
    updateJokers();
  }

  function updateJokers() {
    const have = window.AppGold ? window.AppGold.jokers() : {};
    document.querySelectorAll('#jokers [data-joker]').forEach((b) => {
      const k = b.dataset.joker, n = have[k] || 0;
      b.querySelector('i').textContent = n;
      b.classList.toggle('joker--empty', n <= 0);
      b.classList.toggle('joker--on', picking === k);
      b.disabled = over || jk >= JOKER_MAX;
    });
    $('jkNote').textContent = picking ? (picking === 'erase' ? '없앨 타일을 눌러 주세요' : '한 단계 올릴 타일을 눌러 주세요')
      : `이번 판 조커 ${jk}/${JOKER_MAX}${jk ? ' · (조커사용)' : ''}`;
  }

  function showModal(title, win) {
    $('modalTitle').textContent = title;
    if (isRun()) {
      const rb = (saved.runs[RUN_KIND[mode]] || {});
      $('modalStats').innerHTML = `점수 <b>${score}</b> · 최고 타일 <b>${maxTile}</b><br>이번 주 내 최고 <b>${rb.w === weekNow() ? rb.s : score}</b>`;
      $('modalNote').textContent = runNote;
      $('continueBtn').style.display = 'none';
      $('modal').classList.add('show');
      return;
    }
    $('modalStats').innerHTML = `점수 <b>${score}</b> · 최고 타일 <b>${maxTile}</b><br>최고 점수 <b>${Math.max(saved.best, score)}</b>${mode === 'normal' && jk ? '<br>(조커사용)' : ''}`;
    $('modalNote').textContent = mode === 'challenge' && over ? '오늘은 한 판만 도전할 수 있어요. 내일 오전 6시에 새 도전이 열려요.' : (win && maxTile >= WIN_TILE ? '계속해서 더 높이 도전할 수 있어요!' : '');
    $('continueBtn').style.display = win ? '' : 'none';
    $('modal').classList.add('show');
  }

  function newGame() {
    if (isRun()) { startRun(); return; }
    $('modal').classList.remove('show');
    $('tiles').innerHTML = '';
    tiles = []; score = 0; maxTile = 0; over = false; locked = false; winShown = false;
    undoSnap = null; jk = 0; picking = null; board().classList.remove('picking');
    addRandomTile(); addRandomTile();
    saveGame(); updateHud();
  }

  // ============ 조커카드 (일반 모드에서만, 한 판에 3장까지) ============
  const board = () => $('board');
  function setPicking(k) { picking = k; board().classList.toggle('picking', !!k); updateJokers(); }
  const tileAt = (el) => tiles.find((t) => t.el === el);

  async function useJoker(kind) {
    if (mode !== 'normal' || over || locked) return;
    const A = window.AppGold;
    if (!A) return;
    if (picking === kind) { setPicking(null); return; }   // 한 번 더 누르면 취소
    setPicking(null);
    if (jk >= JOKER_MAX) { toast(`조커는 한 판에 ${JOKER_MAX}장까지 쓸 수 있어요`); return; }
    if ((A.jokers()[kind] || 0) <= 0) { toast('조커카드가 없어요. 상점에서 살 수 있어요'); return; }
    if (kind === 'undo' && !undoSnap) { toast('되돌릴 수가 없어요'); return; }
    if (kind === 'shuffle' && tiles.length < 2) { toast('섞을 타일이 모자라요'); return; }
    if (kind === 'erase' || kind === 'upgrade') { setPicking(kind); return; }
    await consume(kind, () => { if (kind === 'undo') doUndo(); else doShuffle(); });
  }

  // 조커를 하나 쓰고(저장이 끝난 뒤에) 효과를 적용해요
  async function consume(kind, apply) {
    locked = true;
    try { await window.AppGold.useJoker(kind); }
    catch (e) { locked = false; toast(e && e.user ? e.message : '조커를 쓰지 못했어요. 잠시 뒤에 다시 눌러 주세요'); return; }
    locked = false;
    jk++; apply();
  }

  function doUndo() {
    restore(undoSnap); undoSnap = null;
    emit('game2048:undo');
    saveGame(); updateHud();
  }
  function doShuffle() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [cells[i], cells[k]] = [cells[k], cells[i]]; }
    tiles.forEach((t, i) => { t.r = cells[i][0]; t.c = cells[i][1]; setPos(t); });
    undoSnap = null; afterMove();
  }
  async function pickTile(el) {
    const kind = picking, t = tileAt(el.closest('.tile'));
    if (!kind || !t) return;
    setPicking(null);
    await consume(kind, () => {
      undoSnap = null;
      if (kind === 'erase') { t.el.remove(); tiles = tiles.filter((x) => x !== t); }
      else {
        t.v *= 2; paint(t); if (t.v > maxTile) maxTile = t.v;
        t.el.classList.remove('is-pop'); void t.el.offsetWidth; t.el.classList.add('is-pop');
      }
      afterMove();
    });
  }

  // 지난 판 이어하기 (저장된 값이 이상하면 무시하고 새 판)
  function resumeFrom(g) {
    try {
      if (!g || !Array.isArray(g.tiles) || !g.tiles.length) return false;
      if (!g.tiles.every((t) => Number.isInteger(t.r) && Number.isInteger(t.c) && t.r >= 0 && t.r < SIZE && t.c >= 0 && t.c < SIZE && t.v >= 2)) return false;
      restore(g);
      jk = Math.max(0, Math.min(JOKER_MAX, g.jk | 0)); winShown = !!g.winShown; undoSnap = null; over = false;
      return true;
    } catch (e) { return false; }
  }
  function resume() {
    if (!resumeFrom(saved.game)) return false;
    if (!canMove()) { over = true; saved.game = null; save(); showModal('게임 오버', false); }
    updateHud();
    return true;
  }

  // ============ 기록 도전 (타임어택 · 수 제한) ============
  let runNote = '';
  function stopClock() { clearInterval(runTimer); runTimer = null; }
  function startClock() {
    runStart = Date.now();
    stopClock();
    runTimer = setInterval(() => {
      if (!$('screen-game').classList.contains('active')) { stopClock(); runStart = 0; return; }   // 화면을 나가면 그 판은 없던 일이에요
      updateHud();
      if (Date.now() - runStart >= RUN_SECONDS * 1000 && !locked) endRun();
    }, 250);
  }
  function startRun() {
    stopClock();
    clearBoard();
    runMoves = 0; runStart = 0;
    addRandomTile(); addRandomTile();
    updateHud();
  }
  function runAfterMove() {
    updateHud();
    if (mode === 'limit' && runMoves >= RUN_MOVES) { endRun(); return; }
    if (mode === 'timeattack' && runStart && Date.now() - runStart >= RUN_SECONDS * 1000) { endRun(); return; }
    if (!canMove()) endRun();
  }
  function endRun() {
    if (over) return;
    over = true; stopClock();
    const kind = RUN_KIND[mode], wk = weekNow();
    const cur = saved.runs[kind] && saved.runs[kind].w === wk ? saved.runs[kind].s : 0;
    const isBest = score > cur;
    if (isBest) { saved.runs[kind] = { w: wk, s: score }; save(); }
    if (maxTile > saved.bestTile) { saved.bestTile = maxTile; save(); emit('game2048:record'); }
    runNote = isBest ? '이번 주 새 기록이에요! 주간 순위는 \'우리 기록\'에서 볼 수 있어요.' : '주간 순위는 \'우리 기록\'에서 볼 수 있어요.';
    emit('game2048:run', { kind, week: wk, score });
    updateHud();
    showModal(mode === 'timeattack' ? (Date.now() - runStart >= RUN_SECONDS * 1000 ? '시간 끝!' : '더 못 움직여요') : (runMoves >= RUN_MOVES ? '수를 다 썼어요!' : '더 못 움직여요'), false);
  }

  // ============ 오늘의 도전 ============
  function endChallenge() {
    const ch = saved.challenge; if (!ch) return;
    ch.done = true; ch.score = score; ch.tile = maxTile; ch.game = null; save();
    emit('game2048:challenge', { day: ch.day, score, tile: maxTile });
  }
  function clearBoard() { $('modal').classList.remove('show'); $('tiles').innerHTML = ''; tiles = []; score = 0; maxTile = 0; over = false; locked = false; winShown = false; undoSnap = null; jk = 0; picking = null; board().classList.remove('picking'); }
  function applyModeUI() {
    const ch = mode === 'challenge', run = isRun();
    const title = document.querySelector('#screen-game .topbar__title'), hint = document.querySelector('#screen-game .hint');
    if (title) title.textContent = ch ? '오늘의 도전' : mode === 'timeattack' ? '타임어택' : mode === 'limit' ? '수 제한' : '2048';
    if (hint) hint.textContent = ch ? '오늘 하루 한 판만! 모두 같은 시작 배치로 겨뤄요.' : mode === 'timeattack' ? `${RUN_SECONDS / 60}분 안에 최고 점수! 첫 수를 움직이면 시간이 시작돼요.` : mode === 'limit' ? `딱 ${RUN_MOVES}수! 수가 다 떨어지기 전에 최고 점수를 만들어요.` : '밀어서 같은 숫자를 합쳐요. 2048 을 만들어 보세요!';
    $('restartBtn').style.display = ch ? 'none' : '';
    $('jokers').style.display = ch || run ? 'none' : ''; $('jkNote').style.display = ch || run ? 'none' : '';
    $('againBtn').textContent = ch ? '홈으로' : run ? '다시 하기' : '새 판';
  }
  function loadChallenge() {
    const day = today();
    if (!saved.challenge || saved.challenge.day !== day) saved.challenge = { day, game: null, done: false, score: 0, tile: 0 };   // 어제 하던 판은 버려요
    const ch = saved.challenge;
    clearBoard();
    if (ch.done) { score = ch.score || 0; maxTile = ch.tile || 0; over = true; updateHud(); showModal('오늘의 도전 완료', false); return; }
    if (resumeFrom(ch.game)) { if (!canMove()) { over = true; score = score; endChallenge(); saveGame(); showModal('오늘의 도전 끝', false); } updateHud(); return; }
    rngState = hashSeed('2048-challenge-' + day);
    addRandomTile(); addRandomTile();
    saveGame(); updateHud();
  }
  function setMode(m) {
    if (!['challenge', 'timeattack', 'limit'].includes(m)) m = 'normal';
    if (m === mode && m === 'normal') return;
    if (m === 'challenge' && m === mode && saved.challenge && saved.challenge.day === today()) { if (saved.challenge.done) { updateHud(); showModal('오늘의 도전 완료', false); } return; }
    saveGame();
    stopClock();
    mode = m;
    if (m === 'challenge') loadChallenge();
    else if (isRun()) startRun();
    else { clearBoard(); if (!resume()) newGame(); }
    applyModeUI();
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
      if (picking) { if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN && e.target.closest && e.target.closest('.tile')) pickTile(e.target); return; }   // 조커로 타일 고르기
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });

    document.querySelectorAll('#jokers [data-joker]').forEach((b) => b.addEventListener('click', () => useJoker(b.dataset.joker)));
    window.addEventListener('gold:change', updateJokers);
    $('restartBtn').addEventListener('click', newGame);
    $('againBtn').addEventListener('click', () => { if (mode === 'challenge') { $('modal').classList.remove('show'); emit('game2048:exit'); } else newGame(); });
    $('continueBtn').addEventListener('click', () => $('modal').classList.remove('show'));
  }

  // 다른 파일(cloud.js)이 기록을 읽고 합칠 수 있게 열어 둬요 — 기록은 올라가기만 해요
  window.Game2048 = {
    records() {
      if (rollover()) { save(); updateHud(); }
      return { best: saved.best || 0, bestTile: saved.bestTile || 0, plays: saved.plays || 0, bestJk: !!saved.bestJk, season: saved.season || '', pseason: saved.pseason || '', pbest: saved.pbest || 0 };
    },
    apply(r) {
      if (r.pseason && (!saved.pseason || r.pseason > saved.pseason || (r.pseason === saved.pseason && (r.pbest || 0) > (saved.pbest || 0)))) { saved.pseason = r.pseason; saved.pbest = r.pbest || 0; }   // 지난 시즌 기록은 더 최근/높은 쪽
      if ((r.best || 0) > (saved.best || 0)) saved.bestJk = !!r.bestJk;   // 더 높은 쪽 기록의 표시를 따라가요
      saved.best = Math.max(saved.best || 0, r.best || 0);
      saved.bestTile = Math.max(saved.bestTile || 0, r.bestTile || 0);
      saved.plays = Math.max(saved.plays || 0, r.plays || 0);
      save(); updateHud();
    },
    repaint() { tiles.forEach(paint); },
    setMode,
    get mode() { return mode; },
    runBest(kind) { const r = saved.runs && saved.runs[kind]; return r && r.w === weekNow() ? r.s : 0; },
    // 오늘의 도전 상태 { done, started, score }
    challengeState() {
      const ch = saved.challenge && saved.challenge.day === today() ? saved.challenge : null;
      return { done: !!(ch && ch.done), started: !!(ch && (ch.done || ch.game)), score: ch ? (ch.done ? ch.score : (ch.game ? ch.game.score : 0)) : 0 };
    }   // 테마를 바꾸면 보드 위 타일 그림도 바꿔요
  };
  window.addEventListener('themechange', () => window.Game2048.repaint());

  start();
})();
