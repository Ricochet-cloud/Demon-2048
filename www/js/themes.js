// 타일 테마 (타일 그림 세트) — 새 테마는 아래 LIST 에 한 덩어리만 추가하고 이미지 폴더를 넣으면 돼요
// - values: 이 테마에 그림이 있는 타일 숫자 (이 범위를 넘는 타일은 big.webp)
// - full: true 면 그림이 타일 전체를 채우고 숫자는 아래쪽에 겹쳐서 나와요 (false 는 아래 띠에 숫자가 있는 그림)
// - names: 도감에 보이는 이름 (없으면 숫자만)
// - plain: true 면 그림 없이 숫자만 있는 색깔 타일 (도감에는 나오지 않아요)
// 도감은 따로 저장하지 않고 '최고 타일' 에서 계산해요 (큰 타일을 만들려면 작은 타일을 모두 거쳐야 하니까요)
(() => {
  'use strict';

  const KEY = 'game2048.theme.v1';
  const pow = (max) => { const a = []; for (let n = 2; n <= max; n *= 2) a.push(n); return a; };

  const LIST = [
    { id: 'default', name: '12귀월', desc: '십이귀월과 싸워 올라가요', dir: './images/', full: false, values: pow(16384), names: {}, bigName: '' },
    {
      id: 'corps', name: '귀살대', desc: '함께 싸우는 대원들이에요', dir: './images/themes/corps/', full: true, values: pow(8192),
      names: {
        2: '아가츠마 젠이츠', 4: '하시비라 이노스케', 8: '카마도 네즈코', 16: '칸로지 미츠리', 32: '코쵸 시노부', 64: '토키토 무이치로',
        128: '이구로 오바나이', 256: '시나즈가와 사네미', 512: '우즈이 텐겐', 1024: '렌고쿠 쿄주로', 2048: '카마도 탄지로',
        4096: '토미오카 기유', 8192: '히메지마 교메이'
      },
      bigName: '귀살대'
    }
  ];

  LIST.push({ id: 'plain', name: '기본 숫자', desc: '그림 없이 숫자만 보이는 깔끔한 타일이에요', dir: '', full: false, values: [], names: {}, bigName: '', plain: true });

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
