import { elementOrbsFromHands } from './portal-geometry.js';

export const FUSION_DURATION = 5000;
export const fusionName = kind => ({ hybrid: 'Steamfire', water: 'Tidal sphere', fire: 'Inferno' })[kind];

export function createElementFusion() {
  let phase = 'idle', elapsed = 0, lastAt = null, interruptedAt = null, fusedAt = null;
  let recipe = '', needsSeparation = false, stableOrbs = [];
  let snapshot = { phase, progress: 0, orbs: [], fused: null };
  function reset(waitForSeparation = false) {
    phase = 'idle'; elapsed = 0; lastAt = null; interruptedAt = null; fusedAt = null;
    needsSeparation = waitForSeparation; stableOrbs = [];
    snapshot = { phase, progress: 0, orbs: [], fused: null };
  }
  return {
    reset,
    get state() { return snapshot; },
    update(hands, elements, now) {
      const nextRecipe = `${elements.left}:${elements.right}`;
      if (recipe && recipe !== nextRecipe) reset();
      recipe = nextRecipe;
      const gap = lastAt === null ? 0 : Math.max(0, now - lastAt);
      const step = gap <= 250 ? gap : 0;
      if (gap > 600 && phase === 'mixing') elapsed = 0;
      lastAt = now;
      const blend = 1 - Math.exp(-Math.min(gap || 16, 100) / 85);
      const observed = elementOrbsFromHands(hands, 1280, 800);
      let orbs = observed
        .map(orb => {
          const old = stableOrbs.find(candidate => candidate.slot === orb.slot);
          return { ...orb, element: elements[orb.slot], radius: old ? old.radius + (orb.radius - old.radius) * blend : orb.radius,
            center: old ? { x: old.center.x + (orb.center.x - old.center.x) * blend, y: old.center.y + (orb.center.y - old.center.y) * blend } : orb.center };
        }).sort((a, b) => a.slot.localeCompare(b.slot));
      const pair = orbs.length === 2;
      const separation = pair ? Math.hypot(observed[0].center.x - observed[1].center.x, observed[0].center.y - observed[1].center.y) : Infinity;
      // Contact uses palm size, independently of the visitor's chosen effect size.
      const reach = pair ? orbs[0].contactRadius + orbs[1].contactRadius : 0;
      const close = pair && !hands.some(hand => hand.fist) && separation < reach * (phase === 'idle' ? .84 : 1.12);
      if (needsSeparation && pair && separation > reach * 1.35) needsSeparation = false;
      if (phase !== 'fused') {
        if (close && !needsSeparation) {
          if (phase === 'idle') { phase = 'mixing'; elapsed = 0; }
          else if (interruptedAt === null) elapsed += step;
          interruptedAt = null;
          if (elapsed >= FUSION_DURATION) { phase = 'fused'; fusedAt = now; }
        } else if (phase === 'mixing') {
          interruptedAt ??= now;
          if (now - interruptedAt > 300) { phase = 'idle'; elapsed = 0; interruptedAt = null; }
        }
      } else {
        // Finger pose jitter must not split a forged effect. Separation or
        // sustained tracking loss does; a brief overlap/occlusion holds it still.
        if (!pair || separation > reach * 1.85) {
          interruptedAt ??= now;
          if (now - interruptedAt > 600) reset();
        } else interruptedAt = null;
      }
      if (phase !== 'idle' && interruptedAt !== null && stableOrbs.length === 2) {
        const decay = Math.exp(-(now - interruptedAt) / 180);
        orbs = stableOrbs.map(orb => ({ ...orb, motion: { x: orb.motion.x * decay, y: orb.motion.y * decay } }));
      } else stableOrbs = orbs;
      const center = orbs.length ? {
        x: orbs.reduce((sum, orb) => sum + orb.center.x, 0) / orbs.length,
        y: orbs.reduce((sum, orb) => sum + orb.center.y, 0) / orbs.length,
      } : null;
      const kind = elements.left === elements.right ? elements.left : 'hybrid';
      const radius = orbs.reduce((sum, orb) => sum + orb.radius, 0) * 1.12;
      const previous = snapshot.fused;
      const fusedCenter = center && previous ? {
        x: previous.center.x + (center.x - previous.center.x) * blend,
        y: previous.center.y + (center.y - previous.center.y) * blend,
      } : center;
      snapshot = {
        phase, progress: Math.min(1, elapsed / FUSION_DURATION), orbs, center,
        fused: phase === 'fused' && fusedCenter ? {
          center: fusedCenter, radius: previous ? previous.radius + (radius - previous.radius) * blend : radius,
          motion: { x: orbs.reduce((sum, orb) => sum + orb.motion.x, 0) / orbs.length, y: orbs.reduce((sum, orb) => sum + orb.motion.y, 0) / orbs.length },
          kind, age: Math.max(0, (now - fusedAt) / 1000),
        } : null,
      };
      return snapshot;
    },
  };
}
