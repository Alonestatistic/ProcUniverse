// Regional climate: temperature, moisture, sunlight, producer energy budgets.
// temp = stellar_input*latitude + greenhouse - elevation_cooling + ocean_moderation + local_variation
"use strict";

// static per-cell variation field, generated once per world (climate stream)
function makeLocalVariation(rng, n) {
  const f = new Float32Array(n);
  for (let i = 0; i < n; i++) f[i] = rng.gauss(0, 2.2);
  return f;
}

function greenhouseC(atm) {
  // simplified radiative forcing; CO2 log response, CH4 strong per-unit, vapor feedback
  const co2 = Math.max(0, atm.co2), ch4 = Math.max(0, atm.ch4);
  return 22 * Math.log2(1 + co2 / 8) + 14 * (ch4 / (ch4 + 0.5)) + atm.vapor * 6;
}

function updateClimate(world) {
  const { grid, atm, system } = world;
  const focus = world.focusPlanet;
  const flux = system.totalLuminosity / (focus.orbitAU * focus.orbitAU);
  // blackbody-ish equilibrium baseline (°C)
  const baseT = 278 * Math.pow(flux, 0.25) - 273;
  const gh = greenhouseC(atm);
  // vapor feedback: more ocean + heat -> more vapor (bounded)
  const oceanFrac = world.oceanFrac;
  atm.vapor = Math.max(0, Math.min(3, oceanFrac * 3 * Math.max(0, (baseT + gh + 20) / 60)));

  const eqPoleDelta = 46 - Math.min(18, gh * 0.25); // thicker atmosphere -> milder gradient
  let sumT = 0;

  // pass 1: raw temp + sunlight
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const latRad = c.lat * Math.PI / 180;
    const latFactor = Math.cos(latRad);
    let t = baseT + gh - eqPoleDelta * (1 - latFactor);
    const landElev = c.waterDepth > 0 ? 0 : Math.max(0, c.elevation - world.seaLevel + (world.seaLevel > c.elevation ? 0 : 0));
    t -= Math.max(0, c.elevation - Math.max(0, world.seaLevel)) * (c.waterDepth > 0 ? 0 : 5.5); // lapse ~5.5°C/km
    t += world.localVar[i];
    c.temp = t;
    c.sunlight = Math.max(0.03, latFactor) * Math.min(1.6, flux);
    sumT += t;
  }
  // pass 2: ocean moderation (water cells & coastal pull toward mean)
  const meanT = sumT / cells.length;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.waterDepth > 0) {
      c.temp = c.temp * 0.7 + meanT * 0.3;
      c.ice = c.temp < -2;
    } else {
      c.ice = false;
    }
  }
  world.globalTemp = meanT;

  // moisture: smoothing diffusion from water cells, mountains block
  const W = grid.W, H = grid.H;
  const m0 = world._moistBuf || (world._moistBuf = new Float32Array(cells.length));
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    m0[i] = c.waterDepth > 0 && !c.ice ? 1 : (c.ice ? 0.3 : c.moisture * 0.5);
  }
  // a few diffusion passes with eastward prevailing transport
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = cells[i];
        if (c.waterDepth > 0) continue;
        const west = y * W + ((x - 1 + W) % W);
        const east = y * W + ((x + 1) % W);
        const north = y > 0 ? i - W : i;
        const south = y < H - 1 ? i + W : i;
        let inflow = m0[west] * 0.5 + m0[east] * 0.2 + m0[north] * 0.15 + m0[south] * 0.15;
        // rain shadow: high elevation upstream (west) blocks
        if (cells[west].elevation > c.elevation + 1.5 && cells[west].waterDepth === 0) inflow *= 0.45;
        m0[i] = Math.max(m0[i], inflow * 0.92);
      }
    }
  }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    c.moisture = c.waterDepth > 0 ? 1 : Math.min(1, m0[i]);
  }
}

// producer energy budgets per cell (photosynthetic + chemosynthetic potential)
function updateResources(world) {
  const cells = world.grid.cells;
  const o2Shield = Math.min(1, world.atm.o2 / 4); // UV shielding gates land productivity
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    let e = 0;
    if (c.waterDepth > 0 && !c.ice) {
      // shallow water is most productive
      const depthFactor = c.waterDepth < 1.5 ? 1 : Math.max(0.15, 1.5 / c.waterDepth * 0.7);
      e = c.sunlight * depthFactor;
    } else if (c.waterDepth === 0) {
      e = c.sunlight * c.moisture * o2Shield * 0.8;
    } else if (c.ice) {
      e = c.sunlight * 0.05;
    }
    c.energy = e * 100; // arbitrary energy units per tick
    c.ventEnergy = c.volcanic ? 45 * world.volcanismLevel : (c.waterDepth > 3 && world.volcanismLevel > 0.4 ? 6 : 0);
  }
}

window.SimClimate = { makeLocalVariation, greenhouseC, updateClimate, updateResources };
