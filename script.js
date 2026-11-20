/* ============================================================
   Романтическая открытка — логика
   Чистый JavaScript, без зависимостей.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const stage = $('stage');
  const intro = $('intro');
  const heartBtn = $('heartBtn');
  const tilt = $('tilt');
  const card = $('card');
  const title = $('title');
  const hugBtn = $('hugBtn');
  const hugScene = $('hugScene');
  const hugText = $('hugText');
  const ambientCanvas = $('ambient');
  const fxCanvas = $('fx');

  const aCtx = ambientCanvas.getContext('2d');
  const fCtx = fxCanvas.getContext('2d');
  const canvasOk = Boolean(aCtx && fCtx);

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mq.matches;

  /* ---------- Утилиты ---------- */

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const PALETTE = ['#ff6b8f', '#ff3d6e', '#d4204f', '#ff9db5', '#ffc2d1'];
  const MAX_FX = 360;

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // перезапуск CSS-анимации
    el.classList.add(cls);
  }

  /* ---------- Рисование на canvas ---------- */

  function drawHeart(c, x, y, s, rot, color, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(0, 0.6);
    c.bezierCurveTo(-1.1, -0.1, -0.7, -1, 0, -0.4);
    c.bezierCurveTo(0.7, -1, 1.1, -0.1, 0, 0.6);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawSpark(c, x, y, r, color, alpha) {
    const o = r * 3;
    const i = r * 0.7;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - o);
    c.lineTo(x + i, y - i);
    c.lineTo(x + o, y);
    c.lineTo(x + i, y + i);
    c.lineTo(x, y + o);
    c.lineTo(x - i, y + i);
    c.lineTo(x - o, y);
    c.lineTo(x - i, y - i);
    c.closePath();
    c.fill();
  }

  /* ---------- Состояние частиц ---------- */

  let W = 0;
  let H = 0;
  let floaters = [];
  let sparks = [];
  let fx = [];
  let fxDirty = false;

  function newFloater(anywhere) {
    return {
      bx: rand(0, W),
      y: anywhere ? rand(0, H) : H + rand(20, 80),
      s: rand(5, 13),
      vy: rand(14, 34),
      amp: rand(8, 26),
      freq: rand(0.3, 0.8),
      ph: rand(0, 6.28),
      rot: rand(-0.5, 0.5),
      a: rand(0.14, 0.42),
      c: pick(PALETTE),
      t: 0
    };
  }

  function seed() {
    const small = W < 640;
    floaters = Array.from({ length: small ? 14 : 24 }, () => newFloater(true));
    sparks = Array.from({ length: small ? 34 : 64 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.7, 2.2),
      ph: rand(0, 6.28),
      sp: rand(0.6, 1.8),
      a: rand(0.25, 0.8)
    }));
  }

  function resize(force) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Не пересоздаём canvas из-за небольших изменений высоты (адресная строка на телефоне)
    if (!force && W && w === W && Math.abs(h - H) < 150) return;
    W = w;
    H = h;
    if (!canvasOk) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [[ambientCanvas, aCtx], [fxCanvas, fCtx]].forEach(([cv, c]) => {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    seed();
    if (reduced) drawAmbient(0);
  }

  /* ---------- Обновление и отрисовка ---------- */

  function step(dt) {
    for (let i = 0; i < floaters.length; i++) {
      const f = floaters[i];
      f.t += dt;
      f.y -= f.vy * dt;
      if (f.y < -30) floaters[i] = newFloater(false);
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life += dt;
      if (p.life >= p.max) { fx.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt + Math.cos(p.life * 3 + p.ph) * p.sw * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  function drawAmbient(t) {
    if (!canvasOk) return;
    aCtx.clearRect(0, 0, W, H);

    for (const f of floaters) {
      const x = f.bx + Math.sin(f.t * f.freq * 2 + f.ph) * f.amp;
      const alpha = f.a * Math.min(1, Math.max(0, f.y / 140));
      drawHeart(aCtx, x, f.y, f.s, f.rot + Math.sin(f.t + f.ph) * 0.2, f.c, alpha);
    }

    for (const s of sparks) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      drawSpark(aCtx, s.x, s.y, s.r, '#ffe3ea', s.a * tw);
    }
    aCtx.globalAlpha = 1;
  }

  function drawFx() {
    if (!canvasOk) return;
    if (!fx.length) {
      if (fxDirty) { fCtx.clearRect(0, 0, W, H); fxDirty = false; }
      return;
    }
    fxDirty = true;
    fCtx.clearRect(0, 0, W, H);
    for (const p of fx) {
      if (p.delay > 0) continue;
      const left = 1 - p.life / p.max;
      const alpha = Math.min(1, left * 2.2);
      if (p.kind === 'h') drawHeart(fCtx, p.x, p.y, p.s, p.rot, p.c, alpha * 0.95);
      else drawSpark(fCtx, p.x, p.y, p.s, '#ffe9ef', alpha);
    }
    fCtx.globalAlpha = 1;
  }

  /* ---------- Цикл анимации ---------- */

  let running = false;
  let raf = 0;
  let last = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    drawAmbient(now / 1000);
    drawFx();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced || !canvasOk || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* ---------- Эффекты ---------- */

  function burst(x, y, count, o) {
    if (reduced || !canvasOk) return;
    const opt = o || {};
    const heartRatio = opt.heartRatio ?? 0.6;
    for (let i = 0; i < count && fx.length < MAX_FX; i++) {
      const ang = rand(0, Math.PI * 2);
      const sp = rand(opt.min ?? 90, opt.max ?? 320);
      const heart = Math.random() < heartRatio;
      fx.push({
        kind: heart ? 'h' : 's',
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        g: opt.g ?? 180,
        drag: opt.drag ?? 1.2,
        sw: 0, ph: 0, delay: 0,
        life: 0,
        max: rand(0.9, 1.8),
        s: heart ? rand(5, 12) : rand(1, 2.4),
        rot: rand(0, 6.28),
        vr: rand(-3, 3),
        c: pick(PALETTE)
      });
    }
    start();
  }

  function rainHearts(n) {
    if (reduced || !canvasOk) return;
    for (let i = 0; i < n && fx.length < MAX_FX; i++) {
      fx.push({
        kind: 'h',
        x: rand(0, W),
        y: H + rand(10, 80),
        vx: 0,
        vy: -rand(220, 420),
        g: 0,
        drag: 0,
        sw: rand(10, 34),
        ph: rand(0, 6.28),
        delay: rand(0, 0.9),
        life: 0,
        max: rand(2.4, 4.2),
        s: rand(6, 15),
        rot: rand(-0.5, 0.5),
        vr: rand(-0.6, 0.6),
        c: pick(PALETTE)
      });
    }
    start();
  }

  /* ---------- Открытие сердца ---------- */

  function revealCard() {
    stage.dataset.state = 'open';
    card.hidden = false;
    title.focus({ preventScroll: true });
    window.setTimeout(() => { intro.hidden = true; }, reduced ? 0 : 1300);
    if (!reduced) window.setTimeout(() => rainHearts(18), 500);
  }

  function openHeart() {
    if (stage.dataset.state !== 'closed') return;
    stage.dataset.state = 'opening';
    heartBtn.tabIndex = -1;
    heartBtn.setAttribute('aria-disabled', 'true');

    if (reduced) { revealCard(); return; }

    const r = heartBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.5;

    window.setTimeout(() => {
      burst(cx, cy, 26, { min: 120, max: 380, heartRatio: 0.55 });
      burst(cx, cy, 34, { min: 60, max: 260, heartRatio: 0, g: 60 });
    }, 220);

    window.setTimeout(revealCard, 700);
  }

  heartBtn.addEventListener('click', openHeart);

  /* Лёгкий наклон сердца за курсором (только для мыши) */
  window.addEventListener('pointermove', (e) => {
    if (reduced || e.pointerType !== 'mouse' || stage.dataset.state !== 'closed') return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    tilt.style.setProperty('--ry', (nx * 18).toFixed(2) + 'deg');
    tilt.style.setProperty('--rx', (-ny * 14).toFixed(2) + 'deg');
  }, { passive: true });

  /* ---------- Кнопка «Обнять тебя» ---------- */

  let hugTimer = 0;

  hugBtn.addEventListener('click', () => {
    hugScene.hidden = false;
    hugText.textContent = hugText.dataset.text || '';
    restart(hugScene, 'play');
    restart(hugText, 'show');

    hugScene.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });

    if (reduced) return;

    const b = hugBtn.getBoundingClientRect();
    burst(b.left + b.width / 2, b.top + b.height / 2, 14, { min: 80, max: 220, heartRatio: 0.8, g: 120 });

    window.clearTimeout(hugTimer);
    hugTimer = window.setTimeout(() => {
      const s = hugScene.getBoundingClientRect();
      burst(s.left + s.width / 2, s.top + s.height / 2, 30, { min: 100, max: 300, heartRatio: 0.7 });
      rainHearts(22);
    }, 1000);
  });

  /* ---------- События окна ---------- */

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(false); });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  const onMotionChange = () => {
    reduced = mq.matches;
    if (reduced) {
      stop();
      fx = [];
      drawFx();
      drawAmbient(0);
    } else {
      start();
    }
  };
  if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
  else if (mq.addListener) mq.addListener(onMotionChange);

  /* ---------- Запуск ---------- */

  resize(true);
  if (reduced) drawAmbient(0);
  else start();
})();
