import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHand, createGestureController } from './gestures.js';

test('thumb-to-pinky pinch changes the filter once until released', () => {
  const controller = createGestureController();
  const pinch = [{ fist: false, thumbPinkyPinch: true }];
  assert.equal(controller.update(pinch, 1000).nextFilter, false);
  assert.equal(controller.update(pinch, 1090).nextFilter, true);
  assert.equal(controller.update(pinch, 1400).nextFilter, false);
  const released = [{ fist: false, thumbPinkyPinch: false, thumbPinkyReleased: true }];
  controller.update(released, 1500);
  controller.update(released, 1680);
  assert.equal(controller.update(pinch, 1800).nextFilter, false);
  assert.equal(controller.update(pinch, 1890).nextFilter, true);
});

test('two fists switch mode once and suppress an accidental filter change', () => {
  const controller = createGestureController();
  const fists = [{ fist: true, thumbPinkyPinch: true }, { fist: true, thumbPinkyPinch: true }];
  assert.deepEqual(controller.update(fists, 1000), { nextFilter: false, toggleMode: true, dualFist: true, filterPinch: false });
  assert.equal(controller.update(fists, 2000).toggleMode, false);
  controller.update([], 2100);
  controller.update([], 2350);
  assert.equal(controller.update(fists, 2400).toggleMode, true);
});

test('closed fingers and thumb-pinky pinch are distinguished by landmarks', () => {
  const open = Array.from({ length: 21 }, () => ({ x: .5, y: .6 }));
  open[0] = { x: .5, y: .9 };
  open[5] = { x: .43, y: .65 }; open[9] = { x: .5, y: .63 }; open[17] = { x: .58, y: .66 };
  for (const [tip, joint, x] of [[8, 6, .43], [12, 10, .5], [16, 14, .56], [20, 18, .62]]) {
    open[joint] = { x, y: .48 };
    open[tip] = { x, y: .25 };
  }
  open[4] = { x: .32, y: .44 };
  assert.equal(analyzeHand(open).fist, false);
  assert.equal(analyzeHand(open).thumbPinkyPinch, false);
  const pinch = open.map(p => ({ ...p }));
  pinch[4] = { x: .62, y: .25 };
  assert.equal(analyzeHand(pinch).thumbPinkyPinch, true);
  const closed = open.map(p => ({ ...p }));
  for (const [tip, joint, x] of [[8, 6, .43], [12, 10, .5], [16, 14, .56], [20, 18, .62]]) {
    closed[joint] = { x, y: .6 };
    closed[tip] = { x, y: .73 };
  }
  closed[4] = { x: .62, y: .73 };
  assert.equal(analyzeHand(closed).fist, true);
  assert.equal(analyzeHand(closed).thumbPinkyPinch, false);
});

function openPalm() {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .6, z: 0 }));
  points[0] = { x: .5, y: .9, z: 0 };
  points[5] = { x: .43, y: .65, z: 0 };
  points[9] = { x: .5, y: .63, z: 0 };
  points[17] = { x: .58, y: .66, z: 0 };
  for (const [tip, joint, x] of [[8, 6, .43], [12, 10, .5], [16, 14, .56], [20, 18, .62]]) {
    points[joint] = { x, y: .48, z: 0 };
    points[tip] = { x, y: .25, z: 0 };
  }
  points[4] = { x: .32, y: .44, z: 0 };
  return points;
}
const worldFrom = points => points.map(p => ({ x: (p.x - .5) * 1280 * .0004, y: (p.y - .9) * 800 * .0004, z: p.z * 1280 * .0004 }));
function rotateInImage(points, angle, scale = 1) {
  return points.map(p => {
    const x = (p.x - .5) * 1280 * scale, y = (p.y - .9) * 800 * scale;
    return { x: .5 + (x * Math.cos(angle) - y * Math.sin(angle)) / 1280, y: .9 + (x * Math.sin(angle) + y * Math.cos(angle)) / 800, z: p.z * scale };
  });
}

