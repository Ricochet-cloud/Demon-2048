// 칭호 20개(웃긴 7 · 귀여운 6 · 멋진 7)를 shopdata.js 에 추가해요. (이미 있는 id 는 건너뛰어서 여러 번 돌려도 안전해요)
// 사용: node tools/shop-admin/add-titles-pack-1.js
const path = require('path');
const lib = require('./lib');
const FILE = path.join(__dirname, '..', '..', 'www', 'js', 'shopdata.js');
const G1 = '웃긴 칭호', G2 = '귀여운 칭호', G3 = '멋진 칭호';
const PACK = [
  { id: 'x-mergebug', name: '합치기 중독자', price: 60, group: G1 },
  { id: 'x-undo', name: '한 번만 되돌릴게요', price: 70, group: G1 },
  { id: 'x-corner', name: '구석 지박령', price: 80, group: G1 },
  { id: 'x-oneMore', name: '딱 한 판만 병', price: 90, group: G1 },
  { id: 'x-lag', name: '손가락이 먼저 나감', price: 100, group: G1 },
  { id: 'x-4096', name: '4096은 꿈속에서', price: 120, group: G1 },
  { id: 'x-sleep', name: '내일 출근 어쩌지', price: 150, group: G1 },
  { id: 'c-bun', name: '말랑 호빵', price: 60, group: G2 },
  { id: 'c-kitten', name: '꼬물 아기고양이', price: 80, group: G2 },
  { id: 'c-chick', name: '삐약 병아리', price: 80, group: G2 },
  { id: 'c-candy', name: '솜사탕 한 입', price: 100, group: G2 },
  { id: 'c-clover', name: '네잎클로버', price: 120, group: G2 },
  { id: 'c-star', name: '반짝 별똥별', price: 150, group: G2 },
  { id: 'k-shadow', name: '그림자 검객', price: 200, group: G3 },
  { id: 'k-lone', name: '고독한 사냥꾼', price: 250, group: G3 },
  { id: 'k-night', name: '밤을 걷는 자', price: 300, group: G3 },
  { id: 'k-dawn', name: '새벽을 가르는 칼날', price: 350, group: G3 },
  { id: 'k-legend', name: '전설의 합병가', price: 450, group: G3 },
  { id: 'k-emperor', name: '타일의 황제', price: 600, group: G3 },
  { id: 'k-abyss', name: '심연의 지배자', price: 800, group: G3 }
];
const shop = lib.load(FILE);
let added = 0;
for (const it of PACK) {
  if (shop.titles.some((x) => x.id === it.id)) continue;
  shop.titles.push(it);
  added++;
}
if (added) lib.save(FILE, shop);
console.log(added ? `${added}개를 추가했어요.` : '이미 모두 들어 있어요. 바뀐 게 없어요.');
