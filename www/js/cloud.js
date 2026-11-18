// 닉네임과 기록을 Firebase(Firestore)에 저장하고, 서로의 기록을 불러와요
// - 저장 위치: game2048_users/{내 uid}  (커플 사이트 데이터와 컬렉션이 달라서 섞이지 않아요)
// - 로그인하면 이 기기 기록과 클라우드 기록 중 높은 쪽으로 맞춰요 (앱을 다시 깔아도 기록이 돌아와요)
// - 로그인이 꺼져 있으면(firebase-config.js 가 비어 있으면) 아무것도 하지 않아요
(() => {
  'use strict';

  const A = window.AppAuth, G = window.Game2048;
  const COL = 'game2048_users';
  const NICK_MAX = 12;
  const BIO_MAX = 20;
  const PHOTO_MAX = 60000;   // 직접 올린 사진(작게 줄인 data URL) 글자 수 상한 — 규칙과 같아야 해요
  const PHOTO_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  const idOk = (id) => id === '' || /^[a-z0-9_-]{1,20}$/.test(String(id));
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
      { best: r.best, bestTile: r.bestTile, plays: r.plays, bestJk: !!r.bestJk, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      extra || {}
    ), { merge: true });
    if (extra) Object.assign(me, extra);
  }

  // 로그인 직후: 클라우드 기록을 받아서 이 기기 기록과 합치고, 높은 쪽을 다시 올려요
  async function reconcile() {
    const snap = await mine().get();
    me = snap.exists ? snap.data() : {};
    G.apply({ best: me.best, bestTile: me.bestTile, plays: me.plays, bestJk: me.bestJk });
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
    get photo() { return PHOTO_RE.test(me.photo || '') ? me.photo : ''; },
    get frame() { return me.frame || ''; },
    get title() { return me.title || ''; },
    get bio() { return me.bio || ''; },
    async saveFrame(id) { if (!idOk(id)) throw new Error('프레임을 고를 수 없어요.'); await push({ frame: id }); },
    get bg() { return me.bg || ''; },
    get nameFx() { return me.nameFx || ''; },
    async saveBg(id) { if (!idOk(id)) throw new Error('배경을 고를 수 없어요.'); await push({ bg: id }); },
    async saveNameFx(id) { if (!idOk(id)) throw new Error('이름 꾸미기를 고를 수 없어요.'); await push({ nameFx: id }); },
    // 응원: 하루에 한 사람에게 한 번 (이미 보냈으면 규칙이 막아서 오류가 나요)
    async sendCheer(toUid, msg, day) {
      await store().collection('game2048_cheers').doc(`${A.user.uid}_${toUid}_${day}`).set({
        from: A.user.uid, to: toUid, day, msg: String(msg).slice(0, 20), at: firebase.firestore.FieldValue.serverTimestamp()
      });
    },
    async loadCheers(day) {
      const qs = await store().collection('game2048_cheers').where('to', '==', A.user.uid).where('day', '==', day).get();
      return qs.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    },
    async saveTitle(id) { if (!idOk(id)) throw new Error('칭호를 고를 수 없어요.'); await push({ title: id }); },
    async saveBio(text) {
      const n = String(text || '').trim();
      if ([...n].length > BIO_MAX) throw new Error(`상태 메시지는 ${BIO_MAX}글자까지 쓸 수 있어요.`);
      await push({ bio: n });
    },
    async saveAvatar(id) {
      if (!/^[a-z0-9_-]{1,20}$/.test(String(id))) throw new Error('사진을 고를 수 없어요.');
      await push({ avatar: id, photo: '' });   // 상점 사진을 고르면 직접 올린 사진은 내려가요
    },
    // 직접 올린 사진 (같은 자리에 덮어써요). dataUrl 이 '' 이면 지워요
    async savePhoto(dataUrl) {
      const d = String(dataUrl || '');
      if (d && (!PHOTO_RE.test(d) || d.length > PHOTO_MAX)) throw new Error('사진이 너무 크거나 형식이 달라요.');
      await push({ photo: d });
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
