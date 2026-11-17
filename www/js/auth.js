// 이메일 로그인 (Firebase Auth) — firebase-config.js 가 비어 있으면 꺼져 있고, 앱은 로그인 없이 동작해요
(() => {
  'use strict';

  const cfg = window.FIREBASE_CONFIG || {};
  let enabled = !!(cfg.apiKey && cfg.projectId && window.firebase);
  let auth = null, user = null, ready = !enabled;
  const listeners = [];
  const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

  if (enabled) {
    try {
      firebase.initializeApp(cfg);
      auth = firebase.auth();
      auth.onAuthStateChanged((u) => { user = u; ready = true; emit(); },
                              () => { user = null; ready = true; emit(); });
    } catch (e) {
      console.error('Firebase 시작 실패', e);
      enabled = false; ready = true;
    }
  }

  const MESSAGES = {
    'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
    'auth/user-disabled': '사용할 수 없는 계정이에요.',
    'auth/user-not-found': '이메일이나 비밀번호가 맞지 않아요.',
    'auth/wrong-password': '이메일이나 비밀번호가 맞지 않아요.',
    'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 뒤에 다시 해보세요.',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요.'
  };

  window.AppAuth = {
    get enabled() { return enabled; },
    get ready() { return ready; },
    get user() { return user; },
    onChange(fn) { listeners.push(fn); },
    async signIn(email, password) {
      try { await auth.signInWithEmailAndPassword(String(email).trim(), password); }
      catch (e) { throw new Error(MESSAGES[e && e.code] || '로그인하지 못했어요. 잠시 뒤에 다시 해보세요.'); }
    },
    signOut() { return auth.signOut(); }
  };
})();
