import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFromHands } from './portal-geometry.js';
import { CAGE_EDGES, CAGE_FACES, CAGE_VERTICES, powerFromHands, projectPowerPoint } from './power-geometry.js';

function hand(x, open = 1, y = .4) {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: y + .25 }));
  [4, 8, 12, 16, 20].forEach((index, i) => {
    landmarks[index] = { x: x + (i - 2) * .025 * open, y: y + Math.abs(i - 2) * .05 * open };
  });
  return { landmarks };
}

test('power keeps the exact original five-tip mesh anchors, including input order independence', () => {
  const hands = [hand(.28), hand(.72)];
  const original = portalFromHands(hands, '3d', 1280, 800);
  const field = powerFromHands(hands, 1280, 800);
  assert.deepEqual(field.anchors, original);
  assert.deepEqual(powerFromHands([...hands].reverse(), 1280, 800), field);
  assert.ok(field.facets[0][0].x < original.polygons[0][0].x);
  assert.ok(field.facets[0][3].x > original.polygons[0][3].x);
});

test('spreading hands and raising strength expand the field without unbounded size', () => {
  const close = powerFromHands([hand(.4), hand(.6)], 1280, 800);
  const wide = powerFromHands([hand(.2), hand(.8)], 1280, 800);
  assert.ok(wide.rx > close.rx);
  assert.ok(wide.ry > close.ry);
  assert.ok(powerFromHands([hand(.3), hand(.7)], 1280, 800, 1).rx > powerFromHands([hand(.3), hand(.7)], 1280, 800, .2).rx);
  const extreme = powerFromHands([hand(-.5, 10), hand(1.5, 10)], 1280, 800, 10);
  assert.ok(extreme.rx <= 1280 * .39);
  assert.ok(extreme.ry <= 800 * .37);
  assert.equal(extreme.strength, 1);
});

test('one hand controls a smaller field and losing all hands removes it', () => {
  assert.equal(powerFromHands([], 1280, 800), null);
  const single = powerFromHands([hand(.3)], 1280, 800);
  assert.equal(single.anchors.variant, 'single');
  assert.equal(single.facets.length, 1);
  assert.equal(single.facets[0].length, 5);
  assert.ok(single.rx < powerFromHands([hand(.3), hand(.7)], 1280, 800).rx);
  assert.ok(Math.abs(single.center.x - 1280 * .3) < 1);
});

test('the cage is a closed 3D icosahedron with finite perspective projection over long sessions', () => {
  assert.equal(CAGE_VERTICES.length, 12);
  assert.equal(CAGE_FACES.length, 20);
  assert.equal(CAGE_EDGES.length, 30);
  for (const [a, b] of CAGE_EDGES) {
    assert.equal(CAGE_FACES.filter(face => face.includes(a) && face.includes(b)).length, 2);
  }
  const field = powerFromHands([hand(.3), hand(.7)], 1280, 800);
  for (const time of [0, 10, 3600, 86400]) {
    const points = CAGE_VERTICES.map(v => projectPowerPoint(v, field, { x: .3, y: time * .19, z: .1 }));
    assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)));
    assert.ok(points.some(p => p.z > .2) && points.some(p => p.z < -.2));
    const next = projectPowerPoint(CAGE_VERTICES[0], field, { x: .3, y: (time + 1 / 60) * .19, z: .1 });
    assert.ok(Math.hypot(points[0].x - next.x, points[0].y - next.y) < 5);
  }
});
