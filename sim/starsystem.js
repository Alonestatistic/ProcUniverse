// Seeded star-system generation. Stable orbital summaries, no n-body physics.
"use strict";

const STAR_TYPES = [
  // weight, type, massRange (solar), tempRange (K), color
  { w: 12, type: "M dwarf",      mass: [0.1, 0.5],  temp: [2500, 3800], color: "#ff8a5c" },
  { w: 9,  type: "K dwarf",      mass: [0.5, 0.8],  temp: [3800, 5200], color: "#ffb46b" },
  { w: 8,  type: "G star",       mass: [0.8, 1.1],  temp: [5200, 6000], color: "#ffe9a8" },
  { w: 5,  type: "F star",       mass: [1.1, 1.5],  temp: [6000, 7200], color: "#fff6e0" },
  { w: 2,  type: "A star",       mass: [1.5, 2.3],  temp: [7200, 9500], color: "#cfe2ff" },
  { w: 2,  type: "red giant",    mass: [0.9, 4.0],  temp: [3200, 4500], color: "#ff6b4a" },
  { w: 2,  type: "white dwarf",  mass: [0.4, 0.9],  temp: [8000, 20000], color: "#dfe9f5" },
  { w: 2,  type: "brown dwarf",  mass: [0.02, 0.08], temp: [800, 2200], color: "#a85f3f" },
  { w: 1,  type: "neutron star", mass: [1.2, 2.0],  temp: [60000, 600000], color: "#bfe9ff" },
];

function pickWeighted(rng, list) {
  let total = 0;
  for (const e of list) total += e.w;
  let r = rng.next() * total;
  for (const e of list) { r -= e.w; if (r <= 0) return e; }
  return list[list.length - 1];
}

function makeStar(rng, primary) {
  const t = pickWeighted(rng, STAR_TYPES);
  const mass = rng.float(t.mass[0], t.mass[1]);
  const temp = rng.float(t.temp[0], t.temp[1]);
  // crude main-sequence-ish luminosity from mass; degenerate types overridden
  let lum = Math.pow(mass, 3.5);
  if (t.type === "red giant") lum = rng.float(20, 300);
  if (t.type === "white dwarf") lum = rng.float(0.001, 0.05);
  if (t.type === "brown dwarf") lum = rng.float(0.00005, 0.001);
  if (t.type === "neutron star") lum = rng.float(0.0001, 0.01);
  return {
    name: null, // assigned by caller
    type: t.type, color: t.color,
    mass: +mass.toFixed(3),
    tempK: Math.round(temp),
    luminosity: +lum.toFixed(5),
    ageGyr: +rng.float(0.5, 9).toFixed(2),
    radiation: +(lum > 5 ? rng.float(1.5, 4) : rng.float(0.3, 1.5)).toFixed(2),
  };
}

const PLANET_TYPES = ["rocky", "rocky", "rocky", "gas giant", "ice giant", "dwarf"];

function generateStarSystem(rng, namesRng) {
  const nStars = rng.next() < 0.70 ? 1 : (rng.next() < 0.85 ? 2 : 3);
  const stars = [];
  const baseName = window.SimNames.starName(namesRng);
  for (let i = 0; i < nStars; i++) {
    const s = makeStar(rng, i === 0);
    s.name = nStars === 1 ? baseName : baseName + " " + "ABC".charAt(i);
    stars.push(s);
  }
  const totalLum = stars.reduce((a, s) => a + s.luminosity, 0);
  // habitable zone (AU) ~ sqrt(L)
  const hzInner = Math.sqrt(totalLum / 1.1);
  const hzOuter = Math.sqrt(totalLum / 0.53);

  const nPlanets = Math.max(1, Math.min(10, Math.round(rng.gauss(5, 2))));
  const planets = [];
  let au = rng.float(0.08, 0.4) * Math.max(0.4, Math.sqrt(totalLum));
  for (let i = 0; i < nPlanets; i++) {
    au *= rng.float(1.4, 2.1); // Titius-Bode-ish spacing
    const type = rng.pick(PLANET_TYPES);
    const inHZ = au >= hzInner && au <= hzOuter;
    const radius = type === "gas giant" ? rng.float(6, 12)
      : type === "ice giant" ? rng.float(3, 5)
      : type === "dwarf" ? rng.float(0.1, 0.4)
      : rng.float(0.4, 1.8); // Earth radii
    planets.push({
      name: baseName + window.SimNames.planetSuffix(i),
      index: i, type,
      orbitAU: +au.toFixed(2),
      radius: +radius.toFixed(2),
      inHZ,
      moons: type === "gas giant" ? rng.int(4, 40) : type === "ice giant" ? rng.int(2, 16) : rng.int(0, 3),
      axialTilt: +rng.float(0, 45).toFixed(1),
      rotationHours: +rng.powerLaw(8, 600, -1.6).toFixed(1),
      // formation chemistry
      initialWater: +rng.powerLaw(0.001, 0.15, -1.8).toFixed(4), // fraction of "full ocean"
      volcanism: +rng.float(0.3, 1.0).toFixed(2),
      magneticField: +rng.float(0, 1).toFixed(2),
    });
  }

  // pick focus planet: rocky, prefer in/near HZ
  let focus = null, bestScore = -1;
  for (const p of planets) {
    if (p.type !== "rocky") continue;
    const mid = (hzInner + hzOuter) / 2;
    const dist = Math.abs(Math.log(p.orbitAU / mid));
    const score = (p.inHZ ? 2 : 0) + (1 / (1 + dist)) + p.radius * 0.1;
    if (score > bestScore) { bestScore = score; focus = p; }
  }
  if (!focus) { // no rocky planet — take the dwarf or first planet as a harsh world
    focus = planets.find(p => p.type === "dwarf") || planets[0];
  }
  focus.isFocus = true;

  return {
    stars, planets,
    totalLuminosity: +totalLum.toFixed(4),
    hzInner: +hzInner.toFixed(2),
    hzOuter: +hzOuter.toFixed(2),
    debrisDensity: +rng.float(0.4, 1.6).toFixed(2), // drives bombardment rate
    cometReservoir: +rng.float(0.3, 1.5).toFixed(2),
    asteroidBelts: rng.int(0, 2),
    focusName: focus.name,
  };
}

window.SimStarSystem = { generateStarSystem };
