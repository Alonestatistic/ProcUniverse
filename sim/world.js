// WorldState + deterministic tick pipeline + adaptive simulation clock + tests.
// Simulation core is plain data + pure functions; no DOM dependencies here.
"use strict";

(function () {
  const T = window.SimTerrain;

  function createWorld(seedString) {
    window.SimBiology.resetSeq();
    const rng = new window.SimRNG.RngRoot(seedString);
    const sysRng = rng.stream("system");
    const namesRng = rng.stream("naming");
    const system = window.SimStarSystem.generateStarSystem(sysRng, namesRng);
    const focusPlanet = system.planets.find(p => p.isFocus);

    const terrainRng = rng.stream("terrain");
    const grid = window.SimTerrain.generateTerrain(terrainRng, focusPlanet);

    const abioRng = rng.stream("abio");
    const world = {
      seedString, rng, system, focusPlanet, grid,
      ageYears: 0, tickCount: 0,
      hydro: focusPlanet.initialWater * 80, // cell-km of water; "80" ≈ full shallow ocean
      seaLevel: -99, seaLevelDirty: true, oceanFrac: 0,
      atm: { n2: 78, co2: 18, o2: 0.0, ch4: 0.02, vapor: 0 },
      volcanismLevel: focusPlanet.volcanism,
      tempPulse: 0, globalTemp: 0,
      localVar: window.SimClimate.makeLocalVariation(rng.stream("climate"), grid.cells.length),
      species: new Map(),
      populations: new Map(),
      popsByCell: new Map(),
      totalBiomass: 0,
      lifePresent: false,
      recentExtinctions: [],
      massExtinctionActive: false,
      history: new window.SimHistory.History(),
      // per-world life-origin character (some worlds are simply unlucky)
      abioFavorability: abioRng.powerLaw(0.05, 1.0, -1.2),
      panspermiaRate: abioRng.chance(0.6) ? abioRng.float(0.2, 1.0) : 0,
      firstLifeRecorded: false, firstPredationRecorded: false,
      firstLandRecorded: false, oxygenEventRecorded: false, sterilizedRecorded: false,
      firstOceanRecorded: false,
    };
    world.history.record(world, {
      type: "geology", importance: 8,
      text: "Planet " + focusPlanet.name + " formed: a barren " + focusPlanet.type + " world ("
        + focusPlanet.radius + " R⊕) orbiting at " + focusPlanet.orbitAU + " AU"
        + (focusPlanet.inHZ ? ", inside the habitable zone." : ", outside the nominal habitable zone."),
    });
    return world;
  }

  // adaptive tick length from current era/state. Slows during crises and active
  // radiation; speeds up when the biosphere is stable so deep time still passes.
  function pickDt(world) {
    if (!world.lifePresent) {
      if (world.oceanFrac < 0.02) return 1e6;       // barren bombardment era
      return 2.5e5;                                  // oceans, waiting for life
    }
    if (world.massExtinctionActive) return 1e4;      // crisis: fine resolution
    if (world.recentExtinctions.length >= 2) return 2e4; // turbulent
    if (world.tempPulse > 1) return 2e4;             // recovering from impact heat
    return 6e4;                                      // stable microbial ecosystem
  }

  function aliveSpeciesCount(world) {
    let n = 0;
    for (const [, sp] of world.species) if (sp.extinctTime === null) n++;
    return n;
  }

  // ---- the documented stable pipeline order ----
  function tick(world) {
    const dt = pickDt(world);
    world.tickCount++;
    world.ageYears += dt;

    // 1-2. astronomical state + impacts
    window.SimImpacts.resolveImpacts(world, dt);

    // 3. geology: volcanism decays, outgasses CO2 + traces of water
    world.volcanismLevel = world.focusPlanet.volcanism * Math.exp(-world.ageYears / 9e9);
    world.atm.co2 = Math.min(45, world.atm.co2 + world.volcanismLevel * dt * 2.0e-9 * 1e3);
    world.hydro += world.volcanismLevel * dt * 4e-9 * 1e3;
    // carbonate-silicate thermostat: once oceans exist, silicate weathering relaxes CO2
    // toward a wet setpoint (stronger when warmer/wetter). This stabilises climate and
    // is what lets a barren hot world cool into a habitable window. Bounded by design.
    if (world.oceanFrac > 0.01) {
      const co2Set = 4.5;                       // wet-planet CO2 attractor (kPa)
      const warmth = Math.max(0.2, (world.globalTemp + 5) / 25);
      const relax = Math.min(0.9, world.oceanFrac * warmth * dt * 2.2e-7);
      world.atm.co2 += (co2Set - world.atm.co2) * relax;
      world.atm.co2 = Math.max(0.05, world.atm.co2);
    }

    // 4. hydrosphere: recompute sea level when changed
    if (world.seaLevelDirty || (world.tickCount & 15) === 0) {
      world.seaLevel = T.computeSeaLevel(world.grid, world.hydro);
      world.oceanFrac = T.applySeaLevel(world.grid, world.seaLevel);
      world.seaLevelDirty = false;
      if (!world.firstOceanRecorded && world.oceanFrac > 0.05) {
        world.firstOceanRecorded = true;
        world.history.record(world, {
          type: "geology", importance: 9,
          text: "Oceans formed: liquid water now covers " + (world.oceanFrac * 100).toFixed(0)
            + "% of the surface, fed by volcanic outgassing and impact-delivered volatiles.",
        });
      }
    }

    // 5-6. climate + resources (temp pulse from big impacts decays)
    window.SimClimate.updateClimate(world);
    if (world.tempPulse > 0.01) {
      for (const c of world.grid.cells) c.temp += world.tempPulse;
      world.globalTemp += world.tempPulse;
      world.tempPulse *= Math.max(0, 1 - dt / 2e6);
    }
    window.SimClimate.updateResources(world);

    // 7. life origin attempts (abiogenesis pathway)
    if (!world.lifePresent && world.oceanFrac > 0.03) {
      const rng = world.rng.stream("abio");
      const warmShallow = world.globalTemp > -10 && world.globalTemp < 55;
      if (warmShallow) {
        const p = world.abioFavorability * 0.0035 * (dt / 2.5e5);
        if (rng.chance(p)) {
          // pick a viable founding cell deterministically
          const cands = [];
          for (const c of world.grid.cells) {
            if (c.waterDepth > 0 && !c.ice && c.temp > 0 && c.temp < 60 && (c.energy > 20 || c.ventEnergy > 10)) cands.push(c);
          }
          if (cands.length > 0) {
            window.SimBiology.foundSpecies(world, cands[rng.int(0, cands.length - 1)], "abiogenesis");
          }
        }
      }
    }

    // 8-19. ecology pipeline (competition..feedback)
    window.SimEcology.stepEcology(world, dt);

    // climate sanity bounds (resource totals remain bounded)
    world.atm.co2 = Math.max(0.02, Math.min(60, world.atm.co2));
    world.atm.o2 = Math.max(0, Math.min(35, world.atm.o2));
    world.atm.ch4 = Math.max(0, Math.min(8, world.atm.ch4));
    world.hydro = Math.max(0, Math.min(400, world.hydro));
    return dt;
  }

  function eraName(world) {
    if (!world.firstOceanRecorded) return "FORMATION ERA";
    if (!world.lifePresent && !world.firstLifeRecorded) return "OCEANIC ERA · sterile";
    if (!world.lifePresent && world.firstLifeRecorded) return "POST-BIOTIC ERA · sterilized";
    if (world.massExtinctionActive) return "EXTINCTION CRISIS";
    if (world.atm.o2 > 2.5) return "OXYGENATION ERA";
    if (world.firstPredationRecorded) return "MICROBIAL ECOSYSTEM ERA";
    return "EARLY MICROBIAL ERA";
  }

  // ---- determinism test support: order-stable state hash ----
  function hashWorld(world) {
    let h = 0x811c9dc5 >>> 0;
    function mix(v) {
      const x = (v * 65536) | 0;
      h ^= (x & 0xff); h = Math.imul(h, 0x01000193);
      h ^= ((x >>> 8) & 0xff); h = Math.imul(h, 0x01000193);
      h ^= ((x >>> 16) & 0xff); h = Math.imul(h, 0x01000193);
      h ^= ((x >>> 24) & 0xff); h = Math.imul(h, 0x01000193);
    }
    mix(world.ageYears / 1e3); mix(world.hydro); mix(world.atm.o2 * 1000); mix(world.atm.co2 * 1000);
    mix(world.species.size); mix(world.populations.size);
    for (let i = 0; i < world.grid.cells.length; i += 7) {
      const c = world.grid.cells[i];
      mix(c.elevation * 100); mix(c.temp * 10); mix(c.waterDepth * 100);
    }
    for (const [key, pop] of world.populations) {
      mix(window.SimRNG.fnv1a(key)); mix(pop.biomass * 10);
    }
    return h >>> 0;
  }

  function runTests(log) {
    const results = [];
    function t(name, fn) {
      try { const ok = fn(); results.push({ name, ok: !!ok }); }
      catch (e) { results.push({ name, ok: false, err: String(e) }); }
    }
    t("same seed → identical star system", () => {
      const a = createWorld("test-42"), b = createWorld("test-42");
      return JSON.stringify(a.system) === JSON.stringify(b.system);
    });
    t("same seed + 400 ticks → identical state hash", () => {
      const a = createWorld("test-42"); for (let i = 0; i < 400; i++) tick(a);
      const b = createWorld("test-42"); for (let i = 0; i < 400; i++) tick(b);
      return hashWorld(a) === hashWorld(b);
    });
    t("different seeds → different worlds", () => {
      const a = createWorld("test-42"), b = createWorld("test-43");
      for (let i = 0; i < 200; i++) { tick(a); tick(b); }
      return hashWorld(a) !== hashWorld(b);
    });
    t("populations never negative", () => {
      const a = createWorld("life-hunt-7");
      for (let i = 0; i < 1500; i++) {
        tick(a);
        for (const [, p] of a.populations) if (p.biomass < 0) return false;
      }
      return true;
    });
    t("atmosphere & hydrosphere stay bounded", () => {
      const a = createWorld("bounds-1");
      for (let i = 0; i < 1500; i++) tick(a);
      return a.atm.o2 <= 35 && a.atm.co2 <= 60 && a.hydro <= 400 && a.atm.ch4 <= 8;
    });
    t("extinct species have no active populations", () => {
      const a = createWorld("life-hunt-7");
      for (let i = 0; i < 1500; i++) tick(a);
      for (const [, p] of a.populations) {
        const sp = a.species.get(p.speciesId);
        if (sp.extinctTime !== null && p.biomass >= 0.5) return false;
      }
      return true;
    });
    t("speciation produces valid lineage links", () => {
      const a = createWorld("life-hunt-7");
      for (let i = 0; i < 2500; i++) tick(a);
      for (const [id, sp] of a.species) {
        if (sp.parentId !== null) {
          const parent = a.species.get(sp.parentId);
          if (!parent || !parent.childrenIds.includes(id)) return false;
        }
      }
      return true;
    });
    t("longitude wrap: west neighbor of x=0 is x=127", () => {
      const a = createWorld("wrap");
      const n = window.SimTerrain.neighborIdx(a.grid, 5 * 128 + 0);
      return n.includes(5 * 128 + 127);
    });
    if (log) for (const r of results) log((r.ok ? "PASS" : "FAIL") + "  " + r.name + (r.err ? " — " + r.err : ""));
    return results;
  }

  window.SimWorld = { createWorld, tick, pickDt, eraName, hashWorld, runTests, aliveSpeciesCount };
})();
