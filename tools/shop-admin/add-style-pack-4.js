// 프레임·카드 배경·이름 색 4차 묶음을 shopdata.js 에 추가해요. (이미 있는 id 는 건너뛰어서 여러 번 돌려도 안전해요)
// 사용: node tools/shop-admin/add-style-pack-4.js
const path = require('path');
const lib = require('./lib');
const FILE = path.join(__dirname, '..', '..', 'www', 'js', 'shopdata.js');
const PACK = {
  frames: [
    { id: 'round', name: '동글', price: 110 }, { id: 'squish', name: '말랑', price: 120 }, { id: 'cane', name: '사탕지팡이', price: 130 },
    { id: 'circuit', name: '회로', price: 170 }, { id: 'royal', name: '로열', price: 200 }, { id: 'vine', name: '덩굴', price: 120 },
    { id: 'spark', name: '반짝', price: 190 }, { id: 'ghost', name: '유령불', price: 210 }, { id: 'scroll', name: '두루마리', price: 130 },
    { id: 'glitch', name: '글리치', price: 240 }
  ],
  bgs: [
    { id: 'polar', name: '극광의 밤', price: 170 }, { id: 'lava', name: '용암', price: 160 }, { id: 'circuit', name: '회로판', price: 140 },
    { id: 'synth', name: '레트로 석양', price: 190 }, { id: 'bubble', name: '비눗방울', price: 120 }, { id: 'dune', name: '사막 노을', price: 130 },
    { id: 'mist', name: '안개 숲', price: 110 }, { id: 'crystal', name: '수정 동굴', price: 150 }, { id: 'kraft', name: '크래프트', price: 90 },
    { id: 'tidal', name: '밀물', price: 120 }
  ],
  nameFx: [
    { id: 'lavender', name: '라벤더', price: 80 }, { id: 'peach', name: '복숭아', price: 80 }, { id: 'emerald', name: '에메랄드', price: 90 },
    { id: 'coral', name: '산호', price: 80 }, { id: 'lemon', name: '레몬', price: 80 }, { id: 'ice', name: '얼음', price: 110 },
    { id: 'violet', name: '보랏빛', price: 100 }, { id: 'twilight', name: '황혼', price: 160 }, { id: 'boreal', name: '극광빛', price: 200 },
    { id: 'gilt', name: '금박', price: 260 }, { id: 'chrome', name: '크롬', price: 190 }, { id: 'glitchfx', name: '글리치', price: 240 },
    { id: 'duo', name: '투톤', price: 140 }, { id: 'holo', name: '홀로그램', price: 250 }, { id: 'outline', name: '외곽선', price: 150 },
    { id: 'popfx', name: '입체', price: 170 }, { id: 'twinkle', name: '별빛', price: 180 }
  ]
};
// 처음 만들었던 이름 글꼴 10종은 취소했어요. 이미 추가했다면 목록에서 지워요 (산 사람이 없을 때만 의미 있어요)
const DROP = ['jua', 'blackhan', 'dohyeon', 'gugi', 'pen', 'singleday', 'dokdo', 'songmyung', 'melody', 'cutefont'];
const shop = lib.load(FILE);
let added = 0;
const before = shop.nameFx.length;
shop.nameFx = shop.nameFx.filter((x) => !DROP.includes(x.id));
if (shop.nameFx.length !== before) { added++; console.log(`취소한 글꼴 ${before - shop.nameFx.length}개를 목록에서 뺐어요.`); }
for (const k of Object.keys(PACK)) for (const it of PACK[k]) {
  if (shop[k].some((x) => x.id === it.id)) continue;
  shop[k].push(it);
  added++;
}
if (added) lib.save(FILE, shop);
console.log(added ? `${added}개를 추가했어요.` : '이미 모두 들어 있어요. 바뀐 게 없어요.');
