import test from 'node:test';
import assert from 'node:assert/strict';
import { portalFromHands } from './portal-geometry.js';

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
