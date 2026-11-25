// 프로필 투표 — 매일 "가장 잘 꾸민 프로필"에 한 표. 다음 날 아침 6시에 결과가 나오고, 1등은 골드 30 + '베스트 프로필' 칭호
// - 내 한 표는 내 사용자 문서의 owned 목록에 'pv:날짜:대상uid' 로 남아요 (규칙 변경 없음, 하루에 한 표, 마감 전에는 바꿀 수 있어요)
// - 득표는 이미 읽어 둔 모든 사용자 문서에서 앱이 세요 (읽기가 늘지 않아요). 내 표는 내 문서에만 있어서 자기 자신에게는 줄 수 없어요 (자기 표는 세지 않아요)
// - 1등 보상을 받은 표시는 'pw:날짜' 로 남아요. 보상은 결과가 난 날부터 며칠 안에 받아야 해요
(() => {
  'use strict';

  const GOLD = 30;          // 1등 보상
  const MIN_VOTES = 2;      // 그날 표가 이 수 이상일 때만 1등이 나와요 (혼자 투표해서 보상 받는 걸 막아요)
  const KEEP_DAYS = 4;      // 투표 표시를 지키는 날 수 (오늘 + 지난 3일). 더 오래된 건 내가 투표할 때 정리돼요
  const CLAIM_BACK = 3;     // 며칠 전 결과까지 보상을 받을 수 있는지
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  const shift = (key, n) => {
    const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n);
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const mark = (day, uid) => `pv:${day}:${uid}`;
  const keepDays = (today) => Array.from({ length: KEEP_DAYS }, (_, i) => shift(today, -i));

  // 그날 득표: { by: { uid: 표 }, total }  (한 사람이 한 표만, 자기 자신·없는 사람에게 준 표는 안 세요)
  function tally(users, day) {
    const pre = `pv:${day}:`, ids = new Set(users.map((u) => u.uid)), by = {}; let total = 0;
    users.forEach((v) => {
      const m = (v.owned || []).find((x) => typeof x === 'string' && x.startsWith(pre));
      if (!m) return;
      const t = m.slice(pre.length);
      if (!t || t === v.uid || !ids.has(t)) return;
      by[t] = (by[t] || 0) + 1; total++;
    });
    return { by, total };
  }
  // 그날 1등 (동점이면 모두): { uids, count, total }
  function winners(users, day) {
    const { by, total } = tally(users, day);
    if (total < MIN_VOTES) return { uids: [], count: 0, total };
    const max = Math.max(0, ...Object.values(by));
    return { uids: Object.keys(by).filter((u) => by[u] === max), count: max, total };
  }
  // 내가 그날 고른 사람 (owned 목록에서)
  function mine(owned, day) {
    const pre = `pv:${day}:`, m = (owned || []).find((x) => typeof x === 'string' && x.startsWith(pre));
    return m ? m.slice(pre.length) : '';
  }
  // 아직 안 받은 1등 보상이 있는 가장 최근 날짜 (없으면 '')
  function claimable(users, myUid, owned, today) {
    for (let n = 1; n <= CLAIM_BACK; n++) {
      const d = shift(today, -n);
      if ((owned || []).includes('pw:' + d)) continue;
      if (winners(users, d).uids.includes(myUid)) return d;
    }
    return '';
  }

  window.AppPVote = { GOLD, MIN_VOTES, CLAIM_BACK, DAY_RE, shift, mark, keepDays, tally, winners, mine, claimable };
})();
