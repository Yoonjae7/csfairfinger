import { portalFromHands } from './portal-geometry.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const phi = (1 + Math.sqrt(5)) / 2;
const length = Math.hypot(1, phi);
export const CAGE_VERTICES = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
].map(vertex => vertex.map(value => value / length));
export const CAGE_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];
export const CAGE_EDGES = [...new Map(CAGE_FACES.flatMap(face =>
  face.map((a, i) => [a, face[(i + 1) % 3]].sort((x, y) => x - y)),
).map(edge => [edge.join(':'), edge])).values()];

// The original five-tip mesh is the controller. Only this mode expands it.
export function powerFromHands(hands, width, height, strength = .72) {
  const anchors = portalFromHands(hands, '3d', width, height);
  if (!anchors) return null;
  const tips = anchors.polygons.flat();
  const xs = tips.map(p => p.x), ys = tips.map(p => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const amount = clamp(strength, 0, 1);
  const distance = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  const openness = hands.reduce((sum, hand) => {
    const landmarks = hand.landmarks;
    const palmSize = Math.max(distance(landmarks[5], landmarks[17]), distance(landmarks[0], landmarks[9]) * .75, 18);
    const fingers = [4, 8, 12, 16, 20].map(index => landmarks[index]);
    const spread = Math.max(...fingers.flatMap((a, i) => fingers.slice(i + 1).map(b => distance(a, b))));
    return sum + clamp((spread / palmSize - .45) / 1.65, 0, 1);
  }, 0) / hands.length;
  const size = (.9 + amount * .3) * (.8 + openness * .3);
  const rx = clamp(Math.max(hands.length > 1 ? 205 : 165, spanX * .66) * size, 100, width * .39);
  const ry = clamp(Math.max(hands.length > 1 ? 165 : 155, spanY * .65, rx * .72) * size, 100, height * .37);
  const ordered = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
  const a = ordered[0].landmarks[0];
  const b = ordered.length > 1 ? ordered[1].landmarks[0] : ordered[0].landmarks[9];
  const roll = ordered.length > 1 ? Math.atan2((b.y - a.y) * height, (b.x - a.x) * width) : Math.atan2((b.x - a.x) * width, (a.y - b.y) * height);
  const scale = 1.18 + amount * .28;
  return {
    anchors, center, rx, ry, roll: clamp(roll, -.65, .65), strength: amount,
    openness, depth: .6 + openness * .4,
    facets: anchors.polygons.map(vertices => vertices.map(p => ({
      x: center.x + (p.x - center.x) * scale,
      y: center.y + (p.y - center.y) * scale,
    }))),
    motion: {
      x: hands.reduce((sum, hand) => sum + (hand.motion?.x || 0), 0) / hands.length,
      y: hands.reduce((sum, hand) => sum + (hand.motion?.y || 0), 0) / hands.length,
    },
  };
}

export function projectPowerPoint(vertex, field, rotation = {}, scale = 1) {
  let [x, y, z] = vertex;
  z *= field.depth ?? 1;
  const ax = rotation.x || 0, ay = rotation.y || 0, az = rotation.z || 0;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  const perspective = 1 / (1 - z * .22);
  return { x: field.center.x + x * field.rx * scale * perspective, y: field.center.y + y * field.ry * scale * perspective, z };
}
