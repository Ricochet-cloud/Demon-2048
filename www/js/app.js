// 화면 전환 (홈 / 게임 / 프로필 / 꾸미기)
// - 주소의 #이름 으로 화면을 구분해서 안드로이드 뒤로가기 버튼도 자연스럽게 동작해요
// - 새 화면을 만들면 index.html 에 <section data-screen="이름"> 을 추가하고 아래 SCREENS 에 이름만 넣어요
(() => {
  'use strict';

  const SCREENS = ['home', 'game', 'profile', 'shop'];
  const STORE_KEY = 'game2048.v1';   // game.js 와 같은 키
  const $ = (id) => document.getElementById(id);

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  const current = () => { const n = location.hash.slice(1); return SCREENS.includes(n) ? n : 'home'; };

  function refreshHome() {
    const g = readSaved().game;
    const el = $('homeResume');
    if (g && g.score > 0) { el.textContent = `진행 중인 판 이어하기 · ${g.score}점`; el.hidden = false; }
    else el.hidden = true;
  }

  function refreshProfile() {
    const s = readSaved();
    $('pfBest').textContent = s.best || '-';
    $('pfTile').textContent = s.bestTile || '-';
  }

  function render() {
    const name = current();
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === name));
    window.scrollTo(0, 0);
    if (name === 'home') refreshHome();
    if (name === 'profile') refreshProfile();
  }

  function go(name) {
    if (name === current()) return;
    history.pushState({ app: 1 }, '', '#' + name);
    render();
  }

  function back() {
    if (history.state && history.state.app) history.back();            // 앱 안에서 온 경우: 이전 화면으로
    else { history.replaceState({}, '', '#home'); render(); }           // 바로 열린 경우: 홈으로
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    if (e.target.closest('[data-back]')) back();
  });
  window.addEventListener('popstate', render);

  if (!SCREENS.includes(location.hash.slice(1))) history.replaceState({}, '', '#home');
  render();
})();
