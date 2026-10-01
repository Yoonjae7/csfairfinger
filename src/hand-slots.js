const wrist = hand => hand.landmarks[0];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createHandSlots() {
  let tracks = {};
  function cost(hand, slot, now) {
    const track = tracks[slot];
    if (!track) return slot === (wrist(hand).x < .5 ? 'left' : 'right') ? .1 : .45;
    const motion = now - track.at < 1500 ? distance(wrist(hand), track.position) : .3;
    const identity = hand.handedness && track.handedness
      ? hand.handedness === track.handedness ? -.4 : .6
      : 0;
    return motion + identity;
  }
  return {
    assign(hands, now) {
      const incoming = hands.slice(0, 2);
      let slots;
      if (incoming.length === 2) {
        const direct = cost(incoming[0], 'left', now) + cost(incoming[1], 'right', now);
        const swapped = cost(incoming[0], 'right', now) + cost(incoming[1], 'left', now);
        slots = direct <= swapped ? ['left', 'right'] : ['right', 'left'];
      } else {
        slots = incoming.length ? [cost(incoming[0], 'left', now) <= cost(incoming[0], 'right', now) ? 'left' : 'right'] : [];
      }
      return incoming.map((hand, i) => {
        const slot = slots[i];
        tracks[slot] = { position: wrist(hand), handedness: tracks[slot]?.handedness || hand.handedness, at: now };
        return { ...hand, slot };
      });
    },
    reset() { tracks = {}; },
  };
}
