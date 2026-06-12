"use strict";
(function () {
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function morphotype(sp) {
    const g = sp.genome;
    if (g.size > .72 && g.motility > .55) return "proto-creature morph";
    if (g.armor > .62 || g.toxin > .65) return "fortified colony morph";
    if (g.predation > .5) return "hunter-cell morph";
    if (g.dispersal > .65) return "drifter morph";
    return g.chemo > g.photo ? "vent-feeder morph" : "sun-feeder morph";
  }
  function draw(canvas, sp) {
    const ctx = canvas.getContext("2d"), g = sp.genome;
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h * .51;
    const hue = window.SimRNG.fnv1a("creature/" + sp.id) % 360;
    const rx = 86 + g.size * 108, ry = 54 + g.size * 60;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, w * .55);
    bg.addColorStop(0, "#183542"); bg.addColorStop(.58, "#0a1720"); bg.addColorStop(1, "#04080b");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(cx, cy); ctx.lineCap = "round";

    const limbs = 2 + Math.floor(g.motility * 8);
    for (let i = 0; i < limbs; i++) {
      const a = i * Math.PI * 2 / limbs + sp.id * .03;
      const x = Math.cos(a) * rx * .88, y = Math.sin(a) * ry * .82;
      const len = 28 + g.motility * 82;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + Math.cos(a) * len * .4 - Math.sin(a) * 14,
        y + Math.sin(a) * len * .4 + Math.cos(a) * 14,
        x + Math.cos(a) * len * .75 + Math.sin(a) * 22,
        y + Math.sin(a) * len * .75 - Math.cos(a) * 22,
        x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.strokeStyle = `hsla(${hue},70%,68%,${.25 + g.motility * .5})`;
      ctx.lineWidth = 2 + g.size * 2; ctx.stroke();
    }

    const spikes = Math.floor(g.armor * 12);
    for (let i = 0; i < spikes; i++) {
      const a = i * Math.PI * 2 / spikes;
      const x = Math.cos(a) * rx * .94, y = Math.sin(a) * ry * .94;
      const nx = Math.cos(a), ny = Math.sin(a), len = 12 + g.armor * 30;
      ctx.beginPath(); ctx.moveTo(x - ny * 7, y + nx * 7);
      ctx.lineTo(x + nx * len, y + ny * len); ctx.lineTo(x + ny * 7, y - nx * 7); ctx.closePath();
      ctx.fillStyle = `hsla(${(hue + 25) % 360},55%,45%,.85)`; ctx.fill();
    }

    const lobes = 2 + Math.floor(g.dispersal * 4), points = 84;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = i * Math.PI * 2 / points;
      const wobble = 1 + .06 * Math.sin(a * lobes + sp.id) + .03 * Math.sin(a * (lobes + 3));
      const x = Math.cos(a) * rx * wobble, y = Math.sin(a) * ry * wobble;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const body = ctx.createRadialGradient(-rx * .25, -ry * .3, 4, 0, 0, rx * 1.25);
    body.addColorStop(0, `hsla(${(hue + 38) % 360},82%,72%,.96)`);
    body.addColorStop(.45, `hsla(${hue},72%,49%,.95)`);
    body.addColorStop(1, `hsla(${(hue + 330) % 360},76%,20%,.98)`);
    ctx.fillStyle = body; ctx.shadowColor = `hsla(${hue},80%,55%,.45)`; ctx.shadowBlur = 28; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = `hsla(${hue},85%,78%,.68)`; ctx.lineWidth = 3; ctx.stroke();

    const organelles = 5 + Math.floor(g.energyEff * 10);
    for (let i = 0; i < organelles; i++) {
      const a = i * 2.399 + sp.id, r = Math.sqrt((i + 1) / (organelles + 1));
      const x = Math.cos(a) * rx * .63 * r, y = Math.sin(a) * ry * .58 * r;
      ctx.beginPath(); ctx.ellipse(x, y, 10 + i % 5, 6 + i % 4, a, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${g.photo > g.chemo ? 110 : 42},75%,55%,${.25 + g.energyEff * .3})`; ctx.fill();
    }

    ctx.beginPath(); ctx.ellipse(-rx * .12, 0, 30 + g.mutationRate * 22, 22 + g.mutationRate * 15, -.25, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(hue + 190) % 360},65%,26%,.82)`; ctx.fill();

    const eyes = 1 + Math.floor((g.motility + g.predation) * 2.1);
    for (let i = 0; i < eyes; i++) {
      const ey = (i - (eyes - 1) / 2) * 22, ex = rx * .48 - Math.abs(ey) * .12;
      ctx.beginPath(); ctx.arc(ex, ey, 9 + g.predation * 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235,250,255,.88)"; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 3, ey, 3.5 + g.predation * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = g.predation > .45 ? "#ff654f" : "#17232b"; ctx.fill();
    }

    const mouthX = rx * .73;
    ctx.beginPath(); ctx.ellipse(mouthX, 0, 6 + g.predation * 20, 5 + g.predation * 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15,5,8,.86)"; ctx.fill();
    if (g.toxin > .45) {
      const n = 2 + Math.floor(g.toxin * 6);
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n + .5;
        ctx.beginPath(); ctx.arc(Math.cos(a) * rx * .58, Math.sin(a) * ry * .55, 5 + g.toxin * 6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(hue + 285) % 360},90%,65%,.72)`; ctx.fill();
      }
    }
    ctx.restore();
    ctx.fillStyle = "rgba(205,217,224,.86)"; ctx.font = "600 15px 'IBM Plex Mono', monospace"; ctx.textAlign = "left";
    ctx.fillText(sp.name, 20, 28); ctx.fillStyle = "rgba(126,143,154,.82)"; ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.fillText(morphotype(sp).toUpperCase(), 20, 48); ctx.textAlign = "right";
    ctx.fillText("ARTISTIC GENOME VISUALIZATION", w - 20, h - 18);
  }
  window.ProcCreature = { draw, morphotype, clamp };
})();