test('sideways clapping overlap is rejected even when projected fingertips touch', () => {
  const open = openPalm();
  for (const angle of [75, 85, 89]) {
    const yaw = angle * Math.PI / 180;
    const sideways = open.map(p => ({ ...p, x: .5 + (p.x - .5) * Math.cos(yaw), z: (p.x - .5) * Math.sin(yaw) }));
    // Force the precise 2D overlap reported by the user.
    sideways[4] = { ...sideways[4], x: sideways[20].x, y: sideways[20].y };
    assert.equal(analyzeHand(sideways, worldFrom(sideways)).thumbPinkyPinch, false);
    assert.equal(analyzeHand(sideways, worldFrom(sideways)).thumbPinkyReleased, false);
    const withoutDepth = sideways.map(({ x, y }) => ({ x, y }));
    assert.equal(analyzeHand(withoutDepth).thumbPinkyPinch, false);
  }
});

test('3D depth rejects apparent contact on an otherwise visible palm', () => {
  const points = openPalm(); points[4] = { ...points[20], z: .09 };
  assert.equal(analyzeHand(points, worldFrom(points)).thumbPinkyPinch, false);
  assert.equal(analyzeHand(points).thumbPinkyPinch, false);
  points[4] = { ...points[20], z: .004 };
  assert.equal(analyzeHand(points, worldFrom(points)).thumbPinkyPinch, true);
});

test('intentional contact still works across hand sizes, image rotations, and moderate tilt', () => {
  const points = openPalm(); points[4] = { ...points[20], x: points[20].x - .008, z: .004 };
  for (const scale of [.35, 1, 1.6]) {
    for (const angle of [0, Math.PI / 2, Math.PI]) {
      const rotated = rotateInImage(points, angle, scale);
      assert.equal(analyzeHand(rotated, worldFrom(rotated)).thumbPinkyPinch, true);
    }
  }
  const yaw = Math.PI / 4;
  const tilted = points.map(p => ({ ...p, x: .5 + (p.x - .5) * Math.cos(yaw), z: (p.x - .5) * Math.sin(yaw) + p.z }));
  assert.equal(analyzeHand(tilted, worldFrom(tilted)).thumbPinkyPinch, true);
});

test('brief overlap and gaps between detections cannot confirm a tap', () => {
  const controller = createGestureController();
  const pinch = [{ slot: 'left', fist: false, thumbPinkyPinch: true }];
  assert.equal(controller.update(pinch, 0).nextFilter, false);
  assert.equal(controller.update(pinch, 50).nextFilter, false);
  assert.equal(controller.update([], 70).nextFilter, false);
  assert.equal(controller.update(pinch, 100).nextFilter, false);
  assert.equal(controller.update(pinch, 500).nextFilter, false);
  assert.equal(controller.update(pinch, 550).nextFilter, false);
  assert.equal(controller.update(pinch, 590).nextFilter, true);
});

test('sideways poses and lost tracking cannot rearm an already held pinch', () => {
  const controller = createGestureController();
  const pinch = [{ fist: false, thumbPinkyPinch: true, thumbPinkyReleased: false }];
  controller.update(pinch, 0);
  assert.equal(controller.update(pinch, 90).nextFilter, true);
  const edge = [{ fist: false, thumbPinkyPinch: false, thumbPinkyReleased: false }];
  for (let now = 150; now <= 700; now += 50) controller.update(edge, now);
  controller.update(pinch, 750);
  assert.equal(controller.update(pinch, 850).nextFilter, false);
  for (let now = 900; now <= 1300; now += 50) controller.update([], now);
  controller.update(pinch, 1350);
  assert.equal(controller.update(pinch, 1450).nextFilter, false);
  const open = [{ fist: false, thumbPinkyPinch: false, thumbPinkyReleased: true }];
  controller.update(open, 1500); controller.update(open, 1680);
  controller.update(pinch, 1700);
  assert.equal(controller.update(pinch, 1790).nextFilter, true);
});

test('alternating hands cannot add their noisy contact frames into one confirmed tap', () => {
  const controller = createGestureController();
  const pinch = slot => [{ slot, fist: false, thumbPinkyPinch: true }];
  controller.update(pinch('left'), 0);
  assert.equal(controller.update(pinch('right'), 60).nextFilter, false);
  assert.equal(controller.update(pinch('left'), 120).nextFilter, false);
  assert.equal(controller.update(pinch('left'), 210).nextFilter, true);
});
