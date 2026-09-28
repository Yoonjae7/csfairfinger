const point = (x, y) => ({ x, y });
const tip = (hand, index, width, height) => point(hand.landmarks[index].x * width, hand.landmarks[index].y * height);

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
