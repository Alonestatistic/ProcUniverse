// Impact scheduler & resolution: heavy bombardment decaying over time.
// Impacts deliver water/organics, carve craters, heat the world, can kill, can seed microbes.
"use strict";

function expectedImpactsPerTick(world, dtYears) {
  const ageGyr = world.ageYears / 1e9;
  // heavy bombardment decays over first ~0.8 Gyr, low background after
  const rate = world.system.debrisDensity * (Math.exp(-ageGyr / 0.30) * 5.0 + 0.012); // impacts per Myr
  return rate * (dtYears / 1e6);
}

function resolveImpacts(world, dtYears) {
  const rng = world.rng.stream("impacts");
  const expected = expectedImpactsPerTick(world, dtYears);
  // deterministic Poisson-ish: integer part + fractional chance
  let n = Math.floor(expected);
  if (rng.chance(expected - n)) n++;
  if (n <= 0) return;
  n = Math.min(n, 12); // batch cap; very fast eras summarize
  let summary = { count: 0, water: 0, biggest: 0 };

  for (let k = 0; k < n; k++) {
    const size = rng.powerLaw(0.5, 60, -2.2); // km diameter equiv
    const idx = rng.int(0, world.grid.cells.length - 1);
    const cell = world.grid.cells[idx];
    const isComet = rng.chance(0.45 * world.system.cometReservoir / (world.system.cometReservoir + 1) + 0.25);

    // water/volatile delivery (comets richer)
    const waterDelivered = Math.pow(size, 2.1) * (isComet ? 0.0022 : 0.0005);
    world.hydro += waterDelivered;
    world.atm.co2 += Math.pow(size, 1.8) * 0.0006; // volatile outgassing on impact
    summary.count++; summary.water += waterDelivered; summary.biggest = Math.max(summary.biggest, size);

    // crater + heating for significant impacts
    if (size > 6) {
      cell.elevation = Math.max(-9, cell.elevation - size * 0.04);
      cell.crater = Math.min(1, cell.crater + size / 40);
      for (const ni of window.SimTerrain.neighborIdx(world.grid, idx)) {
        world.grid.cells[ni].elevation += size * 0.008; // rim
        world.grid.cells[ni].crater = Math.min(1, world.grid.cells[ni].crater + size / 90);
      }
      world.seaLevelDirty = true;
    }
    if (size > 25) {
      // global heat pulse: boils off some ocean, stresses life
      world.tempPulse += size * 0.10;
      world.hydro = Math.max(0, world.hydro - Math.pow(size, 1.6) * 0.002);
      world.seaLevelDirty = true;
    }

    // kill populations near ground zero
    let killed = 0;
    if (world.populations.size > 0 && size > 3) {
      const radius = size > 25 ? 4 : size > 10 ? 2 : 1;
      const hit = cellsWithin(world.grid, idx, radius);
      for (const ci of hit) {
        for (const pop of world.popsByCell.get(ci) || []) {
          const frac = size > 35 ? 1 : 0.5 + size / 80;
          pop.biomass *= (1 - Math.min(1, frac));
          killed++;
        }
      }
    }

    // panspermia: comets/asteroids may carry durable microbes (world pathway dependent)
    let seeded = false;
    if (!cellIsSterile(world, cell) && world.panspermiaRate > 0 && size < 20) {
      const pSeed = world.panspermiaRate * (isComet ? 0.012 : 0.004);
      if (rng.chance(pSeed) && cell.waterDepth > 0 && cell.temp > -5 && cell.temp < 70) {
        seeded = window.SimBiology.foundSpecies(world, cell, "panspermia (" + (isComet ? "comet" : "asteroid") + ")");
      }
    }

    // record major impacts individually
    if (size > 18 || seeded) {
      const desc = window.SimNames.regionDescriptor(cell);
      world.history.record(world, {
        type: "impact",
        importance: seeded ? 9 : Math.min(9, 3 + size / 9),
        text: (isComet ? "Comet" : "Asteroid") + " impact (" + size.toFixed(0) + " km) struck " + desc
          + (waterDelivered > 0.5 ? ", delivering significant water" : "")
          + (size > 25 ? "; global heating boiled part of the hydrosphere" : "")
          + (killed > 0 ? "; regional populations devastated" : "")
          + (seeded ? "; durable microbes survived entry — panspermia" : "") + ".",
      });
    }
  }
  // aggregate minor bombardment into era summaries
  world.history.accumulateMinorImpacts(world, summary);
}

function cellsWithin(grid, idx, radius) {
  const W = grid.W, H = grid.H;
  const x0 = idx % W, y0 = (idx / W) | 0;
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const y = y0 + dy;
    if (y < 0 || y >= H) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = (x0 + dx + W) % W;
      out.push(y * W + x);
    }
  }
  return out;
}

function cellIsSterile(world, cell) {
  return false; // hook for future per-cell sterility
}

window.SimImpacts = { resolveImpacts, cellsWithin };
