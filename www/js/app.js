// 화면 전환 (홈 / 게임 / 프로필 / 꾸미기 / 로그인)
// - 주소의 #이름 으로 화면을 구분해서 안드로이드 뒤로가기 버튼도 자연스럽게 동작해요
// - 새 화면을 만들면 index.html 에 <section data-screen="이름"> 을 추가하고 아래 SCREENS 에 이름만 넣어요
// - 로그인이 켜져 있으면(firebase-config.js 에 값이 있으면) 로그인 전에는 로그인 화면만 보여요
(() => {
  'use strict';

  const SCREENS = ['home', 'game', 'profile', 'shop', 'login'];
  const STORE_KEY = 'game2048.v1';   // game.js 와 같은 키
  const $ = (id) => document.getElementById(id);
  const A = window.AppAuth;

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  const current = () => { const n = location.hash.slice(1); return SCREENS.includes(n) ? n : 'home'; };

  // 지금 실제로 보여줄 화면 (로그인 상태에 따라 달라져요)
  function effective() {
    const name = current();
    if (!A.enabled) return name === 'login' ? 'home' : name;
    if (!A.ready) return 'boot';
    if (!A.user) return 'login';
    return name === 'login' ? 'home' : name;
  }

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
    if (A.enabled && A.user) {
      $('pfAccount').textContent = `로그인: ${A.user.email}`;
      $('logoutBtn').hidden = false;
    } else {
      $('pfAccount').textContent = '로그인하면 닉네임을 정하고 서로의 기록을 볼 수 있게 돼요. 지금 기록은 이 기기 안에만 저장돼요.';
      $('logoutBtn').hidden = true;
    }
  }

  function render() {
    const name = effective();
    if (name !== 'boot' && name !== current()) history.replaceState({}, '', '#' + name);
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === name));
    window.scrollTo(0, 0);
    if (name === 'home') refreshHome();
    if (name === 'profile') refreshProfile();
    if (name === 'login') $('loginErr').textContent = '';
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
  A.onChange(render);

  // ---------- 로그인 / 로그아웃 ----------
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value, pw = $('loginPw').value;
    if (!email.trim() || !pw) { $('loginErr').textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
    $('loginBtn').disabled = true; $('loginErr').textContent = '';
    try { await A.signIn(email, pw); $('loginPw').value = ''; }
    catch (err) { $('loginErr').textContent = err.message; }
    finally { $('loginBtn').disabled = false; }
  });

  $('logoutBtn').addEventListener('click', async () => {
    if (!window.confirm('로그아웃할까요?')) return;
    try { await A.signOut(); } catch (e) { /* 실패해도 화면은 그대로 */ }
  });

  if (!SCREENS.includes(location.hash.slice(1))) history.replaceState({}, '', '#home');
  render();
})();
