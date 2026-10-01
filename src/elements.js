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
  const x = Math.cos(angle) * 1.22;
  const y = Math.sin(angle) * Math.cos(inclination) * 1.22;
  const z = Math.sin(angle) * Math.sin(inclination) * 1.22;
  return project(geometry, x * Math.cos(phase) - y * Math.sin(phase), x * Math.sin(phase) + y * Math.cos(phase), z, yaw, tilt);
}

function drawOrbits(ctx, geometry, element, time, yaw, tilt, front) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = element === 'fire' ? '#ff9a55' : '#9cf7ff';
  ctx.shadowBlur = front ? 14 : 5;
  for (let ring = 0; ring < 2; ring++) {
    ctx.strokeStyle = element === 'fire'
      ? front ? '#ffd08bc7' : '#ff81537a'
      : front ? '#c4ffffdb' : '#70d9ef85';
    ctx.lineWidth = front ? 3.5 - ring * .7 : 2.1;
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
    const length = (.11 + .13 * (Math.sin(time * (5 + i % 4) + i * 3.4) * .5 + .5)) * (.5 + strength);
    const y = 1 - 2 * (i + .5) / count;
    const ringRadius = Math.sqrt(1 - y * y);
    const angle = i * 2.399963 + time * .34;
    const tip = project(geometry, ringRadius * Math.cos(angle) * (1 + length), y * (1 + length) - length * .44, ringRadius * Math.sin(angle) * (1 + length), yaw, tilt);
    const radialX = base.x - geometry.center.x;
    const radialY = base.y - geometry.center.y;
    const radialLength = Math.max(1, Math.hypot(radialX, radialY));
    const tangentX = -radialY / radialLength;
    const tangentY = radialX / radialLength;
    const width = (4 + strength * 4) * base.scale;
    const gradient = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
    gradient.addColorStop(0, front ? '#fff2b8e0' : '#ff98587a');
    gradient.addColorStop(.45, front ? '#ff9d4ac0' : '#f85b5370');
    gradient.addColorStop(1, '#f3415800');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(base.x + tangentX * width, base.y + tangentY * width);
    ctx.quadraticCurveTo(tip.x + tangentX * width * .5, tip.y + tangentY * width * .5, tip.x, tip.y);
    ctx.quadraticCurveTo(tip.x - tangentX * width * .6, tip.y - tangentY * width * .6, base.x - tangentX * width, base.y - tangentY * width);
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
    const rise = (time * (element === 'fire' ? 9 + i % 5 : 6 + i % 4) + i * (element === 'fire' ? 13 : 7)) % (element === 'fire' ? 24 : 16);
    ctx.globalAlpha = (front ? .75 : .36) * strength;
    if (element === 'fire') {
      ctx.shadowColor = '#ffbe72';
      ctx.shadowBlur = front ? 10 : 4;
      ctx.fillStyle = i % 5 ? '#ffb76f' : '#fff3c7';
      circle(ctx, p.x, p.y - rise, size);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#d8ffff';
      ctx.lineWidth = Math.max(1, size * .25);
      circle(ctx, p.x, p.y - rise, size);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      circle(ctx, p.x - size * .3, p.y - rise - size * .3, Math.max(.8, size * .16));
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSphereGrid(ctx, geometry, element, yaw, tilt) {
  ctx.save();
  ctx.strokeStyle = element === 'fire' ? '#ffd59980' : '#d2ffffa0';
  ctx.lineWidth = element === 'fire' ? 1.4 : 1.6;
  ctx.shadowColor = element === 'fire' ? '#ffb36c' : '#9af6ff';
  ctx.shadowBlur = 6;
  function drawLine(pointAt) {
    let drawing = false;
    ctx.beginPath();
    for (let step = 0; step <= 72; step++) {
      const p = pointAt(step / 72);
      if (p.z >= -.025) {
        if (!drawing) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        drawing = true;
      } else drawing = false;
    }
    ctx.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    const latitude = i * .32;
    drawLine(t => {
      const longitude = t * TAU;
      const horizontal = Math.cos(latitude);
      return project(geometry, horizontal * Math.cos(longitude), Math.sin(latitude), horizontal * Math.sin(longitude), yaw, tilt);
    });
  }
  for (let i = 0; i < 12; i++) {
    const longitude = i / 12 * TAU;
    drawLine(t => {
      const latitude = -Math.PI / 2 + t * Math.PI;
      const horizontal = Math.cos(latitude);
      return project(geometry, horizontal * Math.cos(longitude), Math.sin(latitude), horizontal * Math.sin(longitude), yaw, tilt);
    });
  }
  ctx.restore();
}

function drawSphereBody(ctx, sourceCanvas, geometry, element, strength, time, yaw, tilt) {
  const { center, radius } = geometry;
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
  ctx.filter = fire ? 'contrast(1.3) saturate(2.1) sepia(.75)' : 'contrast(1.16) saturate(1.65) hue-rotate(9deg)';
  const top = Math.max(0, Math.floor((center.y - radius) / 30) * 30);
  const bottom = Math.min(HEIGHT, center.y + radius);
  for (let y = top; y < bottom; y += 30) {
    const height = Math.min(30, HEIGHT - y);
    const relativeY = (y - center.y) / radius;
    const bulge = 1 + .12 * (1 - relativeY * relativeY);
    const shimmer = Math.sin(y * (fire ? .065 : .042) + time * (fire ? 6 : 2.8)) * (fire ? 5 : 9) * strength;
    ctx.drawImage(sourceCanvas, 0, y, WIDTH, height, (WIDTH - WIDTH * bulge) / 2 + shimmer, y, WIDTH * bulge, height);
  }
  ctx.filter = 'none';
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
  drawSphereGrid(ctx, geometry, element, yaw, tilt);

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
  drawOrbits(ctx, geometry, element, time, yaw, tilt, false);
  if (element === 'fire') drawFirePlumes(ctx, geometry, strength, time, yaw, tilt, false);
  drawParticles(ctx, geometry, element, strength, time, yaw, tilt, false);
  drawSphereBody(ctx, sourceCanvas, geometry, element, strength, time, yaw, tilt);
  drawOrbits(ctx, geometry, element, time, yaw, tilt, true);
  if (element === 'fire') drawFirePlumes(ctx, geometry, strength, time, yaw, tilt, true);
  drawParticles(ctx, geometry, element, strength, time, yaw, tilt, true);
}
