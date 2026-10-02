import { CAGE_EDGES, CAGE_FACES, CAGE_VERTICES, powerFromHands, projectPowerPoint } from './power-geometry.js';

const TAU = Math.PI * 2;
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

export function drawPowerScene(c, hands, width, height, look, strength, time, drawFacet) {
  const field = powerFromHands(hands, width, height, strength);
  if (!field) return;
  const colors = PALETTES[look] || PALETTES.prism;
  const amount = field.strength;
  const pixel = look === 'pixel';
  const rotation = { x: .32 + Math.sin(time * .17) * .16, y: time * .19, z: field.roll * .45 + Math.sin(time * .13) * .12 };
  const cage = CAGE_VERTICES.map(v => projectPowerPoint(v, field, rotation));
  const faces = CAGE_FACES.map((indices, i) => ({ points: indices.map(index => cage[index]), i, depth: indices.reduce((sum, index) => sum + cage[index].z, 0) / 3 })).sort((a, b) => a.depth - b.depth);

  c.save();
  c.lineJoin = pixel ? 'miter' : 'round';
  const halo = c.createRadialGradient(field.center.x, field.center.y, 0, field.center.x, field.center.y, Math.max(field.rx, field.ry) * 1.4);
  halo.addColorStop(0, colors[1] + '00'); halo.addColorStop(.52, colors[0] + '16'); halo.addColorStop(1, colors[1] + '00');
  c.fillStyle = halo; c.fillRect(0, 0, width, height);

  // Filtered camera bands retain the fingertip topology of the original mesh.
  field.facets.forEach((vertices, index) => {
    c.save(); c.globalAlpha = .35 + amount * .27; drawFacet(c, vertices, index); c.restore();
  });
  faces.forEach(face => {
    const fill = c.createLinearGradient(face.points[0].x, face.points[0].y, face.points[1].x, face.points[1].y);
    fill.addColorStop(0, colors[face.i % 3]); fill.addColorStop(1, colors[(face.i + 1) % 3]);
    c.globalAlpha = (.018 + (face.depth + 1) * .025) * (.5 + amount);
    c.fillStyle = fill; path(c, face.points); c.fill();
  });

  c.globalCompositeOperation = 'screen';
  // Three differently tilted polygon orbits make the depth visible as they turn.
  const orbits = [
    ring(field, 12, { x: .32, y: .38, z: field.roll + time * .08 }, 1.22),
    ring(field, 6, { x: 1.03, y: -.35, z: -time * .11 + field.roll }, 1.32, Math.PI / 6),
    ring(field, 6, { x: -.6, y: 1.03, z: time * .13 }, 1.26),
  ];
  orbits.forEach((points, i) => {
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
  field.anchors.polygons.forEach((vertices, band) => {
    const expanded = field.facets[band];
    wire(c, expanded, colors[band % 3], .7, 1.6, pixel ? 0 : 6);
    vertices.forEach((p, i) => {
      const q = expanded[i];
      c.strokeStyle = colors[band % 3]; c.globalAlpha = .55; c.lineWidth = 1;
      c.beginPath(); line(c, p, q); c.stroke();
      spark(c, p, 7, colors[3], .95);
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
