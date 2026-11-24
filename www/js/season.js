// 시즌 — 기본 모드의 최고 점수는 한 달마다 새로 시작해요 (매달 1일 오전 6시, 하루가 바뀌는 시각과 같아요)
// - 내 문서의 season 필드: { k: 지금 best 가 속한 시즌('2026-11'), pk: 지난 시즌, ps: 지난 시즌 최고 점수 }
// - 시즌이 바뀌면 best 는 0부터 다시 시작하고, 지난 시즌 기록은 pk/ps 에 남아요 (최고 타일·도감·골드는 그대로예요)
// - 시즌 필드가 없는 예전 기록은 "마지막으로 저장한 달"의 기록으로 봐요 (이번 달에 저장했다면 그대로 이어져요)
(() => {
  'use strict';

  const START_HOUR = 6;   // gold.js 의 하루 시작 시각과 같아야 해요
  const pad = (n) => String(n).padStart(2, '0');
  const shifted = (date) => new Date((date || new Date()).getTime() - START_HOUR * 3600e3);
  const key = (date) => { const x = shifted(date); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; };
  const prevKey = (k) => { const [y, m] = k.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
  const monthNo = (k) => Number(String(k).split('-')[1]) || 0;

  // 이번 시즌이 끝나는 시각 (다음 달 1일 오전 6시)
  function endsAt(date) {
    const x = shifted(date);
    return new Date(x.getFullYear(), x.getMonth() + 1, 1, START_HOUR, 0, 0);
  }
  // 남은 시간 { days, hours } — 마지막 날에는 days 가 0 이에요
  function left(date) {
    const ms = Math.max(0, endsAt(date).getTime() - (date || new Date()).getTime());
    return { days: Math.floor(ms / 86400e3), hours: Math.floor(ms % 86400e3 / 3600e3) };
  }
  function leftText(date) {
    const l = left(date);
    return l.days > 0 ? `D-${l.days}` : l.hours > 0 ? `${l.hours}시간 남음` : '곧 끝나요';
  }

  // 시즌 필드가 없는 예전 문서가 어느 달 기록인지: 마지막으로 저장한 시각의 달
  function legacyKey(u) {
    const t = u && u.updatedAt;
    const d = t && typeof t.toDate === 'function' ? t.toDate() : (t instanceof Date ? t : null);
    return d ? key(d) : '';
  }
  // 이 사람 문서의 best 가 속한 시즌
  const seasonOf = (u) => (u && u.season && u.season.k) || legacyKey(u);
  // 이번 시즌의 최고 점수 (지난 시즌 기록이면 0)
  const bestOf = (u) => (u && seasonOf(u) === key() ? (u.best || 0) : 0);
  // 지난 시즌 기록 { k, s } — 필요하면 문서의 best 가 지난 시즌 기록인지도 살펴요
  function pastOf(u) {
    let p = u && u.season && u.season.pk ? { k: u.season.pk, s: u.season.ps || 0 } : null;
    const k = seasonOf(u);
    if (u && k && k !== key() && (u.best || 0) > 0 && (!p || k > p.k || (k === p.k && u.best > p.s))) p = { k, s: u.best };
    return p && p.k ? p : null;
  }

  window.AppSeason = { key, prevKey, monthNo, endsAt, left, leftText, seasonOf, bestOf, pastOf };
})();
