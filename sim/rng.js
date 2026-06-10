// Deterministic RNG: root seed string -> independently derived named streams.
// fnv1a hash for derivation, mulberry32 for generation. No Math.random anywhere.
"use strict";

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

class RngStream {
  constructor(seedString) {
    this.label = seedString;
    this._s = fnv1a(seedString) || 1;
    this.draws = 0;
  }
  // mulberry32 core
  next() {
    this.draws++;
    this._s = (this._s + 0x6D2B79F5) | 0;
    let t = Math.imul(this._s ^ (this._s >>> 15), 1 | this._s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); } // inclusive
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // Box-Muller (single value; discards pair partner for simplicity, still deterministic)
  gauss(mean = 0, sd = 1) {
    let u = 0, v = 0;
    u = this.next(); if (u <= 1e-12) u = 1e-12;
    v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // power-law sample in [min,max], exponent < 0 biases small
  powerLaw(min, max, exp) {
    const r = this.next();
    return Math.pow(r * (Math.pow(max, exp + 1) - Math.pow(min, exp + 1)) + Math.pow(min, exp + 1), 1 / (exp + 1));
  }
}

// Root -> derived streams. Each named stream is fully independent.
class RngRoot {
  constructor(rootSeedString) {
    this.rootSeed = String(rootSeedString);
    this._streams = new Map();
  }
  stream(name) {
    if (!this._streams.has(name)) {
      this._streams.set(name, new RngStream(this.rootSeed + "/" + name));
    }
    return this._streams.get(name);
  }
  // a fresh, derived one-off stream (e.g. per-species naming) — does not disturb shared streams
  derive(name) { return new RngStream(this.rootSeed + "/" + name); }
}

window.SimRNG = { fnv1a, RngStream, RngRoot };
