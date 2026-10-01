import test from 'node:test';
import assert from 'node:assert/strict';
import { createElementFusion } from './element-fusion.js';
import { createHandSlots } from './hand-slots.js';

function hand(x, slot, handedness) {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: .5 }));
  landmarks[0] = { x, y: .7 };
  landmarks[5] = { x: x - .04, y: .56 };
  landmarks[17] = { x: x + .04, y: .56 };
  return { slot, handedness, landmarks, fist: false };
}
const close = () => [hand(.44, 'left'), hand(.56, 'right')];
const apart = () => [hand(.2, 'left'), hand(.8, 'right')];
const mixed = { left: 'fire', right: 'water' };
function hold(controller, elements, start, end) {
  let state;
  for (let now = start; now <= end; now += 50) state = controller.update(close(), elements, now);
  return state;
}

test('each separated hand carries its own chosen element', () => {
  const state = createElementFusion().update(apart(), mixed, 0);
  assert.equal(state.phase, 'idle');
  assert.deepEqual(state.orbs.map(orb => [orb.slot, orb.element]), [['left', 'fire'], ['right', 'water']]);
  assert.ok(state.orbs[0].center.x < state.orbs[1].center.x);
});

for (const [elements, kind] of [[mixed, 'hybrid'], [{ left: 'water', right: 'water' }, 'water'], [{ left: 'fire', right: 'fire' }, 'fire']]) {
  test(`five seconds of contact forges the ${kind} recipe exactly once`, () => {
    const controller = createElementFusion();
    assert.equal(hold(controller, elements, 0, 4950).phase, 'mixing');
    const fused = controller.update(close(), elements, 5000);
    assert.equal(fused.phase, 'fused'); assert.equal(fused.fused.kind, kind);
    assert.ok(fused.fused.radius > fused.orbs[0].radius * 1.6);
    assert.equal(controller.update(close(), elements, 6000).fused.age, 1);
  });
}

test('loss of contact, tracker gaps, or a changed recipe cannot complete an old hold', () => {
  const controller = createElementFusion();
  hold(controller, mixed, 0, 2500);
  controller.update(apart(), mixed, 2550);
  assert.equal(controller.update(apart(), mixed, 2900).phase, 'idle');
  hold(controller, mixed, 2950, 4950);
  assert.equal(controller.update(close(), mixed, 6000).progress, 0);
  hold(controller, mixed, 6050, 8050);
  const changed = controller.update(close(), { left: 'fire', right: 'fire' }, 8100);
  assert.equal(changed.progress, 0);
  controller.update([], mixed, 8150);
  assert.equal(controller.update([], mixed, 8500).phase, 'idle');
});

test('a short tracking interruption pauses the timer and separating splits the result', () => {
  const controller = createElementFusion();
  const before = hold(controller, mixed, 0, 2000).progress;
  controller.update([], mixed, 2050);
  assert.equal(controller.update(close(), mixed, 2150).progress, before);
  hold(controller, mixed, 2200, 5300);
  assert.equal(controller.state.phase, 'fused');
  controller.update(apart(), mixed, 5350);
  assert.equal(controller.update(apart(), mixed, 6000).phase, 'idle');
});

test('hand identity survives crossing, detector order changes, and one hand disappearing', () => {
  const slots = createHandSlots();
  slots.assign([hand(.2, null, 'Left'), hand(.8, null, 'Right')], 0);
  const crossed = slots.assign([hand(.3, null, 'Right'), hand(.7, null, 'Left')], 100);
  assert.equal(crossed[0].slot, 'right'); assert.equal(crossed[1].slot, 'left');
  assert.equal(slots.assign([hand(.69, null, 'Left')], 200)[0].slot, 'left');
  assert.equal(slots.assign([hand(.68, null, 'Left'), hand(.31, null, 'Right')], 300)[1].slot, 'right');
});

test('manual splitting requires hands to separate before a new forge starts', () => {
  const controller = createElementFusion();
  hold(controller, mixed, 0, 5000); controller.reset(true);
  assert.equal(hold(controller, mixed, 5050, 11050).phase, 'idle');
  controller.update(apart(), mixed, 11100);
  assert.equal(hold(controller, mixed, 11150, 16150).phase, 'fused');
});

test('closed fists cannot start fusion while the dimension gesture is held', () => {
  const controller = createElementFusion();
  const fists = close().map(hand => ({ ...hand, fist: true }));
  for (let now = 0; now <= 6000; now += 50) controller.update(fists, mixed, now);
  assert.equal(controller.state.phase, 'idle');
});


test('overlapping hand dropouts retain both mixing effects and pause the hold', () => {
  const controller = createElementFusion();
  const before = hold(controller, mixed, 0, 2000);
  const missing = controller.update([close()[0]], mixed, 2050);
  assert.equal(missing.phase, 'mixing');
  assert.equal(missing.progress, before.progress);
  assert.deepEqual(missing.orbs, before.orbs);
  assert.deepEqual(missing.center, before.center);
  assert.equal(controller.update(close().reverse(), mixed, 2150).progress, before.progress);
  assert.deepEqual(controller.state.orbs.map(orb => orb.slot), ['left', 'right']);
});

test('repeated forging holds its shape through missing hands and pose jitter', () => {
  const controller = createElementFusion();
  for (let cycle = 0; cycle < 4; cycle++) {
    const start = cycle * 8000;
    const forged = hold(controller, mixed, start, start + 5000);
    assert.equal(forged.phase, 'fused');
    for (const [offset, hands] of [[50, [close()[1]]], [200, []], [300, close().map(h => ({ ...h, fist: true }))]]) {
      const state = controller.update(hands, mixed, start + 5000 + offset);
      assert.equal(state.phase, 'fused');
      assert.deepEqual(state.fused.center, forged.fused.center);
      if (offset < 300) assert.equal(state.fused.radius, forged.fused.radius);
      else assert.ok(state.fused.radius > forged.fused.radius * .75);
    }
    controller.update(apart(), mixed, start + 5400);
    assert.equal(controller.update(apart(), mixed, start + 6500).phase, 'idle');
  }
});
