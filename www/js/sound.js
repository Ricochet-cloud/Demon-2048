// 소리 — 효과음은 코드로 합성하고, 배경음악(BGM)은 audio/*.mp3 를 이음새 없이 반복해요
// - 브라우저/아이폰 규칙상 화면을 처음 터치한 뒤에야 소리가 나요 (첫 터치에서 자동으로 시작)
// - 설정(음악·효과음·진동·크기·전체 음소거)은 이 기기에만 저장돼요
// - 새 효과음은 아래 SFX 에 함수 하나를 추가하고 play('이름') 으로 부르면 돼요
(() => {
  'use strict';

  const KEY = 'game2048.sound.v1';
  const TRACKS = { home: './audio/bgm-home.mp3', game: './audio/bgm-game.mp3' };
  const DEFAULTS = { muted: false, music: true, sfx: true, vibrate: true, musicVol: 0.6, sfxVol: 0.8 };
  let s = Object.assign({}, DEFAULTS);
  try { s = Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 저장소를 못 써도 소리는 나요 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 무시 */ } };
  const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  const $ = (id) => document.getElementById(id);

  let ctx = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let want = 'home';          // 지금 화면에 어울리는 곡
  let cur = null;             // 재생 중인 곡 { name, src, gain }
  let token = 0;
  const loading = {};         // 곡 이름 -> 디코딩 Promise

  const musicOn = () => !!ctx && !s.muted && s.music;
  const sfxOn = () => !!ctx && !s.muted && s.sfx && ctx.state === 'running';

  // ---------- 시작 (첫 터치) ----------
  function unlock() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();      // 한꺼번에 여러 소리가 나도 찢어지지 않게
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    sfxBus.connect(comp); comp.connect(ctx.destination);
    musicBus.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes(true);
    ctx.resume().catch(() => {});
    syncMusic();
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  document.addEventListener('visibilitychange', () => {   // 앱을 내리면 멈추고, 돌아오면 이어서
    if (!ctx) return;
    (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
  });

  function applyVolumes(instant) {
    if (!ctx) return;
    const t = ctx.currentTime, tc = instant ? 0 : 0.03;
    musicBus.gain.setTargetAtTime(musicOn() ? s.musicVol : 0, t, tc || 0.001);
    sfxBus.gain.setTargetAtTime(!s.muted && s.sfx ? s.sfxVol : 0, t, tc || 0.001);
  }

  // ---------- 배경음악 ----------
  function load(name) {
    if (!loading[name]) {
      loading[name] = fetch(TRACKS[name]).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => ctx.decodeAudioData(b))
        .catch((e) => { delete loading[name]; throw e; });
    }
    return loading[name];
  }

  function stopCur(sec) {
    if (!cur) return;
    const c = cur; cur = null;
    c.gain.gain.setTargetAtTime(0, ctx.currentTime, sec / 3);
    setTimeout(() => { try { c.src.stop(); } catch (e) { /* 이미 멈춤 */ } }, sec * 1000 + 100);
  }

  async function syncMusic() {
    const my = ++token;
    if (!ctx) return;
    if (!musicOn()) { stopCur(0.4); return; }
    if (cur && cur.name === want) return;
    let buf;
    try { buf = await load(want); } catch (e) { console.warn('배경음악을 불러오지 못했어요', e); return; }
    if (my !== token || !musicOn()) return;
    stopCur(1.0);                                      // 이전 곡은 부드럽게 줄이고
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;                 // 이음새를 미리 맞춰 둔 곡이라 끊김 없이 반복돼요
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(musicBus);
    src.start();
    g.gain.setTargetAtTime(1, ctx.currentTime, 0.45);  // 새 곡은 서서히 키워요
    cur = { name: want, src, gain: g };
  }

  window.addEventListener('screenchange', (e) => { want = e.detail === 'game' ? 'game' : 'home'; syncMusic(); });

  // ---------- 효과음 합성 ----------
  const SCALE = [0, 2, 3, 7, 8];                       // 일본풍 음계(히라조시) — 어떤 음을 눌러도 어울려요
  const noteFreq = (i) => 293.66 * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);   // 레(D4)부터

  function osc(type, f0, f1, t, dur, peak, dest, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, peak, freq, q, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function pluck(freq, t, peak) {                      // 고토를 뜯는 듯한 소리
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(sfxBus);
    osc('triangle', freq * 1.012, freq, t, 1.0, peak, lp, 0.003);
    osc('sine', freq * 2, freq * 2, t, 0.45, peak * 0.35, lp, 0.003);
    osc('triangle', freq * 3.01, freq * 3, t, 0.12, peak * 0.12, lp, 0.002);
  }

  function taiko(t, peak) {                            // 큰북
    osc('sine', 150, 48, t, 0.45, peak, sfxBus, 0.002);
    noise(t, 0.08, peak * 0.5, 500, 0.8, 'lowpass');
  }

  const SFX = {
    click() { const t = ctx.currentTime; osc('triangle', 700, 420, t, 0.06, 0.4); noise(t, 0.02, 0.12, 3000, 1); },
    move() { noise(ctx.currentTime, 0.09, 0.45, 1800, 0.9); },
    merge(values) {                                    // 합쳐진 숫자가 클수록 높은 음
      const t = ctx.currentTime;
      const top = [...new Set(values)].sort((a, b) => b - a).slice(0, 2);
      top.forEach((v, i) => {
        const idx = Math.min(12, Math.max(0, Math.round(Math.log2(v)) - 2));
        pluck(noteFreq(idx), t + i * 0.05, 0.30 + Math.min(0.10, idx * 0.008));
      });
      if (top[0] >= 512) taiko(t, 0.25);
    },
    undo() { const t = ctx.currentTime; osc('sine', 520, 240, t, 0.16, 0.5); osc('triangle', 780, 360, t, 0.16, 0.2); },
    over() { const t = ctx.currentTime; taiko(t, 0.55); [7, 5, 3, 0].forEach((n, i) => pluck(noteFreq(n), t + 0.25 + i * 0.2, 0.4)); },
    win() {
      const t = ctx.currentTime; taiko(t, 0.5);
      [2, 3, 4, 5, 6, 7, 9].forEach((n, i) => pluck(noteFreq(n), t + i * 0.09, 0.25));
      pluck(noteFreq(10), t + 0.75, 0.3); pluck(noteFreq(7), t + 0.75, 0.2);
    }
  };

  function play(name, arg) {
    if (!sfxOn()) return;
    try { SFX[name](arg); } catch (e) { console.warn('효과음 오류', e); }
  }

  function buzz(pattern) {                             // 안드로이드 진동 (아이폰은 지원 안 해요)
    if (!s.vibrate || s.muted) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
  }

  window.addEventListener('game2048:move', () => play('move'));
  window.addEventListener('game2048:merge', (e) => {
    const values = (e.detail && e.detail.values) || [];
    if (!values.length) return;
    play('merge', values);
    if (Math.max(...values) >= 128) buzz(18);
  });
  window.addEventListener('game2048:undo', () => play('undo'));
  window.addEventListener('game2048:over', () => { play('over'); buzz([90, 60, 160]); });
  window.addEventListener('game2048:win', () => { play('win'); buzz([40, 40, 40, 40, 120]); });

  // ---------- 설정 화면 / 소리 버튼 ----------
  const ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">'
    + '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="wave" d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11"/>'
    + '<path class="slash" d="M16 9l5 6M21 9l-5 6"/></svg>';
  document.querySelectorAll('[data-sound-toggle]').forEach((b) => { b.innerHTML = ICON; });

  function refreshUI() {
    document.querySelectorAll('[data-sound-toggle]').forEach((b) => {
      b.classList.toggle('off', s.muted);
      b.setAttribute('aria-pressed', s.muted ? 'true' : 'false');
    });
    if ($('optMusic')) {
      $('optMusic').checked = s.music; $('optSfx').checked = s.sfx; $('optVib').checked = s.vibrate;
      $('optMusicVol').value = Math.round(s.musicVol * 100); $('optSfxVol').value = Math.round(s.sfxVol * 100);
    }
  }

  function set(key, val) {
    s[key] = typeof DEFAULTS[key] === 'boolean' ? !!val : clamp01(val);
    save(); applyVolumes(); syncMusic(); refreshUI();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sound-toggle]')) { unlock(); set('muted', !s.muted); }
    if (e.target.closest('.menu__btn, .btn, .topbar__back, .pick button, [data-sound-toggle]')) play('click');
  });
  if ($('optMusic')) {
    $('optMusic').addEventListener('change', (e) => set('music', e.target.checked));
    $('optSfx').addEventListener('change', (e) => { set('sfx', e.target.checked); if (e.target.checked) play('click'); });
    $('optVib').addEventListener('change', (e) => { set('vibrate', e.target.checked); if (e.target.checked) buzz(30); });
    $('optMusicVol').addEventListener('input', (e) => set('musicVol', e.target.value / 100));
    $('optSfxVol').addEventListener('input', (e) => set('sfxVol', e.target.value / 100));
    $('optSfxVol').addEventListener('change', () => play('merge', [64]));   // 놓았을 때 크기를 들어볼 수 있게
  }
  refreshUI();

  // 확인용 (콘솔에서 AppSound.status() 로 볼 수 있어요)
  window.AppSound = {
    status() { return { state: ctx ? ctx.state : 'locked', track: cur ? cur.name : null, settings: Object.assign({}, s) }; }
  };
})();
