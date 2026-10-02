import { CAGE_EDGES, CAGE_FACES, CAGE_VERTICES, powerFromHands, projectPowerPoint } from './power-geometry.js';

const TAU = Math.PI * 2;
const CRYSTAL_VERTICES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const CRYSTAL_FACES = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
const PALETTES = {
  prism: ['#83f7ff', '#c0a0ff', '#ffb8eb', '#f4ffff'],
  thermal: ['#ffcf6a', '#ff756e', '#b690ff', '#fff4d9'],
  pixel: ['#b1ffc9', '#91d5ff', '#e8a7ff', '#f1fff0'],
  mono: ['#e6f1ff', '#a6b7d8', '#ffffff', '#ffffff'],
  rgb: ['#67ffff', '#ff6395', '#a6ffbd', '#ffffff'],
  dream: ['#efb5ff', '#b3c4ff', '#a7ffe7', '#fff3ff'],
};

function path(c, points, close = true) {
  c.beginPath(); c.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(p => c.lineTo(p.x, p.y));
  if (close) c.closePath();
}
function line(c, a, b) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function ring(field, count, rotation, scale, phase = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * TAU + phase;
    return projectPowerPoint([Math.cos(angle), Math.sin(angle), 0], field, rotation, scale);
  });
}
function wire(c, points, color, alpha, width, glow = 0) {
  c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = width;
  c.shadowColor = color; c.shadowBlur = glow;
  path(c, points); c.stroke(); c.shadowBlur = 0;
}
function spark(c, p, size, color, alpha) {
  c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(p.x - size, p.y); c.lineTo(p.x + size, p.y);
  c.moveTo(p.x, p.y - size); c.lineTo(p.x, p.y + size); c.stroke();
}

function prismFaces(c, faces, colors, time, strength, core = false) {
  faces.forEach(face => {
    const [a, b, d] = face.points;
    const front = Math.max(0, face.depth);
    const fill = c.createLinearGradient(a.x, a.y, b.x, b.y);
    fill.addColorStop(0, colors[face.i % 3]);
    fill.addColorStop(.48, '#1f2347');
    fill.addColorStop(1, colors[(face.i + 1) % 3]);
    c.globalAlpha = (.025 + (face.depth + 1) * .035) * (.5 + strength) * (core ? 1.2 : 1);
    c.fillStyle = fill; path(c, face.points); c.fill();

    const center = { x: (a.x + b.x + d.x) / 3, y: (a.y + b.y + d.y) / 3 };
    const inset = face.points.map(p => lerp(p, center, core ? .12 : .16));
    wire(c, inset, colors[(face.i + 1) % 3], front * .28, .65);

    // A reflection slides across the actual triangle, fading at the back.
    const sweep = (Math.sin(time * .7 + face.i * .63) + 1) / 2;
    const first = lerp(a, d, sweep), second = lerp(b, d, sweep);
    c.strokeStyle = colors[3]; c.globalAlpha = front * (.12 + strength * .18) * Math.sin(sweep * Math.PI);
    c.lineWidth = core ? 3 : 2; c.beginPath(); line(c, first, second); c.stroke();
  });
}

function crystal(c, field, colors, time, strength, pixel) {
  const rotation = { x: .55 - field.motion.y * .00015, y: -time * .25 + field.motion.x * .00025, z: field.roll };
  const points = CRYSTAL_VERTICES.map(v => projectPowerPoint(v, field, rotation, .47 + field.openness * .09));
  const faces = CRYSTAL_FACES.map((indices, i) => ({ points: indices.map(index => points[index]), i, depth: indices.reduce((sum, index) => sum + points[index].z, 0) / 3 })).sort((a, b) => a.depth - b.depth);
  c.save(); c.globalCompositeOperation = 'source-over';
  prismFaces(c, faces, colors, time * 1.3, strength, true);
  faces.forEach(face => wire(c, face.points, '#20233d', .13, 3.2));
  c.globalCompositeOperation = 'screen';
  faces.forEach(face => wire(c, face.points, colors[face.i % 3], .2 + (face.depth + 1) * .22, pixel ? 1.7 : 1.1));
  points.forEach(p => spark(c, p, 3.5, colors[3], .55 + (p.z + 1) * .2));
  c.restore();
}

