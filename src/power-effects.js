import { SHAPES, projectVertex, rotateVertex } from './power-geometry.js';

const TAU = Math.PI * 2;
const PALETTES = {
  prism: ['#69d8fa', '#a997fc', '#f4b2db', '#b8f4de', '#8cbcf8'],
  thermal: ['#ffcb70', '#ff9678', '#e981b5', '#c5a0fe', '#ffd6a0'],
  pixel: ['#a6f3c4', '#7cdde4', '#e1a6ed', '#b7beff', '#e1f69d'],
  mono: ['#dde7f2', '#b7c9de', '#f4f3f5', '#d4d9e2', '#b3c8d2'],
  rgb: ['#71e5ee', '#fa7eab', '#9eeeae', '#ad9fff', '#f2c18a'],
  dream: ['#ebb9f2', '#b2c6fa', '#b9f0df', '#d6bffc', '#c0e8f7'],
};
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const blend = (a, b, t) => `rgb(${a.map((value, i) => Math.round(value + (b[i] - value) * t)).join(',')})`;

function path(c, points) {
  c.beginPath(); c.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(p => c.lineTo(p.x, p.y)); c.closePath();
}

function drawTrail(c, trail, color, opacity, launched, pixel) {
  if (trail.length < 2 || opacity <= 0) return;
  c.save(); c.lineCap = pixel ? 'square' : 'round';
  // Short curves make the orbital movement legible without full wire circles.
  for (let i = 1; i < trail.length; i++) {
    const alpha = i / trail.length;
    c.strokeStyle = color; c.globalAlpha = opacity * alpha * (launched ? .56 : .3);
    c.lineWidth = (launched ? 6 : 3) * alpha;
    c.beginPath(); c.moveTo(trail[i - 1].x, trail[i - 1].y); c.lineTo(trail[i].x, trail[i].y); c.stroke();
  }
  if (launched) {
    c.strokeStyle = '#f6ffff'; c.globalAlpha = opacity * .65; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(trail[0].x, trail[0].y); trail.slice(1).forEach(p => c.lineTo(p.x, p.y)); c.stroke();
  }
  c.restore();
}

function drawShape(c, object, color, strength, pixel) {
  if (object.opacity <= 0) return;
  const mesh = SHAPES[object.kind];
  const world = mesh.vertices.map(v => rotateVertex(v, object.rotation));
  const points = mesh.vertices.map(v => projectVertex(v, object.center, object.size, object.rotation));
  const faces = mesh.faces.map((indices, index) => {
    const [a, b, d] = indices.map(i => world[i]);
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, v = { x: d.x - a.x, y: d.y - a.y, z: d.z - a.z };
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const center = indices.reduce((sum, i) => ({ x: sum.x + world[i].x / indices.length, y: sum.y + world[i].y / indices.length, z: sum.z + world[i].z / indices.length }), { x: 0, y: 0, z: 0 });
    const flip = normal.x * center.x + normal.y * center.y + normal.z * center.z < 0 ? -1 : 1;
    const length = Math.hypot(normal.x, normal.y, normal.z);
    const light = (-normal.x * .35 - normal.y * .65 + normal.z * .6) / length * flip;
    return { points: indices.map(i => points[i]), index, depth: center.z, light };
  }).sort((a, b) => a.depth - b.depth);
  const base = rgb(color);
  c.save();
  const halo = c.createRadialGradient(object.center.x, object.center.y, 0, object.center.x, object.center.y, object.size * 2.1);
  halo.addColorStop(0, color + '39'); halo.addColorStop(1, color + '00');
  c.globalAlpha = object.opacity * (.45 + strength * .3); c.fillStyle = halo;
  c.fillRect(object.center.x - object.size * 2.1, object.center.y - object.size * 2.1, object.size * 4.2, object.size * 4.2);
  c.lineJoin = 'round';
  faces.forEach(face => {
    const illumination = Math.max(0, face.light);
    const dark = blend([28, 38, 64], base, .35 + illumination * .45);
    const bright = blend(base, [255, 255, 255], .16 + illumination * .5);
    const fill = c.createLinearGradient(face.points[0].x, face.points[0].y, face.points[2].x, face.points[2].y);
    fill.addColorStop(0, bright); fill.addColorStop(1, dark);
    c.globalAlpha = object.opacity * .9; c.fillStyle = fill; path(c, face.points); c.fill();
    c.strokeStyle = '#17263b'; c.globalAlpha = object.opacity * .38; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = blend(base, [255, 255, 255], .65); c.globalAlpha = object.opacity * (.24 + illumination * .54); c.lineWidth = pixel ? 1.4 : .8; c.stroke();
  });
  // One small reflection, confined to the front face, gives the solid a glass edge.
  const front = faces[faces.length - 1].points;
  c.strokeStyle = '#f4ffff'; c.globalAlpha = object.opacity * .8; c.lineWidth = 1.3;
  c.beginPath(); c.moveTo(front[0].x, front[0].y); c.lineTo(front[1].x, front[1].y); c.stroke();
  c.restore();
}

export function drawPowerScene(c, motion, look, strength) {
  if (!motion) return;
  const colors = PALETTES[look] || PALETTES.prism;
  const pixel = look === 'pixel';
  c.save();
  motion.orbs.forEach(orb => drawTrail(c, orb.trail, colors[orb.finger], orb.opacity, false, pixel));
  motion.shots.forEach(shot => drawTrail(c, shot.trail, colors[shot.finger], shot.opacity, true, pixel));
  [...motion.orbs, ...motion.shots].sort((a, b) => a.center.z - b.center.z).forEach(object => drawShape(c, object, colors[object.finger], strength, pixel));
  motion.tips.forEach(p => {
    c.globalAlpha = .7; c.fillStyle = '#f3ffff'; c.strokeStyle = '#324765'; c.lineWidth = 1;
    c.beginPath(); c.arc(p.x, p.y, 3, 0, TAU); c.fill(); c.stroke();
  });
  motion.flashes.forEach(flash => {
    c.globalAlpha = flash.opacity * .7; c.strokeStyle = colors[flash.finger]; c.lineWidth = 1.6;
    c.beginPath(); c.arc(flash.position.x, flash.position.y, flash.radius, 0, TAU); c.stroke();
  });
  c.restore();
}
