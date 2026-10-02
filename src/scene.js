import { portalFromHands } from './portal-geometry.js';
import { drawPowerScene } from './power-effects.js';
import { createPowerMotion } from './power-motion.js';
import { createHandSlots } from './hand-slots.js';

const WIDTH = 1280;
const HEIGHT = 800;
const FILTERS = ['prism', 'thermal', 'pixel', 'mono', 'rgb', 'dream'];
const point = (x, y) => ({ x, y });

export function createScene(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = WIDTH;
  sourceCanvas.height = HEIGHT;
  const sourceCtx = sourceCanvas.getContext('2d', { alpha: false });
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = 96;
  pixelCanvas.height = 60;
  const pixelCtx = pixelCanvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handSlots = createHandSlots();
  const power = createPowerMotion(WIDTH, HEIGHT);
  const state = {
    source: null,
    mode: '3d',
    filter: 'prism',
    renderTime: 0,
    power: null,
    strength: 0.72,
    hands: [],
    lastHandUpdate: 0,
  };

  function drawPlaceholder(c) {
    const bg = c.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#34334c');
    bg.addColorStop(.6, '#65658e');
    bg.addColorStop(1, '#8886ac');
    c.fillStyle = bg;
    c.fillRect(0, 0, WIDTH, HEIGHT);
    const halo = c.createRadialGradient(700, 380, 25, 700, 380, 490);
    halo.addColorStop(0, '#c6bce78f');
    halo.addColorStop(1, '#c6bce700');
    c.fillStyle = halo;
    c.fillRect(130, 0, 1030, HEIGHT);

    c.strokeStyle = '#ffffff20'; c.lineWidth = 1;
    for (let x = 20; x < WIDTH; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, HEIGHT); c.stroke(); }
    for (let y = 20; y < HEIGHT; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(WIDTH, y); c.stroke(); }
    c.fillStyle = '#d9ffe6a8';
    c.textAlign = 'center';
    c.font = '180px Pixelify';
    c.fillText('✳', WIDTH * .56, HEIGHT * .53);
    c.font = '20px Pixelify';
    c.letterSpacing = '4px';
    c.fillStyle = '#f9f8ffb8';
    c.fillText('CAMERA STANDBY', WIDTH * .56, HEIGHT * .62);
    c.letterSpacing = '0px';
  }

  function drawVideo(c, video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return drawPlaceholder(c);
    const scale = Math.max(WIDTH / vw, HEIGHT / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    c.save();
    c.translate(WIDTH, 0);
    c.scale(-1, 1);
    c.drawImage(video, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);
    c.restore();
  }

  function updateSource() {
    sourceCtx.save();
    sourceCtx.clearRect(0, 0, WIDTH, HEIGHT);
    if (state.source?.kind === 'video') drawVideo(sourceCtx, state.source.element);
    else drawPlaceholder(sourceCtx);
    sourceCtx.restore();
  }

  function polygon(c, vertices) {
    c.beginPath();
    c.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) c.lineTo(vertices[i].x, vertices[i].y);
    c.closePath();
  }

  function clippedImage(c, vertices, options, filterName) {
    const amount = state.strength;
    c.save();
    polygon(c, vertices); c.clip();
    c.filter = options.filter;
    if (filterName === 'pixel') {
      pixelCtx.drawImage(sourceCanvas, 0, 0, pixelCanvas.width, pixelCanvas.height);
      c.imageSmoothingEnabled = false;
      c.drawImage(pixelCanvas, 0, 0, WIDTH, HEIGHT);
      c.imageSmoothingEnabled = true;
    } else {
      c.drawImage(sourceCanvas, options.dx * amount, options.dy * amount, WIDTH, HEIGHT);
    }
    c.filter = 'none';
    c.fillStyle = options.tint;
    c.globalAlpha = options.alpha * amount;
    c.fillRect(0, 0, WIDTH, HEIGHT);
    c.globalAlpha = 1;
    if (filterName === 'rgb') {
      c.globalCompositeOperation = 'screen';
      c.fillStyle = options.rgb;
      c.globalAlpha = amount * .38;
      c.fillRect(0, 0, WIDTH, HEIGHT);
    }
    c.restore();
  }

  function treatment(filterName, secondary) {
    switch (filterName) {
      case 'thermal': return { filter: 'contrast(1.6) saturate(2.6) hue-rotate(150deg)', tint: secondary ? '#4850d3' : '#fb8667', alpha: .47, dx: 15, dy: -13, rgb: '#ff8b50' };
      case 'pixel': return { filter: 'none', tint: secondary ? '#88d8db' : '#eaa1dc', alpha: .25, dx: 0, dy: 0, rgb: '#ec8dd0' };
      case 'mono': return { filter: 'grayscale(1) contrast(1.45)', tint: secondary ? '#514d70' : '#f0eff3', alpha: secondary ? .38 : .2, dx: 12, dy: -8, rgb: '#ffffff' };
      case 'rgb': return { filter: 'contrast(1.35) saturate(1.8)', tint: secondary ? '#16d6e6' : '#f9427b', alpha: .49, dx: secondary ? 18 : -18, dy: 0, rgb: secondary ? '#2ae2f9' : '#ff365a' };
      case 'dream': return { filter: 'blur(5px) saturate(1.7)', tint: secondary ? '#a3d9f4' : '#e8a6dc', alpha: .53, dx: 10, dy: -8, rgb: '#f2addf' };
      default: return { filter: 'contrast(1.15) saturate(1.55)', tint: secondary ? '#65c7ee' : '#ee3d77', alpha: secondary ? .5 : .55, dx: secondary ? 15 : -15, dy: secondary ? 10 : -8, rgb: '#fd6b91' };
    }
  }

  function drawPortal(c, hands) {
    const geometry = portalFromHands(hands, state.mode, WIDTH, HEIGHT);
    if (!geometry) return;
    const secondaryFilter = FILTERS[(FILTERS.indexOf(state.filter) + 1) % FILTERS.length];
    geometry.polygons.forEach((vertices, index) => {
      const filterName = index === 0 ? state.filter : secondaryFilter;
      c.save();
      c.shadowColor = '#12112a9c'; c.shadowBlur = 20; c.shadowOffsetY = 9;
      polygon(c, vertices); c.fillStyle = '#24233f7a'; c.fill();
      c.restore();
      clippedImage(c, vertices, treatment(filterName, index > 0), filterName);
      c.save();
      c.lineJoin = 'round';
      polygon(c, vertices); c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.shadowColor = '#dff9ff'; c.shadowBlur = 10; c.stroke();
      c.restore();
    });
  }

  function drawHands(c) {
    if (!state.hands.length || performance.now() - state.lastHandUpdate > 500) return;
    for (const hand of state.hands) {
      c.save();
      c.strokeStyle = hand.thumbPinkyPinch ? '#d4ffdcdb' : '#e9e3ff99';
      c.fillStyle = hand.thumbPinkyPinch ? '#c5ffd1' : '#e9e3ff';
      c.lineWidth = 2;
      for (const [from, to] of [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20]]) {
        const p = hand.landmarks[from], q = hand.landmarks[to];
        c.beginPath(); c.moveTo(p.x * WIDTH, p.y * HEIGHT); c.lineTo(q.x * WIDTH, q.y * HEIGHT); c.stroke();
      }
      for (const i of [4, 8, 12, 16, 20]) {
        const p = hand.landmarks[i]; c.beginPath(); c.arc(p.x * WIDTH, p.y * HEIGHT, 5, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

  function render(c = ctx, includeUI = true) {
    const now = performance.now();
    if (includeUI) state.renderTime = reducedMotion.matches ? 0 : now / 1000;
    updateSource();
    c.clearRect(0, 0, WIDTH, HEIGHT);
    c.drawImage(sourceCanvas, 0, 0);
    if (state.mode !== 'power' && state.filter === 'dream') {
      c.fillStyle = '#e6c4ff'; c.globalAlpha = .10 * state.strength; c.fillRect(0, 0, WIDTH, HEIGHT); c.globalAlpha = 1;
    }
    const liveHands = performance.now() - state.lastHandUpdate < 500 ? state.hands : [];
    if (state.mode === 'power') {
      if (includeUI) state.power = power.update(liveHands, state.lastHandUpdate, now, state.strength, reducedMotion.matches);
      drawPowerScene(c, state.power, state.filter, state.strength);
    } else {
      drawPortal(c, liveHands);
    }
    if (includeUI && state.mode !== 'power') drawHands(c);
  }

  function frame() { render(); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);

  function setHands(hands) {
    const now = performance.now();
    const ordered = handSlots.assign(hands, now);
    const previous = state.hands;
    const dt = Math.max(.016, (now - state.lastHandUpdate) / 1000);
    state.hands = ordered.map(hand => {
      const old = previous.find(candidate => candidate.slot === hand.slot);
      const landmarks = old
        ? hand.landmarks.map((p, i) => point(old.landmarks[i].x + (p.x - old.landmarks[i].x) * .42, old.landmarks[i].y + (p.y - old.landmarks[i].y) * .42))
        : hand.landmarks;
      const velocity = old && dt < .3 ? point(
        Math.max(-1000, Math.min(1000, (landmarks[0].x - old.landmarks[0].x) * WIDTH / dt)),
        Math.max(-1000, Math.min(1000, (landmarks[0].y - old.landmarks[0].y) * HEIGHT / dt)),
      ) : point(0, 0);
      const motion = point((old?.motion?.x || 0) * .65 + velocity.x * .35, (old?.motion?.y || 0) * .65 + velocity.y * .35);
      return { ...hand, motion, landmarks };
    });
    state.lastHandUpdate = now;
    return state.hands;
  }

  return {
    state,
    setSource(source) { state.source = source; },
    setHands,
    setMode(mode) { if (state.mode !== mode) { state.power = power.reset(); state.mode = mode; } },
    setFilter(filter) { state.filter = filter; },
    resetSession() { state.hands = []; handSlots.reset(); state.power = power.reset(); },
    setStrength(value) { state.strength = value; },
    capture() {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = WIDTH; exportCanvas.height = HEIGHT + 95;
      const exportCtx = exportCanvas.getContext('2d');
      render(exportCtx, false);
      exportCtx.fillStyle = '#f8f7f2'; exportCtx.fillRect(0, HEIGHT, WIDTH, 95);
      exportCtx.fillStyle = '#7070a2'; exportCtx.fillRect(0, HEIGHT, WIDTH, 5);
      exportCtx.font = '600 37px Pixelify'; exportCtx.fillStyle = '#303044';
      exportCtx.fillText('CSS REALITY LAB', 38, HEIGHT + 61);
      exportCtx.font = '600 16px DM Sans'; exportCtx.fillStyle = '#7070a2';
      exportCtx.textAlign = 'right'; exportCtx.fillText("WE DON'T CODE, WE BUILD  ✳", WIDTH - 38, HEIGHT + 56);
      return exportCanvas;
    },
  };
}
