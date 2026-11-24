// 배팅 이벤트 — 두 편 중 한 편을 골라서, 이벤트 기간 동안 모은 점수의 합으로 겨뤄요
// - 이벤트 내용(기간·보상·두 편의 이름과 그림)은 events/events.json 에 적어요 (관리 도구가 만들어 줘요)
//   앱은 먼저 웹(GitHub Pages)에 올라간 최신 파일을 보고, 안 되면 앱 안에 들어 있는 파일을 써요
//   → 새 이벤트는 git push 만 하면 앱을 새로 깔지 않아도 나타나요
// - 내 문서의 ev 필드: { id: 이벤트 id, side: 내가 고른 편, s: 내가 모은 점수 }  (편은 한 번 고르면 못 바꿔요)
// - 이긴 편(점수 합이 높은 편)을 고른 사람이 이벤트가 끝난 뒤 골드를 한 번 받아요 (evClaim 에 받은 이벤트 id 를 적어 둬요)
// - 서버 없이 앱이 계산하는 방식이라 기술적으로는 조작이 가능해요 (친구끼리 쓰는 용도)
(() => {
  'use strict';

  const REMOTE = 'https://ricochet-cloud.github.io/Demon-2048/events/';   // 웹에 올라간 최신 이벤트 파일
  const LOCAL = './events/';                                              // 앱 안에 들어 있는 파일
  const SHOW_DAYS = 7;          // 끝난 뒤에도 결과·보상 받기를 이만큼(일) 보여줘요
  const GRACE_MS = 3600e3;      // 끝난 직후 늦게 올라가는 점수를 받아 주는 시간
  const KEY = 'game2048.bet.v1', CACHE = 'game2048.events.v1';
  const ID_RE = /^[a-z0-9_-]{1,20}$/, DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/, IMG_RE = /^[\w./-]{1,100}$/;
  const DAY_START_HOUR = 6;     // 하루가 바뀌는 시각 (gold.js 와 같아요)

  const C = window.AppCloud;
  let events = [], loadedOnce = false, loading = null;

  // ---------- 이벤트 목록 읽기 ----------
  const dayStart = (key) => { const m = DAY_RE.exec(key); return new Date(+m[1], +m[2] - 1, +m[3], DAY_START_HOUR, 0, 0); };
  const startsAt = (ev) => dayStart(ev.start);
  const endsAt = (ev) => { const d = dayStart(ev.end); d.setDate(d.getDate() + 1); return d; };   // 끝나는 날 다음 날 오전 6시

  function norm(e, base) {
    if (!e || !ID_RE.test(String(e.id)) || !DAY_RE.test(String(e.start)) || !DAY_RE.test(String(e.end))) return null;
    if (!Array.isArray(e.sides) || e.sides.length !== 2) return null;
    const url = (p) => (typeof p === 'string' && IMG_RE.test(p) && !p.startsWith('/') ? new URL(p, base).href : '');
    const sides = e.sides.map((s, i) => ({
      id: ID_RE.test(String(s && s.id)) ? String(s.id) : '',
      name: String((s && s.name) || '').slice(0, 12) || (i ? '파랑' : '빨강'),
      image: url(s && s.image),
      color: /^#[0-9a-fA-F]{6}$/.test((s && s.color) || '') ? s.color : (i ? '#3b6fd4' : '#c0392b')
    }));
    if (!sides[0].id || !sides[1].id || sides[0].id === sides[1].id) return null;
    const ev = { id: String(e.id), title: String(e.title || '이벤트').slice(0, 30), start: e.start, end: e.end, image: url(e.image), sides,
      reward: Math.max(0, Math.min(100000, Number.isInteger(e.reward) ? e.reward : 0)) };
    return endsAt(ev) > startsAt(ev) ? ev : null;
  }

  async function fetchFrom(base) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(base + 'events.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { base: new URL(base, location.href).href, data: await r.json() };
    } finally { clearTimeout(t); }
  }

  async function load(force) {
    if (loading) return loading;
    if (loadedOnce && !force) return events;
    loading = (async () => {
      let got = null;
      try { got = await fetchFrom(REMOTE); } catch (e) { /* 웹 파일을 못 읽으면 앱 안 파일을 써요 */ }
      if (!got) { try { got = await fetchFrom(LOCAL); } catch (e) { /* 아래에서 저장해 둔 것을 써요 */ } }
      if (got) { try { localStorage.setItem(CACHE, JSON.stringify(got)); } catch (e) { /* 무시 */ } }
      else { try { got = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { got = null; } }
      events = got && got.data && Array.isArray(got.data.events) ? got.data.events.map((e) => norm(e, got.base)).filter(Boolean) : [];
      loadedOnce = true;
      return events;
    })();
    try { return await loading; } finally { loading = null; }
  }

  const phase = (ev, now) => { const t = (now || new Date()).getTime(); return t < startsAt(ev).getTime() ? 'upcoming' : t < endsAt(ev).getTime() ? 'live' : 'ended'; };
  // 지금 보여줄 이벤트: 진행 중 > 막 끝난 것(일주일 안) > 곧 시작할 것
  function current(now) {
    now = now || new Date();
    const t = now.getTime(), by = (f) => events.filter((e) => phase(e, now) === f);
    const live = by('live').sort((a, b) => endsAt(a) - endsAt(b))[0];
    if (live) return live;
    const ended = by('ended').filter((e) => t - endsAt(e).getTime() < SHOW_DAYS * 86400e3).sort((a, b) => endsAt(b) - endsAt(a))[0];
    if (ended) return ended;
    return by('upcoming').sort((a, b) => startsAt(a) - startsAt(b))[0] || null;
  }
  function leftText(ev, now) {
    now = now || new Date();
    const ph = phase(ev, now);
    if (ph === 'ended') return '';
    const ms = Math.max(0, (ph === 'live' ? endsAt(ev) : startsAt(ev)).getTime() - now.getTime());
    const d = Math.floor(ms / 86400e3), h = Math.floor(ms % 86400e3 / 3600e3);
    const t = d > 0 ? `D-${d}` : h > 0 ? `${h}시간` : '곧';
    return ph === 'live' ? (d > 0 ? `끝나기까지 ${t}` : h > 0 ? `${t} 남음` : '곧 끝나요') : (d > 0 ? `시작까지 ${t}` : h > 0 ? `${t} 뒤 시작` : '곧 시작해요');
  }
  const mmdd = (key) => { const m = DAY_RE.exec(key); return `${+m[2]}.${+m[3]}`; };
  const period = (ev) => `${mmdd(ev.start)} ~ ${mmdd(ev.end)}`;

  // ---------- 집계 ----------
  // list: 모두의 문서. 편마다 { total, members(점수 높은 순) } 를 만들고, 이긴 편을 가려요 (같으면 둘 다 이겨요)
  function tally(ev, list) {
    const out = {}; ev.sides.forEach((s) => { out[s.id] = { side: s, total: 0, members: [] }; });
    (list || []).forEach((u) => {
      const e = u.ev;
      if (!e || e.id !== ev.id || !out[e.side]) return;
      const s = Math.max(0, Number.isInteger(e.s) ? e.s : 0);
      out[e.side].total += s; out[e.side].members.push({ user: u, score: s });
    });
    const a = out[ev.sides[0].id], b = out[ev.sides[1].id];
    [a, b].forEach((x) => x.members.sort((p, q) => q.score - p.score));
    const winners = a.total + b.total === 0 ? [] : a.total === b.total ? [a.side.id, b.side.id] : [a.total > b.total ? a.side.id : b.side.id];
    return { a, b, winners, lead: a.total === b.total ? null : a.total > b.total ? a : b };
  }
  // 내 상태: { side: 내 편 id 또는 '', score, win: 이겼는지, claimed: 이미 받았는지 }
  function mine(ev, list, uid) {
    const u = (list || []).find((x) => x.uid === uid) || {};
    const e = u.ev && u.ev.id === ev.id ? u.ev : null, t = tally(ev, list);
    const side = e && t.a.side.id === e.side ? t.a.side.id : e && t.b.side.id === e.side ? t.b.side.id : '';
    const win = !!side && phase(ev) === 'ended' && t.winners.includes(side);
    return { side, score: side ? (e.s || 0) : 0, win, claimed: u.evClaim === ev.id, claimable: win && ev.reward > 0 && u.evClaim !== ev.id };
  }

  const userError = (msg) => Object.assign(new Error(msg), { user: true });
  const needNet = () => userError('인터넷 연결이 필요해요. 잠시 뒤에 다시 눌러 주세요.');

  // ---------- 점수 모으기 ----------
  // 이벤트가 진행 중이면 얻은 점수를 모았다가 4초 뒤(또는 게임이 끝날 때) 내 편 점수에 더해요
  let S = { owner: null, pending: 0, pid: '' };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 무시 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };
  let lastGain = 0, timer = null, chain = Promise.resolve();

  function flush() {
    chain = chain.then(async () => {
      clearTimeout(timer);
      if (!C.enabled || !C.loaded || !S.pending || !S.pid) return;
      const d = S.pending, pid = S.pid, ev = events.find((e) => e.id === pid);
      if (!ev || Date.now() > endsAt(ev).getTime() + GRACE_MS) { S.pending -= d; save(); return; }   // 이미 끝난 이벤트 점수는 받지 않아요
      await C.tx(async (t, ref) => {
        const snap = await t.get(ref), e = snap.exists ? snap.data().ev : null;
        if (!e || e.id !== pid || !e.side) return;   // 이 이벤트에 참가하지 않았으면 버려요
        t.set(ref, { ev: { id: e.id, side: e.side, s: Math.max(0, (Number.isInteger(e.s) ? e.s : 0) + d) } }, { merge: true });
      });
      S.pending -= d; S.owner = C.uid; save();
    }).catch((e) => console.warn('이벤트 점수 저장 실패', e));
    return chain;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(flush, 4000); };

  window.addEventListener('game2048:score', (e) => {
    const g = (e.detail && e.detail.gain) || 0;
    lastGain = g;
    if (!C.enabled || !g) return;
    const ev = current();
    if (!ev || phase(ev) !== 'live') return;
    if (S.pid !== ev.id) { S.pid = ev.id; S.pending = 0; }
    S.pending += g; save(); later();
  });
  window.addEventListener('game2048:undo', () => {   // 되돌리기로 얻은 점수는 빼요
    if (!C.enabled || !lastGain || !S.pid || !S.pending) return;
    S.pending -= lastGain; lastGain = 0; save(); later();
  });
  window.addEventListener('game2048:over', () => flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('cloud:ready', () => {
    if (S.owner && S.owner !== C.uid) S.pending = 0;   // 다른 계정 점수는 버려요
    S.owner = C.uid; save();
    load().then(() => window.dispatchEvent(new Event('events:ready'))).catch(() => {});
  });

  // ---------- 편 고르기 (한 번 고르면 못 바꿔요) ----------
  // 끝난 이벤트 중 내가 이겼는데 아직 못 받은 보상을 모두 받아요 (skipId 는 건너뛸 이벤트). 받은 이벤트 목록을 돌려줘요
  let claiming = false;
  async function claimOld(list, skipId) {
    if (claiming || !C.enabled || !C.loaded) return [];
    claiming = true;
    const got = [];
    try {
      for (const e of events) {
        if (e.id === skipId || phase(e) !== 'ended') continue;
        const m = mine(e, list, C.uid);
        if (!m.side) continue;   // 참가하지 않은 이벤트
        if (m.claimable) {
          try { await window.AppGold.claimEvent(e.id, e.reward); got.push(e); } catch (err) { if (!err.user) { console.warn('이벤트 보상 받기 실패', err); continue; } }
        }
        // 이긴 이벤트·진 이벤트 모두 전적에 남겨요 (이미 남겼으면 건너뛰어요)
        if (!window.AppGold.owns('ew:' + e.id) && !window.AppGold.owns('el:' + e.id)) {
          try { await window.AppGold.recordEvent(e.id, m.win); } catch (err) { if (!err.user) console.warn('이벤트 전적 기록 실패', err); }
        }
      }
    } finally { claiming = false; }
    return got;
  }

  // 새 이벤트에 참가하면 내 기록이 새 이벤트로 바뀌어요. 그 전에 앞 이벤트 보상이 남아 있으면 먼저 받아요
  async function join(ev, sideId) {
    if (!C.enabled) throw userError('로그인하면 참가할 수 있어요.');
    if (!C.loaded) throw needNet();
    if (phase(ev) === 'ended') throw userError('이미 끝난 이벤트예요.');
    if (!ev.sides.some((s) => s.id === sideId)) throw userError('없는 편이에요.');
    let list;
    try { list = await C.loadAll(); } catch (e) { throw needNet(); }   // 앞 이벤트 결과를 확인하지 못하면 참가하지 않아요
    const got = await claimOld(list, ev.id);
    const me = list.find((u) => u.uid === C.uid);
    const prev = me && me.ev && me.ev.id !== ev.id ? events.find((e) => e.id === me.ev.id) : null;
    if (prev && phase(prev) === 'ended' && !got.some((e) => e.id === prev.id) && mine(prev, list, C.uid).claimable) throw userError('앞 이벤트 보상을 먼저 받아야 해요. 잠시 뒤에 다시 해 주세요.');
    S.pending = 0; S.pid = ev.id; save();   // 참가하기 전에 얻은 점수는 세지 않아요
    try {
      await C.tx(async (t, ref) => {
        const snap = await t.get(ref), d = snap.exists ? snap.data() : {};
        if (d.ev && d.ev.id === ev.id) throw userError('이미 편을 골랐어요. 바꿀 수 없어요.');
        t.set(ref, { ev: { id: ev.id, side: sideId, s: 0 } }, { merge: true });
      });
    } catch (e) { if (e.user) throw e; console.warn('편 고르기 실패', e); throw needNet(); }
    return got;
  }

  // 내 전적: { w: 이긴 수, l: 진 수, streak: 지금 연승, best: 최고 연승 } — 기록은 이벤트 시작 순서로 세요
  function stats() {
    const G = window.AppGold; let w = 0, l = 0, streak = 0, best = 0;
    [...events].sort((a, b) => String(a.start).localeCompare(String(b.start))).forEach((e) => {
      if (G.owns('ew:' + e.id)) { w++; streak++; best = Math.max(best, streak); }
      else if (G.owns('el:' + e.id)) { l++; streak = 0; }
    });
    return { w, l, streak, best };
  }

  window.AppBetting = { stats, load, current, phase, leftText, period, tally, mine, join, claimOld, flush, startsAt, endsAt,
    get list() { return events; }, get ready() { return loadedOnce; } };
})();
