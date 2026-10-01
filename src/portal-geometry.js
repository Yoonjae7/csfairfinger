const point = (x, y) => ({ x, y });
const tip = (hand, index, width, height) => point(hand.landmarks[index].x * width, hand.landmarks[index].y * height);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function elementOrbsFromHands(hands, width, height) {
  return hands.slice(0, 2).map(hand => {
    const tips = [4, 8, 12, 16, 20].map(index => tip(hand, index, width, height));
    const palm = Math.hypot(
      (hand.landmarks[5].x - hand.landmarks[17].x) * width,
      (hand.landmarks[5].y - hand.landmarks[17].y) * height,
    );
    const palmCenter = point(
      [0, 5, 9, 13, 17].reduce((sum, i) => sum + hand.landmarks[i].x * width, 0) / 5,
      [0, 5, 9, 13, 17].reduce((sum, i) => sum + hand.landmarks[i].y * height, 0) / 5,
    );
    // Normalize finger extension by palm size, so opening the hand controls
    // the effect even when the hand stays at the same distance from the camera.
    const extension = tips.slice(1).reduce((sum, p) => sum + Math.hypot(p.x - palmCenter.x, p.y - palmCenter.y), 0) / 4;
    const spread = Math.max(...tips.flatMap(a => tips.map(b => Math.hypot(a.x - b.x, a.y - b.y))));
    const scale = Math.max(25, palm);
    const openness = hand.fist ? 0 : .75 * clamp((extension / scale - .35) / 1.65, 0, 1)
      + .25 * clamp((spread / scale - .4) / 1.1, 0, 1);
    return {
      slot: hand.slot,
      center: point(tips.reduce((sum, p) => sum + p.x, 0) / 5, tips.reduce((sum, p) => sum + p.y, 0) / 5),
      radius: clamp((42 + openness * 90) * clamp(palm / 105, .85, 1.2), 36, 158),
      contactRadius: clamp(palm * .8 + 55, 90, 145),
      openness,
      motion: hand.motion || point(0, 0),
      tilt: clamp((tips[4].y - tips[0].y) / Math.max(palm, 25), -.5, .5),
    };
  });
}

function orderCorners(corners, bowtie) {
  const sorted = [...corners].sort((a, b) => a.x - b.x);
  const left = sorted.slice(0, 2).sort((a, b) => a.y - b.y);
  const right = sorted.slice(2).sort((a, b) => a.y - b.y);
  return bowtie
    ? [left[0], right[1], right[0], left[1]]
    : [left[0], right[0], right[1], left[1]];
}

function isRotated(thumb, index, height) {
  const dx = index.x - thumb.x;
  const dy = index.y - thumb.y;
  return dy > height * .04 || Math.abs(dx) > Math.abs(dy) * 1.1;
}

export function portalFromHands(hands, mode, width, height) {
  if (!hands.length) return null;
  const ordered = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
  const fingertips = hand => [4, 8, 12, 16, 20].map(index => tip(hand, index, width, height));

  if (ordered.length === 1) {
    const t = fingertips(ordered[0]);
    return { variant: 'single', polygons: [mode === '3d' ? t : [t[0], t[1], t[2], t[4]]] };
  }

  const left = fingertips(ordered[0]);
  const right = fingertips(ordered[1]);
  if (mode === '3d') {
    return {
      variant: 'mesh',
      polygons: [
        [left[0], left[1], left[2], right[2], right[1], right[0]],
        [left[2], left[3], left[4], right[4], right[3], right[2]],
      ],
    };
  }

  const bowtie = isRotated(left[0], left[1], height) || isRotated(right[0], right[1], height);
  return { variant: bowtie ? 'bowtie' : 'quad', polygons: [orderCorners([left[0], left[1], right[0], right[1]], bowtie)] };
}
