// 프레임·카드 배경·이름 효과 6차 묶음(각 6개)을 shopdata.js 에 추가해요. (이미 있는 id 는 건너뛰어서 여러 번 돌려도 안전해요)
// 사용: node tools/shop-admin/add-style-pack-6.js
const path = require('path');
const lib = require('./lib');
const FILE = path.join(__dirname, '..', '..', 'www', 'js', 'shopdata.js');
const PACK = {
  frames: [
    { id: 'gem', name: '보석', price: 190 }, { id: 'lace', name: '레이스', price: 110 }, { id: 'chain', name: '사슬', price: 130 },
    { id: 'wood', name: '나무 액자', price: 100 }, { id: 'tape', name: '주의 테이프', price: 120 }, { id: 'pearl', name: '진주', price: 170 }
  ],
  bgs: [
    { id: 'latte', name: '라떼', price: 100 }, { id: 'notebook', name: '모눈 노트', price: 90 }, { id: 'cotton', name: '솜사탕 구름', price: 120 },
    { id: 'comic', name: '만화 점무늬', price: 140 }, { id: 'picnic', name: '피크닉', price: 110 }, { id: 'tatami', name: '다다미', price: 100 }
  ],
  nameFx: [
    { id: 'cherry', name: '체리', price: 100 }, { id: 'jelly', name: '젤리', price: 180 }, { id: 'cream', name: '크림', price: 120 },
    { id: 'sapphire', name: '사파이어', price: 200 }, { id: 'spotlight', name: '스포트라이트', price: 220 }, { id: 'matcha', name: '말차', price: 90 }
  ]
};
const shop = lib.load(FILE);
let added = 0;
for (const k of Object.keys(PACK)) for (const it of PACK[k]) {
  if (shop[k].some((x) => x.id === it.id)) continue;
  shop[k].push(it);
  added++;
}
if (added) lib.save(FILE, shop);
console.log(added ? `${added}개를 추가했어요.` : '이미 모두 들어 있어요. 바뀐 게 없어요.');
