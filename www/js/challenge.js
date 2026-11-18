// 오늘의 도전 — 하루 한 판, 모두 같은 시작 배치로 점수를 겨뤄요
// - 판이 끝나면 내 문서의 challenge 필드에 { day, score, tile, pd, ps } 를 올려요 (pd/ps 는 어제 기록이라 전날 1등을 가릴 수 있어요)
// - 끝낸 보상(20골드)은 하루 한 번, 전날 1등은 다음 날 앱을 열면 50골드를 한 번 받아요 (chDone / chClaim 에 날짜를 적어 둬요)
// - 서버 없이 앱이 계산하는 방식이라 기술적으로는 조작이 가능해요 (친구끼리 쓰는 용도)
(() => {
  'use strict';

  const REWARD_DONE = 20, REWARD_WIN = 50;
  const KEY = 'game2048.ch.v1';
  const C = window.AppCloud, G = window.AppGold;
  const pad = (n) => String(n).padStart(2, '0');
  function prevDay(key) { const [y, m, d] = key.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d - 1)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; }
  const scoreOf = (u, day) => { const c = (u && u.challenge) || {}; return c.day === day ? (c.score || 0) : c.pd === day ? (c.ps || 0) : 0; };

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const store = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } };

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  async function rewardDone(day) {
    try { await G.claimOnce('chDone', day, REWARD_DONE); toast(`오늘의 도전 완료! 골드 ${REWARD_DONE}을 받았어요`); }
    catch (e) { if (!e.user) console.warn('도전 보상 실패', e); }
  }

  // 결과를 올려요 (한 번만 올라가고, 다른 기기에서 이미 올렸으면 그대로 둬요)
  let busy = null;
  function submit() {
    busy = (busy || Promise.resolve()).then(async () => {
      const p = load();
      if (!p || !C.enabled || !C.loaded) return;
      await C.tx(async (t, ref) => {
        const snap = await t.get(ref);
        const cur = snap.exists ? snap.data().challenge : null;
        if (cur && cur.day === p.day) return;
        t.set(ref, { challenge: { day: p.day, score: p.score, tile: p.tile, pd: cur ? cur.day : '', ps: cur ? (cur.score || 0) : 0 } }, { merge: true });
      });
      store(null);
      await rewardDone(p.day);
    }).catch((e) => console.warn('도전 결과 저장 실패', e));
    return busy;
  }

  window.addEventListener('game2048:challenge', (e) => {
    const d = e.detail;
    if (!C.enabled) { rewardDone(d.day); return; }   // 로그인 없이 쓰는 경우 이 기기에서만
    store({ day: d.day, score: d.score, tile: d.tile });
    submit();
  });

  // 어제 1등이면 보상을 받아요
  async function checkWinner() {
    if (!C.enabled || !C.loaded) return;
    const y = prevDay(G.dayKey());
    const list = await C.loadAll();
    const scores = list.map((u) => ({ uid: u.uid, s: scoreOf(u, y) }));
    const top = Math.max(0, ...scores.map((x) => x.s));
    const mine = scores.find((x) => x.uid === C.uid);
    if (top <= 0 || !mine || mine.s !== top) return;
    try { await G.claimOnce('chClaim', y, REWARD_WIN); toast(`어제 도전 1등! 골드 ${REWARD_WIN}을 받았어요`); }
    catch (e) { if (!e.user) console.warn('도전 1등 보상 실패', e); }
  }

  window.addEventListener('cloud:ready', () => {
    submit().then(checkWinner).catch((e) => console.warn('오늘의 도전 확인 실패', e));
  });

  window.AppChallenge = { day: () => G.dayKey(), prevDay, scoreOf, rewardDone: REWARD_DONE, rewardWin: REWARD_WIN };
})();
