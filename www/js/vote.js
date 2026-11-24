// 타일 테마 투표 — 아이디어를 모으는 게시판과, 관리자가 올린 투표(여러 후보 중 한 곳에 한 표)
// - 투표 내용(이름·기간·후보)은 events/polls.json 에 적어요 (관리 도구가 만들어 줘요). 이벤트처럼 웹에 올라간 최신 파일을 먼저 읽어요
// - 내 한 표는 내 문서의 vote 필드: { id: 투표 id, o: 고른 후보 id } (기간 안에는 바꿀 수 있어요)
// - 아이디어(댓글)는 game2048_ideas 컬렉션: 문서 id 가 내uid_날짜_번호(1~3) 라서 하루에 3개까지, 내 것만 지울 수 있어요
(() => {
  'use strict';

  const REMOTE = 'https://ricochet-cloud.github.io/Demon-2048/events/';
  const LOCAL = './events/';
  const SHOW_DAYS = 14;         // 끝난 뒤에도 결과(당선 후보)를 이만큼(일) 보여줘요
  const CACHE = 'game2048.polls.v1';
  const IDEA_MAX = 40, IDEA_PER_DAY = 3;
  const ID_RE = /^[a-z0-9_-]{1,20}$/, DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/, IMG_RE = /^[\w./-]{1,100}$/;
  const DAY_START_HOUR = 6;     // 하루가 바뀌는 시각 (gold.js 와 같아요)

  const C = window.AppCloud;
  let polls = [], loadedOnce = false, loading = null;

  const dayStart = (key) => { const m = DAY_RE.exec(key); return new Date(+m[1], +m[2] - 1, +m[3], DAY_START_HOUR, 0, 0); };
  const startsAt = (p) => dayStart(p.start);
  const endsAt = (p) => { const d = dayStart(p.end); d.setDate(d.getDate() + 1); return d; };

  function norm(p, base) {
    if (!p || !ID_RE.test(String(p.id)) || !DAY_RE.test(String(p.start)) || !DAY_RE.test(String(p.end))) return null;
    if (!Array.isArray(p.options) || p.options.length < 2 || p.options.length > 8) return null;
    const url = (v) => (typeof v === 'string' && IMG_RE.test(v) && !v.startsWith('/') ? new URL(v, base).href : '');
    const options = p.options.map((o) => ({ id: ID_RE.test(String(o && o.id)) ? String(o.id) : '', name: String((o && o.name) || '').slice(0, 16), desc: String((o && o.desc) || '').slice(0, 40), image: url(o && o.image) }));
    if (options.some((o) => !o.id || !o.name) || new Set(options.map((o) => o.id)).size !== options.length) return null;
    const poll = { id: String(p.id), title: String(p.title || '테마 투표').slice(0, 30), start: p.start, end: p.end, options };
    return endsAt(poll) > startsAt(poll) ? poll : null;
  }

  async function fetchFrom(base) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(base + 'polls.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { base: new URL(base, location.href).href, data: await r.json() };
    } finally { clearTimeout(t); }
  }

  async function load(force) {
    if (loading) return loading;
    if (loadedOnce && !force) return polls;
    loading = (async () => {
      let got = null;
      try { got = await fetchFrom(REMOTE); } catch (e) { /* 웹 파일을 못 읽으면 앱 안 파일을 써요 */ }
      if (!got) { try { got = await fetchFrom(LOCAL); } catch (e) { /* 아래에서 저장해 둔 것을 써요 */ } }
      if (got) { try { localStorage.setItem(CACHE, JSON.stringify(got)); } catch (e) { /* 무시 */ } }
      else { try { got = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { got = null; } }
      polls = got && got.data && Array.isArray(got.data.polls) ? got.data.polls.map((p) => norm(p, got.base)).filter(Boolean) : [];
      loadedOnce = true;
      return polls;
    })();
    try { return await loading; } finally { loading = null; }
  }

  const phase = (p, now) => { const t = (now || new Date()).getTime(); return t < startsAt(p).getTime() ? 'upcoming' : t < endsAt(p).getTime() ? 'live' : 'ended'; };
  // 지금 보여줄 투표: 진행 중 > 막 끝난 것(2주 안) > 곧 시작할 것
  function current(now) {
    now = now || new Date();
    const t = now.getTime(), by = (f) => polls.filter((p) => phase(p, now) === f);
    const live = by('live').sort((a, b) => endsAt(a) - endsAt(b))[0];
    if (live) return live;
    const ended = by('ended').filter((p) => t - endsAt(p).getTime() < SHOW_DAYS * 86400e3).sort((a, b) => endsAt(b) - endsAt(a))[0];
    return ended || by('upcoming').sort((a, b) => startsAt(a) - startsAt(b))[0] || null;
  }
  function leftText(p, now) {
    now = now || new Date();
    const ph = phase(p, now);
    if (ph === 'ended') return '';
    const ms = Math.max(0, (ph === 'live' ? endsAt(p) : startsAt(p)).getTime() - now.getTime());
    const d = Math.floor(ms / 86400e3), h = Math.floor(ms % 86400e3 / 3600e3);
    return ph === 'live' ? (d > 0 ? `마감까지 D-${d}` : h > 0 ? `${h}시간 남음` : '곧 마감') : (d > 0 ? `시작까지 D-${d}` : h > 0 ? `${h}시간 뒤 시작` : '곧 시작');
  }
  const mmdd = (key) => { const m = DAY_RE.exec(key); return `${+m[2]}.${+m[3]}`; };
  const period = (p) => `${mmdd(p.start)} ~ ${mmdd(p.end)}`;

  // 후보별 표 수와 1위 (같으면 공동 1위, 표가 없으면 없음)
  function tally(poll, list) {
    const rows = poll.options.map((o) => ({ option: o, votes: 0 }));
    (list || []).forEach((u) => { const v = u.vote; if (v && v.id === poll.id) { const r = rows.find((x) => x.option.id === v.o); if (r) r.votes++; } });
    const total = rows.reduce((n, r) => n + r.votes, 0), top = Math.max(0, ...rows.map((r) => r.votes));
    return { rows, total, winners: top > 0 ? rows.filter((r) => r.votes === top).map((r) => r.option.id) : [] };
  }
  const mineOf = (poll, list, uid) => { const u = (list || []).find((x) => x.uid === uid); return u && u.vote && u.vote.id === poll.id && poll.options.some((o) => o.id === u.vote.o) ? u.vote.o : ''; };

  const userError = (msg) => Object.assign(new Error(msg), { user: true });
  async function vote(poll, optId) {
    if (!C.enabled || !C.loaded) throw userError('인터넷 연결이 필요해요. 잠시 뒤에 다시 눌러 주세요.');
    if (phase(poll) !== 'live') throw userError(phase(poll) === 'ended' ? '이미 끝난 투표예요.' : '아직 시작 전이에요.');
    if (!poll.options.some((o) => o.id === optId)) throw userError('없는 후보예요.');
    try { await C.tx(async (t, ref) => { t.set(ref, { vote: { id: poll.id, o: optId } }, { merge: true }); }); }
    catch (e) { console.warn('투표 실패', e); throw userError('투표하지 못했어요. 인터넷 연결을 확인해 주세요.'); }
  }

  // ---------- 아이디어(댓글) ----------
  const clean = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim();
  async function ideas() { return (await C.loadIdeas()).sort((a, b) => ((b.at && b.at.toDate ? b.at.toDate().getTime() : 0) - (a.at && a.at.toDate ? a.at.toDate().getTime() : 0))).slice(0, 100); }
  // day: 오늘(하루 바뀌는 시각 기준) 키. 오늘 올린 개수가 3개면 못 올려요
  async function addIdea(text, day, mine) {
    const t = clean(text);
    if (!t) throw userError('아이디어를 적어 주세요.');
    if ([...t].length > IDEA_MAX) throw userError(`아이디어는 ${IDEA_MAX}글자까지 쓸 수 있어요.`);
    const used = new Set((mine || []).filter((i) => i.id.includes('_' + day + '_')).map((i) => i.id.split('_').pop()));
    const n = [1, 2, 3].find((k) => !used.has(String(k)));
    if (!n) throw userError(`아이디어는 하루에 ${IDEA_PER_DAY}개까지 올릴 수 있어요.`);
    try { await C.addIdea(t, day, n); } catch (e) { console.warn('아이디어 저장 실패', e); throw userError('올리지 못했어요. 인터넷 연결을 확인해 주세요.'); }
  }

  window.AppVote = { load, current, phase, leftText, period, tally, mineOf, vote, ideas, addIdea, ideaMax: IDEA_MAX, perDay: IDEA_PER_DAY, startsAt, endsAt,
    get list() { return polls; }, get ready() { return loadedOnce; } };
  window.addEventListener('cloud:ready', () => { load().then(() => window.dispatchEvent(new Event('polls:ready'))).catch(() => {}); });
})();
