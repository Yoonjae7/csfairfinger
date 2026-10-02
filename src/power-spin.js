const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const BASE_SPIN_SPEED = 10;
const CLOSE_SPIN_SPEED = 400;

export function handProximity(hands, width, height) {
  if (hands.length < 2) return 0;
  const distance = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  const palms = hands.slice(0, 2).map(hand => {
    const points = [0, 5, 9, 13, 17].map(index => hand.landmarks[index]);
    return {
      center: { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length },
      size: Math.max(24, distance(hand.landmarks[5], hand.landmarks[17]), distance(hand.landmarks[0], hand.landmarks[9]) * .75),
    };
  });
  const gap = distance(palms[0].center, palms[1].center) / ((palms[0].size + palms[1].size) / 2);
  const close = clamp((5 - gap) / 3.8, 0, 1);
  return close * close * (3 - 2 * close);
}

export function createPowerSpin() {
  let time = 0, speed = BASE_SPIN_SPEED, lastFrame = null;
  return {
    reset() { time = 0; speed = BASE_SPIN_SPEED; lastFrame = null; return { time, speed, proximity: 0 }; },
    update(hands, width, height, now, reducedMotion = false) {
      const elapsed = lastFrame === null ? 0 : Math.max(0, (now - lastFrame) / 1000);
      const dt = elapsed <= .25 ? elapsed : 0;
      lastFrame = now;
      if (reducedMotion) { time = 0; speed = BASE_SPIN_SPEED; return { time, speed, proximity: 0 }; }
      if (!hands.length) { speed = BASE_SPIN_SPEED; return { time, speed, proximity: 0 }; }
      const proximity = handProximity(hands, width, height);
      const target = BASE_SPIN_SPEED + proximity * (CLOSE_SPIN_SPEED - BASE_SPIN_SPEED);
      // Ease the speed, then integrate phase. Never multiply page uptime by speed.
      const easing = Math.exp(-6 * dt);
      time += target * dt + (speed - target) * (1 - easing) / 6;
      speed = target + (speed - target) * easing;
      return { time, speed, proximity };
    },
  };
}
