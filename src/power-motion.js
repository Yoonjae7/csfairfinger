import { clamp, fingerSources, orbitPose, startingPhase } from './power-geometry.js';

const MAX_SHOTS = 18;
const SHOT_LIFE = .85;
const empty = () => ({ orbs: [], shots: [], flashes: [], tips: [] });

export function createPowerMotion(width, height) {
  let tracks = new Map();
  let shots = [];
  let lastInput = null;
  let lastFrame = null;
  let nextShot = 0;

  function reset() {
    tracks.clear(); shots = []; lastInput = null; lastFrame = null;
    return empty();
  }

  return {
    reset,
    update(hands, inputTime, now, strength = .72, reducedMotion = false) {
      const amount = clamp(strength, 0, 1);
      const elapsed = lastFrame === null ? 0 : Math.max(0, (now - lastFrame) / 1000);
      const dt = reducedMotion ? 0 : Math.min(.05, elapsed);
      if (elapsed > .25) { tracks.clear(); shots = []; lastInput = null; }
      lastFrame = now;
      if (reducedMotion) shots = [];
      shots = shots.filter(shot => (now - shot.born) / 1000 < SHOT_LIFE);
      const sources = fingerSources(hands, width, height);
      const visible = new Set(sources.map(source => source.id));
      for (const id of tracks.keys()) if (!visible.has(id)) tracks.delete(id);

      const fresh = inputTime !== lastInput && now - inputTime < 200;
      const candidates = [];
      sources.forEach(source => {
        let track = tracks.get(source.id);
        if (!track) {
          track = { source, position: source.position, wrist: source.wrist, inputAt: inputTime, phase: startingPhase(source.finger), vx: 0, vy: 0, armed: !source.blocked, quietSince: null, lastShot: -Infinity, appeared: now };
          tracks.set(source.id, track);
        } else if (fresh) {
          const inputDt = (inputTime - track.inputAt) / 1000;
          if (inputDt > .008 && inputDt < .18) {
            const wristX = (source.wrist.x - track.wrist.x) / inputDt;
            const wristY = (source.wrist.y - track.wrist.y) / inputDt;
            const vx = (source.position.x - track.position.x) / inputDt - wristX * .2;
            const vy = (source.position.y - track.position.y) / inputDt - wristY * .2;
            track.vx = track.vx * .35 + clamp(vx, -2600, 2600) * .65;
            track.vy = track.vy * .35 + clamp(vy, -2600, 2600) * .65;
            const speed = Math.hypot(track.vx, track.vy);
            const threshold = Math.max(620, source.palmSize * 5);
            if (source.blocked) {
              track.armed = false; track.quietSince = null;
            } else if (speed < threshold * .4) {
              track.quietSince ??= inputTime;
              if (inputTime - track.quietSince >= 140 && now - track.lastShot > 500) track.armed = true;
            } else {
              track.quietSince = null;
              if (!reducedMotion && track.armed && speed > threshold && now - track.lastShot > 500) candidates.push({ track, source, speed });
            }
          } else {
            track.vx = 0; track.vy = 0; track.armed = false; track.quietSince = null;
          }
          track.position = source.position; track.wrist = source.wrist; track.inputAt = inputTime;
        }
        track.source = source;
        // Integrating phase avoids jumps when fingers change the orbit speed.
        track.phase += dt * (1.1 + source.extension * 1.3 + Math.min(.9, Math.hypot(track.vx, track.vy) / 1600));
      });
      if (fresh) lastInput = inputTime;

      // A sweep launches up to three shapes per hand, once until motion settles.
      const bursts = new Map();
      candidates.sort((a, b) => b.speed - a.speed).forEach(({ track, source, speed }) => {
        track.armed = false;
        if ((bursts.get(source.hand) || 0) >= 3 || shots.length >= MAX_SHOTS) return;
        bursts.set(source.hand, (bursts.get(source.hand) || 0) + 1);
        const dx = track.vx / speed * .85 + source.aim.x * .15;
        const dy = track.vy / speed * .85 + source.aim.y * .15;
        const length = Math.max(.01, Math.hypot(dx, dy));
        const velocity = 1200 + amount * 500 + Math.min(450, speed * .15);
        const pose = orbitPose(source, track.phase, amount);
        shots.push({ id: nextShot++, kind: source.kind, finger: source.finger, born: now, origin: pose, tip: source.position, vx: dx / length * velocity, vy: dy / length * velocity, size: 22 + amount * 8, spin: track.phase, heading: Math.atan2(dy, dx) + Math.PI / 2 });
        track.lastShot = now;
      });

      const orbs = sources.map(source => {
        const track = tracks.get(source.id);
        const center = orbitPose(source, track.phase, amount);
        const opacity = Math.min(clamp((now - track.appeared) / 120, 0, 1), clamp((now - track.lastShot - 180) / 220, 0, 1));
        const trail = reducedMotion ? [] : Array.from({ length: 10 }, (_, i) => orbitPose(source, track.phase - (9 - i) * .065, amount));
        return {
          id: source.id, kind: source.kind, finger: source.finger, center, opacity,
          size: (18 + source.extension * 10) * (.8 + amount * .3) * (1 + center.z * .16),
          rotation: { x: .4 + track.phase * .35, y: track.phase * .7 + source.finger, z: source.roll * .2 },
          trail,
        };
      });
      const flight = shots.map(shot => {
        const age = (now - shot.born) / 1000;
        const position = t => ({ x: shot.origin.x + shot.vx * t, y: shot.origin.y + shot.vy * t, z: shot.origin.z });
        return {
          ...shot, center: position(age), opacity: clamp((SHOT_LIFE - age) / .18, 0, 1),
          rotation: { x: shot.spin + age * 7, y: age * 4, z: shot.heading },
          trail: Array.from({ length: 9 }, (_, i) => position(Math.max(0, age - (8 - i) * .011))),
        };
      });
      const flashes = shots.filter(shot => now - shot.born < 170).map(shot => ({ position: shot.tip, radius: 8 + (now - shot.born) * .08, opacity: 1 - (now - shot.born) / 170, finger: shot.finger }));
      return { orbs, shots: flight, flashes, tips: sources.map(source => source.position) };
    },
  };
}
