// 프레임·카드 배경·이름 꾸미기 2차 묶음을 shopdata.js 에 추가해요. (이미 있는 id 는 건너뛰어서 여러 번 돌려도 안전해요)
// 사용: node tools/shop-admin/add-style-pack-2.js
const path = require('path');
const lib = require('./lib');
const FILE = path.join(__dirname, '..', '..', 'www', 'js', 'shopdata.js');
const PACK = {
  frames: [
    { id: 'stitch', name: '바느질', price: 100 }, { id: 'candy', name: '캔디', price: 150 }, { id: 'steel', name: '강철', price: 140 },
    { id: 'heart', name: '하트', price: 160 }, { id: 'sunset', name: '석양', price: 180 }
  ],
  bgs: [
    { id: 'deep', name: '심해', price: 110 }, { id: 'galaxy', name: '은하', price: 160 }, { id: 'neon', name: '네온 시티', price: 150 },
    { id: 'autumn', name: '단풍', price: 120 }, { id: 'berry', name: '딸기밭', price: 110 }
  ],
  nameFx: [
    { id: 'mint', name: '민트빛', price: 80 }, { id: 'orange', name: '귤빛', price: 80 }, { id: 'silver', name: '은빛', price: 150 },
    { id: 'dusk', name: '노을빛', price: 220 }, { id: 'neon', name: '네온', price: 200 }
  ]
};
const shop = lib.load(FILE);
let added = 0;
for (const k of Object.keys(PACK)) for (const it of PACK[k]) {
  if (shop[k].some((x) => x.id === it.id)) continue;
  shop[k].push(it); added++;
}
if (added) lib.save(FILE, shop);
console.log(added ? `${added}개를 추가했어요.` : '이미 모두 들어 있어요. 바뀐 게 없어요.');
