// 닉네임과 기록을 Firebase(Firestore)에 저장하고, 서로의 기록을 불러와요
// - 저장 위치: game2048_users/{내 uid}  (커플 사이트 데이터와 컬렉션이 달라서 섞이지 않아요)
// - 로그인하면 이 기기 기록과 클라우드 기록 중 높은 쪽으로 맞춰요 (앱을 다시 깔아도 기록이 돌아와요)
// - 로그인이 꺼져 있으면(firebase-config.js 가 비어 있으면) 아무것도 하지 않아요
(() => {
  'use strict';

  const A = window.AppAuth, G = window.Game2048;
  const COL = 'game2048_users';
  const NICK_MAX = 12;
  let db = null, me = {}, loaded = false, failed = false, timer = null;
  const readyListeners = [];

  const on = () => !!(A.enabled && A.user && window.firebase && firebase.firestore);
  function store() {
    if (!db) {
      db = firebase.firestore();
      try { db.settings({ experimentalAutoDetectLongPolling: true }); } catch (e) { /* 이미 설정됨 */ }
    }
    return db;
  }
  const mine = () => store().collection(COL).doc(A.user.uid);

  async function push(extra) {
    const r = G.records();
    await mine().set(Object.assign(
      { best: r.best, bestTile: r.bestTile, plays: r.plays, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      extra || {}
    ), { merge: true });
    if (extra) Object.assign(me, extra);
  }

  // 로그인 직후: 클라우드 기록을 받아서 이 기기 기록과 합치고, 높은 쪽을 다시 올려요
  async function reconcile() {
    const snap = await mine().get();
    me = snap.exists ? snap.data() : {};
    G.apply({ best: me.best, bestTile: me.bestTile, plays: me.plays });
    await push();
    loaded = true;
    readyListeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    window.dispatchEvent(new Event('cloud:ready'));
  }

  function start() {
    loaded = false; me = {};
    failed = false;
    if (on()) reconcile().catch((e) => { console.warn('기록 동기화 실패', e); failed = true; window.dispatchEvent(new Event('cloud:failed')); });
  }

  // 점수가 오를 때마다 올려요 (너무 자주 올리지 않게 잠깐 모아서)
  window.addEventListener('game2048:record', () => {
    if (!on()) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      (loaded ? push() : reconcile()).catch((e) => console.warn('기록 저장 실패', e));
    }, 1500);
  });

  A.onChange(start);
  if (A.ready && A.user) start();

  window.AppCloud = {
    get enabled() { return on(); },
    get loaded() { return loaded; },
    get failed() { return failed; },
    get uid() { return A.user ? A.user.uid : null; },
    get nickname() { return me.nickname || ''; },
    get avatar() { return me.avatar || ''; },
    async saveAvatar(id) {
      if (!/^[a-z0-9_-]{1,20}$/.test(String(id))) throw new Error('사진을 고를 수 없어요.');
      await push({ avatar: id });
    },
    // 내 문서를 읽고 고치는 트랜잭션 (골드 받기·구매처럼 한 번만 반영돼야 할 때 써요)
    async tx(fn) { return store().runTransaction((t) => fn(t, mine())); },
    async loadAll() {
      const qs = await store().collection(COL).get();
      return qs.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
    },
    async saveNickname(name) {
      const n = String(name || '').trim();
      if (!n) throw new Error('닉네임을 입력해 주세요.');
      if ([...n].length > NICK_MAX) throw new Error(`닉네임은 ${NICK_MAX}글자까지 쓸 수 있어요.`);
      await push({ nickname: n });
    }
  };
})();
