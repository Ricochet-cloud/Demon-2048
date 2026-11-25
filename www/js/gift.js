// 골드 선물 — 관리자가 보낸 선물이 홈에 카드로 떠요. "받기"를 누르면 골드가 들어오고, 선물마다 한 번만 받아요
// - 내용은 events/gifts.json (관리 도구의 "선물" 탭이 만들어 줘요). 웹의 최신 파일을 먼저 읽어서 새 APK 없이 바뀌어요
// - to 가 없으면 로그인한 모든 사람, 있으면 그 uid 의 사람만 볼 수 있어요
// - 받은 표시는 사용자 문서의 owned 목록에 'gf:선물id' 로 남아요 (gold.js 의 claimGift)
(() => {
  'use strict';

  const REMOTE = 'https://ricochet-cloud.github.io/Demon-2048/events/';
  const LOCAL = './events/';
  const CACHE = 'game2048.gifts.v1';
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[a-z0-9_-]{1,20}$/;
  const DAY_START_HOUR = 6;
  const SHOW_MAX = 3;
  let list = [], loadedAt = 0, loading = null;

  const dayKey = () => { const x = new Date(Date.now() - DAY_START_HOUR * 3600e3), p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
  const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const norm = (g) => {
    if (!g || !ID_RE.test(String(g.id)) || g.on === false) return null;
    const gold = Number(g.gold), title = clean(g.title, 24);
    if (!Number.isInteger(gold) || gold < 1 || gold > 100000 || !title) return null;
    const to = Array.isArray(g.to) ? g.to.map((u) => clean(u, 60)).filter(Boolean).slice(0, 50) : [];
    return { id: String(g.id), gold, title, text: clean(g.text, 100), to,
      start: DAY_RE.test(g.start || '') ? g.start : '', end: DAY_RE.test(g.end || '') ? g.end : '' };
  };
  const active = (g, day) => (!g.start || day >= g.start) && (!g.end || day <= g.end);

  async function fetchFrom(base) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(base + 'gifts.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function load(force) {
    if (loading) return loading;
    if (!force && loadedAt && Date.now() - loadedAt < 60e3) return list;
    loading = (async () => {
      let got = null;
      try { got = await fetchFrom(REMOTE); } catch (e) { /* 웹 파일을 못 읽으면 앱 안 파일을 써요 */ }
      if (!got) { try { got = await fetchFrom(LOCAL); } catch (e) { /* 아래에서 저장해 둔 것을 써요 */ } }
      if (got) { try { localStorage.setItem(CACHE, JSON.stringify(got)); } catch (e) { /* 무시 */ } }
      else { try { got = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { got = null; } }
      list = got && Array.isArray(got.gifts) ? got.gifts.map(norm).filter(Boolean) : [];
      loadedAt = Date.now();
      return list;
    })();
    try { return await loading; } finally { loading = null; }
  }

  // uid 사람이 지금 받을 수 있는 선물 (기간 안, 대상이 맞고, 아직 안 받은 것)
  const pending = (uid, owns) => { const d = dayKey(); return list.filter((g) => active(g, d) && (!g.to.length || g.to.includes(uid)) && !owns('gf:' + g.id)).slice(0, SHOW_MAX); };

  // box 안에 선물 카드를 그려요. env = { uid, owns(key), claim(id, gold), done(gold) }
  function render(box, env) {
    const items = env && env.uid ? pending(env.uid, env.owns) : [];
    box.textContent = '';
    box.hidden = !items.length;
    items.forEach((g) => {
      const card = document.createElement('div'); card.className = 'card homealert homegift';
      const head = document.createElement('div'); head.className = 'homealert__head';
      const tag = document.createElement('span'); tag.className = 'homealert__tag'; tag.textContent = '선물';
      head.appendChild(tag);
      const h = document.createElement('h2'); h.textContent = g.title;
      card.appendChild(head); card.appendChild(h);
      if (g.text) { const p = document.createElement('p'); p.textContent = g.text; card.appendChild(p); }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--sub homealert__btn';
      b.textContent = `골드 ${g.gold.toLocaleString('ko-KR')} 받기`;
      const err = document.createElement('p'); err.className = 'homegift__err'; err.hidden = true;
      b.addEventListener('click', async () => {
        b.disabled = true; err.hidden = true;
        try { await env.claim(g.id, g.gold); env.done(g.gold); render(box, env); }
        catch (e) { b.disabled = false; err.textContent = e && e.message ? e.message : '지금은 받을 수 없어요. 잠시 뒤에 다시 눌러 주세요.'; err.hidden = false; }
      });
      card.appendChild(b); card.appendChild(err);
      box.appendChild(card);
    });
  }

  window.AppGift = { load, pending, render };
})();
