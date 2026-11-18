// 상점 물건 목록 (프로필 사진 · 프레임 · 칭호 · 카드 배경 · 이름 꾸미기 · 타일 테마)
// 상점 관리 프로그램(tools/shop-admin)이 이 파일을 고쳐요. 손으로 고쳐도 돼요.
// - price 가 없으면 무료예요 (테마도 price 가 있으면 골드로 사야 바꿀 수 있어요) (칭호는 price 도 cond 도 없으면 미션 보상 같은 특별 칭호)
// - off: true 는 '판매 중지'예요. 상점에서는 사라지지만, 이미 가진 사람은 계속 쓸 수 있어요.
// - ver: 그림을 바꿀 때마다 올라가는 번호예요 (옛 그림이 앱에 남지 않게 주소 뒤에 붙어요).
// - titles 의 cond 는 업적 조건 이름이에요 (win2048 / dexHalf / dexFull) — app.js 의 CONDS 에서 정해요.
// - frames / bgs / nameFx 의 모양(CSS)은 css/app.css 의 .fr-<id> / .bg-<id> / .nm-<id> 에 있어요.
// - themes: max 는 이 테마에 그림이 있는 가장 큰 타일 숫자, cat 은 상점 분류(귀멸/일본/기본), dir 은 이미지 폴더예요.
window.SHOP = {
  avatars: [
    { id: 'tanjiro', name: '탄지로' },
    { id: 'nezuko', name: '네즈코' },
    { id: 'zenitsu', name: '젠이츠' },
    { id: 'inosuke', name: '이노스케' },
    { id: 'mitsuri', name: '미츠리' },
    { id: 'rengoku', name: '렌고쿠' },
    { id: 'murata', name: '무라타', price: 50 },
    { id: 'rui', name: '루이', price: 100 },
    { id: 'enmu', name: '엔무', price: 100 },
    { id: 'daki', name: '다키', price: 120 },
    { id: 'gyutaro', name: '규타로', price: 120 },
    { id: 'tamayo', name: '타마요', price: 150 },
    { id: 'akaza', name: '아카자', price: 150 },
    { id: 'douma', name: '도우마', price: 150 },
    { id: 'kokushibo', name: '코쿠시보', price: 200 },
    { id: 'muzan', name: '키부츠지 무잔', price: 300 },
    { id: 'shinobu', name: '시노부', price: 150 },
    { id: 'muichiro', name: '무이치로', price: 150 },
    { id: 'sanemi', name: '사네미', price: 200 },
    { id: 'obanai', name: '오바나이', price: 200 },
    { id: 'giyu', name: '기유', price: 200 },
    { id: 'tengen', name: '텐겐', price: 250 },
    { id: 'gyomei', name: '교메이', price: 300 },
    { id: 'tanjiro-nezuko', name: '탄지로·네즈코', price: 150 },
    { id: 'yushiro-tamayo', name: '유시로·타마요', price: 200 },
    { id: 'hakuji-koyuki', name: '하쿠지·코유키', price: 200 },
    { id: 'tengen-wives', name: '텐겐의 아내들', price: 250 },
    { id: 'me', name: '나', price: 10 },
    { id: 'gf', name: '김혜원', price: 10 },
    { id: 'sis', name: '예똥', price: 10 }
  ],
  frames: [
    { id: 'silver', name: '은색' },
    { id: 'gold', name: '금색', price: 80 },
    { id: 'sakura', name: '벚꽃', price: 120 },
    { id: 'wave', name: '물결', price: 120 },
    { id: 'flame', name: '불꽃', price: 200 },
    { id: 'ice', name: '서리', price: 120 },
    { id: 'wisteria', name: '등꽃', price: 130 },
    { id: 'rainbow', name: '무지개', price: 150 },
    { id: 'moon', name: '달빛', price: 160 },
    { id: 'thunder', name: '번개', price: 180 },
    { id: 'blood', name: '혈귀', price: 220 },
    { id: 'sun', name: '일륜', price: 350 },
    { id: 'bamboo', name: '대나무', price: 120 },
    { id: 'ink', name: '먹', price: 100 },
    { id: 'neon', name: '네온', price: 170 },
    { id: 'starlight', name: '별빛', price: 180 },
    { id: 'aurora', name: '오로라', price: 220 },
    { id: 'stitch', name: '바느질', price: 100 },
    { id: 'candy', name: '캔디', price: 150 },
    { id: 'steel', name: '강철', price: 140 },
    { id: 'heart', name: '하트', price: 160 },
    { id: 'sunset', name: '석양', price: 180 }
  ],
  titles: [
    { id: 'beginner', name: '귀살대 신입', price: 50, group: '일반' },
    { id: 'hashira', name: '주 보좌', price: 100, group: '일반' },
    { id: 'flame', name: '불꽃의 후예', price: 150, group: '일반' },
    { id: 'p-mushi', name: '蟲柱 충주', price: 200, group: '주(柱)' },
    { id: 'p-kasumi', name: '霞柱 하주', price: 250, group: '주(柱)' },
    { id: 'p-sound', name: '音柱 음주', price: 250, group: '주(柱)' },
    { id: 'p-stone', name: '岩柱 암주', price: 300, group: '주(柱)' },
    { id: 'p-flame', name: '炎柱 염주', price: 300, group: '주(柱)' },
    { id: 'p-water', name: '水柱 수주', price: 300, group: '주(柱)' },
    { id: 'p-wind', name: '風柱 풍주', price: 350, group: '주(柱)' },
    { id: 'p-love', name: '戀柱 연주', price: 350, group: '주(柱)' },
    { id: 'p-snake', name: '蛇柱 사주', price: 350, group: '주(柱)' },
    { id: 'u6', name: '上弦 陸 상현6', price: 500, group: '상현(上弦)' },
    { id: 'u5', name: '上弦 伍 상현5', price: 600, group: '상현(上弦)' },
    { id: 'u4', name: '上弦 肆 상현4', price: 700, group: '상현(上弦)' },
    { id: 'u3', name: '上弦 參 상현3', price: 800, group: '상현(上弦)' },
    { id: 'u2', name: '上弦 貳 상현2', price: 1000, group: '상현(上弦)' },
    { id: 'u1', name: '上弦 壹 상현1', price: 1500, group: '상현(上弦)' },
    { id: 'win2048', name: '2048 달성자', cond: 'win2048', how: '2048 타일 만들기' },
    { id: 'collector', name: '수집가', cond: 'dexHalf', how: '도감 절반 채우기' },
    { id: 'master', name: '도감 마스터', cond: 'dexFull', how: '도감 전부 채우기' },
    { id: 'diligent', name: '성실한 대원', how: '하루 미션 전부 받기' }
  ],
  bgs: [
    { id: 'check', name: '이치마쓰', price: 80 },
    { id: 'asanoha', name: '삼베잎', price: 80 },
    { id: 'sakura', name: '벚꽃', price: 100 },
    { id: 'butterfly', name: '나비 저택', price: 100 },
    { id: 'water', name: '물의 호흡', price: 120 },
    { id: 'flame', name: '불의 호흡', price: 150 },
    { id: 'thunder', name: '천둥의 호흡', price: 150 },
    { id: 'infinity', name: '무한성', price: 200 },
    { id: 'moon', name: '상현의 밤', price: 200 },
    { id: 'blood', name: '혈귀', price: 250 },
    { id: 'sun', name: '일륜도', price: 300 },
    { id: 'dusk', name: '노을', price: 120 },
    { id: 'seigaiha', name: '청해파', price: 130 },
    { id: 'snow', name: '눈 내리는 밤', price: 100 },
    { id: 'lantern', name: '등불 거리', price: 150 },
    { id: 'grove', name: '대숲', price: 100 },
    { id: 'deep', name: '심해', price: 110 },
    { id: 'galaxy', name: '은하', price: 160 },
    { id: 'neon', name: '네온 시티', price: 150 },
    { id: 'autumn', name: '단풍', price: 120 },
    { id: 'berry', name: '딸기밭', price: 110 }
  ],
  nameFx: [
    { id: 'gold', name: '금빛', price: 80 },
    { id: 'sakura', name: '벚꽃빛', price: 80 },
    { id: 'water', name: '물빛', price: 80 },
    { id: 'wisteria', name: '등꽃빛', price: 80 },
    { id: 'red', name: '핏빛', price: 100 },
    { id: 'flame', name: '불꽃', price: 200 },
    { id: 'thunder', name: '번개', price: 200 },
    { id: 'rainbow', name: '무지개', price: 250 },
    { id: 'moon', name: '달빛', price: 250 },
    { id: 'sun', name: '일륜', price: 300 },
    { id: 'mint', name: '민트빛', price: 80 },
    { id: 'orange', name: '귤빛', price: 80 },
    { id: 'silver', name: '은빛', price: 150 },
    { id: 'dusk', name: '노을빛', price: 220 },
    { id: 'neon', name: '네온', price: 200 }
  ],
  themes: [
    { id: 'default', name: '12귀월', desc: '십이귀월과 싸워 올라가요', cat: '기본', dir: './images/', full: false, max: 16384, bigName: '', ver: 1,
      names: {
        2: '엔무', 4: '루이', 8: '나키메', 16: '카이가쿠', 32: '아카자', 64: '한텐구', 128: '교코',
        256: '다키규타로', 512: '도우마', 1024: '코쿠시보', 2048: '무잔'
      } },
    { id: 'corps', name: '귀살대', desc: '함께 싸우는 대원들이에요', cat: '귀멸', dir: './images/themes/corps/', full: true, max: 8192, bigName: '귀살대',
      names: {
        2: '아가츠마 젠이츠', 4: '하시비라 이노스케', 8: '카마도 네즈코', 16: '칸로지 미츠리', 32: '코쵸 시노부', 64: '토키토 무이치로', 128: '이구로 오바나이',
        256: '시나즈가와 사네미', 512: '우즈이 텐겐', 1024: '렌고쿠 쿄주로', 2048: '카마도 탄지로', 4096: '토미오카 기유', 8192: '히메지마 교메이'
      } },
    { id: 'school', name: '귀멸학원', desc: '교복을 입은 학원 버전이에요', cat: '귀멸', dir: './images/themes/school/', full: true, max: 8192, bigName: '귀멸학원 단체',
      names: {
        2: '아가츠마 젠이츠', 4: '하시비라 이노스케', 8: '카마도 네즈코', 16: '시나즈가와 겐야', 32: '토키토 무이치로', 64: '칸로지 미츠리', 128: '코쵸 시노부',
        256: '이구로 오바나이', 512: '시나즈가와 사네미', 1024: '우즈이 텐겐', 2048: '카마도 탄지로', 4096: '렌고쿠 쿄주로', 8192: '토미오카 기유'
      } },
    { id: 'items', name: '귀멸 도구', desc: '귀멸의 칼날에 나오는 도구와 동물이에요', cat: '귀멸', dir: './images/themes/items/', full: true, max: 8192, bigName: '도구 모음',
      names: {
        2: '숯', 4: '대나무 입마개', 8: '하나후다 귀걸이', 16: '참새 츄타로', 32: '카스가가라스', 64: '멧돼지 가면', 128: '여우 가면',
        256: '등꽃', 512: '무한열차', 1024: '비파', 2048: '일륜도', 4096: '쓰즈미 북', 8192: '태양'
      } },
    { id: 'hwatu', name: '화투', desc: '1월부터 12월까지, 화투 그림이에요', cat: '일본', dir: './images/themes/hwatu/', full: true, max: 8192, bigName: '화투판',
      names: {
        2: '1월 송학', 4: '2월 매조', 8: '3월 벚꽃', 16: '4월 흑싸리', 32: '5월 난초', 64: '6월 모란', 128: '7월 홍싸리',
        256: '8월 공산', 512: '9월 국화', 1024: '10월 단풍', 2048: '11월 오동', 4096: '12월 비', 8192: '광'
      } },
    { id: 'yokai', name: '요괴', desc: '일본 전설 속 요괴들이 숫자가 커질수록 강해져요', cat: '일본', dir: './images/themes/yokai/', full: true, max: 8192, bigName: '백귀야행',
      names: {
        2: '카라카사 오바케', 4: '츠쿠모가미 등롱', 8: '카파', 16: '타누키', 32: '로쿠로쿠비', 64: '유키온나', 128: '텐구',
        256: '구미호', 512: '츠치구모', 1024: '오니', 2048: '야마타노오로치', 4096: '가샤도쿠로', 8192: '용신'
      } },
    { id: 'food', name: '일본 음식', desc: '주먹밥에서 가이세키 정식까지, 점점 호화로워져요', cat: '일본', dir: './images/themes/food/', full: true, max: 8192, bigName: '일본 음식 한 상',
      names: {
        2: '오니기리', 4: '타코야키', 8: '미소시루', 16: '타마고야키', 32: '라멘', 64: '카레라이스', 128: '돈카츠',
        256: '우나기 덮밥', 512: '덴푸라 모둠', 1024: '스시 모둠', 2048: '사시미 모둠', 4096: '스키야키', 8192: '가이세키 정식'
      } },
    { id: 'wagashi', name: '일본 전통 과자', desc: '단고에서 다과 정식까지, 달콤한 와가시예요', cat: '일본', dir: './images/themes/wagashi/', full: true, max: 8192, bigName: '와가시 가게',
      names: {
        2: '미타라시 단고', 4: '타이야키', 8: '도라야키', 16: '센베이', 32: '딸기 다이후쿠', 64: '사쿠라 모찌', 128: '양갱',
        256: '호지차와 와가시', 512: '네리키리', 1024: '하나미 단고', 2048: '와가시 모듬', 4096: '금박 와가시', 8192: '다과 정식'
      } },
    { id: 'japan', name: '일본 명물 여행', desc: '홋카이도에서 후지산까지, 일본 곳곳의 명물이에요', cat: '일본', dir: './images/themes/japan/', full: true, max: 8192, bigName: '일본 지도',
      names: {
        2: '홋카이도 털게', 4: '아오모리 사과', 8: '센다이 칠석', 16: '도쿄 타워', 32: '닛코 도쇼구', 64: '가나자와 겐로쿠엔', 128: '후시미 이나리',
        256: '나라 사슴', 512: '오사카 성', 1024: '이쓰쿠시마 신사', 2048: '오키나와 슈리성', 4096: '하코네 온천', 8192: '후지산'
      } },
    { id: 'ninja', name: '닌자', desc: '쿠나이에서 인술까지, 색이 또렷한 닌자 세계예요', cat: '일본', dir: './images/themes/ninja/', full: true, max: 8192, bigName: '닌자 마을',
      names: {
        2: '쿠나이', 4: '수리검', 8: '닌자 두루마리', 16: '폭죽 부적', 32: '닌자 라멘', 64: '이마 보호대', 128: '복면 닌자',
        256: '차크라 구슬', 512: '화둔 인술', 1024: '수둔 인술', 2048: '뇌둔 인술', 4096: '닌자 성', 8192: '지붕 위의 대장'
      } },
    { id: 'irezumi', name: '이레즈미', desc: '일본 전통 문신 도안, 색마다 그림이 달라요', cat: '일본', dir: './images/themes/irezumi/', full: true, max: 8192, bigName: '등판 도안',
      names: {
        2: '벚꽃', 4: '파도', 8: '단풍', 16: '잉어', 32: '모란', 64: '뱀', 128: '하니야 가면',
        256: '호랑이', 512: '봉황', 1024: '오니', 2048: '용', 4096: '등용문', 8192: '용호상박'
      } },
    { id: 'animals', name: '일본의 귀여운 동물', desc: '귀여운 일본의 동물들이에요', cat: '일본', dir: './images/themes/animals/', full: true, max: 8192, bigName: '귀여운 일본 동물들', ver: 1,
      names: {
        2: '병아리', 4: '금붕어', 8: '개구리', 16: '다람쥐', 32: '시바이누', 64: '마네키네코', 128: '토끼',
        256: '너구리', 512: '나라 사슴', 1024: '눈 원숭이', 2048: '두루미', 4096: '여우', 8192: '호랑이 또는 용'
      } },
    { id: 'hanja', name: '한자', desc: '귀여운 한자 타일이에요.', cat: '일본', dir: './images/themes/hanja/', full: true, max: 8192, bigName: '무', ver: 1,
      names: {
        2: '물', 4: '불', 8: '나무', 16: '흙', 32: '금', 64: '바람', 128: '번개',
        256: '구름', 512: '달', 1024: '마음', 2048: '용', 4096: '하늘', 8192: '복'
      } },
    { id: 'plain', name: '기본 숫자', desc: '그림 없이 숫자만 보이는 깔끔한 타일이에요', cat: '기본', dir: '', full: false, plain: true, bigName: '', names: {} }
  ]
};
