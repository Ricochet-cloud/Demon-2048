#!/usr/bin/env node
'use strict';
// 상점 관리 프로그램 — 내 컴퓨터에서만 열리는 웹 화면 (npm run admin)
//   시트 이미지를 올리면 자동으로 잘라서 상점(www/js/shopdata.js + www/images)에 올려요.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const lib = require('./lib');

const ROOT = path.resolve(process.env.SHOP_ROOT || path.join(__dirname, '..', '..'));
const WWW = path.join(ROOT, 'www');
const DATA = path.join(WWW, 'js', 'shopdata.js');
const PORT = Number(process.env.PORT || 5050);
const VALUES = Array.from({ length: 13 }, (_, i) => 2 ** (i + 1));   // 2 … 8192
const SLOTS = VALUES.map(String).concat('big');
const CATS = ['귀멸', '일본', '기본'];
const sheets = new Map();   // 올린 시트를 잠깐 들고 있어요 (저장할 때 다시 안 올려도 되게)

const send = (res, code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const fail = (msg) => { const e = new Error(msg); e.user = true; return e; };
function readBody(req, limit = 60 * 1024 * 1024) {
  return new Promise((ok, no) => {
    const parts = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { no(fail('파일이 너무 커요.')); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', no);
  });
}
const readJson = async (req) => { try { return JSON.parse((await readBody(req)).toString('utf8')); } catch (e) { throw e.user ? e : fail('요청을 읽지 못했어요.'); } };

// www 안쪽 경로만 허용 (밖으로 나가는 경로는 막아요)
function inWww(...parts) {
  const p = path.resolve(WWW, ...parts);
  if (p !== WWW && !p.startsWith(WWW + path.sep)) throw fail('허용되지 않은 경로예요.');
  return p;
}
// 칸 수 직접 지정 (1~8)
function b2grid(c, r) { c = Number(c); r = Number(r); return Number.isInteger(c) && Number.isInteger(r) && c >= 1 && r >= 1 && c <= 8 && r <= 8 && c * r >= 2 ? { cols: c, rows: r } : null; }
const idOk = (id) => /^[a-z0-9][a-z0-9_-]{1,19}$/.test(id || '');
const clean = (s, max) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
function getSheet(id) { const s = sheets.get(id); if (!s) throw fail('올린 시트를 찾지 못했어요. 다시 올려 주세요.'); return s; }

const api = {
  // 지금 상점 데이터
  async 'GET /api/shop'() { return lib.load(DATA); },

  // 시트 올리기 → 칸 미리보기
  async 'POST /api/sheet'(req) {
    const body = await readJson(req);
    const buf = Buffer.from(String(body.data || '').replace(/^data:[^,]*,/, ''), 'base64');
    if (buf.length < 1000) throw fail('이미지를 읽지 못했어요.');
    let found;
    const g = b2grid(body.cols, body.rows);
    try { found = await lib.findCells(buf, g); } catch (e) { throw fail(e.message && /칸/.test(e.message) ? e.message : '이미지 파일이 아니에요. (png, jpg, webp)'); }
    if (found.width < 400 || found.height < 400) throw fail('이미지가 너무 작아요.');
    const id = crypto.randomBytes(6).toString('hex');
    sheets.set(id, { buf, cells: found.cells, cols: found.cols, rows: found.rows });
    if (sheets.size > 8) sheets.delete(sheets.keys().next().value);
    const thumbs = [];
    for (const c of found.cells) thumbs.push(await lib.thumb(buf, c, 140));
    return { sheetId: id, warn: found.warn, thumbs, size: [found.width, found.height], cols: found.cols, rows: found.rows };
  },

  // 타일 테마 저장 (새 테마 / 기존 테마 덮어쓰기)
  async 'POST /api/theme'(req) {
    const b = await readJson(req);
    const sheet = getSheet(b.sheetId);
    const shop = lib.load(DATA);
    const id = String(b.id || '');
    const log = [];
    const slots = (b.slots || []).filter((s) => SLOTS.includes(String(s.slot)));
    for (const s of slots) if (s.on && !(Number.isInteger(s.cell) && s.cell >= 1 && s.cell <= sheet.cells.length)) throw fail(`칸 번호는 1~${sheet.cells.length}이에요.`);
    const names = {};
    VALUES.forEach((v) => { const s = slots.find((x) => String(x.slot) === String(v)); const n = clean(s && s.name, 24); if (n) names[v] = n; });

    let theme;
    if (b.mode === 'new') {
      if (!idOk(id)) throw fail('id 는 영문 소문자/숫자/_- 로 2~20자예요. 예) animals');
      if (shop.themes.some((t) => t.id === id)) throw fail(`'${id}' 테마가 이미 있어요. 덮어쓰려면 "기존 테마 덮어쓰기"를 고르세요.`);
      const name = clean(b.name, 12);
      if (!name) throw fail('테마 이름을 적어 주세요.');
      if (!CATS.includes(b.cat)) throw fail('분류를 골라 주세요.');
      if (SLOTS.some((k) => !slots.some((s) => String(s.slot) === k && s.on))) throw fail('새 테마는 14칸(2~8192 + 큰 이미지)이 모두 필요해요.');
      theme = { id, name, desc: clean(b.desc, 40), cat: b.cat, dir: `./images/themes/${id}/`, full: true, max: 8192, bigName: clean(b.bigName, 24), names };
      const pr = priceOf(b.price, false, name); if (pr) theme.price = pr;   // 비우면 무료
      const plainAt = shop.themes.findIndex((t) => t.plain);   // '기본 숫자'(plain)는 항상 맨 끝에 둬요
      shop.themes.splice(plainAt < 0 ? shop.themes.length : plainAt, 0, theme);
      log.push(`새 테마 '${name}' 등록`);
    } else if (b.mode === 'overwrite') {
      theme = shop.themes.find((t) => t.id === id);
      if (!theme || theme.plain) throw fail('덮어쓸 테마를 찾지 못했어요.');
      if (b.name != null && clean(b.name, 12)) theme.name = clean(b.name, 12);
      if (b.desc != null) theme.desc = clean(b.desc, 40);
      if (CATS.includes(b.cat)) theme.cat = b.cat;
      if (b.bigName != null) theme.bigName = clean(b.bigName, 24);
      if ('price' in b && !isLocked('themes', theme).price) { const pr = priceOf(b.price, false, theme.name); if (pr) theme.price = pr; else delete theme.price; }
      theme.names = Object.assign({}, theme.names, names);
      log.push(`기존 테마 '${theme.name}' 수정`);
    } else throw fail('모드를 골라 주세요.');

    const dir = inWww(theme.dir);
    let n = 0;
    for (const s of slots) {
      if (!s.on) continue;
      await lib.writeCell(sheet.buf, sheet.cells[s.cell - 1], 256, path.join(dir, String(s.slot) + '.webp'));
      n++;
    }
    if (n) { theme.ver = (theme.ver || 0) + 1; log.push(`이미지 ${n}장 저장 (${theme.dir})`); }
    lib.save(DATA, shop);
    log.push('shopdata.js 저장');
    return { ok: true, log, theme: theme.id };
  },

  // 프로필 사진 저장 (새 사진 / 같은 id 면 덮어쓰기)
  async 'POST /api/avatars'(req) {
    const b = await readJson(req);
    const sheet = getSheet(b.sheetId);
    const shop = lib.load(DATA);
    const items = (b.items || []).filter((i) => i.on);
    if (!items.length) throw fail('올릴 칸을 하나 이상 고르세요.');
    const seen = new Set();
    for (const i of items) {
      if (!(Number.isInteger(i.cell) && i.cell >= 1 && i.cell <= sheet.cells.length)) throw fail('칸 번호가 이상해요.');
      if (!/^[a-z0-9][a-z0-9_-]{0,19}$/.test(i.id || '')) throw fail(`id 를 확인하세요: '${i.id || ''}' (영문 소문자/숫자/_- 20자 이하)`);
      if (seen.has(i.id)) throw fail(`id 가 겹쳐요: ${i.id}`);
      seen.add(i.id);
      if (!clean(i.name, 12)) throw fail(`'${i.id}' 의 이름을 적어 주세요.`);
      const pr = Number(i.price || 0);
      if (!Number.isInteger(pr) || pr < 0 || pr > 100000) throw fail(`'${i.id}' 의 가격은 0 이상의 정수예요. (0 이면 무료)`);
    }
    const log = [];
    for (const i of items) {
      await lib.writeCell(sheet.buf, sheet.cells[i.cell - 1], 384, inWww('images', 'avatars', i.id + '.webp'));
      const price = Number(i.price || 0), name = clean(i.name, 12);
      const cur = shop.avatars.find((a) => a.id === i.id);
      if (cur) { cur.name = name; if (price) cur.price = price; else delete cur.price; cur.ver = (cur.ver || 0) + 1; log.push(`'${name}' 덮어쓰기`); }
      else { const o = { id: i.id, name }; if (price) o.price = price; shop.avatars.push(o); log.push(`'${name}' 새로 등록${price ? ` (${price}골드)` : ' (무료)'}`); }
    }
    lib.save(DATA, shop);
    log.push('shopdata.js 저장');
    return { ok: true, log };
  },

  // ---- 3단계: 이미 있는 물건 관리 ----
  // 이름·가격·판매 중지 한꺼번에 저장 (바뀐 줄만 보내요)
  async 'POST /api/items/save'(req) {
    const b = await readJson(req);
    const sec = SECTION[b.section];
    if (!sec) throw fail('종류를 확인하세요.');
    const shop = lib.load(DATA);
    const list = shop[b.section];
    const edits = Array.isArray(b.items) ? b.items : [];
    if (!edits.length) throw fail('바뀐 내용이 없어요.');
    const log = [];
    for (const e of edits) {
      const it = list.find((x) => x.id === e.id);
      if (!it) throw fail(`'${e.id}' 물건을 찾지 못했어요.`);
      const locked = isLocked(b.section, it);
      const name = clean(e.name, sec.nameMax);
      if (!name) throw fail(`'${it.id}' 의 이름을 적어 주세요.`);
      const was = [it.name, it.price || 0, !!it.off];
      it.name = name;
      if (!locked.price) {
        const pr = priceOf(e.price, sec.priceRequired, it.name);
        if (pr) it.price = pr; else delete it.price;
      }
      if (!locked.off) { if (e.off) it.off = true; else delete it.off; }
      if (was[0] !== it.name || was[1] !== (it.price || 0) || was[2] !== !!it.off) log.push(`'${it.name}' 수정${it.off ? ' (판매 중지)' : ''}${it.price ? ` · ${it.price}골드` : sec.priceRequired ? '' : ' · 무료'}`);
    }
    lib.save(DATA, shop);
    log.push('shopdata.js 저장');
    return { ok: true, log, shop };
  },

  // 완전히 지우기 (이미 산 사람은 그 물건을 못 쓰게 돼요 — 보통은 '판매 중지'를 쓰세요)
  async 'POST /api/items/delete'(req) {
    const b = await readJson(req);
    const sec = SECTION[b.section];
    if (!sec) throw fail('종류를 확인하세요.');
    const shop = lib.load(DATA);
    const list = shop[b.section];
    const at = list.findIndex((x) => x.id === b.id);
    if (at < 0) throw fail('물건을 찾지 못했어요.');
    const it = list[at];
    if (isLocked(b.section, it).del) throw fail('이 물건은 지울 수 없어요.');
    const log = [];
    list.splice(at, 1);
    if (b.section === 'avatars') {
      const f = inWww('images', 'avatars', it.id + '.webp');
      if (fs.existsSync(f)) { fs.unlinkSync(f); log.push('사진 파일 삭제'); }
    } else if (b.section === 'themes') {
      const rel = String(it.dir || '').replace(/^\.\//, '');
      if (rel === `images/themes/${it.id}/` && /^[a-z0-9_-]+$/.test(it.id)) {   // 테마 전용 폴더일 때만 폴더째 지워요
        const d = inWww(rel);
        if (fs.existsSync(d)) { fs.rmSync(d, { recursive: true, force: true }); log.push('테마 이미지 폴더 삭제'); }
      }
    }
    log.unshift(`'${it.name}' 완전히 삭제`);
    lib.save(DATA, shop);
    log.push('shopdata.js 저장');
    return { ok: true, log, shop };
  },

  // 새 칭호 만들기 (이름 + 골드 가격만, 조건이 필요한 칭호는 따로 만들어요)
  async 'POST /api/title'(req) {
    const b = await readJson(req);
    const shop = lib.load(DATA);
    const name = clean(b.name, SECTION.titles.nameMax);
    if (!name) throw fail('칭호 이름을 적어 주세요.');
    const price = priceOf(b.price, true, name);
    const group = clean(b.group, 10) || '일반';
    let id = clean(b.id, 20);
    if (id) { if (!idOk(id)) throw fail('id 는 영문 소문자/숫자/_- 로 2~20자예요. (비워 두면 자동으로 만들어요)'); }
    else { do { id = 't' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36); } while (shop.titles.some((t) => t.id === id)); }
    if (shop.titles.some((t) => t.id === id)) throw fail(`'${id}' 칭호가 이미 있어요.`);
    if (shop.titles.some((t) => t.price && t.name === name)) throw fail(`'${name}' 칭호가 이미 있어요.`);
    // 같은 묶음(group)의 마지막 칸 바로 뒤에 넣어요 (없으면 가격 있는 칭호들 맨 뒤)
    let at = -1;
    shop.titles.forEach((t, i) => { if (t.price && (t.group || '업적') === group) at = i; });
    if (at < 0) shop.titles.forEach((t, i) => { if (t.price) at = i; });
    shop.titles.splice(at + 1, 0, { id, name, price, group });
    lib.save(DATA, shop);
    return { ok: true, log: [`칭호 '${name}' 추가 (${price}골드, 묶음 '${group}')`, 'shopdata.js 저장'], shop };
  },

  // ---- 배팅 이벤트 ----
  async 'GET /api/events'() { return { events: readEvents() }; },

  // 이벤트 저장 (id 가 새것이면 추가, 있으면 수정). 그림은 새로 올린 것만 바꿔요
  //   b = { id, title, start, end, reward, sides:[{name,color,img?},{...}], image? }  (img/image 는 data URL, 빈 값이면 그대로 두고, 'remove' 면 지워요)
  async 'POST /api/events/save'(req) {
    const b = await readJson(req);
    const id = String(b.id || '');
    if (!idOk(id)) throw fail('id 는 영문 소문자/숫자/_- 로 2~20자예요. 예) bm1');
    const title = clean(b.title, 30);
    if (!title) throw fail('이벤트 이름을 적어 주세요.');
    if (!DAY_RE.test(b.start || '') || !DAY_RE.test(b.end || '')) throw fail('시작일과 종료일을 골라 주세요.');
    if (dayNum(b.end) < dayNum(b.start)) throw fail('종료일이 시작일보다 빠를 수 없어요.');
    if (dayNum(b.end) - dayNum(b.start) > 60) throw fail('기간은 60일까지예요.');
    const reward = Number(b.reward);
    if (!Number.isInteger(reward) || reward < 0 || reward > 100000) throw fail('보상은 0 이상의 정수(골드)예요.');
    if (!Array.isArray(b.sides) || b.sides.length !== 2) throw fail('두 편이 필요해요.');
    const list = readEvents();
    const at = list.findIndex((e) => e.id === id), old = at >= 0 ? list[at] : null;
    // 기간이 겹치면 안 돼요 (새 이벤트에 참가하면 앞 이벤트 기록이 덮여요)
    const other = list.find((e) => e.id !== id && dayNum(b.start) <= dayNum(e.end) && dayNum(e.start) <= dayNum(b.end));
    if (other) throw fail(`'${other.title}' (${other.start} ~ ${other.end}) 와 기간이 겹쳐요. 겹치지 않게 해 주세요.`);
    const sides = ['a', 'b'].map((sid, i) => {
      const s = b.sides[i] || {}, name = clean(s.name, 12);
      if (!name) throw fail(`${i ? '두' : '첫'} 번째 편의 이름을 적어 주세요.`);
      if (!/^#[0-9a-fA-F]{6}$/.test(s.color || '')) throw fail(`${name} 편의 색을 골라 주세요.`);
      return { id: sid, name, color: String(s.color).toLowerCase() };
    });
    const ev = { id, title, start: b.start, end: b.end, reward, sides };
    const log = [];
    // 그림 (새로 올리면 새 파일 이름으로 저장해서 앱에 옛 그림이 남지 않아요)
    const put = async (field, cur, name, w, h) => {
      let out = evImgOk(cur) ? cur : '';
      if (field === 'remove') { rmEvImg(out); return ''; }
      if (field) { const file = `${name}-${stamp()}.webp`; await lib.writeImage(dataBuf(field), path.join(EV_DIR, file), w, h); rmEvImg(out); log.push(`그림 저장 (events/${file})`); out = file; }
      return out;
    };
    const img = await put(b.image, old && old.image, id, 1000);
    if (img) ev.image = img;
    for (let i = 0; i < 2; i++) {
      const o = old && old.sides && old.sides[i], v = await put(b.sides[i].img, o && o.image, `${id}-${i ? 'b' : 'a'}`, 256, 256);
      if (v) sides[i].image = v;
    }
    if (at >= 0) list[at] = ev; else list.push(ev);
    list.sort((x, y) => x.start.localeCompare(y.start));
    writeEvents(list);
    log.unshift(`이벤트 '${title}' ${old ? '수정' : '추가'} (${ev.start} ~ ${ev.end}, 보상 ${reward}골드)`);
    log.push('events.json 저장');
    return { ok: true, log, events: list };
  },

  // 이벤트 지우기 (그림 파일도 지워요. 이미 참가한 사람의 기록은 그대로 남아요)
  async 'POST /api/events/delete'(req) {
    const b = await readJson(req);
    const list = readEvents(), at = list.findIndex((e) => e.id === b.id);
    if (at < 0) throw fail('이벤트를 찾지 못했어요.');
    const [ev] = list.splice(at, 1);
    rmEvImg(ev.image); (ev.sides || []).forEach((s) => rmEvImg(s.image));
    writeEvents(list);
    return { ok: true, log: [`이벤트 '${ev.title}' 삭제`, 'events.json 저장'], events: list };
  },

  // ---- 공지 배너 (www/events/notices.json) — 목록 전체를 한 번에 저장해요 ----
  async 'GET /api/notices'() { return { notices: readNotices() }; },
  async 'POST /api/notices/save'(req) {
    const b = await readJson(req);
    if (!Array.isArray(b.notices) || b.notices.length > 20) throw fail('공지는 20개까지예요.');
    const list = b.notices.map((n, i) => {
      const text = clean(n && n.text, 120);
      if (!text) throw fail(`${i + 1}번 공지의 글을 적어 주세요. (안 쓸 공지는 줄을 지워 주세요)`);
      const r = { text, on: !(n && n.on === false) };
      const s = (n && n.start) || '', e = (n && n.end) || '';
      if (s && !DAY_RE.test(s)) throw fail(`${i + 1}번 공지의 시작일이 이상해요.`);
      if (e && !DAY_RE.test(e)) throw fail(`${i + 1}번 공지의 마감일이 이상해요.`);
      if (s && e && dayNum(e) < dayNum(s)) throw fail(`${i + 1}번 공지의 마감일이 시작일보다 빠를 수 없어요.`);
      if (s) r.start = s; if (e) r.end = e;
      return r;
    });
    fs.mkdirSync(EV_DIR, { recursive: true });
    fs.writeFileSync(path.join(EV_DIR, 'notices.json'), JSON.stringify({ notices: list }, null, 2) + '\n');
    return { ok: true, log: [`공지 ${list.length}개 저장 (notices.json)`], notices: list };
  },

  // ---- 테마 투표 (www/events/polls.json + 후보 그림) ----
  async 'GET /api/polls'() { return { polls: readPolls() }; },

  // 투표 저장 (id 가 새것이면 추가, 있으면 수정). 후보 그림은 새로 올린 것만 바꿔요
  //   b = { id, title, start, end, options:[{ id?, name, desc, img? }] }  (img 는 data URL, 빈 값이면 그대로 두고, 'remove' 면 지워요)
  async 'POST /api/polls/save'(req) {
    const b = await readJson(req);
    const id = String(b.id || '');
    if (!idOk(id)) throw fail('id 는 영문 소문자/숫자/_- 로 2~20자예요. 예) theme1');
    const title = clean(b.title, 30);
    if (!title) throw fail('투표 이름을 적어 주세요.');
    if (!DAY_RE.test(b.start || '') || !DAY_RE.test(b.end || '')) throw fail('시작일과 마감일을 골라 주세요.');
    if (dayNum(b.end) < dayNum(b.start)) throw fail('마감일이 시작일보다 빠를 수 없어요.');
    if (dayNum(b.end) - dayNum(b.start) > 60) throw fail('기간은 60일까지예요.');
    if (!Array.isArray(b.options) || b.options.length < 2 || b.options.length > 8) throw fail('후보는 2~8개가 필요해요.');
    const list = readPolls();
    const at = list.findIndex((p) => p.id === id), old = at >= 0 ? list[at] : null;
    const other = list.find((p) => p.id !== id && dayNum(b.start) <= dayNum(p.end) && dayNum(p.start) <= dayNum(b.end));
    if (other) throw fail(`'${other.title}' (${other.start} ~ ${other.end}) 와 기간이 겹쳐요. 겹치지 않게 해 주세요.`);
    // 후보 id: 수정할 때는 원래 id 를 지켜요 (이미 던진 표가 어느 후보인지 알아야 해서)
    const used = new Set(b.options.map((o) => o && o.id).filter((x) => /^[a-z0-9_-]{1,20}$/.test(x || '')));
    let seq = 0;
    const nextId = () => { let k; do { k = 'o' + (++seq); } while (used.has(k)); used.add(k); return k; };
    const options = b.options.map((o, i) => {
      const name = clean(o && o.name, 16);
      if (!name) throw fail(`${i + 1}번 후보의 이름을 적어 주세요.`);
      const oid = /^[a-z0-9_-]{1,20}$/.test((o && o.id) || '') && (!old || old.options.some((x) => x.id === o.id)) ? o.id : nextId();
      const r = { id: oid, name };
      const desc = clean(o && o.desc, 40); if (desc) r.desc = desc;
      return r;
    });
    if (new Set(options.map((o) => o.id)).size !== options.length) throw fail('후보 id 가 겹쳐요. 다시 시도해 주세요.');
    const poll = { id, title, start: b.start, end: b.end, options };
    const log = [];
    for (let i = 0; i < options.length; i++) {
      const prev = old && old.options.find((x) => x.id === options[i].id), field = b.options[i].img;
      let img = prev && evImgOk(prev.image) ? prev.image : '';
      if (field === 'remove') { rmEvImg(img); img = ''; }
      else if (field) { const file = `${id}-${options[i].id}-${stamp()}.webp`; await lib.writeImage(dataBuf(field), path.join(EV_DIR, file), 384, 384); rmEvImg(img); img = file; log.push(`그림 저장 (events/${file})`); }
      if (img) options[i].image = img;
    }
    if (old) old.options.forEach((x) => { if (!options.some((o) => o.id === x.id)) rmEvImg(x.image); });   // 빠진 후보의 그림은 지워요
    if (at >= 0) list[at] = poll; else list.push(poll);
    list.sort((x, y) => x.start.localeCompare(y.start));
    writePolls(list);
    log.unshift(`투표 '${title}' ${old ? '수정' : '추가'} (${poll.start} ~ ${poll.end}, 후보 ${options.length}개)`);
    log.push('polls.json 저장');
    return { ok: true, log, polls: list };
  },

  async 'POST /api/polls/delete'(req) {
    const b = await readJson(req);
    const list = readPolls(), at = list.findIndex((p) => p.id === b.id);
    if (at < 0) throw fail('투표를 찾지 못했어요.');
    const [p] = list.splice(at, 1);
    p.options.forEach((o) => rmEvImg(o.image));
    writePolls(list);
    return { ok: true, log: [`투표 '${p.title}' 삭제`, 'polls.json 저장'], polls: list };
  }
};

// ---- 배팅 이벤트 (www/events/events.json + 그림) ----
const EV_DIR = path.join(WWW, 'events');
const EV_FILE = path.join(EV_DIR, 'events.json');
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const readEvents = () => { try { const j = JSON.parse(fs.readFileSync(EV_FILE, 'utf8')); return Array.isArray(j.events) ? j.events : []; } catch (e) { return []; } };
function writeEvents(list) { fs.mkdirSync(EV_DIR, { recursive: true }); fs.writeFileSync(EV_FILE, JSON.stringify({ events: list }, null, 2) + '\n'); }
const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const evImgOk = (n) => typeof n === 'string' && /^[\w-]{1,60}\.webp$/.test(n);
const dataBuf = (v) => { const b = Buffer.from(String(v || '').replace(/^data:[^,]*,/, ''), 'base64'); if (b.length < 200) throw fail('이미지를 읽지 못했어요.'); return b; };
const POLL_FILE = path.join(EV_DIR, 'polls.json');
const readNotices = () => { try { const j = JSON.parse(fs.readFileSync(path.join(EV_DIR, 'notices.json'), 'utf8')); return Array.isArray(j.notices) ? j.notices : []; } catch (e) { return []; } };
const readPolls = () => { try { const j = JSON.parse(fs.readFileSync(POLL_FILE, 'utf8')); return Array.isArray(j.polls) ? j.polls : []; } catch (e) { return []; } };
function writePolls(list) { fs.mkdirSync(EV_DIR, { recursive: true }); fs.writeFileSync(POLL_FILE, JSON.stringify({ polls: list }, null, 2) + '\n'); }
const stamp = () => Date.now().toString(36);
function rmEvImg(name) { if (evImgOk(name)) { const f = path.join(EV_DIR, name); if (fs.existsSync(f)) fs.unlinkSync(f); } }

// 종류별 규칙
const SECTION = {
  avatars: { nameMax: 12, priceRequired: false },
  frames: { nameMax: 12, priceRequired: false },
  titles: { nameMax: 14, priceRequired: true },
  bgs: { nameMax: 12, priceRequired: true },     // 배경·이름 꾸미기는 무료 개념이 없어서 가격이 꼭 있어야 해요
  nameFx: { nameMax: 12, priceRequired: true },
  themes: { nameMax: 12, priceRequired: false }
};
// 건드리면 안 되는 물건 (price: 가격 바꾸기 불가 / off: 판매 중지 불가 / del: 삭제 불가)
function isLocked(section, it) {
  if (section === 'themes' && (it.id === 'default' || it.plain)) return { price: true, off: true, del: true };   // 기본 테마들은 항상 있어야 해요
  if (section === 'titles' && !it.price) return { price: true, off: true, del: true };                           // 업적·미션 칭호는 이름만 바꿀 수 있어요
  return {};
}
function priceOf(v, required, label) {
  const n = v === '' || v == null ? 0 : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw fail(`'${label}' 의 가격은 0 이상의 정수예요.`);
  if (required && n < 1) throw fail(`'${label}' 은(는) 가격이 꼭 있어야 해요. (1골드 이상)`);
  return n;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer(async (req, res) => {
  try {
    // 내 컴퓨터(localhost)에서 온 요청만 받아요
    const host = String(req.headers.host || '').split(':')[0];
    if (host !== 'localhost' && host !== '127.0.0.1') return send(res, 403, { error: '접근할 수 없어요.' });
    const url = new URL(req.url, 'http://localhost');
    const key = `${req.method} ${url.pathname}`;
    if (api[key]) {
      if (req.method === 'POST' && req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)) return send(res, 403, { error: '접근할 수 없어요.' });
      return send(res, 200, await api[key](req));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {   // 지금 앱의 이미지 미리보기용
      const p = inWww(decodeURIComponent(url.pathname.slice(7)));
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, fs.readFileSync(p), MIME[path.extname(p)] || 'application/octet-stream');
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'index.html')), MIME['.html']);
    send(res, 404, 'not found', 'text/plain');
  } catch (e) {
    if (!e.user) console.error(e);
    send(res, e.user ? 400 : 500, { error: e.user ? e.message : '문제가 생겼어요: ' + e.message });
  }
});
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`상점 관리 프로그램: ${url}   (끄려면 Ctrl+C)`);
  console.log(`대상 폴더: ${ROOT}`);
  if (!process.env.NO_OPEN) exec(process.platform === 'win32' ? `start "" ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`, () => {});
});
