// 프레임·카드 배경·이름 꾸미기·칭호 3차 묶음을 shopdata.js 에 추가해요. (이미 있는 id 는 건너뛰어서 여러 번 돌려도 안전해요)
// 사용: node tools/shop-admin/add-style-pack-3.js
const path = require('path');
const lib = require('./lib');
const FILE = path.join(__dirname, '..', '..', 'www', 'js', 'shopdata.js');
const PACK = {
  frames: [
    { id: 'gilded', name: '금박', price: 190 }, { id: 'glass', name: '유리', price: 150 }, { id: 'pixel', name: '도트', price: 110 },
    { id: 'leaf', name: '새싹', price: 130 }, { id: 'choco', name: '초코', price: 110 }, { id: 'ember', name: '불씨', price: 210 },
    { id: 'prism', name: '프리즘', price: 240 }
  ],
  bgs: [
    { id: 'cloud', name: '구름', price: 100 }, { id: 'sunrise', name: '일출', price: 130 }, { id: 'firefly', name: '반딧불 숲', price: 150 },
    { id: 'rain', name: '비 오는 날', price: 120 }, { id: 'hanji', name: '한지', price: 90 }, { id: 'meteor', name: '별똥별', price: 170 }
  ],
  nameFx: [
    { id: 'pink', name: '분홍빛', price: 80 }, { id: 'sky', name: '하늘빛', price: 80 }, { id: 'lime', name: '라임빛', price: 80 },
    { id: 'ember', name: '불씨빛', price: 180 }, { id: 'ocean', name: '바다빛', price: 180 }, { id: 'candy', name: '솜사탕', price: 230 }
  ],
  titles: [
    { id: 'n2048', name: '2048 도전자', price: 60, group: '일반' }, { id: 'commute', name: '오늘도 출근', price: 90, group: '일반' },
    { id: 'nightwatch', name: '야간 순찰대', price: 130, group: '일반' }, { id: 'tilemaker', name: '타일 장인', price: 120, group: '일반' },
    { id: 'fan', name: '귀멸 덕후', price: 150, group: '일반' }, { id: 'hunter', name: '숫자 사냥꾼', price: 180, group: '일반' },
    { id: 'merger', name: '합치기 달인', price: 200, group: '일반' }, { id: 'focus', name: '전집중의 호흡', price: 250, group: '일반' }
  ]
};
const shop = lib.load(FILE);
let added = 0;
for (const k of Object.keys(PACK)) for (const it of PACK[k]) {
  if (shop[k].some((x) => x.id === it.id)) continue;
  if (k === 'titles') {   // 같은 분류의 마지막 유료 칭호 뒤에 끼워 넣어요 (업적 칭호가 맨 뒤에 있어서)
    let at = -1; shop.titles.forEach((t, i) => { if (t.price && (t.group || '업적') === it.group) at = i; });
    shop.titles.splice(at + 1, 0, it);
  } else shop[k].push(it);
  added++;
}
if (added) lib.save(FILE, shop);
console.log(added ? `${added}개를 추가했어요.` : '이미 모두 들어 있어요. 바뀐 게 없어요.');
