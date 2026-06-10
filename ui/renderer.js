// Map renderer: ASCII/tile canvas with switchable overlays. Presentation only —
// reads world state, never mutates it.
"use strict";

(function () {
  const CW = 9, CH = 13; // cell pixel size

  const OVERLAYS = ["BIOSPHERE", "ELEVATION", "TEMP", "MOISTURE", "WATER", "BIOMASS", "SPECIES", "ENERGY", "CRATERS"];

  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  function rgb(r, g, b) { return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")"; }

  // species color: stable hue from id, tinted by role
  const ROLE_HUE = { photosynth: 130, chemosynth: 35, predator: 0, grazer: 200, decomposer: 280 };
  function speciesColor(sp) {
    const base = ROLE_HUE[sp.role] !== undefined ? ROLE_HUE[sp.role] : 180;
    const jitter = (window.SimRNG.fnv1a("hue" + sp.id) % 40) - 20;
    return "hsl(" + ((base + jitter + 360) % 360) + ",75%,60%)";
  }

  function terrainGlyph(c, world) {
    if (c.waterDepth > 0) {
      if (c.ice) return { ch: "#", color: "#bcd9e8" };
      return c.waterDepth > 2.5 ? { ch: "~", color: "#1d4f7c" } : { ch: "~", color: "#2e739e" };
    }
    if (c.volcanic) return { ch: "*", color: "#c25033" };
    if (c.crater > 0.25) return { ch: "o", color: "#6b5d52" };
    const relEl = c.elevation - Math.max(0, world.seaLevel);
    if (relEl > 3) return { ch: "^", color: "#9a8f80" };
    if (relEl > 1.5) return { ch: "n", color: "#7d7468" };
    if (c.moisture > 0.5 && world.atm.o2 > 1) return { ch: ".", color: "#5d7a4a" };
    return { ch: ".", color: "#705f4e" };
  }

  function cellColor(c, world, overlay, domSpecies) {
    switch (overlay) {
      case "ELEVATION": {
        const t = (c.elevation + 9) / 18;
        return t < 0.5 ? rgb(20, 40 + t * 240, 120 + t * 120) : rgb(60 + (t - .5) * 350, 90 + (t - .5) * 180, 50);
      }
      case "TEMP": {
        const t = (c.temp + 60) / 140;
        return rgb(lerp(40, 255, t), lerp(60, 70, Math.abs(t - .5) * 2), lerp(255, 30, t));
      }
      case "MOISTURE": return rgb(30, lerp(30, 140, c.moisture), lerp(40, 220, c.moisture));
      case "WATER": return c.waterDepth > 0 ? rgb(30, 80 + Math.min(140, c.waterDepth * 30), 200) : rgb(45, 35, 25);
      case "BIOMASS": {
        let bm = 0; const arr = world.popsByCell.get(c.idx);
        if (arr) for (const p of arr) bm += p.biomass;
        const t = Math.min(1, bm / 250);
        return rgb(lerp(18, 90, t), lerp(20, 230, t), lerp(18, 90, t));
      }
      case "ENERGY": {
        const t = Math.min(1, (c.energy + c.ventEnergy) / 150);
        return rgb(lerp(15, 250, t), lerp(15, 190, t), 20);
      }
      case "CRATERS": return rgb(30 + c.crater * 200, 30 + c.crater * 160, 30 + c.crater * 100);
      case "SPECIES": {
        if (domSpecies) return speciesColor(domSpecies);
        return c.waterDepth > 0 ? "#10202e" : "#1a1712";
      }
      default: return null;
    }
  }

  function render(canvas, world, overlay, selectedIdx) {
    const ctx = canvas.getContext("2d");
    const { W, H, cells } = world.grid;
    canvas.width = W * CW; canvas.height = H * CH;
    ctx.fillStyle = "#05080b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "12px 'IBM Plex Mono', monospace";
    ctx.textBaseline = "middle"; ctx.textAlign = "center";

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const px = c.x * CW, py = c.y * CH;
      // dominant species in cell (for SPECIES overlay + biosphere glyphs)
      let dom = null, domBm = 0, totBm = 0;
      const arr = world.popsByCell.get(c.idx);
      if (arr) for (const p of arr) {
        totBm += p.biomass;
        if (p.biomass > domBm) { domBm = p.biomass; dom = world.species.get(p.speciesId); }
      }

      if (overlay === "BIOSPHERE") {
        const g = terrainGlyph(c, world);
        ctx.fillStyle = c.waterDepth > 0 ? (c.ice ? "#0d1c26" : (c.waterDepth > 2.5 ? "#08141f" : "#0b1d2b")) : "#100e0a";
        ctx.fillRect(px, py, CW, CH);
        if (totBm > 1 && dom) {
          ctx.fillStyle = speciesColor(dom);
          const ch = totBm > 150 ? "@" : totBm > 40 ? "%" : totBm > 8 ? "+" : "·";
          ctx.fillText(ch, px + CW / 2, py + CH / 2 + 1);
        } else {
          ctx.fillStyle = g.color;
          ctx.fillText(g.ch, px + CW / 2, py + CH / 2 + 1);
        }
      } else {
        const col = cellColor(c, world, overlay, dom);
        ctx.fillStyle = col;
        ctx.fillRect(px, py, CW - 1, CH - 1);
        if (overlay === "SPECIES" && dom) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillText(domBm > 40 ? "@" : "+", px + CW / 2, py + CH / 2 + 1);
        }
      }
      if (selectedIdx === i) {
        ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.5, py + 0.5, CW - 1, CH - 1);
      }
    }
  }

  // ---- solar system mini-view ----
  function renderSystem(canvas, world) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * 2;
    const h = canvas.height = 340;
    ctx.fillStyle = "#05080b"; ctx.fillRect(0, 0, w, h);
    const sys = world.system;
    const maxAU = sys.planets[sys.planets.length - 1].orbitAU * 1.15;
    const xOf = au => 70 + (Math.log(au + 0.05) - Math.log(0.05)) / (Math.log(maxAU + 0.05) - Math.log(0.05)) * (w - 130);
    const midY = h / 2;

    // habitable zone band
    const hx1 = xOf(sys.hzInner), hx2 = xOf(sys.hzOuter);
    ctx.fillStyle = "rgba(80,200,120,0.10)";
    ctx.fillRect(hx1, 30, hx2 - hx1, h - 60);
    ctx.strokeStyle = "rgba(80,200,120,0.35)"; ctx.setLineDash([4, 4]);
    ctx.strokeRect(hx1, 30, hx2 - hx1, h - 60); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(80,200,120,0.7)"; ctx.font = "20px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("HABITABLE ZONE", (hx1 + hx2) / 2, 24);

    // stars
    let sy = midY - (sys.stars.length - 1) * 22;
    for (const s of sys.stars) {
      const r = Math.max(8, Math.min(26, 10 + s.luminosity * 3));
      ctx.beginPath(); ctx.arc(36, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 24;
      ctx.fill(); ctx.shadowBlur = 0;
      sy += 44;
    }
    // orbit line
    ctx.strokeStyle = "rgba(160,180,200,0.18)";
    ctx.beginPath(); ctx.moveTo(60, midY); ctx.lineTo(w - 30, midY); ctx.stroke();

    // planets
    ctx.font = "18px 'IBM Plex Mono', monospace";
    for (const p of sys.planets) {
      const x = xOf(p.orbitAU);
      const r = p.type === "gas giant" ? 13 : p.type === "ice giant" ? 9 : Math.max(3.5, p.radius * 4);
      ctx.beginPath(); ctx.arc(x, midY, r, 0, Math.PI * 2);
      ctx.fillStyle = p.type === "gas giant" ? "#c9995f" : p.type === "ice giant" ? "#7fb7d9" : p.isFocus ? "#5d9e6b" : "#8d8478";
      ctx.fill();
      if (p.isFocus) {
        ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, midY, r + 6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#ffe9a8";
        ctx.fillText("◆ " + p.name, x, midY + r + 34);
      } else {
        ctx.fillStyle = "rgba(170,180,190,0.65)";
        ctx.fillText(p.name.split(" ").pop(), x, midY + r + 28);
      }
      ctx.fillStyle = "rgba(140,150,160,0.5)"; ctx.font = "15px 'IBM Plex Mono', monospace";
      ctx.fillText(p.orbitAU + " AU", x, midY - r - 14);
      ctx.font = "18px 'IBM Plex Mono', monospace";
    }
  }

  window.SimRender = { OVERLAYS, render, renderSystem, speciesColor, CW, CH };
})();
