// Deterministic procedural naming: stars, planets, species, eras.
"use strict";

const NAME_SYL_A = ["Kel", "Vor", "Ash", "Tau", "Ner", "Oph", "Cyn", "Dra", "Hel", "Mir", "Sol", "Ix", "Qua", "Ten", "Ul", "Zar", "Bel", "Cor", "Fen", "Gal"];
const NAME_SYL_B = ["ius", "ara", "eth", "on", "ia", "ux", "ane", "or", "is", "ea", "um", "yx", "al", "en", "ova", "ir"];

const GENUS_SYL = ["vor", "ka", "ri", "mu", "ta", "len", "or", "ix", "ap", "eth", "un", "go", "sa", "li", "ne", "phos", "tro", "ba", "cy", "do", "lu", "mi", "ze", "tha"];
const SPEC_SYL = ["vens", "tilis", "arix", "odon", "ella", "ius", "ans", "or", "etta", "um", "ax", "iens", "ola", "urn", "ys", "ene"];

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function starName(rng) {
  return rng.pick(NAME_SYL_A) + rng.pick(NAME_SYL_B) + "-" + rng.int(100, 999);
}

function planetSuffix(i) {
  return " " + "bcdefghijk".charAt(i);
}

function speciesName(rng) {
  const genus = cap(rng.pick(GENUS_SYL) + rng.pick(GENUS_SYL));
  const spec = rng.pick(GENUS_SYL) + rng.pick(SPEC_SYL);
  return { genus, binomial: genus + " " + spec };
}

// Human-readable region descriptor from cell data, used in event text.
function regionDescriptor(cell) {
  const latAbs = Math.abs(cell.lat);
  let band = latAbs < 23 ? "equatorial" : latAbs < 55 ? "temperate" : "polar";
  let kind;
  if (cell.waterDepth > 2) kind = "deep ocean";
  else if (cell.waterDepth > 0) kind = "shallows";
  else if (cell.volcanic) kind = "volcanic terrain";
  else if (cell.elevation > 2.5) kind = "highlands";
  else kind = "lowlands";
  return band + " " + kind;
}

function fmtAge(years) {
  if (years >= 1e9) return (years / 1e9).toFixed(2) + " Gyr";
  if (years >= 1e6) return (years / 1e6).toFixed(1) + " Myr";
  if (years >= 1e3) return (years / 1e3).toFixed(0) + " kyr";
  return Math.round(years) + " yr";
}

window.SimNames = { starName, planetSuffix, speciesName, regionDescriptor, fmtAge, cap };
