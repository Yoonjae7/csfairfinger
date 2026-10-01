import { renderElementMaterial } from './element-material.js';
import { mixingRotation } from './element-fusion.js';

const TAU = Math.PI * 2;
const WIDTH = 1280;
const HEIGHT = 800;

// Rotate points on a sphere and project them with depth. Hands tilt its axis.
function project(geometry, x, y, z, yaw, tilt) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const turnedX = x * cy + z * sy;
  const turnedZ = z * cy - x * sy;
  const turnedY = y * ct - turnedZ * st;
  const depth = y * st + turnedZ * ct;
  const scale = 1 + depth * .14;
  return {
    x: geometry.center.x + turnedX * geometry.radius * scale,
    y: geometry.center.y + turnedY * geometry.radius * scale,
    z: depth,
    scale,
  };
}

function circle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
}

function orbitPoint(geometry, angle, ring, time, yaw, tilt) {
  const inclination = ring ? -.72 : .88;
  const phase = time * (ring ? -.22 : .28) + ring * .8;
  const flow = 1.16 + Math.sin(angle * 4 + time * 1.4 + ring) * .035;
  const x = Math.cos(angle) * flow;
  const y = Math.sin(angle) * Math.cos(inclination) * flow;
  const z = Math.sin(angle) * Math.sin(inclination) * flow;
  return project(geometry, x * Math.cos(phase) - y * Math.sin(phase), x * Math.sin(phase) + y * Math.cos(phase), z, yaw, tilt);
}

