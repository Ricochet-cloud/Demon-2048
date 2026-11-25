// 프레임·카드 배경·이름 효과 5차 묶음을 shopdata.js 에 추가해요. (이미 있는 id 는 건너뛰어서 여러 번 돌려도 안전해요)
// 사용: node tools/shop-admin/add-style-pack-5.js
const path = require('path');
const lib = require('./lib');
const FILE = path.join(__dirname, '..', '..', 'www', 'js', 'shopdata.js');
const PACK = {
  frames: [
    { id: 'film', name: '필름', price: 120 }, { id: 'stamp', name: '우표', price: 130 }, { id: 'rope', name: '밧줄', price: 110 },
    { id: 'bulb', name: '전구', price: 190 }, { id: 'double', name: '액자', price: 150 }, { id: 'target', name: '과녁', price: 120 }
  ],
  bgs: [
    { id: 'blueprint', name: '청사진', price: 130 }, { id: 'chalk', name: '칠판', price: 110 }, { id: 'diner', name: '다이너 체크', price: 120 },
    { id: 'carbon', name: '카본', price: 140 }, { id: 'denim', name: '데님', price: 100 }, { id: 'crt', name: '구형 모니터', price: 160 },
    { id: 'vinyl', name: '레코드판', price: 170 }, { id: 'marble', name: '대리석', price: 180 }
  ],
  nameFx: [
    { id: 'retro3d', name: '레트로 입체', price: 170 }, { id: 'candycane', name: '사탕 줄무늬', price: 200 }, { id: 'magma', name: '용암', price: 190 },
    { id: 'fog', name: '안개', price: 150 }, { id: 'emboss', name: '양각', price: 120 }, { id: 'horizon', name: '수평선', price: 140 },
    { id: 'marker', name: '형광펜', price: 130 }, { id: 'squiggle', name: '물결 밑줄', price: 100 }
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
