/* 게임 잘하는 법: 꿀팁 카드 + 작은 보드 애니메이션
   새 꿀팁은 TIPS 에 한 덩어리만 추가하면 돼요.
   frames: 장면 목록. tiles 는 [고유이름, 숫자, 줄(r), 칸(c)]. 같은 이름의 타일은 장면이 바뀔 때 미끄러져 움직여요
   (이름이 사라지면 합쳐진 거예요). */
(function () {
  'use strict';
  const TIPS = [
    {
      title: '큰 타일은 구석에 고정',
      desc: '가장 큰 타일을 한 구석(보통 오른쪽 아래)에 두고 움직이지 마세요. 나머지 타일이 그 옆에 차곡차곡 쌓이게 해요.',
      frames: [
        { cap: '64 는 오른쪽 아래에 가만히', tiles: [['A', 64, 3, 3], ['B', 8, 1, 0], ['C', 8, 2, 1], ['D', 2, 0, 2]] },
        { cap: '아래(↓)로 밀어요', tiles: [['A', 64, 3, 3], ['B', 8, 3, 0], ['C', 8, 3, 1], ['D', 2, 3, 2]] },
        { cap: '오른쪽(→)으로 밀면 8+8 이 합쳐져요', tiles: [['A', 64, 3, 3], ['C', 16, 3, 1], ['D', 2, 3, 2]] }
      ]
    },
    {
      title: '반대 방향은 아끼기',
      desc: '큰 타일이 아래에 있다면 위(↑)는 정말 막힐 때만 눌러요. 한 번 누르면 줄 전체가 올라가서 구석이 무너져요.',
      frames: [
        { cap: '아래 줄이 가지런해요', tiles: [['A', 64, 3, 3], ['B', 32, 3, 2], ['C', 16, 3, 1], ['D', 8, 3, 0]] },
        { cap: '위(↑)를 누르면…', tiles: [['A', 64, 0, 3], ['B', 32, 0, 2], ['C', 16, 0, 1], ['D', 8, 0, 0]] },
        { cap: '줄 전체가 올라가고 새 타일이 아래에 생겨요', tiles: [['A', 64, 0, 3], ['B', 32, 0, 2], ['C', 16, 0, 1], ['D', 8, 0, 0], ['E', 2, 3, 1]] }
      ]
    },
    {
      title: '연쇄로 합치기',
      desc: '숫자를 순서대로 놓아 두면 한 번 밀 때 줄줄이 합쳐져요. 같은 숫자를 바로 옆에 붙여 두는 게 핵심이에요.',
      frames: [
        { cap: '같은 숫자를 가까이 모아 두면', tiles: [['A', 8, 3, 3], ['B', 4, 3, 2], ['C', 2, 3, 1], ['D', 2, 3, 0]] },
        { cap: '오른쪽(→)으로 밀면 2+2 = 4', tiles: [['A', 8, 3, 3], ['B', 4, 3, 2], ['D', 4, 3, 1]] },
        { cap: '한 번 더 밀면 4+4 = 8', tiles: [['A', 8, 3, 3], ['D', 8, 3, 2]] },
        { cap: '또 한 번 밀면 8+8 = 16!', tiles: [['A', 16, 3, 3]] }
      ]
    },
    {
      title: '빈칸을 늘리는 수 고르기',
      desc: '어느 쪽으로 밀지 고민될 때는 합쳐지는 쌍이 많아서 빈칸이 가장 많이 늘어나는 쪽을 골라요.',
      frames: [
        { cap: '한 줄에 두 쌍이 있어요', tiles: [['A', 2, 1, 0], ['B', 2, 1, 1], ['C', 4, 1, 2], ['D', 4, 1, 3]] },
        { cap: '왼쪽(←)으로 밀면 한 번에 둘 다 합쳐져요', tiles: [['A', 4, 1, 0], ['C', 8, 1, 1]] }
      ]
    },
    {
      title: '새 타일을 보고 누르기',
      desc: '급하게 누르지 말고, 새로 생긴 타일이 어디인지 먼저 확인해요. 한 수 앞만 생각해도 실수가 확 줄어요.',
      frames: [
        { cap: '이 판에서', tiles: [['A', 32, 3, 3], ['B', 16, 3, 2], ['C', 8, 2, 3]] },
        { cap: '2 가 새로 생겼어요 (반짝!)', tiles: [['A', 32, 3, 3], ['B', 16, 3, 2], ['C', 8, 2, 3], ['N', 2, 3, 0]] },
        { cap: '위치를 보고 어느 쪽으로 밀지 정해요', tiles: [['A', 32, 3, 3], ['B', 16, 3, 2], ['C', 8, 2, 3], ['N', 2, 3, 0]] }
      ]
    },
    {
      title: '조커카드는 위기에 아껴 쓰기',
      desc: '판이 막히기 직전에 쓰는 게 가장 값져요. 점수를 올릴 때 낭비하지 말고 큰 타일이 위험할 때 꺼내요.',
      jokers: true
    }
  ];

  function paint(el, v) {
    el.dataset.v = v > 2048 ? 'big' : String(v);
    el.firstChild.textContent = v;
    el.classList.toggle('long', String(v).length >= 4);
    const img = window.AppThemes && window.AppThemes.imgOf ? window.AppThemes.imgOf(v) : '';
    el.classList.toggle('has-img', !!img);
    if (img) el.style.setProperty('--img', `url("${new URL(img, document.baseURI).href}")`);
    else el.style.removeProperty('--img');
  }

  // 작은 보드에 장면을 돌려요. 멈추려면 돌려받은 함수를 부르세요
  function play(host, frames, capEl) {
    host.textContent = '';
    const cells = document.createElement('div'); cells.className = 'board__cells';
    for (let i = 0; i < 16; i++) { const c = document.createElement('div'); c.className = 'cell'; cells.appendChild(c); }
    const layer = document.createElement('div'); layer.className = 'board__tiles';
    host.appendChild(cells); host.appendChild(layer);
    const els = new Map();
    let i = 0, timer = null, alive = true;
    function show(f, fresh) {
      const names = new Set(f.tiles.map((t) => t[0]));
      els.forEach((el, k) => {
        if (!names.has(k)) { els.delete(k); el.classList.add('tip-gone'); setTimeout(() => el.remove(), 380); }
      });
      f.tiles.forEach(([k, v, r, c]) => {
        let el = els.get(k);
        if (!el) {
          el = document.createElement('div'); el.className = 'tile' + (fresh ? '' : ' is-new');
          el.appendChild(document.createElement('span')); layer.appendChild(el); els.set(k, el);
          el.style.setProperty('--r', r); el.style.setProperty('--c', c);
        }
        const old = el.dataset.v;
        paint(el, v);
        el.style.setProperty('--r', r); el.style.setProperty('--c', c);
        if (old && old !== el.dataset.v) { el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop'); }
      });
      if (capEl) capEl.textContent = f.cap || '';
    }
    function step() {
      if (!alive) return;
      if (i >= frames.length) { i = 0; layer.textContent = ''; els.clear(); }
      show(frames[i], i === 0);
      i++;
      timer = setTimeout(step, i === frames.length ? 2000 : 1400);
    }
    step();
    return () => { alive = false; clearTimeout(timer); };
  }

  window.AppTips = { TIPS, play };
})();
