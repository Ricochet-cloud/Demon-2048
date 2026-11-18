// 타일 테마 (타일 그림 세트) — 목록은 js/shopdata.js 에 있고, 여기서는 그 목록으로 테마를 만들어요
// - values: 이 테마에 그림이 있는 타일 숫자 (shopdata 의 max 까지의 2의 거듭제곱, 이 범위를 넘는 타일은 big.webp)
// - full: true 면 그림이 타일 전체를 채우고 숫자는 아래쪽에 겹쳐서 나와요 (false 는 아래 띠에 숫자가 있는 그림)
// - names: 도감에 보이는 이름 (없으면 숫자만)
// - plain: true 면 그림 없이 숫자만 있는 색깔 타일 (도감에는 나오지 않아요)
// 도감은 따로 저장하지 않고 '최고 타일' 에서 계산해요 (큰 타일을 만들려면 작은 타일을 모두 거쳐야 하니까요)
(() => {
  'use strict';

  const KEY = 'game2048.theme.v1';
  const pow = (max) => { const a = []; for (let n = 2; n <= max; n *= 2) a.push(n); return a; };

  // 테마 목록은 js/shopdata.js (window.SHOP.themes) 에 있어요 — 새 테마는 거기에 한 줄 추가하고 이미지 폴더를 넣으면 돼요
  const LIST = ((window.SHOP && window.SHOP.themes) || []).map((t) => Object.assign({}, t, { values: t.plain ? [] : pow(t.max) }));
  if (!LIST.length) LIST.push({ id: 'default', name: '12귀월', desc: '', dir: './images/', full: false, values: pow(16384), names: {}, bigName: '', cat: '기본' });

  const byId = (id) => LIST.find((t) => t.id === id) || LIST[0];
  let currentId = 'default';
  try { currentId = byId(localStorage.getItem(KEY)).id; } catch (e) { /* 저장소를 못 써도 기본 테마로 동작 */ }

  function apply() { document.documentElement.dataset.theme = currentId; }
  apply();

  window.AppThemes = {
    list: LIST,
    byId,
    get() { return byId(currentId); },
    set(id) {
      currentId = byId(id).id;
      try { localStorage.setItem(KEY, currentId); } catch (e) { /* 무시 */ }
      apply();
      window.dispatchEvent(new CustomEvent('themechange', { detail: currentId }));
    },
    // 타일 숫자 → 그림 주소 (그림이 없으면 null → 색깔 타일)
    imgOf(v, theme) {
      const t = theme || byId(currentId);
      if (t.values.includes(v)) return t.dir + v + '.webp';
      if (v > t.values[t.values.length - 1]) return t.dir + 'big.webp';
      return null;
    },
    // 도감에 보여 줄 테마 (그림 없는 테마를 쓰고 있으면 그림이 있는 첫 테마)
    dexTheme() { const t = byId(currentId); return t.plain ? LIST.find((x) => !x.plain) : t; },
    // 지금까지 만든 타일들 (최고 타일 이하의 2의 거듭제곱은 전부 만든 것)
    discovered(bestTile, theme) {
      const t = theme || byId(currentId);
      return t.values.filter((v) => v <= (bestTile || 0));
    }
  };
})();
