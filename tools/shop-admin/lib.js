'use strict';
// 상점 관리 프로그램의 공용 코드: 시트 격자 찾기/자르기, shopdata.js 읽고 쓰기
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ---- 시트 이미지 (4x4, 검은 격자선) ----
function bands(isDark, len, other) {
  const out = [];
  for (let i = 0; i < len; i++) {
    let n = 0;
    for (let j = 0; j < other; j++) if (isDark(i, j)) n++;
    if (n / other > 0.8) { if (out.length && i - out[out.length - 1][1] <= 1) out[out.length - 1][1] = i; else out.push([i, i]); }
  }
  return out;
}

// 칸의 위치를 돌려줘요 (왼쪽 위부터 가로로). 격자선에서 칸 수(가로x세로)를 자동으로 알아내요.
// grid = { cols, rows } 를 주면 그 칸 수로 균등하게 나눠요 (격자선이 안 보이는 이미지용).
async function findCells(buf, grid) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const dark = (x, y) => { const p = (y * W + x) * 3; return data[p] + data[p + 1] + data[p + 2] < 90; };
  const MIN = 20;
  const build = (xs, ys, nc, nr) => {
    const cells = [];
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
      const left = xs[c][1] + 3, top = ys[r][1] + 3, w = xs[c + 1][0] - 2 - left, h = ys[r + 1][0] - 2 - top, size = Math.min(w, h);
      if (!(size >= MIN)) return null;
      cells.push({ left, top, size });
    }
    return cells;
  };
  const even = (nc, nr) => {
    const m = Math.round(W * 0.004), g = Math.round(W * 0.005);
    const xs = [[0, m]]; for (let i = 1; i < nc; i++) xs.push([Math.round(W * i / nc) - g, Math.round(W * i / nc) + g]); xs.push([W - m, W]);
    const ys = [[0, m]]; for (let i = 1; i < nr; i++) ys.push([Math.round(H * i / nr) - g, Math.round(H * i / nr) + g]); ys.push([H - m, H]);
    return build(xs, ys, nc, nr);
  };
  const forced = grid && Number.isInteger(grid.cols) && Number.isInteger(grid.rows);
  let cells = null, nc, nr, warn = '', auto = false;
  if (forced) {
    nc = grid.cols; nr = grid.rows; cells = even(nc, nr);
    if (!cells) throw new Error('칸이 너무 작아요. 칸 수를 확인하세요.');
  } else {
    const cols = bands((x, y) => dark(x, y), W, H), rows = bands((y, x) => dark(x, y), H, W);
    if (cols.length >= 2 && rows.length >= 2 && cols.length <= 9 && rows.length <= 9 && (cols.length - 1) * (rows.length - 1) >= 2) {
      nc = cols.length - 1; nr = rows.length - 1; cells = build(cols, rows, nc, nr); auto = !!cells;
    }
    if (!cells) {
      nc = 4; nr = 4; cells = even(4, 4);
      warn = `격자선을 못 찾아서(가로 ${cols.length}개, 세로 ${rows.length}개) 칸을 4x4로 균등하게 나눴어요. 칸 수가 다르면 위에서 바꾸고, 미리보기를 꼭 확인하세요.`;
      if (!cells) throw new Error('칸을 나누지 못했어요. 이미지가 너무 작아요.');
    }
  }
  return { cells, cols: nc, rows: nr, warn, auto, width: W, height: H };
}

const cellImage = (buf, cell, px) => {
  const img = sharp(buf).extract({ left: cell.left, top: cell.top, width: cell.size, height: cell.size });
  return px && cell.size > px ? img.resize(px, px, { kernel: 'lanczos3' }) : img;   // 원본보다 작게 줄일 때만 줄여요 (늘리거나 불필요하게 줄이면 뿌예져요)
};
// px 는 '최대 크기'예요. 칸이 그보다 작으면 원본 크기 그대로, 품질 94 로 저장해서 또렷하게 남겨요.
async function writeCell(buf, cell, px, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await cellImage(buf, cell, px).webp({ quality: 94, effort: 6, smartSubsample: false }).toFile(out);
}
async function thumb(buf, cell, px) { return 'data:image/webp;base64,' + (await sharp(buf).extract({ left: cell.left, top: cell.top, width: cell.size, height: cell.size }).resize(px, px, { kernel: 'lanczos3' }).webp({ quality: 70 }).toBuffer()).toString('base64'); }

// ---- shopdata.js 읽고 쓰기 ----
const HEADER = `// 상점 물건 목록 (프로필 사진 · 프레임 · 칭호 · 카드 배경 · 이름 꾸미기 · 타일 테마)
// 상점 관리 프로그램(tools/shop-admin)이 이 파일을 고쳐요. 손으로 고쳐도 돼요.
// - price 가 없으면 무료예요 (테마도 price 가 있으면 골드로 사야 바꿀 수 있어요) (칭호는 price 도 cond 도 없으면 미션 보상 같은 특별 칭호)
// - off: true 는 '판매 중지'예요. 상점에서는 사라지지만, 이미 가진 사람은 계속 쓸 수 있어요.
// - ver: 그림을 바꿀 때마다 올라가는 번호예요 (옛 그림이 앱에 남지 않게 주소 뒤에 붙어요).
// - titles 의 cond 는 업적 조건 이름이에요 (win2048 / dexHalf / dexFull) — app.js 의 CONDS 에서 정해요.
// - frames / bgs / nameFx 의 모양(CSS)은 css/app.css 의 .fr-<id> / .bg-<id> / .nm-<id> 에 있어요.
// - themes: max 는 이 테마에 그림이 있는 가장 큰 타일 숫자, cat 은 상점 분류(귀멸/일본/기본), dir 은 이미지 폴더예요.
`;
const SECTIONS = ['avatars', 'frames', 'titles', 'bgs', 'nameFx'];

function val(v) {
  if (v && typeof v === 'object') return '{ ' + Object.keys(v).map((k) => `${k}: ${val(v[k])}`).join(', ') + ' }';
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return String(v);
}
function fmtTheme(t) {
  const { names, ...rest } = t;
  const keys = Object.keys(names || {});
  const rows = [];
  for (let i = 0; i < keys.length; i += 7) rows.push('        ' + keys.slice(i, i + 7).map((k) => `${k}: ${val(names[k])}`).join(', '));
  return '{ ' + Object.keys(rest).map((k) => `${k}: ${val(rest[k])}`).join(', ') + (keys.length ? ',\n      names: {\n' + rows.join(',\n') + '\n      }' : ', names: {}') + ' }';
}
function serialize(shop) {
  const sec = (k) => `  ${k}: [\n` + shop[k].map((o) => '    ' + val(o)).join(',\n') + '\n  ]';
  return HEADER + 'window.SHOP = {\n' + SECTIONS.map(sec).join(',\n') + ',\n  themes: [\n' + shop.themes.map((t) => '    ' + fmtTheme(t)).join(',\n') + '\n  ]\n};\n';
}
function load(file) {
  const win = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(win);
  if (!win.SHOP) throw new Error('shopdata.js 를 읽지 못했어요');
  return win.SHOP;
}
function save(file, shop) {
  const text = serialize(shop);
  new Function('window', text)({});            // 문법 검사 (망가진 파일을 쓰지 않게)
  fs.writeFileSync(file + '.tmp', text);
  fs.renameSync(file + '.tmp', file);
}

module.exports = { findCells, writeCell, thumb, load, save, serialize };
