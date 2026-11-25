// 홈 알림 카드 — 관리자가 올린 알림이 홈에 카드로 떠요 (예: "새 타일 테마가 나왔어요! 확인해 보세요")
// - 내용은 events/alerts.json 에 적어요 (관리 도구의 "알림" 탭이 만들어 줘요). 이벤트처럼 웹의 최신 파일을 먼저 읽어서 새 APK 없이 바뀌어요
// - 사용자가 ✕ 나 버튼을 누르면 그 알림의 id 를 이 기기에 적어 두고, 다시는 안 보여요 (같은 알림을 다시 띄우려면 관리 도구에서 "다시 띄우기")
// - 알림마다 시작일·마감일(선택)과 켜기/끄기가 있어요
(() => {
  'use strict';

  const REMOTE = 'https://ricochet-cloud.github.io/Demon-2048/events/';
  const LOCAL = './events/';
  const CACHE = 'game2048.alerts.v1', SEEN = 'game2048.alerts.seen.v1';
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[a-z0-9_-]{1,24}$/;
  const DAY_START_HOUR = 6;      // 하루가 바뀌는 시각 (gold.js 와 같아요)
  const SHOW_MAX = 3;            // 한 번에 보이는 알림 수
  const GO = ['home', 'modes', 'dex', 'shop', 'profile', 'settings', 'event', 'vote'];
  const TYPES = { theme: '새 타일', event: '이벤트', vote: '투표', update: '업데이트', info: '안내' };

  let list = [], loadedAt = 0, loading = null;

  const dayKey = () => { const x = new Date(Date.now() - DAY_START_HOUR * 3600e3), p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
  const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const norm = (a) => {
    if (!a || !ID_RE.test(String(a.id)) || a.on === false) return null;
    const title = clean(a.title, 24), text = clean(a.text, 100);
    if (!title) return null;
    return { id: String(a.id), type: TYPES[a.type] ? a.type : 'info', title, text, go: GO.includes(a.go) ? a.go : '', btn: clean(a.btn, 10) || '확인하러 가기',
      start: DAY_RE.test(a.start || '') ? a.start : '', end: DAY_RE.test(a.end || '') ? a.end : '' };
  };
  const active = (a, day) => (!a.start || day >= a.start) && (!a.end || day <= a.end);

  const seen = () => { try { const v = JSON.parse(localStorage.getItem(SEEN) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  function dismiss(id) {
    const v = seen(); if (!v.includes(id)) v.push(id);
    try { localStorage.setItem(SEEN, JSON.stringify(v.slice(-100))); } catch (e) { /* 저장소를 못 쓰면 이번 화면에서만 닫혀요 */ }
  }

  async function fetchFrom(base) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(base + 'alerts.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
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
      list = got && Array.isArray(got.alerts) ? got.alerts.map(norm).filter(Boolean) : [];
      loadedAt = Date.now();
      return list;
    })();
    try { return await loading; } finally { loading = null; }
  }

  // 지금 보여줄 알림 (기간 안이고, 아직 닫지 않은 것)
  const pending = () => { const d = dayKey(), s = seen(); return list.filter((a) => active(a, d) && !s.includes(a.id)).slice(0, SHOW_MAX); };

  // box 안에 알림 카드를 그려요. 닫거나 버튼을 누르면 다시 그려요
  function render(box) {
    const items = pending();
    box.textContent = '';
    box.hidden = !items.length;
    items.forEach((a) => {
      const card = document.createElement('div'); card.className = 'card homealert homealert--' + a.type;
      const head = document.createElement('div'); head.className = 'homealert__head';
      const tag = document.createElement('span'); tag.className = 'homealert__tag'; tag.textContent = TYPES[a.type];
      const x = document.createElement('button'); x.type = 'button'; x.className = 'homealert__x'; x.setAttribute('aria-label', '알림 닫기'); x.textContent = '✕';
      x.addEventListener('click', () => { dismiss(a.id); render(box); });
      head.appendChild(tag); head.appendChild(x);
      const h = document.createElement('h2'); h.textContent = a.title;
      card.appendChild(head); card.appendChild(h);
      if (a.text) { const p = document.createElement('p'); p.textContent = a.text; card.appendChild(p); }
      if (a.go) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--sub homealert__btn'; b.textContent = a.btn;
        b.addEventListener('click', () => { dismiss(a.id); render(box); location.hash = '#' + a.go; });
        card.appendChild(b);
      }
      box.appendChild(card);
    });
  }

  window.AppAlert = { load, pending, render, dismiss, types: TYPES };
})();
