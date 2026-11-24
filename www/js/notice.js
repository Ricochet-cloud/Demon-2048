// 홈 맨 위 공지 배너 — 관리자가 올린 말이 흘러가는 글씨로 계속 돌아가요
// - 내용은 events/notices.json 에 적어요 (관리 도구의 "공지" 탭이 만들어 줘요). 이벤트처럼 웹의 최신 파일을 먼저 읽어서 새 APK 없이 바뀌어요
// - 공지마다 시작일·마감일(선택)과 켜기/끄기가 있고, 지금 보여줄 공지가 없으면 배너가 아예 안 보여요
(() => {
  'use strict';

  const REMOTE = 'https://ricochet-cloud.github.io/Demon-2048/events/';
  const LOCAL = './events/';
  const CACHE = 'game2048.notices.v1';
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const DAY_START_HOUR = 6;      // 하루가 바뀌는 시각 (gold.js 와 같아요)
  const SPEED = 55;              // 글씨가 흐르는 속도 (초당 픽셀)
  const SEP = '   ◆   ';

  let list = [], loadedAt = 0, loading = null;

  const dayKey = () => { const x = new Date(Date.now() - DAY_START_HOUR * 3600e3), p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
  const norm = (n) => {
    if (!n || typeof n.text !== 'string') return null;
    const text = n.text.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text || n.on === false) return null;
    return { text, start: DAY_RE.test(n.start || '') ? n.start : '', end: DAY_RE.test(n.end || '') ? n.end : '' };
  };
  const active = (n, day) => (!n.start || day >= n.start) && (!n.end || day <= n.end);

  async function fetchFrom(base) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(base + 'notices.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function load(force) {
    if (loading) return loading;
    if (!force && loadedAt && Date.now() - loadedAt < 60e3) return list;   // 1분 안에는 다시 읽지 않아요
    loading = (async () => {
      let got = null;
      try { got = await fetchFrom(REMOTE); } catch (e) { /* 웹 파일을 못 읽으면 앱 안 파일을 써요 */ }
      if (!got) { try { got = await fetchFrom(LOCAL); } catch (e) { /* 아래에서 저장해 둔 것을 써요 */ } }
      if (got) { try { localStorage.setItem(CACHE, JSON.stringify(got)); } catch (e) { /* 무시 */ } }
      else { try { got = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { got = null; } }
      list = got && Array.isArray(got.notices) ? got.notices.map(norm).filter(Boolean) : [];
      loadedAt = Date.now();
      return list;
    })();
    try { return await loading; } finally { loading = null; }
  }

  // 지금 보여줄 공지 글 (여러 개면 ◆ 로 이어서 한 줄로 흘러요)
  const lines = () => list.filter((n) => active(n, dayKey())).map((n) => n.text);

  // 배너를 그려요. box: 배너 칸, track: 흐르는 글씨 칸, host: 배너가 있을 때 class 를 붙일 화면
  let shown = '';
  function render(box, track, host) {
    const txt = lines().join(SEP);
    box.hidden = !txt; host.classList.toggle('has-notice', !!txt);
    if (!txt || txt === shown) return;
    shown = txt;
    track.textContent = '';
    const a = document.createElement('span'), b = document.createElement('span');
    a.textContent = b.textContent = txt + SEP;   // 같은 글을 두 번 이어 붙여서 끊김 없이 돌아가게 해요
    b.setAttribute('aria-hidden', 'true');
    track.appendChild(a); track.appendChild(b);
    box.setAttribute('aria-label', '공지: ' + txt);
    requestAnimationFrame(() => {
      const w = a.getBoundingClientRect().width || 300;
      track.style.setProperty('--dur', Math.max(10, w / SPEED).toFixed(1) + 's');
    });
  }

  window.AppNotice = { load, lines, render };
})();
