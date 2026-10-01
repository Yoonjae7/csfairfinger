import test from 'node:test';
import assert from 'node:assert/strict';
import { elementOrbsFromHands, portalFromHands } from './portal-geometry.js';

function hand(x, rotated = false) {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: .5 }));
  landmarks[0] = { x, y: .75 };
  landmarks[4] = { x: x - .02, y: .42 };
  landmarks[8] = { x: x - .01, y: rotated ? .62 : .22 };
  landmarks[12] = { x, y: .16 };
  landmarks[16] = { x: x + .02, y: .22 };
  landmarks[20] = { x: x + .04, y: .32 };
  return { landmarks };
}

test('two upright hands make a four-corner portal and tilted fingers make a bowtie', () => {
  const quad = portalFromHands([hand(.7), hand(.3)], '2d', 1280, 800);
  assert.equal(quad.variant, 'quad');
  assert.equal(quad.polygons[0].length, 4);
  const bowtie = portalFromHands([hand(.3, true), hand(.7)], '2d', 1280, 800);
  assert.equal(bowtie.variant, 'bowtie');
});

test('3D mode uses two fingertip mesh bands and one hand keeps a small portal', () => {
  const mesh = portalFromHands([hand(.3), hand(.7)], '3d', 1280, 800);
  assert.equal(mesh.variant, 'mesh');
  assert.deepEqual(mesh.polygons.map(polygon => polygon.length), [6, 6]);
  assert.equal(portalFromHands([hand(.3)], '2d', 1280, 800).polygons[0].length, 4);
});

test('the portal is absent when no hands are tracked', () => {
  assert.equal(portalFromHands([], '2d', 1280, 800), null);
  assert.equal(portalFromHands([], '3d', 1280, 800), null);
});

test('each 3D element follows its hand and stays bounded at extreme hand sizes', () => {
  assert.deepEqual(elementOrbsFromHands([], 1280, 800), []);
  const left = { ...hand(.3), slot: 'left' };
  const right = { ...hand(.7), slot: 'right' };
  left.landmarks[5] = { x: 0, y: .5 }; left.landmarks[17] = { x: 1, y: .5 };
  const orbs = elementOrbsFromHands([left, right], 1280, 800);
  assert.deepEqual(orbs.map(orb => orb.slot), ['left', 'right']);
  assert.ok(orbs[0].center.x < orbs[1].center.x);
  for (const orb of orbs) assert.ok(orb.radius >= 36 && orb.radius <= 158);
});


test('opening fingers grows elements while palm size and position stay fixed', () => {
  const open = hand(.5);
  open.landmarks[5] = { x: .46, y: .55 }; open.landmarks[17] = { x: .54, y: .55 };
  const curled = { ...open, landmarks: open.landmarks.map(p => ({ ...p })) };
  for (const i of [4, 8, 12, 16, 20]) curled.landmarks[i] = { x: .5, y: .59 };
  const a = elementOrbsFromHands([open], 1280, 800)[0];
  const b = elementOrbsFromHands([curled], 1280, 800)[0];
  assert.ok(a.radius > b.radius * 2);
  assert.equal(a.contactRadius, b.contactRadius);
  assert.equal(elementOrbsFromHands([{ ...open, fist: true }], 1280, 800)[0].openness, 0);
});
