// 주간 순위 — 한 주 동안 게임에서 얻은 점수를 모아서(누적) 1등에게 골드를 줘요
// - 한 주는 월요일 오전 6시에 시작해요 (하루가 바뀌는 시각은 gold.js 와 같아요)
// - 내 문서의 week 필드: { k: 이번 주 시작일, s: 이번 주 점수, pk: 지난주 시작일, ps: 지난주 점수 }
// - 보상은 "지난주" 1등이 다음 주에 앱을 열었을 때 한 번만 받아요 (weekClaim 에 받은 주를 적어 둬요)
// - 서버 없이 앱이 계산하는 방식이라 기술적으로는 조작이 가능해요 (친구끼리 쓰는 용도)
(() => {
  'use strict';

  const MIN_SCORE = 300;   // 이 점수 이상일 때만 1등 보상이 나가요
  const REWARD = 100;      // 주간 1등 골드 (공동 1등이면 모두 받아요)
  const KEY = 'game2048.week.v1';

  const C = window.AppCloud, G = window.AppGold;
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  function shift(key, days) { const [y, m, d] = key.split('-').map(Number); return fmt(new Date(Date.UTC(y, m - 1, d + days))); }
  // 이번 주의 시작일(월요일) — 월요일 오전 6시 전에는 아직 지난주예요
  function weekKey() {
    const [y, m, d] = G.dayKey().split('-').map(Number);
    return shift(G.dayKey(), -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
  }
  const norm = (w, k) => {
    w = w || {};
    if (w.k === k) return { k, s: w.s || 0, pk: w.pk || '', ps: w.ps || 0 };
    return { k, s: 0, pk: w.k || '', ps: w.s || 0 };   // 주가 바뀌면 이번 주 점수가 지난주로 넘어가요
  };
  const scoreOf = (u, k) => { const w = (u && u.week) || {}; return w.k === k ? (w.s || 0) : w.pk === k ? (w.ps || 0) : 0; };

  // 아직 올리지 않은 점수 (기기에 저장해 두고 로그인한 계정 것인지 확인해요)
  let S = { owner: null, pending: 0 };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 무시 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };
  let lastGain = 0, timer = null, chain = Promise.resolve();

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  function flush() {
    chain = chain.then(async () => {
      clearTimeout(timer);
      if (!C.enabled || !C.loaded || !S.pending) return;
      const d = S.pending, k = weekKey();
      await C.tx(async (t, ref) => {
        const snap = await t.get(ref);
        const w = norm(snap.exists ? snap.data().week : null, k);
        w.s = Math.max(0, w.s + d);
        t.set(ref, { week: w }, { merge: true });
        return w;
      });
      S.pending -= d; S.owner = C.uid; save();
    }).catch((e) => console.warn('주간 점수 저장 실패', e));
    return chain;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(flush, 4000); };

  window.addEventListener('game2048:score', (e) => {
    const g = (e.detail && e.detail.gain) || 0;
    lastGain = g;
    if (!C.enabled || !g) return;
    S.pending += g; save(); later();
  });
  window.addEventListener('game2048:undo', () => {   // 되돌리기로 얻은 점수는 빼요
    if (!C.enabled || !lastGain) return;
    S.pending -= lastGain; lastGain = 0; save(); later();
  });
  window.addEventListener('game2048:over', () => flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // 지난주 1등이면 보상을 받아요
  async function checkReward() {
    if (!C.enabled || !C.loaded) return;
    await flush();
    const last = shift(weekKey(), -7);
    const list = await C.loadAll();
    const scores = list.map((u) => ({ uid: u.uid, s: scoreOf(u, last) }));
    const top = Math.max(0, ...scores.map((x) => x.s));
    const mine = scores.find((x) => x.uid === C.uid);
    if (top < MIN_SCORE || !mine || mine.s !== top) return;
    try { await G.claimWeekly(last, REWARD); toast(`지난주 1등! 골드 ${REWARD}을 받았어요`); }
    catch (e) { if (!e.user) console.warn('주간 보상 실패', e); }
  }

  window.addEventListener('cloud:ready', () => {
    if (S.owner && S.owner !== C.uid) { S.pending = 0; }   // 다른 계정 점수는 버려요
    S.owner = C.uid; save();
    checkReward().catch((e) => console.warn('주간 보상 확인 실패', e));
  });

  window.AppWeekly = { key: weekKey, prevKey: () => shift(weekKey(), -7), scoreOf, flush, reward: REWARD, minScore: MIN_SCORE };
})();
