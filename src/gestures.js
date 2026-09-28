const distance = (a, b) => Math.hypot((a.x - b.x) * 1280, (a.y - b.y) * 800);

export function analyzeHand(landmarks) {
  const wrist = landmarks[0];
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmLength = distance(wrist, landmarks[9]);
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]];
  const fist = fingers.every(([tip, joint]) =>
    distance(landmarks[tip], wrist) < distance(landmarks[joint], wrist) * 1.22,
  ) && fingers.reduce((sum, [tip]) => sum + distance(landmarks[tip], wrist), 0) / 4 < palmLength * 1.65;
  const thumbPinkyPinch = !fist && distance(landmarks[4], landmarks[20]) < Math.max(27, palmWidth * .47);

  return { landmarks, fist, thumbPinkyPinch };
}

export function createGestureController() {
  let filterArmed = true;
  let modeArmed = true;
  let filterReleasedAt = null;
  let modeReleasedAt = null;
  let lastFilterAt = -Infinity;
  let lastModeAt = -Infinity;

  return {
    update(hands, now) {
      const dualFist = hands.length >= 2 && hands.every(hand => hand.fist);
      const filterPinch = !dualFist && hands.some(hand => hand.thumbPinkyPinch);
      let nextFilter = false;
      let toggleMode = false;

      if (dualFist) {
        modeReleasedAt = null;
        if (modeArmed && now - lastModeAt >= 900) {
          toggleMode = true;
          modeArmed = false;
          lastModeAt = now;
        }
      } else {
        if (modeReleasedAt === null) modeReleasedAt = now;
        if (now - modeReleasedAt >= 220) modeArmed = true;
      }

      if (filterPinch) {
        filterReleasedAt = null;
        if (filterArmed && now - lastFilterAt >= 350) {
          nextFilter = true;
          filterArmed = false;
          lastFilterAt = now;
        }
      } else {
        if (filterReleasedAt === null) filterReleasedAt = now;
        if (now - filterReleasedAt >= 180) filterArmed = true;
      }

      return { nextFilter, toggleMode, dualFist, filterPinch };
    },
    reset() {
      filterArmed = true;
      modeArmed = true;
      filterReleasedAt = null;
      modeReleasedAt = null;
      lastFilterAt = -Infinity;
      lastModeAt = -Infinity;
    },
  };
}
