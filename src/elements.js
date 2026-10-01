import { renderFireVolume } from './fire-volume.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = (start, end, value) => { const p = clamp((value - start) / (end - start), 0, 1); return p * p * (3 - 2 * p); };
const fract = value => value - Math.floor(value);

function glow(c, x, y, radius, color, alpha) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// Flow geometry is continuous in time. Particle wraps happen at zero opacity,
// avoiding the sudden resets of the former rotating sphere/splash animation.
function fire(c, radius, time, motion, strength, seed = 0, enhanced = false) {
  const windX = clamp(-motion.x / 850, -1.25, 1.25);
  const windY = clamp(motion.y / 1200, -.35, .45);
  c.save(); c.globalCompositeOperation = 'screen';
  glow(c, 0, -radius * .15, radius * 1.8, '#ff5600', .28 * strength);
  glow(c, 0, radius * .1, radius * .8, '#ffbd39', .45 * strength);
  const volume = renderFireVolume(time, motion, seed);
  if (volume) {
    c.globalAlpha = strength;
    c.drawImage(volume, -radius * 1.4, -radius * 2.55, radius * 2.8, radius * 3.2);
  }
  const count = enhanced ? 32 : 24;
  for (let i = 0; !volume && i < count; i++) {
    const s = i * 2.399 + seed;
    const side = Math.sin(s) * .68;
    const pulse = Math.sin(time * (2.4 + (i % 5) * .29) + s);
    const height = radius * (1.2 + .85 * (1 - Math.abs(side)) + .28 * pulse) * (1 + windY);
    const baseX = side * radius;
    const baseY = radius * (.22 + .2 * Math.cos(s) + .07 * Math.sin(time * 2.8 + s));
    const width = radius * (.15 + .12 * (1 - Math.abs(side)));
    const lean = windX * height * .85;
    const curl = Math.sin(time * 3.2 + s) * radius * .22;
    const tipX = baseX + lean + curl;
    const tipY = baseY - height;
    const gradient = c.createLinearGradient(baseX, baseY, tipX, tipY);
    gradient.addColorStop(0, i % 7 === 0 ? '#fff0a6' : '#ff981b');
    gradient.addColorStop(.28, '#ffae24b8');
    gradient.addColorStop(.6, '#ff5a148c');
    gradient.addColorStop(.88, '#f4310b36');
    gradient.addColorStop(1, '#ed240000');
    c.globalAlpha = (.3 + .13 * Math.sin(s)) * strength;
    c.fillStyle = gradient;
    c.beginPath(); c.moveTo(baseX - width, baseY);
    c.bezierCurveTo(baseX - width * 1.5 + lean * .15, baseY - height * .35, tipX - curl - width * .55, tipY + height * .26, tipX, tipY);
    c.bezierCurveTo(tipX + curl * .8 + width * .24, tipY + height * .3, baseX + width + lean * .35, baseY - height * .32, baseX + width, baseY);
    c.bezierCurveTo(baseX + width * .3, baseY + width * .4, baseX - width * .5, baseY + width * .35, baseX - width, baseY);
    c.fill();
  }
  // Smaller curling hot filaments give the plumes moving surface detail.
  for (let i = 0; i < (volume ? 8 : 20); i++) {
    const life = fract(time * (.28 + (i % 4) * .035) + i * .618 + seed);
    const fade = Math.pow(Math.sin(life * Math.PI), 1.5);
    const x = Math.sin(i * 4.13) * radius * .6 + windX * radius * life * 1.8;
    const y = radius * .38 - life * radius * 2.35;
    c.globalAlpha = fade * .2 * strength;
    c.strokeStyle = i % 3 === 0 ? '#fff2a7' : '#ff9c32';
    c.lineWidth = radius * (.009 + (1 - life) * .01); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y);
    c.bezierCurveTo(x + radius * .16, y - radius * .12, x - radius * .14, y - radius * .22, x + Math.sin(time * 3 + i) * radius * .14, y - radius * .35);
    c.stroke();
  }
  for (let i = 0; i < (enhanced ? 64 : 40); i++) {
    const life = fract(time * (.22 + (i % 7) * .018) + i * .618);
    const x = Math.sin(i * 3.7) * radius * (.55 + life * .4) + windX * radius * life * 2.6 + Math.sin(time * 2 + i) * radius * .08;
    const y = radius * .35 - life * radius * (2.4 + (i % 3) * .3);
    c.globalAlpha = Math.sin(life * Math.PI) * (.45 + .4 * (i % 2)) * strength;
    c.fillStyle = i % 3 ? '#ffb354' : '#fff3cb';
    c.beginPath(); c.ellipse(x, y, radius * .009, radius * (.018 + life * .022), windX * .5, 0, TAU); c.fill();
  }
  c.restore();
}

