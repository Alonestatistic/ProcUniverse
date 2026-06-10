// Barren-planet terrain: wrapped equirectangular grid, layered value noise,
// continental mask, volcanism, sea-level solver. Longitude wraps; latitude clamps.
"use strict";

const GRID_W = 128, GRID_H = 64;

// Value noise with an x-wrapping lattice so longitude is seamless.
function makeNoise(rng, latticeW, latticeH) {
  const vals = new Float32Array(latticeW * latticeH);
  for (let i = 0; i < vals.length; i++) vals[i] = rng.next();
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function (x, y) { // x in [0,latticeW), wraps; y clamped
    const x0 = Math.floor(x) % latticeW, y0 = Math.min(latticeH - 2, Math.max(0, Math.floor(y)));
    const x1 = (x0 + 1) % latticeW, y1 = y0 + 1;
    const fx = smooth(x - Math.floor(x)), fy = smooth(y - y0);
    const a = vals[y0 * latticeW + x0], b = vals[y0 * latticeW + x1];
    const c = vals[y1 * latticeW + x0], d = vals[y1 * latticeW + x1];
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };
}

// fractal sample: octaves of wrapped value noise
function makeFractal(rng, baseLatW, baseLatH, octaves) {
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    layers.push(makeNoise(rng, baseLatW << o, (baseLatH << o) + 1));
  }
  return function (u, v) { // u,v in [0,1)
    let sum = 0, amp = 1, ampTotal = 0;
    for (let o = 0; o < layers.length; o++) {
      const lw = baseLatW << o, lh = baseLatH << o;
      sum += layers[o](u * lw, v * lh) * amp;
      ampTotal += amp;
      amp *= 0.5;
    }
    return sum / ampTotal;
  };
}

function generateTerrain(rng, planet) {
  const W = GRID_W, H = GRID_H, N = W * H;
  const continental = makeFractal(rng, 4, 2, 3);
  const detail = makeFractal(rng, 8, 4, 5);
  const ridge = makeFractal(rng, 6, 3, 4);

  const cells = new Array(N);
  for (let y = 0; y < H; y++) {
    const lat = ((y + 0.5) / H - 0.5) * -180; // +90 top -> -90 bottom (deg, approx)
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const cont = continental(u, v);                 // continental mask field
      const det = detail(u, v) - 0.5;                 // local relief
      const rg = Math.abs(ridge(u, v) - 0.5) * 2;     // ridged mountains
      // elevation in km: continents above 0-ish, basins below
      let elev = (cont - 0.52) * 9 + det * 3.5 + (cont > 0.55 ? Math.pow(rg, 2.5) * 6 : 0);
      elev = Math.max(-9, Math.min(9, elev));
      cells[y * W + x] = {
        idx: y * W + x, x, y,
        lat: lat / 2 + ((y + 0.5) / H - 0.5) * -90, // effective lat in [-90,90]
        elevation: elev,
        baseElevation: elev,
        waterDepth: 0,
        ice: false,
        volcanic: false,
        crater: 0,        // crater intensity for display
        temp: 0, moisture: 0, sunlight: 0,
        energy: 0,        // producer energy budget this tick
        ventEnergy: 0,    // chemosynthetic energy
        pops: [],         // active population record refs (rebuilt as needed)
      };
    }
  }
  // fix lat: simpler exact formula
  for (const c of cells) c.lat = (0.5 - (c.y + 0.5) / H) * 180;

  // volcanic hotspots
  const nVents = Math.round(6 + planet.volcanism * 14);
  const vents = [];
  for (let i = 0; i < nVents; i++) {
    const ci = rng.int(0, N - 1);
    cells[ci].volcanic = true;
    cells[ci].elevation += rng.float(0.3, 1.8);
    vents.push(ci);
  }

  return { W, H, cells, vents };
}

// ---- Sea level: fill lowest cells until hydrosphere volume is consumed ----
// hydro is in "cell-km" units: sum over flooded cells of depth.
function computeSeaLevel(grid, hydro) {
  const elevs = grid.cells.map(c => c.elevation).sort((a, b) => a - b);
  const n = elevs.length;
  // prefix sums
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + elevs[i];
  // binary search sea level L: volume(L) = sum_{elev<L} (L - elev)
  let lo = elevs[0] - 0.001, hi = elevs[n - 1] + 20;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    // count cells below mid
    let a = 0, b = n;
    while (a < b) { const m = (a + b) >> 1; if (elevs[m] < mid) a = m + 1; else b = m; }
    const vol = mid * a - prefix[a];
    if (vol < hydro) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function applySeaLevel(grid, seaLevel) {
  let oceanCells = 0;
  for (const c of grid.cells) {
    c.waterDepth = Math.max(0, seaLevel - c.elevation);
    if (c.waterDepth > 0) oceanCells++;
  }
  return oceanCells / grid.cells.length;
}

// neighbor indices with east/west wrap, north/south clamp
function neighborIdx(grid, idx) {
  const W = grid.W, H = grid.H;
  const x = idx % W, y = (idx / W) | 0;
  const out = [];
  const xs = [(x - 1 + W) % W, x, (x + 1) % W];
  for (let dy = -1; dy <= 1; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= H) continue;
    for (const nx of xs) {
      if (nx === x && dy === 0) continue;
      out.push(ny * W + nx);
    }
  }
  return out;
}

window.SimTerrain = { GRID_W, GRID_H, generateTerrain, computeSeaLevel, applySeaLevel, neighborIdx };