function drawOrbits(ctx, geometry, element, time, yaw, tilt, front) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = element === 'fire' ? '#ff9a55' : '#9cf7ff';
  ctx.shadowBlur = front ? 3 : 0;
  ctx.globalAlpha = .55;
  for (let ring = 0; ring < 2; ring++) {
    const warm = element === 'fire' || element === 'hybrid' && ring === 0;
    ctx.shadowColor = warm ? '#ff9a55' : '#9cf7ff';
    ctx.strokeStyle = warm
      ? front ? '#ffd08bc7' : '#ff81537a'
      : front ? '#c4ffffdb' : '#70d9ef85';
    ctx.lineWidth = front ? 2.1 - ring * .5 : 1.1;
    let drawing = false;
    ctx.beginPath();
    for (let step = 0; step <= 100; step++) {
      const p = orbitPoint(geometry, step / 100 * TAU, ring, time, yaw, tilt);
      if ((p.z >= 0) === front) {
        if (!drawing) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        drawing = true;
      } else drawing = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

function shellPoint(geometry, index, count, time, yaw, tilt, distance = 1) {
  const y = 1 - 2 * (index + .5) / count;
  const radius = Math.sqrt(1 - y * y);
  const angle = index * 2.399963 + time * .34;
  return project(geometry, radius * Math.cos(angle) * distance, y * distance, radius * Math.sin(angle) * distance, yaw, tilt);
}

function drawFirePlumes(ctx, geometry, strength, time, yaw, tilt, front) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const count = 52;
  for (let i = 0; i < count; i++) {
    const base = shellPoint(geometry, i, count, time, yaw, tilt, 1.01);
    if ((base.z >= 0) !== front) continue;
    const length = (.19 + .24 * (Math.sin(time * (2.8 + i % 4 * .3) + i * 3.4) * .5 + .5)) * (.5 + strength);
    const y = 1 - 2 * (i + .5) / count;
    const ringRadius = Math.sqrt(1 - y * y);
    const angle = i * 2.399963 + time * .34;
    const tip = project(geometry, ringRadius * Math.cos(angle) * (1 + length), y * (1 + length) - length * .44, ringRadius * Math.sin(angle) * (1 + length), yaw, tilt);
    tip.x -= (geometry.motion?.x || 0) * .025 * length;
    tip.y -= geometry.radius * length * .15 + (geometry.motion?.y || 0) * .015 * length;
    const radialX = base.x - geometry.center.x;
    const radialY = base.y - geometry.center.y;
    const radialLength = Math.max(1, Math.hypot(radialX, radialY));
    const tangentX = -radialY / radialLength;
    const tangentY = radialX / radialLength;
    const width = geometry.radius * (.028 + strength * .025) * base.scale;
    const curl = Math.sin(time * 3 + i * 1.7) * geometry.radius * .07;
    const gradient = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
    gradient.addColorStop(0, front ? '#ffcb7da6' : '#ff782a60');
    gradient.addColorStop(.45, front ? '#ff961d96' : '#f85b2340');
    gradient.addColorStop(1, '#f3410800');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(base.x + tangentX * width, base.y + tangentY * width);
    ctx.bezierCurveTo(base.x + tangentX * (width + curl), base.y + tangentY * (width + curl), tip.x + tangentX * curl, tip.y + tangentY * curl, tip.x, tip.y);
    ctx.quadraticCurveTo(tip.x - tangentX * (width + curl), tip.y - tangentY * (width + curl), base.x - tangentX * width, base.y - tangentY * width);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(ctx, geometry, element, strength, time, yaw, tilt, front) {
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const p = shellPoint(geometry, i, 46, time * (element === 'fire' ? 1.3 : .62), yaw, tilt, 1.09 + i % 5 * .06);
    if ((p.z >= 0) !== front) continue;
    const size = (element === 'fire' ? 1.8 + i % 3 : 2.7 + i % 4 * 1.3) * p.scale * (.55 + strength * .55);
    const life = (time * (element === 'fire' ? .38 + i % 5 * .03 : .2 + i % 4 * .02) + i * .618) % 1;
    const rise = life * geometry.radius * (element === 'fire' ? .58 : .17);
    ctx.globalAlpha = (front ? .75 : .36) * strength * Math.sin(life * Math.PI);
    if (element === 'fire') {
      ctx.shadowColor = '#ffbe72';
      ctx.shadowBlur = 0;
      ctx.fillStyle = i % 5 ? '#ffb76f' : '#fff3c7';
      circle(ctx, p.x, p.y - rise, size);
      ctx.fill();
    } else {
      const drop = ctx.createRadialGradient(p.x - size * .35, p.y - rise - size * .4, size * .1, p.x, p.y - rise, size * 1.1);
      drop.addColorStop(0, '#efffff'); drop.addColorStop(.32, '#a5e8f6b0'); drop.addColorStop(.8, '#2686b080'); drop.addColorStop(1, '#1a526720');
      ctx.fillStyle = drop;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - rise, size * .85, size * 1.12, Math.sin(time + i) * .3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      circle(ctx, p.x - size * .3, p.y - rise - size * .3, Math.max(.8, size * .16));
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSurfaceFlows(ctx, geometry, element, yaw, tilt, time) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = element === 'fire' ? '#ffb36c' : '#9af6ff';
  ctx.shadowBlur = 0;
  function drawLine(pointAt) {
    let drawing = false;
    ctx.beginPath();
    for (let step = 0; step <= 56; step++) {
      const p = pointAt(step / 56);
      if (p.z >= -.025) {
        if (!drawing) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        drawing = true;
      } else drawing = false;
    }
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const warm = element === 'fire' || element === 'hybrid' && i % 2 === 0;
    ctx.strokeStyle = warm ? i % 3 ? '#ffc568b0' : '#fff5b3ba' : i % 3 ? '#56d9f2a6' : '#e9ffffc4';
    ctx.lineWidth = (warm ? 3 : 2) + (i % 3) * 1.5;
    drawLine(t => {
      const longitude = t * TAU;
      const latitude = -.98 + i * .18 + Math.sin(longitude * (warm ? 3 : 4) + time * (warm ? 2.2 : 1.3) + i * .8) * .055;
      const horizontal = Math.cos(latitude);
      return project(geometry, horizontal * Math.cos(longitude), Math.sin(latitude), horizontal * Math.sin(longitude), yaw, tilt);
    });
  }
  for (let i = 0; i < 5; i++) {
    const warm = element === 'fire' || element === 'hybrid' && i % 2;
    ctx.strokeStyle = warm ? '#ffed9d66' : '#e6ffff6b';
    ctx.lineWidth = warm ? 8 : 4;
    drawLine(t => {
      const latitude = -Math.PI / 2 + t * Math.PI;
      const longitude = i / 5 * TAU + Math.sin(latitude * 3 + time * .8 + i) * .16 + latitude * (warm ? 1.2 : .7);
      const horizontal = Math.cos(latitude);
      return project(geometry, horizontal * Math.cos(longitude), Math.sin(latitude), horizontal * Math.sin(longitude), yaw, tilt);
    });
  }
  ctx.restore();
}

function drawSphereBody(ctx, sourceCanvas, geometry, element, strength, time, yaw, tilt, material) {
  const { center, radius } = geometry;
  if (material) {
    ctx.save();
    ctx.globalAlpha = .7 + strength * .3;
    const extent = element === 'water' ? 1.32 : 1.6;
    ctx.drawImage(material, center.x - radius * extent, center.y - radius * extent, radius * extent * 2, radius * extent * 2);
    ctx.restore();
    return;
  }
  const fire = element === 'fire';
  ctx.save();
  ctx.shadowColor = fire ? '#fd7836bb' : '#46c8f8ba';
  ctx.shadowBlur = 36 + strength * 30;
  ctx.fillStyle = fire ? '#bc4338' : '#287fb6';
  circle(ctx, center.x, center.y, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  circle(ctx, center.x, center.y, radius);
  ctx.clip();
  ctx.globalAlpha = .1;
  const shimmer = Math.sin(time * (fire ? 4 : 1.6)) * 5 * strength;
  ctx.drawImage(sourceCanvas, shimmer, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;
  const volume = ctx.createRadialGradient(center.x - radius * .35, center.y - radius * .4, radius * .04, center.x, center.y, radius * 1.17);
  if (fire) {
    volume.addColorStop(0, '#fff4b197');
    volume.addColorStop(.38, '#ff933e99');
    volume.addColorStop(.7, '#dd3d438d');
    volume.addColorStop(1, '#251228e8');
  } else {
    volume.addColorStop(0, '#d8ffffb5');
    volume.addColorStop(.4, '#5ad6ee57');
    volume.addColorStop(.7, '#176ca48f');
    volume.addColorStop(1, '#071b42e8');
  }
  ctx.globalAlpha = .55 + strength * .45;
  ctx.fillStyle = volume;
  ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
  if (element === 'hybrid') {
    const dual = ctx.createLinearGradient(center.x - radius, center.y, center.x + radius, center.y);
    dual.addColorStop(0, '#ff8f3eaa'); dual.addColorStop(.46, '#ffca6c45');
    dual.addColorStop(.56, '#a3ffff45'); dual.addColorStop(1, '#24bde6aa');
    ctx.fillStyle = dual; ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  }
  for (let i = 0; i < 12; i++) {
    const p = shellPoint(geometry, i, 12, time * .7, yaw, tilt, .94);
    if (p.z < 0) continue;
    const warm = fire || element === 'hybrid' && i % 2 === 0;
    const size = radius * (.16 + (i % 3) * .04);
    const cloud = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
    cloud.addColorStop(0, warm ? '#ffdb8390' : '#d4ffff7a');
    cloud.addColorStop(.4, warm ? '#ff973f50' : '#52d3ee50');
    cloud.addColorStop(1, '#ffffff00');
    ctx.fillStyle = cloud; circle(ctx, p.x, p.y, size); ctx.fill();
  }
  drawSurfaceFlows(ctx, geometry, element, yaw, tilt, time);

  const reflection = ctx.createRadialGradient(center.x - radius * .45, center.y - radius * .56, 0, center.x - radius * .3, center.y - radius * .42, radius * .7);
  reflection.addColorStop(0, fire ? '#fff9c681' : '#ffffffb5');
  reflection.addColorStop(.45, fire ? '#ffe1a525' : '#d8ffff33');
  reflection.addColorStop(1, '#ffffff00');
  ctx.fillStyle = reflection;
  ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  const rim = ctx.createLinearGradient(center.x - radius, center.y - radius, center.x + radius, center.y + radius);
  rim.addColorStop(0, fire ? '#fff5c9' : '#edffff');
  rim.addColorStop(.48, fire ? '#ffaf59' : '#8be7f6');
  rim.addColorStop(1, fire ? '#903c4e' : '#23579b');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 4 + strength * 3;
  ctx.shadowColor = fire ? '#ffac54' : '#9cf7ff';
  ctx.shadowBlur = 16;
  circle(ctx, center.x, center.y, radius - 2);
  ctx.stroke();
  ctx.restore();
}

export function drawElement(ctx, sourceCanvas, geometry, element, strength, time) {
  if (!geometry) return;
  const yaw = time * (element === 'fire' ? .62 : .4);
  const tilt = geometry.tilt + Math.sin(time * .38) * .08;
  const material = renderElementMaterial(sourceCanvas, geometry, element, strength, time);
  if (element !== 'fire') drawOrbits(ctx, geometry, element, time, yaw, tilt, false);
  if (element !== 'water' && !material) drawFirePlumes(ctx, geometry, strength, time, yaw, tilt, false);
  drawParticles(ctx, geometry, element, strength, time, yaw, tilt, false);
  if (element === 'water' && geometry.enhanced) drawWaterCrest(ctx, geometry, time, yaw, tilt, false);
  drawSphereBody(ctx, sourceCanvas, geometry, element, strength, time, yaw, tilt, material);
  if (element !== 'fire') drawOrbits(ctx, geometry, element, time, yaw, tilt, true);
  if (element !== 'water' && !material) drawFirePlumes(ctx, geometry, strength, time, yaw, tilt, true);
  drawParticles(ctx, geometry, element, strength, time, yaw, tilt, true);
  if (element === 'water' && geometry.enhanced) drawWaterCrest(ctx, geometry, time, yaw, tilt, true);
  if (element === 'hybrid') {
    drawParticles(ctx, geometry, 'fire', strength, time, yaw, tilt, true);
    drawSteam(ctx, geometry, time, strength);
  }
}

function drawWaterCrest(ctx, geometry, time, yaw, tilt, front) {
  ctx.save();
  const edge = angle => {
    const y = Math.sin(angle * 5 + time * 2) * .11 - .12;
    return [project(geometry, Math.cos(angle) * 1.1, y, Math.sin(angle) * 1.1, yaw, tilt),
      project(geometry, Math.cos(angle) * 1.06, y + .05, Math.sin(angle) * 1.06, yaw, tilt)];
  };
  ctx.fillStyle = front ? '#74e7f137' : '#4ac9e520';
  ctx.strokeStyle = front ? '#e5ffff98' : '#a4ffff40'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 64; i++) {
    const [a, b] = edge(i / 64 * TAU);
    const [d, c] = edge((i + 1) / 64 * TAU);
    if (((a.z + d.z) / 2 >= 0) !== front) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.restore();
}

function drawSteam(ctx, geometry, time, strength) {
  ctx.save();
  for (let i = 0; i < 10; i++) {
    const life = (time * .22 + i / 10) % 1;
    const x = geometry.center.x + Math.sin(i * 3.7 + time * .5) * geometry.radius * .65;
    const y = geometry.center.y - geometry.radius * .55 - life * geometry.radius;
    const size = geometry.radius * (.08 + life * .15);
    const fog = ctx.createRadialGradient(x, y, 0, x, y, size);
    fog.addColorStop(0, `rgba(234,251,255,${Math.sin(life * Math.PI) * .17 * strength})`);
    fog.addColorStop(1, '#edffff00');
    ctx.fillStyle = fog; circle(ctx, x, y, size); ctx.fill();
  }
  ctx.restore();
}

function drawFusionBurst(ctx, geometry, strength) {
  const { center, radius, kind, age } = geometry;
  const initial = age < 1.8;
  const life = initial ? age / 1.8 : ((age - 1.8) % 3.8) / 3.8;
  const intensity = initial ? 1 : kind === 'fire' ? .34 : .12;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 68; i++) {
    const angle = i * 2.399963;
    const reach = radius * (1 + life * (1.1 + (i % 5) * .12));
    const x = center.x + Math.cos(angle) * reach;
    const y = center.y + Math.sin(angle) * reach * .85 + life * life * radius * .5;
    const warm = kind === 'fire' || kind === 'hybrid' && i % 2 === 0;
    const size = (2 + i % 5) * (1 - life) * strength * (initial ? 1.7 : 1);
    ctx.globalAlpha = (initial ? Math.min(1, life * 16) : Math.sin(life * Math.PI)) * (1 - life) ** 2 * intensity;
    ctx.strokeStyle = warm ? '#ffbf69' : '#c0fbff';
    ctx.fillStyle = warm ? '#ffe4a2' : '#9cecff';
    ctx.lineWidth = Math.max(1, size);
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle) * radius * .13 * (1 - life), y - Math.sin(angle) * radius * .13 * (1 - life)); ctx.stroke();
    circle(ctx, x, y, Math.max(.4, size)); ctx.fill();
  }
  if (initial) {
    ctx.globalAlpha = Math.min(1, life * 16) * (1 - life) * .45;
    ctx.strokeStyle = kind === 'fire' ? '#ffd6a0' : '#c6ffff'; ctx.lineWidth = 5 * (1 - life) + 1;
    circle(ctx, center.x, center.y, radius * (1 + life * .9)); ctx.stroke();
  }
  ctx.restore();
}

function drawMixing(ctx, sourceCanvas, fusion, strength, time) {
  const { center, progress } = fusion;
  const spin = mixingRotation(time, progress);
  const orbit = 65 * (1 - progress) + 18;
  const mixing = fusion.orbs.map((orb, i) => {
    const angle = spin + i * Math.PI;
    const target = { x: center.x + Math.cos(angle) * orbit, y: center.y + Math.sin(angle) * orbit * .44 };
    return { ...orb, depth: Math.sin(angle), center: {
      x: orb.center.x + (target.x - orb.center.x) * progress,
      y: orb.center.y + (target.y - orb.center.y) * progress,
    }, radius: orb.radius * (1 - progress * .15) };
  }).sort((a, b) => a.depth - b.depth);
  ctx.save();
  for (const orb of mixing) {
    const gradient = ctx.createLinearGradient(orb.center.x, orb.center.y, center.x, center.y);
    gradient.addColorStop(0, orb.element === 'fire' ? '#ffad68' : '#a6f5ff');
    gradient.addColorStop(1, '#fff5d499');
    ctx.strokeStyle = gradient; ctx.lineWidth = 5 + progress * 13;
    ctx.shadowColor = orb.element === 'fire' ? '#ff883e' : '#63dfff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(orb.center.x, orb.center.y);
    ctx.bezierCurveTo(orb.center.x + Math.sin(spin) * 60, orb.center.y - 65, center.x - Math.sin(spin) * 60, center.y + 60, center.x, center.y); ctx.stroke();
  }
  ctx.restore();
  for (const orb of mixing) drawElement(ctx, sourceCanvas, orb, orb.element, strength, time + (orb.slot === 'left' ? 0 : 1.2));
}

export function drawElementalScene(ctx, sourceCanvas, fusion, strength, time, includeUI = true, reducedMotion = false) {
  if (fusion.phase === 'fused' && fusion.fused) {
    const fused = { ...fusion.fused, enhanced: true, age: reducedMotion ? 2 : fusion.fused.age };
    const bounce = 1 + Math.sin(fused.age * 10) * Math.exp(-fused.age * 2.5) * .12;
    fused.radius *= bounce;
    drawElement(ctx, sourceCanvas, fused, fused.kind, strength, time);
    drawFusionBurst(ctx, fused, strength);
    if (fused.kind === 'water') {
      drawParticles(ctx, { ...fused, radius: fused.radius * 1.18 }, 'water', strength, time * .8, time * .3, .6, true);
    }
    return;
  }
  if (fusion.phase === 'mixing' && fusion.orbs.length === 2) {
    drawMixing(ctx, sourceCanvas, fusion, strength, time);
    return;
  }
  for (const orb of fusion.orbs) {
    drawElement(ctx, sourceCanvas, orb, orb.element, strength, time + (orb.slot === 'left' ? 0 : 1.2));
    if (includeUI) {
      ctx.save(); ctx.font = '600 14px DM Sans'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#171827'; ctx.shadowBlur = 6;
      ctx.fillText(`${orb.slot.toUpperCase()} · ${orb.element.toUpperCase()}`, orb.center.x, orb.center.y + orb.radius + 32);
      ctx.restore();
    }
  }
}
