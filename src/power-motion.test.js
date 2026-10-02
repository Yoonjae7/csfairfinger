import test from 'node:test';
import assert from 'node:assert/strict';
import { createPowerMotion } from './power-motion.js';

function hand(offset = 0, slot = 'left', extras = {}) {
  const x = .4 + offset;
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: .58 }));
  landmarks[0] = { x, y: .74 }; landmarks[5] = { x: x - .035, y: .57 }; landmarks[9] = { x, y: .56 }; landmarks[17] = { x: x + .035, y: .58 };
  [4, 8, 12, 16, 20].forEach((index, i) => { landmarks[index] = { x: x + (i - 2) * .038, y: .32 + Math.abs(i - 2) * .085 }; });
  return { landmarks, slot, ...extras };
}
function flickFinger(original, tip = 8, dx = .09, dy = -.07) {
  return { ...original, landmarks: original.landmarks.map((p, index) => index === tip ? { x: p.x + dx, y: p.y + dy } : { ...p }) };
}

test('entering a pose or slowly steering does not launch shapes', () => {
  const motion = createPowerMotion(1280, 800);
  assert.equal(motion.update([hand()], 0, 0).shots.length, 0);
  let state;
  for (let now = 40; now <= 200; now += 40) state = motion.update([hand(now * .00001)], now, now);
  assert.equal(state.shots.length, 0);
  assert.equal(state.orbs.length, 5);
});

test('a single fast fingertip launches its own geometry in the flick direction', () => {
  const motion = createPowerMotion(1280, 800), start = hand();
  motion.update([start], 0, 0);
  const state = motion.update([flickFinger(start)], 40, 40);
  assert.equal(state.shots.length, 1);
  assert.equal(state.shots[0].finger, 1);
  assert.ok(state.shots[0].vx > 0 && state.shots[0].vy < 0);
  assert.equal(state.orbs.find(orb => orb.finger === 1).opacity, 0);
  const flying = motion.update([flickFinger(start)], 40, 140);
  assert.ok(flying.shots[0].center.x > state.shots[0].center.x + 100);
  assert.equal(flying.shots.length, 1, 'repeated render frames must not relaunch the same tracking input');
});

test('fast sustained movement stays latched and a sweep launches at most three per hand', () => {
  const motion = createPowerMotion(1280, 800);
  motion.update([hand(), hand(.25, 'right')], 0, 0);
  const burst = motion.update([hand(.07), hand(.32, 'right')], 40, 40);
  assert.equal(burst.shots.length, 6);
  for (let now = 80; now <= 240; now += 40) {
    const state = motion.update([hand(now * .00175), hand(.25 + now * .00175, 'right')], now, now);
    assert.equal(state.shots.length, 6);
  }
});

test('after motion settles and the cooldown passes another flick can launch', () => {
  const motion = createPowerMotion(1280, 800), start = hand(), flicked = flickFinger(start);
  motion.update([start], 0, 0); motion.update([flicked], 40, 40);
  for (let now = 80; now <= 720; now += 40) motion.update([flicked], now, now);
  const again = motion.update([flickFinger(flicked)], 760, 760);
  assert.equal(again.shots.length, 2);
});

test('pinch and fist gestures cannot launch, including when those poses are first detected', () => {
  for (const extras of [{ thumbPinkyPinch: true }, { fist: true }]) {
    const motion = createPowerMotion(1280, 800), start = hand(0, 'left', extras);
    motion.update([start], 0, 0);
    assert.equal(motion.update([flickFinger(start)], 40, 40).shots.length, 0);
  }
});

test('missing tracking and reappearance cannot become a flick; old flights expire', () => {
  const motion = createPowerMotion(1280, 800), start = hand();
  motion.update([start], 0, 0);
  const launched = motion.update([flickFinger(start)], 40, 40);
  assert.equal(launched.shots.length, 1);
  const absent = motion.update([], 80, 80);
  assert.equal(absent.orbs.length, 0);
  assert.equal(absent.shots.length, 1, 'a launched shape completes its flight after the hand leaves');
  assert.equal(motion.update([hand(.25)], 120, 120).shots.length, 1);
  assert.equal(motion.update([hand(-.15)], 920, 920).shots.length, 0);
});

test('reduced motion is stationary while still following fingertips and reset clears flights', () => {
  const motion = createPowerMotion(1280, 800), start = hand();
  const first = motion.update([start], 0, 0, .72, true);
  const still = motion.update([start], 40, 40, .72, true);
  assert.deepEqual(first.orbs[1].center, still.orbs[1].center);
  const moved = motion.update([flickFinger(start)], 80, 80, .72, true);
  assert.equal(moved.shots.length, 0);
  assert.ok(moved.orbs[1].center.x > still.orbs[1].center.x);
  assert.deepEqual(motion.reset(), { orbs: [], shots: [], flashes: [], tips: [] });
});