function waterPoint(angle, band, radius, time, motion) {
  const ripple = 1 + .055 * Math.sin(angle * 5 - time * 3.1 + band * 2) + .03 * Math.sin(angle * 9 + time * 1.7);
  const depth = Math.sin(angle);
  const r = radius * (.37 + band * .068) * ripple;
  return {
    x: Math.cos(angle) * r - motion.x * .00011 * radius * (1 - depth),
    y: Math.sin(angle) * r * (.72 + .06 * Math.sin(time * .55)) - motion.y * .0001 * radius * (1 - depth),
    depth,
  };
}

function droplet(c, x, y, size, angle, alpha) {
  c.save(); c.translate(x, y); c.rotate(angle); c.globalAlpha = alpha;
  const g = c.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, '#f0ffff'); g.addColorStop(.25, '#a6efffcc'); g.addColorStop(.6, '#238fdf99'); g.addColorStop(1, '#07528550');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, size * .72, size * 1.35, 0, 0, TAU); c.fill();
  c.fillStyle = '#eeffff'; c.globalAlpha = alpha * .8;
  c.beginPath(); c.ellipse(-size * .22, -size * .4, size * .16, size * .37, -.35, 0, TAU); c.fill();
  c.restore();
}

function water(c, radius, time, motion, strength, seed = 0, enhanced = false) {
  c.save();
  glow(c, 0, 0, radius * 1.4, '#2e9ce9', .22 * strength);
  // A translucent body under the current, with no grid or hard sphere outline.
  const body = c.createRadialGradient(-radius * .25, -radius * .22, radius * .08, 0, 0, radius);
  body.addColorStop(0, '#b9f7ff35'); body.addColorStop(.4, '#379fdd50'); body.addColorStop(.8, '#096cc338'); body.addColorStop(1, '#0e80c000');
  c.globalAlpha = strength; c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, radius * 1.05, radius * .87, -.08, 0, TAU); c.fill();
  const bands = enhanced ? 12 : 10;
  for (let band = enhanced ? -4 : 0; band < bands; band++) {
    const start = time * (.7 + band * .023) + band * .71 + seed;
    const length = TAU * (.66 + (Math.abs(band) % 3) * .1);
    const gradient = c.createLinearGradient(-radius, -radius * .5, radius, radius * .5);
    gradient.addColorStop(0, '#1775c340'); gradient.addColorStop(.3, '#4ec8f0a8'); gradient.addColorStop(.5, '#c1fbffd4'); gradient.addColorStop(.7, '#198dc2a8'); gradient.addColorStop(1, '#195cd330');
    c.strokeStyle = gradient; c.globalAlpha = strength * (.58 + .17 * Math.sin(band));
    c.lineWidth = radius * (.075 + (Math.abs(band) % 3) * .024); c.lineCap = 'round';
    c.beginPath();
    for (let j = 0; j <= 60; j++) {
      const p = waterPoint(start + j / 60 * length, band, radius, time, motion);
      if (!j) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    }
    c.stroke();
    // Thin, broken specular highlights move with the fluid rather than a mesh.
    c.strokeStyle = band % 2 ? '#ceffff' : '#83def6'; c.lineWidth = radius * .012; c.globalAlpha = strength * .65;
    c.beginPath();
    for (let j = 0; j <= 28; j++) {
      const p = waterPoint(start + .22 + j / 28 * length * .4, band, radius, time, motion);
      if (!j) c.moveTo(p.x, p.y - radius * .022); else c.lineTo(p.x, p.y - radius * .022);
    }
    c.stroke();
  }
  // Continuous droplets orbit through depth, then curl into the moving wake.
  for (let i = 0; i < (enhanced ? 38 : 24); i++) {
    const a = time * (.62 + (i % 4) * .07) + i * 2.399 + seed;
    const life = fract(time * .19 + i * .618);
    const r = radius * (1.01 + .4 * life);
    const x = Math.cos(a) * r - motion.x * .0003 * radius * life;
    const y = Math.sin(a) * r * .74 - motion.y * .0003 * radius * life;
    droplet(c, x, y, radius * (.019 + .012 * (1 + Math.sin(a))), a + Math.PI / 2, Math.sin(life * Math.PI) * strength * .75);
  }
  c.restore();
}

function wake(c, geometry, time, strength) {
  const motion = geometry.motion || { x: 0, y: 0 };
  const speed = Math.hypot(motion.x, motion.y);
  if (speed < 35) return;
  c.save();
  for (let i = 5; i >= 1; i--) {
    const delay = i * .045;
    c.save(); c.translate(-motion.x * delay, -motion.y * delay);
    const radius = geometry.radius * (1 - i * .105);
    const fade = clamp(speed / 500, 0, 1) * (1 - i / 6) * .22 * strength;
    if (geometry.kind === 'fire') {
      glow(c, 0, 0, radius * .9, '#ff7115', fade);
      c.globalAlpha = fade; c.strokeStyle = '#ffcb67'; c.lineWidth = radius * .12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, radius * .15);
      c.bezierCurveTo(radius * .2, -radius * .2, -motion.x * .04, -radius * .65, -motion.x * .07 + Math.sin(time * 4 - i) * radius * .1, -radius);
      c.stroke();
    } else {
      glow(c, 0, 0, radius, '#4dd7ef', fade);
      c.globalAlpha = fade; c.strokeStyle = '#b0f5ff'; c.lineWidth = radius * .1;
      c.beginPath(); c.ellipse(0, 0, radius * .8, radius * .55, -.15, time - delay, time - delay + Math.PI * 1.4); c.stroke();
      droplet(c, Math.sin(time * 2 + i) * radius, Math.cos(time * 2 + i) * radius * .5, radius * .04, time, fade * 2);
    }
    c.restore();
  }
  c.restore();
}

