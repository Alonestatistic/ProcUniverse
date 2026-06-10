// Biology: genomes, abiogenesis, sparse populations, ecology, mutation, speciation, extinction.
// Aggregate simulation — one PopulationRecord per active species-region pair, never per organism.
"use strict";

// ---- Genome: numerical traits in [0,1] plus categorical role / biochem ----
const TRAITS = [
  "size", "reproRate", "energyEff", "motility", "tempPref", "tempTol",
  "salinityTol", "radResist", "armor", "toxin", "photo", "chemo",
  "predation", "dormancy", "o2pref", "envMod", "mutationRate", "dispersal",
];
const ROLES = ["photosynth", "chemosynth", "grazer", "predator", "decomposer"];
const BIOCHEM = ["carbon-water", "silicate-sulfur", "ammonia-methane"];

let SPECIES_SEQ = 0;

function randomGenome(rng) {
  const g = {};
  for (const t of TRAITS) g[t] = rng.float(0.15, 0.85);
  // tempPref encodes preferred temp: map [0,1] -> [-15,60]°C
  return g;
}
function prefTempC(g) { return -15 + g.tempPref * 75; }

function newSpecies(world, opts) {
  const id = ++SPECIES_SEQ;
  const nm = window.SimNames.speciesName(world.rng.derive("name/" + id));
  const sp = {
    id, genus: nm.genus, name: nm.binomial,
    genome: opts.genome,
    role: opts.role,
    biochem: opts.biochem,
    origin: opts.origin,
    originTime: world.ageYears,
    extinctTime: null,
    parentId: opts.parentId || null,
    childrenIds: [],
    importance: opts.importance || 1,
    discovered: false,
    peakBiomass: 0,
    populationsAtPeak: 0,
    // divergence accumulators per region cluster handled on populations
  };
  world.species.set(id, sp);
  if (sp.parentId && world.species.has(sp.parentId)) world.species.get(sp.parentId).childrenIds.push(id);
  return sp;
}

// abiogenesis or seeding: create a founder population in a viable cell
function foundSpecies(world, cell, originMethod) {
  if (cell.waterDepth <= 0) return false; // life starts in water
  const rng = world.rng.stream("abio");
  const g = randomGenome(rng);
  // bias founder toward its environment
  g.tempPref = Math.max(0.05, Math.min(0.95, (cell.temp + 15) / 75 + rng.gauss(0, 0.06)));
  const venty = cell.ventEnergy > cell.energy;
  const role = venty ? "chemosynth" : "photosynth";
  if (role === "photosynth") { g.photo = rng.float(0.5, 0.9); g.chemo = rng.float(0, 0.2); }
  else { g.chemo = rng.float(0.5, 0.9); g.photo = rng.float(0, 0.2); }
  g.predation = rng.float(0, 0.15);
  const biochem = world.biochemBias || (world.biochemBias = rng.pick(BIOCHEM));
  const sp = newSpecies(world, { genome: g, role, biochem, origin: originMethod, importance: 6 });
  addPopulation(world, sp, cell, 50);
  world.lifePresent = true;
  if (!world.firstLifeRecorded) {
    world.firstLifeRecorded = true;
    world.history.record(world, {
      type: "firstlife", importance: 10,
      text: "First stable life: " + sp.name + " (" + role + ") originated via " + originMethod
        + " in " + window.SimNames.regionDescriptor(cell) + ".",
    });
  }
  return true;
}

// ---- sparse populations: keyed by speciesId|cellIdx ----
function popKey(spId, cellIdx) { return spId + "|" + cellIdx; }

function addPopulation(world, sp, cell, biomass) {
  const key = popKey(sp.id, cell.idx);
  let pop = world.populations.get(key);
  if (pop) { pop.biomass += biomass; return pop; }
  pop = {
    speciesId: sp.id, cellIdx: cell.idx,
    biomass, health: 1,
    geneOffset: {},     // local adaptation offsets vs species genome
    geneVar: 0.04,
    isolation: 0, generations: 0,
    divergence: 0,
  };
  world.populations.set(key, pop);
  let arr = world.popsByCell.get(cell.idx);
  if (!arr) { arr = []; world.popsByCell.set(cell.idx, arr); }
  arr.push(pop);
  return pop;
}

function effTrait(sp, pop, t) {
  return Math.max(0, Math.min(1, sp.genome[t] + (pop.geneOffset[t] || 0)));
}

// habitat suitability [0,1] for a population in its cell
function suitability(world, sp, pop, cell) {
  const pref = -15 + effTrait(sp, pop, "tempPref") * 75;
  const tol = 6 + effTrait(sp, pop, "tempTol") * 40;
  const tempFit = Math.exp(-Math.pow((cell.temp - pref) / tol, 2));
  // salinity / water requirement: most microbes need water
  const waterFit = cell.waterDepth > 0 ? 1 : effTrait(sp, pop, "dormancy") * 0.4;
  // radiation gate when ozone thin and on land
  const radFit = cell.waterDepth > 0 ? 1 : (0.3 + 0.7 * effTrait(sp, pop, "radResist")) * (0.4 + 0.6 * Math.min(1, world.atm.o2 / 3));
  // o2 preference vs ambient (anaerobes poisoned by O2)
  const o2want = effTrait(sp, pop, "o2pref");
  const o2amb = Math.min(1, world.atm.o2 / 21);
  const o2Fit = 1 - Math.abs(o2want - o2amb) * 0.7;
  return Math.max(0, tempFit * waterFit * radFit * o2Fit);
}

window.SimBiology = {
  TRAITS, ROLES, BIOCHEM, randomGenome, prefTempC, newSpecies, foundSpecies,
  addPopulation, popKey, effTrait, suitability,
  resetSeq() { SPECIES_SEQ = 0; },
};
