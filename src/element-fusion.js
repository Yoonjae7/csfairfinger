import { elementOrbsFromHands } from './portal-geometry.js';

export const FUSION_DURATION = 5000;
export const fusionName = kind => ({ hybrid: 'Steamfire', water: 'Tidal sphere', fire: 'Inferno' })[kind];

export function createElementFusion() {
  let phase = 'idle';
  let elapsed = 0;
  let lastAt = null;
  let interruptedAt = null;
  let fusedAt = null;
  let recipe = '';
  let needsSeparation = false;
  let snapshot = { phase, progress: 0, orbs: [], fused: null };
  function reset(waitForSeparation = false) {
    phase = 'idle'; elapsed = 0; lastAt = null; interruptedAt = null; fusedAt = null;
    needsSeparation = waitForSeparation;
    snapshot = { phase, progress: 0, orbs: [], fused: null };
  }
  return {
    reset,
    get state() { return snapshot; },
    update(hands, elements, now) {
      const orbs = elementOrbsFromHands(hands, 1280, 800).map(orb => ({ ...orb, element: elements[orb.slot] }));
      const nextRecipe = `${elements.left}:${elements.right}`;
      if (recipe && recipe !== nextRecipe) reset();
      recipe = nextRecipe;
      if (lastAt !== null && now - lastAt > 250 && phase === 'mixing') { phase = 'idle'; elapsed = 0; interruptedAt = null; }
      const step = lastAt === null ? 0 : Math.min(250, Math.max(0, now - lastAt));
      lastAt = now;
      const pair = orbs.length === 2;
      const separation = pair ? Math.hypot(orbs[0].center.x - orbs[1].center.x, orbs[0].center.y - orbs[1].center.y) : Infinity;
      const reach = pair ? orbs[0].radius + orbs[1].radius : 0;
      const open = pair && !hands.some(hand => hand.fist);
      const close = open && separation < reach * (phase === 'idle' ? .84 : 1.12);
      if (needsSeparation && pair && separation > reach * 1.35) needsSeparation = false;

      if (phase !== 'fused') {
        if (close && !needsSeparation) {
          if (phase === 'idle') { phase = 'mixing'; elapsed = 0; }
          else if (interruptedAt === null) elapsed += step;
          interruptedAt = null;
          if (elapsed >= FUSION_DURATION) { phase = 'fused'; fusedAt = now; }
        } else if (phase === 'mixing') {
          interruptedAt ??= now;
          if (now - interruptedAt > 250) { phase = 'idle'; elapsed = 0; interruptedAt = null; }
        }
      } else {
        const split = !open || separation > reach * 1.85;
        if (split) {
          interruptedAt ??= now;
          if (now - interruptedAt > 600) reset();
        } else interruptedAt = null;
      }

      const center = orbs.length ? {
        x: orbs.reduce((sum, orb) => sum + orb.center.x, 0) / orbs.length,
        y: orbs.reduce((sum, orb) => sum + orb.center.y, 0) / orbs.length,
      } : null;
      const kind = elements.left === elements.right ? elements.left : 'hybrid';
      snapshot = {
        phase,
        progress: Math.min(1, elapsed / FUSION_DURATION),
        orbs,
        center,
        fused: phase === 'fused' && center ? {
          center, radius: Math.min(240, Math.max(185, reach * 1.13)), tilt: orbs[0].tilt,
          kind, age: Math.max(0, (now - fusedAt) / 1000),
        } : null,
      };
      return snapshot;
    },
  };
}
