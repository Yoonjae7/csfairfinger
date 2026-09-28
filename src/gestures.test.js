import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHand, createGestureController } from './gestures.js';

test('thumb-to-pinky pinch changes the filter once until released', () => {
  const controller = createGestureController();
  const pinch = [{ fist: false, thumbPinkyPinch: true }];
  assert.equal(controller.update(pinch, 1000).nextFilter, true);
  assert.equal(controller.update(pinch, 1400).nextFilter, false);
  controller.update([], 1500);
  controller.update([], 1700);
  assert.equal(controller.update(pinch, 1800).nextFilter, true);
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
