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
    },
    {
      id: 'school', name: '귀멸학원', desc: '교복을 입은 학원 버전이에요', dir: './images/themes/school/', full: true, values: pow(8192),
      names: {
        2: '아가츠마 젠이츠', 4: '하시비라 이노스케', 8: '카마도 네즈코', 16: '시나즈가와 겐야', 32: '토키토 무이치로', 64: '칸로지 미츠리',
        128: '코쵸 시노부', 256: '이구로 오바나이', 512: '시나즈가와 사네미', 1024: '우즈이 텐겐', 2048: '카마도 탄지로',
        4096: '렌고쿠 쿄주로', 8192: '토미오카 기유'
      },
      bigName: '귀멸학원 단체'
    }
  ];

  LIST.push({
    id: 'items', name: '귀멸 도구', desc: '귀멸의 칼날에 나오는 도구와 동물이에요', dir: './images/themes/items/', full: true, values: pow(8192),
    names: {
      2: '숯', 4: '대나무 입마개', 8: '하나후다 귀걸이', 16: '참새 츄타로', 32: '카스가가라스', 64: '멧돼지 가면', 128: '여우 가면',
      256: '등꽃', 512: '무한열차', 1024: '비파', 2048: '일륜도', 4096: '쓰즈미 북', 8192: '태양'
    },
    bigName: '도구 모음'
  });
  LIST.push({
    id: 'hwatu', name: '화투', desc: '1월부터 12월까지, 화투 그림이에요', dir: './images/themes/hwatu/', full: true, values: pow(8192),
    names: {
      2: '1월 송학', 4: '2월 매조', 8: '3월 벚꽃', 16: '4월 흑싸리', 32: '5월 난초', 64: '6월 모란', 128: '7월 홍싸리',
      256: '8월 공산', 512: '9월 국화', 1024: '10월 단풍', 2048: '11월 오동', 4096: '12월 비', 8192: '광'
    },
    bigName: '화투판'
  });

  LIST.push({
    id: 'yokai', name: '요괴', desc: '일본 전설 속 요괴들이 숫자가 커질수록 강해져요', dir: './images/themes/yokai/', full: true, values: pow(8192),
    names: {
      2: '카라카사 오바케', 4: '츠쿠모가미 등롱', 8: '카파', 16: '타누키', 32: '로쿠로쿠비', 64: '유키온나', 128: '텐구',
      256: '구미호', 512: '츠치구모', 1024: '오니', 2048: '야마타노오로치', 4096: '가샤도쿠로', 8192: '용신'
    },
    bigName: '백귀야행'
  });
  LIST.push({
    id: 'food', name: '일본 음식', desc: '주먹밥에서 가이세키 정식까지, 점점 호화로워져요', dir: './images/themes/food/', full: true, values: pow(8192),
    names: {
      2: '오니기리', 4: '타코야키', 8: '미소시루', 16: '타마고야키', 32: '라멘', 64: '카레라이스', 128: '돈카츠',
      256: '우나기 덮밥', 512: '덴푸라 모둠', 1024: '스시 모둠', 2048: '사시미 모둠', 4096: '스키야키', 8192: '가이세키 정식'
    },
    bigName: '일본 음식 한 상'
  });

  LIST.push({
    id: 'wagashi', name: '일본 전통 과자', desc: '단고에서 다과 정식까지, 달콤한 와가시예요', dir: './images/themes/wagashi/', full: true, values: pow(8192),
    names: {
      2: '미타라시 단고', 4: '타이야키', 8: '도라야키', 16: '센베이', 32: '딸기 다이후쿠', 64: '사쿠라 모찌', 128: '양갱',
      256: '호지차와 와가시', 512: '네리키리', 1024: '하나미 단고', 2048: '와가시 모듬', 4096: '금박 와가시', 8192: '다과 정식'
    },
    bigName: '와가시 가게'
  });
  LIST.push({
    id: 'japan', name: '일본 명물 여행', desc: '홋카이도에서 후지산까지, 일본 곳곳의 명물이에요', dir: './images/themes/japan/', full: true, values: pow(8192),
    names: {
      2: '홋카이도 털게', 4: '아오모리 사과', 8: '센다이 칠석', 16: '도쿄 타워', 32: '닛코 도쇼구', 64: '가나자와 겐로쿠엔', 128: '후시미 이나리',
      256: '나라 사슴', 512: '오사카 성', 1024: '이쓰쿠시마 신사', 2048: '오키나와 슈리성', 4096: '하코네 온천', 8192: '후지산'
    },
    bigName: '일본 지도'
  });

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
