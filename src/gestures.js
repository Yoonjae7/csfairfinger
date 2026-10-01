const distance = (a, b) => Math.hypot((a.x - b.x) * 1280, (a.y - b.y) * 800);
const distance3D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const validDepth = points => points?.length === 21 && points.every(p => [p.x, p.y, p.z].every(Number.isFinite));

export function analyzeHand(landmarks, worldLandmarks) {
  const wrist = landmarks[0];
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmLength = distance(wrist, landmarks[9]);
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]];
  const fist = fingers.every(([tip, joint]) =>
    distance(landmarks[tip], wrist) < distance(landmarks[joint], wrist) * 1.22,
  ) && fingers.reduce((sum, [tip]) => sum + distance(landmarks[tip], wrist), 0) / 4 < palmLength * 1.65;
  // Knuckle width perpendicular to the wrist/middle-knuckle axis rejects
  // edge-on palms, independently of rotation within the camera image.
  const axis = { x: (landmarks[9].x - wrist.x) * 1280, y: (landmarks[9].y - wrist.y) * 800 };
  const across = { x: (landmarks[17].x - landmarks[5].x) * 1280, y: (landmarks[17].y - landmarks[5].y) * 800 };
  const visibleWidth = Math.abs(axis.x * across.y - axis.y * across.x) / Math.max(palmLength, 1);
  const palmVisible = palmLength > 12 && visibleWidth > palmLength * .25;
  const depth = validDepth(worldLandmarks) ? worldLandmarks : validDepth(landmarks)
    ? landmarks.map(p => ({ x: p.x * 1280, y: p.y * 800, z: p.z * 1280 })) : null;
  const tipGap = distance(landmarks[4], landmarks[20]);
  const contact = Math.max(27, palmWidth * .47);
  let separatedInDepth = false;
  if (depth) {
    const size = Math.max(distance3D(depth[5], depth[17]), distance3D(depth[0], depth[9]) * .6);
    // Estimated world fingertips can be offset even during real contact.
    // Use depth only to reject clear separation, not to demand exact 3D contact.
    separatedInDepth = Math.abs(depth[4].z - depth[20].z) > size * .8;
  }
  const thumbPinkyPinch = palmVisible && !fist && !separatedInDepth && tipGap < contact;
  // An occluded/sideways hand is unknown, not a released pinch. Require a
  // clearly visible separation before another change can be armed.
  const thumbPinkyReleased = palmVisible && !fist && tipGap > contact * 1.2;

  return { landmarks, fist, thumbPinkyPinch, thumbPinkyReleased };
}

export function createGestureController() {
  let filterArmed = true;
  let modeArmed = true;
  let filterReleasedAt = null;
  let modeReleasedAt = null;
  let lastFilterAt = -Infinity;
  let lastModeAt = -Infinity;
  let lastSampleAt = null;

  return {
    update(hands, now) {
      const dualFist = hands.length >= 2 && hands.every(hand => hand.fist);
      const pinchHand = !dualFist && hands.find(hand => !hand.fist && hand.thumbPinkyPinch);
      const filterPinch = Boolean(pinchHand);
      if (lastSampleAt !== null && now - lastSampleAt > 700) filterReleasedAt = null;
      lastSampleAt = now;
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
        // A tap may only be visible for one camera frame. Orientation already
        // rejects clapping overlap, so do not require a prolonged held pinch.
        if (filterArmed && now - lastFilterAt >= 350) {
          nextFilter = true;
          filterArmed = false;
          lastFilterAt = now;
        }
      } else {
        const released = hands.some(hand => hand.thumbPinkyReleased ?? (!hand.fist && !hand.thumbPinkyPinch));
        if (released && !dualFist) {
          if (filterReleasedAt === null) filterReleasedAt = now;
          if (now - filterReleasedAt >= 180) filterArmed = true;
        } else filterReleasedAt = null;
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
      lastSampleAt = null;
    },
  };
}
