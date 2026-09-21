const NAMES = ["Walk","Conga bounce","Jumping jacks","Swagger","Barrel roll","Chicken dance","Disco point","Squat hop","Worm wave","Kick line"];
const COLORS = ["#f8fafc","#7c8cff","#7dd3c7","#e08a8a"];
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const label = document.getElementById("move");
const MOVE_MS = 10000;
const start = performance.now();
function fit() {
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(400, Math.floor(r.width * dpr));
  canvas.height = Math.floor(72 * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fit();
window.addEventListener("resize", fit);
function limb(ax, ay, ang, len) {
  return [ax + Math.sin(ang) * len, ay + Math.cos(ang) * len];
}
function drawHair(x, y, color, tilt) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
  for (let i = -2; i <= 2; i++) {
    const dx = i * 5;
    ctx.beginPath();
    ctx.moveTo(x + dx + tilt * 4, y - 16);
    ctx.lineTo(x + dx + tilt * 2, y - 6);
    ctx.stroke();
  }
}
function drawHead(x, y, color, tilt, smile) {
  drawHair(x, y, color, tilt);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x - 6 + tilt * 2, y - 1, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6 + tilt * 2, y - 1, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x + tilt * 2, y + 2, 8, 0.2, Math.PI - 0.2, smile < 0);
  ctx.stroke();
}
function pose(move, t, who) {
  const w = t * Math.PI * 2;
  const s = Math.sin(w), c = Math.cos(w);
  switch (move) {
    case 0: {
      const a = s;
      return { hipY: Math.abs(s) * 3, tilt: 0.16, spin: 0, smile: 1, uaL: 0.85 + a * 0.45, laL: 0.5, uaR: 0.15 - a * 0.45, laR: 0.45, ulL: -0.12 - a * 0.38, llL: 0.5 + Math.max(0, a) * 0.55, ulR: 0.42 + a * 0.55, llR: 0.35 + Math.max(0, -a) * 0.6 };
    }
    case 1:
      return { hipY: Math.abs(s) * 10, tilt: 0.2 + s * 0.08, spin: 0, smile: 1, uaL: 0.35, laL: 0.5, uaR: 1.55 + s * 0.25, laR: 0.25, ulL: -0.15, llL: 0.7, ulR: 0.45 + Math.abs(s) * 0.25, llR: 0.55 };
    case 2: {
      const up = Math.max(0, -c);
      return { hipY: up * 16, tilt: 0.08, spin: 0, smile: 1, uaL: 0.55 + up * 1.7, laL: 0.15, uaR: 0.9 + up * 1.9, laR: 0.1, ulL: -0.05 + up * 0.35, llL: 0.25, ulR: 0.25 + up * 0.55, llR: 0.2 };
    }
    case 3:
      return { hipY: 2 + Math.abs(s) * 3, tilt: 0.22, spin: 0, smile: 1, uaL: 1.1 + s * 0.3, laL: 0.35, uaR: 0.2 - s * 0.25, laR: 0.55, ulL: -0.2, llL: 0.45, ulR: 0.55 + s * 0.35, llR: 0.25 };
    case 4:
      return { hipY: 8 + (1 - Math.cos(w)) * 6, tilt: 0, spin: w, smile: 1, uaL: 0.6, laL: 0.4, uaR: 1.3, laR: 0.3, ulL: -0.2, llL: 0.4, ulR: 0.55, llR: 0.35 };
    case 5:
      return { hipY: Math.abs(s) * 6, tilt: 0.14, spin: 0, smile: 1, uaL: 0.7 + s * 0.5, laL: 1.2, uaR: 1.1 - s * 0.5, laR: 1.2, ulL: -0.1, llL: 0.55, ulR: 0.35 + Math.abs(s) * 0.2, llR: 0.5 };
    case 6:
      return { hipY: Math.abs(s) * 8, tilt: 0.2, spin: 0, smile: 1, uaL: 0.35, laL: 0.45, uaR: 2.55 + s * 0.12, laR: 0.05, ulL: -0.15, llL: 0.55, ulR: 0.4, llR: 0.45 };
    case 7: {
      const down = (c * 0.5 + 0.5);
      return { hipY: 6 + down * 14, tilt: 0.12, spin: 0, smile: 1, uaL: 0.55, laL: 0.9, uaR: 0.9, laR: 0.9, ulL: 0.35 + down * 0.45, llL: 0.9 + down * 0.25, ulR: 0.55 + down * 0.35, llR: 0.9 + down * 0.25 };
    }
    case 8: {
      const k = Math.sin(w + who * 0.35);
      return { hipY: 10 + k * 10, tilt: 0.25 + k * 0.2, spin: 0.15, smile: 1, uaL: 0.4, laL: 0.3, uaR: 1.6, laR: 0.2, ulL: 0.15, llL: 0.3, ulR: 0.9, llR: 0.2 };
    }
    default:
      return { hipY: Math.abs(s) * 4, tilt: 0.18, spin: 0, smile: 1, uaL: 0.45, laL: 0.25, uaR: 1.4, laR: 0.15, ulL: -0.05, llL: 0.4, ulR: 0.35 + Math.max(0, s) * 1.45, llR: 0.12 };
  }
}
function drawDude(x, ground, color, p) {
  const hipX = x, hipY = ground - 34 + p.hipY;
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(p.spin + (p.tilt || 0));
  ctx.translate(-hipX, -hipY);
  const neckY = hipY - 22;
  const headY = neckY - 10;
  drawHead(hipX, headY, color, p.tilt, p.smile);
  ctx.strokeStyle = color; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(hipX, neckY); ctx.lineTo(hipX, hipY); ctx.stroke();
  const [eL, eLy] = limb(hipX, neckY + 6, p.uaL, 14);
  const [hL, hLy] = limb(eL, eLy, p.uaL + p.laL, 12);
  const [eR, eRy] = limb(hipX, neckY + 6, p.uaR, 14);
  const [hR, hRy] = limb(eR, eRy, p.uaR + p.laR, 12);
  ctx.beginPath(); ctx.moveTo(hipX, neckY + 6); ctx.lineTo(eL, eLy); ctx.lineTo(hL, hLy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, neckY + 6); ctx.lineTo(eR, eRy); ctx.lineTo(hR, hRy); ctx.stroke();
  const [kL, kLy] = limb(hipX, hipY, p.ulL, 16);
  const [fL, fLy] = limb(kL, kLy, p.ulL + p.llL, 16);
  const [kR, kRy] = limb(hipX, hipY, p.ulR, 16);
  const [fR, fRy] = limb(kR, kRy, p.ulR + p.llR, 16);
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kL, kLy); ctx.lineTo(fL, fLy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kR, kRy); ctx.lineTo(fR, fRy); ctx.stroke();
  ctx.restore();
}
function frame(now) {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.width / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, 72);
  const scale = 72 / 130;
  ctx.scale(scale, scale);
  const w = cssW / scale;
  const elapsed = now - start;
  const move = Math.floor(elapsed / MOVE_MS) % 10;
  const cycle = (elapsed / 1400) % 1;
  const CROSS_MS = 10000;
  const groupX = ((elapsed / CROSS_MS) * (w + 420) % (w + 420)) - 200;
  for (let i = 0; i < 4; i++) drawDude(groupX + i * 78, 118, COLORS[i], pose(move, cycle, i));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
