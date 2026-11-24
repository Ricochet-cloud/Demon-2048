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
  const STREAK_REWARDS = { 3: 30, 7: 100, 14: 200, 30: 500 };   // 연속 출석 N일째에 받는 골드 (하루 한 판 이상 해야 출석)
  const JOKER_PRICE = { undo: 30, erase: 40, shuffle: 50, upgrade: 80 };   // 조커카드 가격
  const JOKER_HOLD = 99;                                                    // 종류별로 가질 수 있는 최대 개수
  const KEY = 'game2048.gold.v1';

  const C = window.AppCloud;
  const pad = (n) => String(n).padStart(2, '0');
  const shiftDay = (key, days) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + days)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
  const normJk = (j) => { const o = {}; Object.keys(JOKER_PRICE).forEach((k) => { const n = j && Number.isInteger(j[k]) ? j[k] : 0; o[k] = Math.max(0, Math.min(JOKER_HOLD, n)); }); return o; };
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
  let S = { gold: 0, day: '', done: [], claimed: [], owned: [], owner: null, streak: null, weekClaim: '', chDone: '', chClaim: '', evClaim: '', jokers: {} };
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

  // 연속 출석: 오늘 한 판을 끝냈을 때 하루에 한 번 올려요 (어제도 했으면 +1, 아니면 1부터 다시)
  const newStreak = () => ({ last: '', n: 0, claimed: 0 });
  function bump(st, day) {
    st = st || newStreak();
    if (st.last === day) return st;
    const cont = st.last === shiftDay(day, -1);
    return { last: day, n: cont ? st.n + 1 : 1, claimed: cont ? st.claimed : 0 };
  }
  const streakAlive = (st, day) => !!st && (st.last === day || st.last === shiftDay(day, -1));
  const nextMilestone = (st) => Object.keys(STREAK_REWARDS).map(Number).find((m) => m > ((st && st.claimed) || 0));

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
        jokers: normJk(d.jokers && typeof d.jokers === 'object' ? d.jokers : (guest ? S.jokers : null)),
        weekClaim: typeof d.weekClaim === 'string' ? d.weekClaim : '',
        chDone: typeof d.chDone === 'string' ? d.chDone : '',
        chClaim: typeof d.chClaim === 'string' ? d.chClaim : '',
        evClaim: typeof d.evClaim === 'string' ? d.evClaim : '',
        streak: (d.streak && typeof d.streak.n === 'number') ? d.streak : (guest ? S.streak : null),
        claimed: same ? [...(d.daily.claimed || [])] : (guest && typeof d.gold !== 'number' && S.day === day ? S.claimed : [])
      };
      if (cur.done.includes('play')) cur.streak = bump(cur.streak, day);   // 오늘 한 판을 끝냈으면 출석
      const nx = mutate(cur);
      t.set(ref, { gold: nx.gold, owned: nx.owned, jokers: normJk(nx.jokers), weekClaim: nx.weekClaim || '', chDone: nx.chDone || '', chClaim: nx.chClaim || '', evClaim: nx.evClaim || '', streak: nx.streak || newStreak(), daily: { day, done: nx.done, claimed: nx.claimed } }, { merge: true });
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
    const nx = mutate({ gold: S.gold, owned: [...S.owned], jokers: normJk(S.jokers), day, done: [...S.done], claimed: [...S.claimed], weekClaim: S.weekClaim || '', chDone: S.chDone || '', chClaim: S.chClaim || '', evClaim: S.evClaim || '', streak: S.done.includes('play') ? bump(S.streak, day) : S.streak });
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
    if (id === 'play') S.streak = bump(S.streak, S.day);
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
    if (S.owner && S.owner !== C.uid) S = { gold: 0, day: '', done: [], claimed: [], owned: [], owner: null, other: true, jokers: {} };   // 다른 계정 상태는 버려요
    ensureToday();
    cloudUpdate((cur) => cur).catch((e) => console.warn('골드 동기화 실패', e));
  });

  // ============ 밖으로 열어 두는 것 ============
  window.AppGold = {
    dayKey,
    get gold() { return S.gold || 0; },
    owns(id) { return S.owned.includes(id); },
    // 조커카드: 가진 개수 { undo, erase, shuffle, upgrade } / 가격표 / 사기 / 쓰기 (쓰면 개수가 하나 줄어요)
    jokers() { return normJk(S.jokers); },
    JOKER_PRICE,
    async buyJoker(kind) {
      const price = JOKER_PRICE[kind];
      if (!price) throw userError('살 수 없는 물건이에요.');
      await update((cur) => {
        const jk = normJk(cur.jokers);
        if (jk[kind] >= JOKER_HOLD) throw userError(`더 가질 수 없어요. (최대 ${JOKER_HOLD}장)`);
        if ((cur.gold || 0) < price) throw userError('골드가 모자라요.');
        jk[kind]++;
        return Object.assign(cur, { gold: cur.gold - price, jokers: jk });
      });
    },
    async useJoker(kind) {
      if (!JOKER_PRICE[kind]) throw userError('쓸 수 없는 조커예요.');
      await update((cur) => {
        const jk = normJk(cur.jokers);
        if (jk[kind] <= 0) throw userError('조커카드가 없어요. 상점에서 살 수 있어요.');
        jk[kind]--;
        return Object.assign(cur, { jokers: jk });
      });
    },
    // 오늘 미션 [{ id, name, reward, state: 'doing' | 'ready' | 'claimed' }]
    missions() {
      const day = ensureToday();
      return missionList(day).map((m) => Object.assign({}, m, { state: S.claimed.includes(m.id) ? 'claimed' : S.done.includes(m.id) ? 'ready' : 'doing' }));
    },
    claimable() { return this.missions().filter((m) => m.state === 'ready').length + (this.streak().ready ? 1 : 0); },
    // 연속 출석 { n: 연속 일수, today: 오늘 출석했는지, next: 다음 보상 일수, ready: 지금 받을 수 있는지, rewards }
    streak() {
      const day = ensureToday(), st = S.streak;
      const alive = streakAlive(st, day), n = alive ? st.n : 0, claimed = alive ? st.claimed : 0;
      const next = nextMilestone({ claimed });
      return { n, today: !!st && st.last === day, claimed, next, ready: !!next && n >= next, rewards: STREAK_REWARDS };
    },
    async claimStreak() {
      let got = 0;
      await update((cur) => {
        const alive = streakAlive(cur.streak, cur.day);
        const next = alive ? nextMilestone(cur.streak) : null;
        if (!next || cur.streak.n < next) throw userError('아직 받을 수 있는 보상이 없어요.');
        got = STREAK_REWARDS[next];
        return Object.assign(cur, { gold: (cur.gold || 0) + got, streak: Object.assign({}, cur.streak, { claimed: next }) });
      });
      return got;
    },
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
    // 주간 1등 보상 (같은 주는 한 번만)
    // field 에 key 를 적어 두고 골드를 줘요 (같은 key 로는 한 번만) — 주간 1등(weekClaim), 오늘의 도전 완료(chDone)/전날 1등(chClaim)
    async claimOnce(field, key, reward) {
      if (!['weekClaim', 'chDone', 'chClaim', 'evClaim'].includes(field)) throw userError('받을 수 없는 보상이에요.');
      await update((cur) => {
        if (cur[field] === key) throw userError('이미 받았어요.');
        return Object.assign(cur, { gold: (cur.gold || 0) + reward, [field]: key });
      });
      return reward;
    },
    claimWeekly(weekKey, reward) { return this.claimOnce('weekClaim', weekKey, reward); },
    claimEvent(eventId, reward) { return this.claimOnce('evClaim', eventId, reward); },   // 배팅 이벤트 승리 보상
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