export function drawPowerScene(c, hands, width, height, look, strength, time) {
  const field = powerFromHands(hands, width, height, strength);
  if (!field) return;
  const colors = PALETTES[look] || PALETTES.prism;
  const amount = field.strength;
  const pixel = look === 'pixel';
  const rotation = {
    x: .32 + Math.sin(time * .17) * .16 - field.motion.y * .00018,
    y: time * .19 + field.motion.x * .0003,
    z: field.roll * .7 + Math.sin(time * .13) * .12,
  };
  const cage = CAGE_VERTICES.map(v => projectPowerPoint(v, field, rotation));
  const faces = CAGE_FACES.map((indices, i) => ({ points: indices.map(index => cage[index]), i, depth: indices.reduce((sum, index) => sum + cage[index].z, 0) / 3 })).sort((a, b) => a.depth - b.depth);

  c.save();
  c.lineJoin = pixel ? 'miter' : 'round';
  const halo = c.createRadialGradient(field.center.x, field.center.y, 0, field.center.x, field.center.y, Math.max(field.rx, field.ry) * 1.4);
  halo.addColorStop(0, colors[1] + '00'); halo.addColorStop(.52, colors[0] + '16'); halo.addColorStop(1, colors[1] + '00');
  c.fillStyle = halo; c.fillRect(0, 0, width, height);

  prismFaces(c, faces, colors, time, amount);
  crystal(c, field, colors, time, amount, pixel);

  // Dark undersides preserve the shape against a brightly lit camera feed.
  c.globalCompositeOperation = 'source-over';
  c.strokeStyle = '#17192e'; c.globalAlpha = .22; c.lineWidth = 5;
  c.beginPath(); CAGE_EDGES.forEach(([a, b]) => line(c, cage[a], cage[b])); c.stroke();

  c.globalCompositeOperation = 'screen';
  // Three differently tilted polygon orbits make the depth visible as they turn.
  const orbits = [
    ring(field, 12, { x: .32, y: .38, z: field.roll + time * .08 }, 1.22),
    ring(field, 6, { x: 1.03, y: -.35, z: -time * .11 + field.roll }, 1.32, Math.PI / 6),
    ring(field, 6, { x: -.6, y: 1.03, z: time * .13 }, 1.26),
  ];
  orbits.forEach((points, i) => {
    c.save(); c.globalCompositeOperation = 'source-over';
    wire(c, points, '#20233d', .22, 4); c.restore();
    wire(c, points, colors[i], .11 + amount * .16, 7, pixel ? 0 : 18);
    wire(c, points, colors[i], .55 + amount * .3, pixel ? 2.4 : 1.6);
    const inner = points.map(p => ({ x: field.center.x + (p.x - field.center.x) * .96, y: field.center.y + (p.y - field.center.y) * .96 }));
    wire(c, inner, colors[i], .16, .7);
    points.forEach((a, edge) => {
      const b = points[(edge + 1) % points.length];
      const phase = (time * .38 + edge * .19 + i * .31) % 1;
      c.globalAlpha = .8; c.strokeStyle = colors[3]; c.lineWidth = 2.5;
      c.beginPath(); line(c, lerp(a, b, Math.max(0, phase - .12)), lerp(a, b, phase)); c.stroke();
      if (edge % 2 === 0) spark(c, a, 3.5, colors[i], .65);
    });
  });

  // Fade continuously with depth, so edges never pop as they cross the plane.
  c.beginPath(); CAGE_EDGES.forEach(([a, b]) => line(c, cage[a], cage[b]));
  c.strokeStyle = colors[0]; c.globalAlpha = .1 + amount * .17;
  c.lineWidth = 7; c.shadowBlur = pixel ? 0 : 14; c.shadowColor = colors[0]; c.stroke(); c.shadowBlur = 0;
  CAGE_EDGES.forEach(([a, b]) => {
    const depth = (cage[a].z + cage[b].z + 2) / 4;
    c.globalAlpha = .2 + depth * (.45 + amount * .35); c.lineWidth = .7 + depth * 1.2;
    c.beginPath(); line(c, cage[a], cage[b]); c.stroke();
  });
  CAGE_EDGES.forEach(([a, b], i) => {
    const phase = (time * .28 + i * .073) % 1;
    const p = lerp(cage[a], cage[b], phase);
    c.globalAlpha = .3 + Math.sin(phase * Math.PI) * .65;
    c.fillStyle = colors[i % 3];
    if (pixel) c.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    else { c.beginPath(); c.arc(p.x, p.y, 2.2, 0, TAU); c.fill(); }
  });

  // Fingertips stay attached to the field through prismatic filaments.
  const markedTips = new Set();
  field.anchors.polygons.forEach((vertices, band) => {
    const expanded = field.facets[band];
    vertices.forEach((p, i) => {
      const q = expanded[i];
      c.strokeStyle = colors[band % 3]; c.globalAlpha = .55; c.lineWidth = 1;
      c.beginPath(); line(c, p, q); c.stroke();
      const key = `${p.x}:${p.y}`;
      if (!markedTips.has(key)) {
        markedTips.add(key);
        const radius = 7 + field.openness * 4;
        const cuff = Array.from({ length: 5 }, (_, j) => {
          const angle = j / 5 * TAU + field.roll + time * .2;
          return { x: p.x + Math.cos(angle) * radius, y: p.y + Math.sin(angle) * radius };
        });
        wire(c, cuff, colors[band % 3], .6, 1);
        spark(c, p, 5, colors[3], .95);
      }
    });
  });
  cage.forEach((p, i) => {
    const depth = (p.z + 1) / 2;
    spark(c, p, 3 + depth * 3, colors[i % 3], .3 + depth * .65);
    c.globalAlpha = depth * .5; c.strokeStyle = colors[3]; c.lineWidth = 1;
    path(c, [{ x: p.x, y: p.y - 8 }, { x: p.x + 8, y: p.y }, { x: p.x, y: p.y + 8 }, { x: p.x - 8, y: p.y }]); c.stroke();
  });

  // Small, genuinely projected tetrahedra circulate outside the main cage.
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * TAU + time * (i % 2 ? .10 : -.07);
    const orbit = projectPowerPoint([Math.cos(angle), Math.sin(angle), Math.sin(angle * 2) * .28], field, { x: .18, z: field.roll }, 1.35);
    const shardField = { ...field, center: orbit, rx: 9 + i % 3 * 4, ry: 14 + i % 3 * 5 };
    const shard = [[0, -1, 0], [-.8, .6, -.4], [.8, .6, -.4], [0, .45, .8]].map(v => projectPowerPoint(v, shardField, { y: time * .7 + i, z: angle }));
    c.globalAlpha = .045; c.fillStyle = colors[i % 3]; path(c, shard.slice(0, 3)); c.fill();
    c.strokeStyle = colors[i % 3]; c.globalAlpha = .65; c.lineWidth = 1;
    c.beginPath(); for (const [a, b] of [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) line(c, shard[a], shard[b]); c.stroke();
    // Motion stretches the light trail in the opposite direction to the hands.
    const trail = { x: orbit.x - Math.cos(angle) * 20 - field.motion.x * .035, y: orbit.y - Math.sin(angle) * 20 - field.motion.y * .035 };
    c.globalAlpha = .2; c.beginPath(); line(c, orbit, trail); c.stroke();
  }
  c.restore();
}
