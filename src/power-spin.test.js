import test from 'node:test';
import assert from 'node:assert/strict';
import { createPowerSpin, handProximity } from './power-spin.js';

function hand(x, y = .5) {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y }));
  landmarks[0] = { x, y: y + .14 };
  landmarks[5] = { x: x - .035, y }; landmarks[17] = { x: x + .035, y };
  return { landmarks };
}
const far = [hand(.2), hand(.8)], near = [hand(.46), hand(.54)];

test('closer hands raise the spin speed and pulling them apart slows it smoothly', () => {
  assert.ok(handProximity(near, 1280, 800) > handProximity(far, 1280, 800));
  const spin = createPowerSpin(); spin.update(far, 1280, 800, 0);
  let state;
  for (let now = 16; now <= 960; now += 16) state = spin.update(near, 1280, 800, now);
  assert.ok(state.speed > 9 && state.speed <= 10);
  const fast = state;
  const transition = spin.update(far, 1280, 800, 976);
  assert.ok(transition.speed < fast.speed && transition.speed > 1);
  assert.ok(transition.time > fast.time && transition.time - fast.time < .17);
  for (let now = 992; now <= 1952; now += 16) state = spin.update(far, 1280, 800, now);
  assert.ok(state.speed < 1.1);
});

test('proximity is independent of hand order and camera distance', () => {
  const hands = [hand(.4), hand(.6)];
  const scaled = hands.map(h => ({ landmarks: h.landmarks.map(p => ({ x: .5 + (p.x - .5) * 1.5, y: .5 + (p.y - .5) * 1.5 })) }));
  assert.equal(handProximity(hands, 1280, 800), handProximity([...hands].reverse(), 1280, 800));
  assert.ok(Math.abs(handProximity(hands, 1280, 800) - handProximity(scaled, 1280, 800)) < .001);
  assert.equal(handProximity([], 1280, 800), 0);
  assert.equal(handProximity([hand(.5)], 1280, 800), 0);
});

test('spin phase is continuous over long sessions and stable across frame rates', () => {
  const a = createPowerSpin(), b = createPowerSpin();
  a.update(near, 1280, 800, 0); b.update(near, 1280, 800, 0);
  let first, second;
  for (let now = 10; now <= 1000; now += 10) first = a.update(near, 1280, 800, now);
  for (let now = 20; now <= 1000; now += 20) second = b.update(near, 1280, 800, now);
  assert.ok(Math.abs(first.time - second.time) < .00001);
  const afterGap = a.update(near, 1280, 800, 86400000);
  assert.equal(afterGap.time, first.time, 'a paused tab must not skip through hours of rotation');
  const next = a.update(far, 1280, 800, 86400016);
  assert.ok(next.time - afterGap.time < .17);
});

test('lost tracking freezes phase; reduced motion and reset return a stationary scene', () => {
  const spin = createPowerSpin(); spin.update(near, 1280, 800, 0);
  const moving = spin.update(near, 1280, 800, 100);
  assert.equal(spin.update([], 1280, 800, 150).time, moving.time);
  assert.deepEqual(spin.update(near, 1280, 800, 200, true), { time: 0, speed: 1, proximity: 0 });
  assert.deepEqual(spin.reset(), { time: 0, speed: 1, proximity: 0 });
});
