import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFromHands } from './portal-geometry.js';
import { FINGERTIPS, SHAPES, fingerSources, orbitPose, projectVertex } from './power-geometry.js';

function hand(x, slot = 'left') {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: .58 }));
  landmarks[0] = { x, y: .74 }; landmarks[5] = { x: x - .035, y: .57 }; landmarks[9] = { x, y: .56 }; landmarks[17] = { x: x + .035, y: .58 };
  FINGERTIPS.forEach((index, i) => { landmarks[index] = { x: x + (i - 2) * .038, y: .32 + Math.abs(i - 2) * .085 }; });
  return { landmarks, slot };
}

test('each finger uses the exact original mesh tip and keeps its hand identity', () => {
  const hands = [hand(.27), hand(.73, 'right')];
  const sources = fingerSources(hands, 1280, 800);
  const anchors = portalFromHands(hands, '3d', 1280, 800).polygons.flat();
  assert.equal(sources.length, 10);
  sources.forEach(source => assert.ok(anchors.some(p => p.x === source.position.x && p.y === source.position.y)));
  assert.deepEqual(fingerSources([...hands].reverse(), 1280, 800).sort((a, b) => a.id.localeCompare(b.id)), [...sources].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(fingerSources([], 1280, 800), []);
});

test('orbits are local to their fingertip, move continuously in a circle, and respond to strength', () => {
  const source = fingerSources([hand(.5)], 1280, 800)[1];
  const a = orbitPose(source, 0, .72), opposite = orbitPose(source, Math.PI, .72);
  assert.ok(a.x > source.position.x && opposite.x < source.position.x);
  const next = orbitPose(source, .01, .72);
  assert.ok(Math.hypot(next.x - a.x, next.y - a.y) < 2);
  const loud = orbitPose(source, 0, 1), soft = orbitPose(source, 0, .2);
  assert.ok(Math.hypot(loud.x - source.position.x, loud.y - source.position.y) > Math.hypot(soft.x - source.position.x, soft.y - source.position.y));
  assert.ok(orbitPose(source, Math.PI / 2, .72).z > 0 && orbitPose(source, Math.PI * 1.5, .72).z < 0);
});

test('all floating shapes are closed 3D solids with finite perspective projection', () => {
  for (const mesh of Object.values(SHAPES)) {
    const edges = mesh.faces.flatMap(face => face.map((a, i) => [a, face[(i + 1) % face.length]].sort((x, y) => x - y).join(':')));
    for (const edge of new Set(edges)) assert.equal(edges.filter(value => value === edge).length, 2);
    for (const time of [0, 3600, 86400]) {
      const points = mesh.vertices.map(v => projectVertex(v, { x: 640, y: 400 }, 26, { x: time * .35, y: time * .7, z: .3 }));
      assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)));
      assert.ok(points.some(p => p.z > 0) && points.some(p => p.z < 0));
    }
  }
});
