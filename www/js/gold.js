// 골드와 일일 미션
// - 미션은 매일 오전 6시에 새로 바뀌고, 달성하면 상점의 미션 탭에서 "받기"를 눌러 골드를 받아요
// - 로그인했을 땐 골드·미션 상태·산 물건(owned)이 내 문서(game2048_users/{uid})에 저장돼서 기기를 바꿔도 같아요
//   받기/구매는 트랜잭션으로 처리해서 두 기기에서 동시에 눌러도 한 번만 지급돼요
// - 로그인 없이 쓰는 경우(firebase-config.js 가 비어 있을 때)는 이 기기 안에만 저장해요
// - 미션 내용이나 금액은 아래 설정에서만 바꾸면 돼요
(() => {
  'use strict';

  // ============ 설정 ============
  const DAY_START_HOUR = 6;               // 하루가 바뀌는 시각
  const TILE_TARGETS = [128, 256, 512];   // "○○ 타일 만들기" 목표 (날마다 돌아가며 바뀌어요)
  const SCORE_TARGET = 2000;              // "한 판에서 ○○점" 목표
  const REWARD = { play: 10, tile: 20, score: 20, all: 20 };
  const KEY = 'game2048.gold.v1';

  const C = window.AppCloud;
  const pad = (n) => String(n).padStart(2, '0');
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

  function dayKey(date) {
    const x = new Date((date || new Date()).getTime() - DAY_START_HOUR * 3600e3);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  }
  const tileTarget = (day) => { const [y, m, d] = day.split('-').map(Number); return TILE_TARGETS[Math.floor(Date.UTC(y, m - 1, d) / 86400000) % TILE_TARGETS.length]; };
  function missionList(day) {
    return [
      { id: 'play', name: '게임 1판 끝내기', reward: REWARD.play },
      { id: 'tile', name: `${tileTarget(day)} 타일 만들기`, reward: REWARD.tile },
      { id: 'score', name: `한 판에서 ${SCORE_TARGET}점 넘기기`, reward: REWARD.score },
      { id: 'all', name: '오늘 미션 전부 달성', reward: REWARD.all }
    ];
  }

  // ============ 이 기기에 저장된 상태 ============
  // owner: 이 상태가 어느 계정 것인지 (null 이면 로그인 없이 모은 것)
  let S = { gold: 0, day: '', done: [], claimed: [], owned: [], owner: null };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 저장소를 못 써도 돼요 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };
  const changed = () => { save(); window.dispatchEvent(new Event('gold:change')); };

  function ensureToday() {
    const day = dayKey();
    if (S.day !== day) { S.day = day; S.done = []; S.claimed = []; save(); }
    return day;
  }

  // 달성한 미션 목록에 id 를 넣고, 세 개를 다 하면 "전부 달성" 도 넣어요
  function addDone(list, id) {
    const out = union(list, [id]);
    return ['play', 'tile', 'score'].every((k) => out.includes(k)) ? union(out, ['all']) : out;
  }

  // ============ 클라우드 (트랜잭션) ============
  // mutate(cur) 가 새 상태를 돌려주면 한 번에 저장해요. 던지면 아무것도 바뀌지 않아요.
  async function cloudUpdate(mutate) {
    const day = ensureToday();
    const next = await C.tx(async (t, ref) => {
      const snap = await t.get(ref);
      const d = snap.exists ? snap.data() : {};
      const same = d.daily && d.daily.day === day;
      const guest = S.owner == null;
      const cur = {
        gold: typeof d.gold === 'number' ? d.gold : (guest ? S.gold : 0),                 // 처음 로그인할 때만 로그인 없이 모은 골드를 가져와요
        owned: Array.isArray(d.owned) ? d.owned : (guest ? S.owned : []),
        day,
        done: union(same ? d.daily.done : [], S.day === day ? S.done : []),
        claimed: same ? [...(d.daily.claimed || [])] : (guest && typeof d.gold !== 'number' && S.day === day ? S.claimed : [])
      };
      const nx = mutate(cur);
      t.set(ref, { gold: nx.gold, owned: nx.owned, daily: { day, done: nx.done, claimed: nx.claimed } }, { merge: true });
      return nx;
    });
    S = Object.assign(S, next, { owner: C.uid });
    changed();
    return next;
  }

  const userError = (msg) => Object.assign(new Error(msg), { user: true });
  const needNet = () => userError('인터넷 연결이 필요해요. 잠시 뒤에 다시 눌러 주세요.');

  // 로그인 상태면 클라우드로, 아니면 이 기기 안에서 바꿔요
  async function update(mutate) {
    if (C.enabled) {
      if (!C.loaded) throw needNet();
      try { return await cloudUpdate(mutate); }
      catch (e) { if (e.user) throw e; console.warn('골드 저장 실패', e); throw needNet(); }
    }
    const day = ensureToday();
    const nx = mutate({ gold: S.gold, owned: [...S.owned], day, done: [...S.done], claimed: [...S.claimed] });
    S = Object.assign(S, nx); changed();
    return nx;
  }

  // ============ 미션 진행 ============
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function mark(id) {
    ensureToday();
    if (S.done.includes(id)) return;
    const hadAll = S.done.includes('all');
    S.done = addDone(S.done, id);
    changed();
    toast(!hadAll && S.done.includes('all') ? '오늘 미션을 모두 달성했어요! 상점에서 보상을 받아요' : '미션 달성! 상점에서 보상을 받아요');
    if (C.enabled && C.loaded) cloudUpdate((cur) => Object.assign(cur, { done: addDone(cur.done, id) })).catch((e) => console.warn('미션 저장 실패', e));
  }

  window.addEventListener('game2048:over', () => mark('play'));
  window.addEventListener('game2048:win', () => mark('play'));
  window.addEventListener('game2048:merge', (e) => {
    const top = Math.max(...((e.detail && e.detail.values) || [0]));
    if (top >= tileTarget(ensureToday())) mark('tile');
  });
  window.addEventListener('game2048:score', (e) => { if (e.detail && e.detail.score >= SCORE_TARGET) mark('score'); });

  // 로그인 직후 / 클라우드를 다 받은 뒤: 계정 기준으로 맞춰요
  window.addEventListener('cloud:ready', () => {
    if (S.owner && S.owner !== C.uid) S = { gold: 0, day: '', done: [], claimed: [], owned: [], owner: null, other: true };   // 다른 계정 상태는 버려요
    ensureToday();
    cloudUpdate((cur) => cur).catch((e) => console.warn('골드 동기화 실패', e));
  });

  // ============ 밖으로 열어 두는 것 ============
  window.AppGold = {
    dayKey,
    get gold() { return S.gold || 0; },
    owns(id) { return S.owned.includes(id); },
    // 오늘 미션 [{ id, name, reward, state: 'doing' | 'ready' | 'claimed' }]
    missions() {
      const day = ensureToday();
      return missionList(day).map((m) => Object.assign({}, m, { state: S.claimed.includes(m.id) ? 'claimed' : S.done.includes(m.id) ? 'ready' : 'doing' }));
    },
    claimable() { return this.missions().filter((m) => m.state === 'ready').length; },
    async claim(id) {
      const m = missionList(ensureToday()).find((x) => x.id === id);
      if (!m) throw userError('없는 미션이에요.');
      await update((cur) => {
        if (!cur.done.includes(id)) throw userError('아직 달성하지 못했어요.');
        if (cur.claimed.includes(id)) throw userError('이미 받았어요.');
        const owned = id === 'all' && !cur.owned.includes('title:diligent') ? [...cur.owned, 'title:diligent'] : cur.owned;   // 업적 칭호
        return Object.assign(cur, { gold: (cur.gold || 0) + m.reward, claimed: [...cur.claimed, id], owned });
      });
      return m.reward;
    },
    // 상점에서 쓸 구매 (골드를 내고 itemId 를 가져요) — 아직 파는 물건은 없지만 구조만 만들어 둬요
    async spend(price, itemId) {
      if (!Number.isInteger(price) || price < 0 || !/^[a-z0-9:_-]{1,40}$/.test(String(itemId))) throw userError('살 수 없는 물건이에요.');
      await update((cur) => {
        if (cur.owned.includes(itemId)) throw userError('이미 가지고 있어요.');
        if ((cur.gold || 0) < price) throw userError('골드가 모자라요.');
        return Object.assign(cur, { gold: cur.gold - price, owned: [...cur.owned, itemId] });
      });
    }
  };
})();
