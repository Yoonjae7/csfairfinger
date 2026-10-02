import { portalFromHands } from './portal-geometry.js';

export const FINGERTIPS = [4, 8, 12, 16, 20];
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TAU = Math.PI * 2;
const phi = (1 + Math.sqrt(5)) / 2;
const unit = Math.hypot(1, phi);
export const SHAPES = {
  tetra: {
    vertices: [[-1, -1, -1], [1, -1, 1], [-1, 1, 1], [1, 1, -1]].map(v => v.map(n => n * .65)),
    faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
  },
  crystal: {
    vertices: [[0, -1.35, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, 1.35, 0]],
    faces: [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]],
  },
  cube: {
    vertices: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(v => v.map(n => n * .68)),
    faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]],
  },
  ico: {
    vertices: [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]].map(v => v.map(n => n / unit)),
    faces: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]],
  },
};
const kinds = ['tetra', 'crystal', 'cube', 'ico', 'tetra'];

// Reuse the original mesh's exact fingertip anchors; no change to portal geometry.
export function fingerSources(hands, width, height) {
  const visible = hands.slice(0, 2);
  const anchors = portalFromHands(visible, '3d', width, height);
  if (!anchors) return [];
  const tips = new Map(anchors.polygons.flat().map(p => [`${p.x}:${p.y}`, p]));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const toPoint = p => ({ x: p.x * width, y: p.y * height });
  return visible.flatMap((hand, handIndex) => {
    const wrist = toPoint(hand.landmarks[0]);
    const palmSize = Math.max(24, distance(toPoint(hand.landmarks[5]), toPoint(hand.landmarks[17])), distance(wrist, toPoint(hand.landmarks[9])) * .75);
    const points = FINGERTIPS.map(index => tips.get(`${hand.landmarks[index].x * width}:${hand.landmarks[index].y * height}`));
    const spread = Math.max(...points.flatMap((a, i) => points.slice(i + 1).map(b => distance(a, b))));
    const openness = clamp((spread / palmSize - .4) / 1.7, 0, 1);
    const roll = Math.atan2(points[4].y - points[0].y, points[4].x - points[0].x);
    return points.map((position, finger) => {
      const base = toPoint(hand.landmarks[FINGERTIPS[finger] - 3]);
      const extension = clamp((distance(position, base) / palmSize - .25) / 1.25, 0, 1);
      const length = Math.max(1, distance(base, position));
      return {
        id: `${hand.slot || hand.handedness || handIndex}:${finger}`,
        hand: hand.slot || hand.handedness || handIndex, finger, kind: kinds[finger],
        position, wrist, palmSize, openness, extension,
        roll: Math.atan2(Math.sin(roll), Math.cos(roll)),
        aim: { x: (position.x - base.x) / length, y: (position.y - base.y) / length },
        blocked: !!(hand.fist || hand.thumbPinkyPinch),
      };
    });
  });
}

export function orbitPose(source, phase, strength) {
  const radius = (34 + source.openness * 24 + source.extension * 16) * (.8 + strength * .35);
  const angle = source.roll * .35;
  const x = Math.cos(phase) * radius;
  const y = Math.sin(phase) * radius * (.46 + source.extension * .12);
  const z = Math.sin(phase) * .75;
  const perspective = 1 / (1 - z * .16);
  return {
    x: source.position.x + (x * Math.cos(angle) - y * Math.sin(angle)) * perspective,
    y: source.position.y + (x * Math.sin(angle) + y * Math.cos(angle)) * perspective,
    z,
  };
}

export function rotateVertex(vertex, rotation) {
  let [x, y, z] = vertex;
  const ax = rotation.x || 0, ay = rotation.y || 0, az = rotation.z || 0;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  return { x, y, z };
}

export function projectVertex(vertex, center, size, rotation) {
  const rotated = rotateVertex(vertex, rotation);
  const perspective = 1 / (1 - rotated.z * .18);
  return { ...rotated, x: center.x + rotated.x * size * perspective, y: center.y + rotated.y * size * perspective };
}

export const startingPhase = finger => finger / 5 * TAU - Math.PI / 2;
