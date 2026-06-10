// Ecology tick: production, competition, predation, stress, growth, migration,
// mutation+selection, speciation, extinction, atmospheric feedback.
"use strict";

(function () {
  const B = window.SimBiology;

  // main biology step; dtFactor scales rates to the adaptive tick length
  function stepEcology(world, dtYears) {
    if (world.populations.size === 0) return;
    const dtF = Math.min(4, dtYears / 25000); // rates tuned to 25 kyr ticks
    const rngMut = world.rng.stream("mutation");
    const rngMig = world.rng.stream("migration");

    const removals = [];
    const additions = []; // queued {sp, cellIdx, biomass, fromPop}
    let totalPhoto = 0, totalMethano = 0, totalBiomass = 0;

    // rebuild per-cell lists are maintained incrementally; iterate populations
    for (const [key, pop] of world.populations) {
      const sp = world.species.get(pop.speciesId);
      const cell = world.grid.cells[pop.cellIdx];
      const cellPops = world.popsByCell.get(pop.cellIdx) || [];
      const suit = B.suitability(world, sp, pop, cell);

      // --- energy intake ---
      const photoT = B.effTrait(sp, pop, "photo");
      const chemoT = B.effTrait(sp, pop, "chemo");
      const predT = B.effTrait(sp, pop, "predation");
      const eff = 0.4 + 0.6 * B.effTrait(sp, pop, "energyEff");

      // share cell energy proportionally to demand among producers
      let producerDemand = 0;
      for (const p of cellPops) {
        const s2 = world.species.get(p.speciesId);
        producerDemand += p.biomass * (B.effTrait(s2, p, "photo") + B.effTrait(s2, p, "chemo") * 0.6);
      }
      const myDemand = pop.biomass * (photoT + chemoT * 0.6);
      const energyShare = producerDemand > 0 ? myDemand / producerDemand : 0;
      let intake = 0;
      intake += Math.min(cell.energy * energyShare, pop.biomass * photoT * 0.9) * eff;
      intake += Math.min(cell.ventEnergy * energyShare, pop.biomass * chemoT * 0.9) * eff;

      // predation/grazing on co-located prey
      let predIntake = 0;
      if (predT > 0.25 && cellPops.length > 1) {
        for (const prey of cellPops) {
          if (prey === pop || prey.biomass <= 0) continue;
          const preySp = world.species.get(prey.speciesId);
          const defense = B.effTrait(preySp, prey, "armor") * 0.6 + B.effTrait(preySp, prey, "toxin") * 0.4;
          const take = Math.min(prey.biomass * 0.12, pop.biomass * predT * 0.18 * Math.max(0.1, 1 - defense)) * dtF;
          prey.biomass -= take;
          predIntake += take * 0.45; // trophic loss
          if (!world.firstPredationRecorded && take > 1) {
            world.firstPredationRecorded = true;
            world.history.record(world, {
              type: "ecology", importance: 8,
              text: "First predation: " + sp.name + " began consuming " + preySp.name + " in "
                + window.SimNames.regionDescriptor(cell) + ". Food webs now exist.",
            });
          }
        }
      }
      intake += predIntake * eff;

      // --- growth & death ---
      const maint = pop.biomass * (0.25 + 0.15 * B.effTrait(sp, pop, "size"));
      const surplus = intake - maint;
      const repro = 0.3 + 0.7 * B.effTrait(sp, pop, "reproRate");
      let growth = surplus > 0 ? surplus * repro * suit : surplus * 0.8;
      // stress mortality when suitability is poor
      growth -= pop.biomass * (1 - suit) * 0.30 * dtF;
      // disease/waste pressure at high density
      const cap = (cell.energy + cell.ventEnergy) * 3 + 5;
      if (pop.biomass > cap) growth -= (pop.biomass - cap) * 0.4;
      pop.biomass = Math.min(cap * 1.6, pop.biomass + growth * dtF);
      pop.health = suit;
      pop.generations += dtF * 50;

      if (pop.biomass < 0.5) { removals.push(key); continue; }

      totalBiomass += pop.biomass;
      totalPhoto += pop.biomass * photoT;
      if (chemoT > 0.4 && B.effTrait(sp, pop, "o2pref") < 0.35) totalMethano += pop.biomass * chemoT;

      // --- mutation + directional selection on local offsets ---
      const mut = 0.004 + 0.02 * B.effTrait(sp, pop, "mutationRate");
      const t = B.TRAITS[rngMut.int(0, B.TRAITS.length - 1)];
      const delta = rngMut.gauss(0, mut * dtF * 1.6);
      const before = B.suitability(world, sp, pop, cell);
      pop.geneOffset[t] = (pop.geneOffset[t] || 0) + delta;
      const after = B.suitability(world, sp, pop, cell);
      // selection: harmful changes usually revert (purifying), helpful ones fix
      if (after < before && rngMut.chance(0.8)) pop.geneOffset[t] -= delta;
      pop.geneVar = Math.min(0.3, pop.geneVar + mut * dtF * 0.1);

      // divergence accumulates from genetic distance, isolation, and ecological
      // mismatch with the parent species' birth niche (frontier adaptation)
      let dist = 0;
      for (const k2 in pop.geneOffset) dist += Math.abs(pop.geneOffset[k2]);
      const isolated = !hasAdjacentKin(world, pop);
      pop.isolation = isolated ? pop.isolation + dtYears : pop.isolation * 0.5;
      pop.divergence = dist;

      // --- speciation ---
      // a peripheral population that has adapted away from its ancestor (large trait
      // distance) and persisted many generations can become a new species. Geographic
      // isolation accelerates it but is not strictly required — adaptive radiation
      // across climate gradients is the main driver. Capped to avoid runaway.
      const matureGen = pop.generations > 4000;
      const speciationReady = dist > 0.5 && matureGen && pop.biomass > 10
        && (isolated || dist > 0.7) && world.species.size < 70;
      if (speciationReady && rngMut.chance(0.0022 * dtF)) {
        speciate(world, sp, pop, world.grid.cells[pop.cellIdx]);
      }

      // --- migration / dispersal ---
      const disp = B.effTrait(sp, pop, "dispersal") * (0.3 + 0.7 * B.effTrait(sp, pop, "motility"));
      if (pop.biomass > 4 && rngMig.chance(Math.min(0.65, disp * dtF))) {
        const neigh = window.SimTerrain.neighborIdx(world.grid, pop.cellIdx);
        const target = neigh[rngMig.int(0, neigh.length - 1)];
        const tCell = world.grid.cells[target];
        const tSuit = B.suitability(world, sp, pop, tCell);
        if (tSuit > 0.15 && (tCell.energy + tCell.ventEnergy) > 1) {
          const moved = pop.biomass * 0.18;
          pop.biomass -= moved;
          additions.push({ spId: sp.id, cellIdx: target, biomass: moved, parent: pop });
          // first land colonization
          if (tCell.waterDepth === 0 && !world.firstLandRecorded && tSuit > 0.25) {
            world.firstLandRecorded = true;
            world.history.record(world, {
              type: "ecology", importance: 9,
              text: "First land colonization: " + sp.name + " established itself on "
                + window.SimNames.regionDescriptor(tCell) + ", shielded by the oxygenated atmosphere.",
            });
          }
        } else {
          pop.biomass += 0; // failed dispersal, biomass retained
        }
      }
    }

    // apply queued changes AFTER iteration (no mutation during iteration)
    for (const add of additions) {
      const sp = world.species.get(add.spId);
      const cell = world.grid.cells[add.cellIdx];
      const p = B.addPopulation(world, sp, cell, add.biomass);
      // migrants carry their local adaptations
      if (add.parent && p !== add.parent) {
        for (const k in add.parent.geneOffset) {
          if (!(k in p.geneOffset)) p.geneOffset[k] = add.parent.geneOffset[k] * 0.8;
        }
      }
    }
    for (const key of removals) removePopulation(world, key);

    // --- extinction bookkeeping ---
    checkExtinctions(world);

    // --- atmospheric feedback from life ---
    // O2 production is slow and opposed by oxidation sinks (reduced volcanic gases,
    // crustal weathering), so the atmosphere approaches a balance rather than the cap.
    const o2Flux = totalPhoto * 2.2e-5 * dtF;
    const o2Sink = world.atm.o2 * (0.006 + world.volcanismLevel * 0.02) * dtF;
    world.atm.o2 = Math.max(0, Math.min(35, world.atm.o2 + o2Flux - o2Sink));
    world.atm.co2 = Math.max(0.02, world.atm.co2 - o2Flux * 0.5);
    const ch4Flux = totalMethano * 6e-6 * dtF;
    world.atm.ch4 = Math.min(8, world.atm.ch4 + ch4Flux);
    // O2 destroys CH4
    world.atm.ch4 = Math.max(0, world.atm.ch4 - world.atm.ch4 * Math.min(0.5, world.atm.o2 * 0.04) * dtF);
    world.totalBiomass = totalBiomass;

    if (!world.oxygenEventRecorded && world.atm.o2 > 2.5) {
      world.oxygenEventRecorded = true;
      world.history.record(world, {
        type: "atmosphere", importance: 10,
        text: "The Great Oxygenation: photosynthetic life pushed atmospheric O₂ past 2.5 kPa. "
          + "Anaerobic lineages worldwide now face poisoning; aerobic niches are opening.",
      });
    }
  }

  function hasAdjacentKin(world, pop) {
    for (const ni of window.SimTerrain.neighborIdx(world.grid, pop.cellIdx)) {
      const arr = world.popsByCell.get(ni);
      if (!arr) continue;
      for (const p of arr) if (p.speciesId === pop.speciesId && p.biomass > 1) return true;
    }
    return false;
  }

  function speciate(world, parentSp, pop, cell) {
    const rng = world.rng.stream("mutation");
    const g = {};
    for (const t of B.TRAITS) g[t] = Math.max(0.02, Math.min(0.98, parentSp.genome[t] + (pop.geneOffset[t] || 0)));
    // niche innovation: an energy-starved daughter near abundant prey biomass may
    // evolve consumption — this is how grazers/predators first appear in a lineage.
    let preyBiomass = 0;
    for (const p of (world.popsByCell.get(pop.cellIdx) || [])) if (p !== pop) preyBiomass += p.biomass;
    let innovated = false;
    if (preyBiomass > 12 && parentSp.role !== "predator" && rng.chance(0.30)) {
      g.predation = Math.max(g.predation, rng.float(0.55, 0.85));
      g.motility = Math.max(g.motility, rng.float(0.4, 0.8));
      g.photo *= 0.4; g.chemo *= 0.4;
      innovated = true;
    }
    let role = parentSp.role;
    if (g.predation > 0.5) role = "predator";
    else if (g.photo > g.chemo && g.photo > 0.4) role = "photosynth";
    else if (g.chemo > 0.4) role = "chemosynth";
    else if (g.predation > 0.3) role = "grazer";
    const sp = B.newSpecies(world, {
      genome: g, role, biochem: parentSp.biochem,
      origin: "speciation from " + parentSp.name,
      parentId: parentSp.id, importance: innovated ? 6 : 4,
    });
    // population transfers to the new species
    removePopulation(world, B.popKey(pop.speciesId, pop.cellIdx));
    B.addPopulation(world, sp, cell, pop.biomass);
    world.history.record(world, {
      type: "speciation", importance: 6 + (role !== parentSp.role ? 1.5 : 0),
      text: sp.name + " diverged from " + parentSp.name
        + (role !== parentSp.role ? " — a new " + role + " lineage" : "")
        + " in " + window.SimNames.regionDescriptor(cell) + ".",
    });
  }

  function removePopulation(world, key) {
    const pop = world.populations.get(key);
    if (!pop) return;
    world.populations.delete(key);
    const arr = world.popsByCell.get(pop.cellIdx);
    if (arr) {
      const i = arr.indexOf(pop);
      if (i >= 0) arr.splice(i, 1);
      if (arr.length === 0) world.popsByCell.delete(pop.cellIdx);
    }
  }

  function checkExtinctions(world) {
    const alive = new Set();
    for (const [, pop] of world.populations) alive.add(pop.speciesId);
    for (const [id, sp] of world.species) {
      if (sp.extinctTime === null && !alive.has(id)) {
        sp.extinctTime = world.ageYears;
        world.recentExtinctions.push(world.ageYears);
        const lifespan = world.ageYears - sp.originTime;
        const kids = sp.childrenIds.length;
        world.history.record(world, {
          type: "extinction", importance: Math.min(9, 3 + Math.log10(1 + sp.peakBiomass) + kids),
          text: sp.name + " became extinct after " + window.SimNames.fmtAge(lifespan)
            + (kids > 0 ? ", survived by " + kids + " descendant lineage" + (kids > 1 ? "s" : "") : ", leaving no descendants") + ".",
        });
      }
      if (sp.extinctTime === null) {
        // track peaks for importance scoring
        let bm = 0, np = 0;
        for (const [, pop] of world.populations) if (pop.speciesId === id) { bm += pop.biomass; np++; }
        if (bm > sp.peakBiomass) { sp.peakBiomass = bm; sp.populationsAtPeak = np; }
      }
    }
    // mass extinction detection: many losses in a short window
    const cutoff = world.ageYears - 3e6;
    world.recentExtinctions = world.recentExtinctions.filter(t => t > cutoff);
    const aliveCount = alive.size;
    if (!world.massExtinctionActive && world.recentExtinctions.length >= 4 && world.recentExtinctions.length > aliveCount * 0.5 && aliveCount > 0) {
      world.massExtinctionActive = true;
      world.history.record(world, {
        type: "extinction", importance: 10,
        text: "MASS EXTINCTION: " + world.recentExtinctions.length + " lineages collapsed within "
          + window.SimNames.fmtAge(3e6) + ". Survivors cling to refuges; empty niches await.",
      });
    }
    if (world.massExtinctionActive && world.recentExtinctions.length === 0) {
      world.massExtinctionActive = false;
      if (aliveCount > 0) {
        world.history.record(world, {
          type: "ecology", importance: 7,
          text: "Recovery: the extinction pulse has passed. " + aliveCount + " surviving lineage"
            + (aliveCount > 1 ? "s radiate" : " radiates") + " into vacated niches.",
        });
      }
    }
    if (world.lifePresent && aliveCount === 0 && !world.sterilizedRecorded) {
      world.sterilizedRecorded = true;
      world.lifePresent = false;
      world.history.record(world, {
        type: "extinction", importance: 10,
        text: "The biosphere has been completely sterilized. The planet is once again lifeless.",
      });
    }
    if (aliveCount > 0) { world.sterilizedRecorded = false; world.lifePresent = true; }
  }

  window.SimEcology = { stepEcology };
})();