export function drawElement(c, source, geometry, strength, time) {
  const { center, radius, enhanced = false } = geometry;
  const kind = geometry.kind || geometry.element;
  const motion = geometry.motion || { x: 0, y: 0 };
  const seed = geometry.slot === 'right' ? 1.7 : .3;
  c.save(); c.translate(center.x, center.y);
  wake(c, { ...geometry, kind }, time, strength);
  if (kind === 'fire') fire(c, radius, time, motion, strength, seed, enhanced);
  else if (kind === 'water') water(c, radius, time, motion, strength, seed, enhanced);
  else {
    water(c, radius, time, motion, strength * .9, seed, true);
    c.save(); c.translate(Math.sin(time * 1.2) * radius * .1, radius * .12);
    fire(c, radius * .63, time, motion, strength * .88, seed, true); c.restore();
    for (let i = 0; i < 10; i++) {
      const life = fract(time * .13 + i * .618);
      glow(c, Math.sin(i * 4 + time * .5) * radius * .65 - motion.x * life * .12, -radius * (.2 + life * 1.6), radius * (.12 + life * .3), '#daf4ff', Math.sin(life * Math.PI) * .13 * strength);
    }
  }
  c.restore();
}

function burst(c, geometry, strength) {
  const { center, radius, kind, age } = geometry;
  if (age > 1.8) return;
  const p = clamp(age / 1.8, 0, 1);
  const fade = Math.sin(Math.PI * p) * strength;
  c.save(); c.translate(center.x, center.y);
  for (let i = 0; i < 48; i++) {
    const a = i * 2.399;
    const distance = radius * (.65 + p * (1.4 + (i % 5) * .1));
    const x = Math.cos(a) * distance, y = Math.sin(a) * distance * .8 + p * p * radius * .5;
    if (kind === 'water' || (kind === 'hybrid' && i % 2)) droplet(c, x, y, radius * .035 * (1 - p), a, fade * .8);
    else {
      c.globalCompositeOperation = 'screen'; c.globalAlpha = fade * .7;
      c.strokeStyle = i % 3 ? '#ff7c22' : '#ffeb9d'; c.lineWidth = radius * .026 * (1 - p); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - Math.cos(a) * radius * .16, y - Math.sin(a) * radius * .16, x - Math.cos(a) * radius * .3, y - Math.sin(a) * radius * .3); c.stroke();
    }
  }
  c.restore();
}

export function drawElementalScene(c, source, fusion, strength, time, includeUI = true, reducedMotion = false) {
  const power = .62 + strength * .38;
  if (fusion.fused) {
    const geometry = { ...fusion.fused, enhanced: true };
    drawElement(c, source, geometry, power, time);
    if (!reducedMotion) burst(c, geometry, power);
    return;
  }
  if (fusion.phase === 'mixing' && fusion.orbs.length === 2) {
    const p = smooth(0, 1, fusion.progress);
    const finish = smooth(.64, 1, fusion.progress);
    const center = fusion.center;
    const spin = reducedMotion ? 0 : time * 1.6;
    for (const [i, orb] of fusion.orbs.entries()) {
      const a = spin + i * Math.PI;
      const distance = (1 - p) * 55;
      const target = { x: center.x + Math.cos(a) * distance, y: center.y + Math.sin(a) * distance * .6 };
      const position = { x: orb.center.x + (target.x - orb.center.x) * p, y: orb.center.y + (target.y - orb.center.y) * p };
      c.save(); c.globalAlpha = 1 - finish;
      // Use strength for the fade because individual plume layers set alpha.
      drawElement(c, source, { ...orb, center: position, radius: orb.radius * (1 - p * .14) }, power * (1 - finish), time);
      c.restore();
    }
    if (finish > 0) {
      const kind = fusion.orbs[0].element === fusion.orbs[1].element ? fusion.orbs[0].element : 'hybrid';
      drawElement(c, source, { center, radius: fusion.orbs.reduce((sum, orb) => sum + orb.radius, 0) * 1.12, kind, enhanced: true }, power * finish, time);
    }
    return;
  }
  for (const orb of fusion.orbs) {
    drawElement(c, source, orb, power, time);
    if (includeUI) {
      c.save(); c.font = '13px DM Sans'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.shadowColor = '#142032'; c.shadowBlur = 4;
      c.fillText(`${orb.slot.toUpperCase()} · ${orb.element.toUpperCase()}`, orb.center.x, orb.center.y + orb.radius * 1.2 + 22);
      c.restore();
    }
  }
}
