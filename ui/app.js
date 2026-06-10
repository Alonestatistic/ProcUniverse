// App controller: simulation clock (pause/speed/step), frame budget, panel rendering.
"use strict";

(function () {
  const W = window;
  const SPEEDS = [0, 1, 4, 16, 64, 256]; // ticks per second target
  const SPEED_LABELS = ["❚❚", "▶", "▶▶", "▶▶▶", "▶▶▶▶", "▶▶▶▶▶"];

  const App = {
    world: null,
    speedIdx: 0,
    overlay: "BIOSPHERE",
    selectedCell: null,
    selectedSpecies: null,
    acc: 0,
    lastT: 0,
    panel: "timeline", // timeline | species
    sps: 0, _spsCount: 0, _spsT: 0,
  };
  W.App = App;

  function $(id) { return document.getElementById(id); }

  function newWorld(seed) {
    App.world = W.SimWorld.createWorld(seed);
    App.selectedCell = null; App.selectedSpecies = null;
    App.speedIdx = 0;
    $("seedInput").value = seed;
    W.SimRender.renderSystem($("sysCanvas"), App.world);
    // warm a few ticks so the system view + formation event exist
    fullRender();
  }

  function step(n) {
    for (let i = 0; i < n; i++) W.SimWorld.tick(App.world);
    App._spsCount += n;
  }

  function loop(t) {
    if (!App.lastT) App.lastT = t;
    const dt = (t - App.lastT) / 1000; App.lastT = t;
    const tps = SPEEDS[App.speedIdx];
    if (tps > 0 && App.world) {
      App.acc += dt * tps;
      let budget = 0;
      const start = performance.now();
      while (App.acc >= 1 && budget < 4000 && (performance.now() - start) < 12) {
        step(1); App.acc -= 1; budget++;
      }
      if (App.acc > tps) App.acc = tps; // don't accumulate huge backlog
      fullRender();
    }
    // sps meter
    App._spsT += dt;
    if (App._spsT >= 0.5) { App.sps = Math.round(App._spsCount / App._spsT); App._spsCount = 0; App._spsT = 0; if (tps === 0) updateDebug(); }
    requestAnimationFrame(loop);
  }

  function setSpeed(i) {
    App.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
    document.querySelectorAll(".speed-btn").forEach((b, idx) => b.classList.toggle("active", idx === App.speedIdx));
  }

  function fullRender() {
    const world = App.world;
    W.SimRender.render($("mapCanvas"), world, App.overlay, App.selectedCell);
    updateDebug();
    updateStatusBar();
    if (App.panel === "timeline") renderTimeline();
    else renderSpeciesList();
    if (App.selectedCell !== null) renderCellInfo();
    if (App.selectedSpecies !== null) renderSpeciesDetail();
  }

  function updateStatusBar() {
    const w = App.world;
    $("eraLabel").textContent = W.SimWorld.eraName(w);
    $("ageLabel").textContent = W.SimNames.fmtAge(w.ageYears);
  }

  function updateDebug() {
    const w = App.world;
    const alive = W.SimWorld.aliveSpeciesCount(w);
    const rows = [
      ["seed", w.seedString],
      ["tick", w.tickCount.toLocaleString()],
      ["age", W.SimNames.fmtAge(w.ageYears)],
      ["dt", W.SimNames.fmtAge(W.SimWorld.pickDt(w))],
      ["ticks/s", App.sps + (SPEEDS[App.speedIdx] === 0 ? " (paused)" : "")],
      ["ocean", (w.oceanFrac * 100).toFixed(1) + "%"],
      ["sea lvl", w.seaLevel.toFixed(2) + " km"],
      ["glob T", w.globalTemp.toFixed(1) + " °C"],
      ["hydro", w.hydro.toFixed(1)],
      ["O₂", w.atm.o2.toFixed(2) + " kPa"],
      ["CO₂", w.atm.co2.toFixed(2) + " kPa"],
      ["CH₄", w.atm.ch4.toFixed(3) + " kPa"],
      ["species (live)", alive + " / " + w.species.size],
      ["populations", w.populations.size.toLocaleString()],
      ["biomass", Math.round(w.totalBiomass).toLocaleString()],
      ["events", w.history.events.length],
    ];
    $("debugBody").innerHTML = rows.map(r =>
      '<div class="dbg-row"><span>' + r[0] + '</span><b>' + r[1] + "</b></div>").join("");
  }

  const EV_COLOR = {
    firstlife: "#7fe6a0", impact: "#ff8a5c", geology: "#c9a87a", atmosphere: "#7fd0ff",
    speciation: "#b69aff", extinction: "#ff6b6b", ecology: "#ffe07f",
  };
  function renderTimeline() {
    const evs = App.world.history.events;
    const minImp = +$("impFilter").value;
    const filtered = evs.filter(e => e.importance >= minImp).slice().reverse().slice(0, 120);
    $("timelineBody").innerHTML = filtered.map(e => {
      const col = EV_COLOR[e.type] || "#9aa";
      return '<div class="ev">'
        + '<div class="ev-head"><span class="ev-age" style="color:' + col + '">' + W.SimNames.fmtAge(e.time) + '</span>'
        + '<span class="ev-imp">' + "■".repeat(Math.max(1, Math.round(e.importance / 2))) + '</span></div>'
        + '<div class="ev-text">' + e.text + '</div></div>';
    }).join("") || '<div class="muted">No events above this importance yet.</div>';
  }

  function renderSpeciesList() {
    const w = App.world;
    const list = [...w.species.values()].sort((a, b) => {
      if ((a.extinctTime === null) !== (b.extinctTime === null)) return a.extinctTime === null ? -1 : 1;
      return b.peakBiomass - a.peakBiomass;
    }).slice(0, 80);
    if (list.length === 0) { $("speciesBody").innerHTML = '<div class="muted">No life has originated yet. Worlds may stay sterile — keep running, or try a new seed.</div>'; return; }
    $("speciesBody").innerHTML = list.map(sp => {
      const live = sp.extinctTime === null;
      const col = W.SimRender.speciesColor(sp);
      let bm = 0, np = 0;
      for (const [, p] of w.populations) if (p.speciesId === sp.id) { bm += p.biomass; np++; }
      return '<div class="sp-row' + (live ? "" : " extinct") + (App.selectedSpecies === sp.id ? " sel" : "") + '" data-sp="' + sp.id + '">'
        + '<span class="sp-dot" style="background:' + col + '"></span>'
        + '<span class="sp-name">' + sp.name + '</span>'
        + '<span class="sp-role">' + sp.role + '</span>'
        + '<span class="sp-bm">' + (live ? Math.round(bm) + " bm · " + np + "r" : "†") + '</span></div>';
    }).join("");
    document.querySelectorAll(".sp-row").forEach(r => r.onclick = () => { App.selectedSpecies = +r.dataset.sp; fullRender(); });
  }

  function renderSpeciesDetail() {
    const w = App.world, sp = w.species.get(App.selectedSpecies);
    if (!sp) { $("spDetail").style.display = "none"; return; }
    $("spDetail").style.display = "block";
    let bm = 0, regions = [];
    for (const [, p] of w.populations) if (p.speciesId === sp.id) { bm += p.biomass; regions.push(p); }
    const g = sp.genome;
    const trait = (k, lbl) => '<div class="tr"><span>' + lbl + '</span><i style="width:' + (g[k] * 100) + '%"></i></div>';
    const parent = sp.parentId ? w.species.get(sp.parentId) : null;
    $("spDetail").innerHTML =
      '<div class="sp-d-head"><span class="sp-dot" style="background:' + W.SimRender.speciesColor(sp) + '"></span>'
      + '<b>' + sp.name + '</b><button class="x" onclick="App.closeSpecies()">✕</button></div>'
      + '<div class="sp-d-meta">' + sp.role + ' · ' + sp.biochem + ' · origin: ' + sp.origin + '</div>'
      + '<div class="sp-d-meta">' + (sp.extinctTime === null
        ? 'LIVING · ' + Math.round(bm) + ' biomass across ' + regions.length + ' regions'
        : 'EXTINCT at ' + W.SimNames.fmtAge(sp.extinctTime) + ' · lived ' + W.SimNames.fmtAge((sp.extinctTime - sp.originTime))) + '</div>'
      + (parent ? '<div class="sp-d-meta">ancestor: <a onclick="App.selectSpecies(' + parent.id + ')">' + parent.name + '</a></div>' : '<div class="sp-d-meta">founder lineage (no ancestor)</div>')
      + (sp.childrenIds.length ? '<div class="sp-d-meta">descendants: ' + sp.childrenIds.map(id => '<a onclick="App.selectSpecies(' + id + ')">' + (w.species.get(id) ? w.species.get(id).genus : id) + '</a>').join(", ") + '</div>' : '')
      + '<div class="traits">'
      + trait("size", "size") + trait("photo", "photosyn") + trait("chemo", "chemosyn")
      + trait("predation", "predation") + trait("energyEff", "efficiency") + trait("tempPref", "temp pref")
      + trait("tempTol", "temp tol") + trait("o2pref", "O₂ pref") + trait("armor", "armor")
      + trait("toxin", "toxin") + trait("dispersal", "dispersal") + trait("mutationRate", "mut rate")
      + '</div>';
  }
  App.closeSpecies = function () { App.selectedSpecies = null; $("spDetail").style.display = "none"; fullRender(); };
  App.selectSpecies = function (id) { App.selectedSpecies = id; App.panel = "species"; setPanel("species"); fullRender(); };

  function renderCellInfo() {
    const w = App.world, c = w.grid.cells[App.selectedCell];
    const arr = w.popsByCell.get(c.idx) || [];
    const pops = arr.map(p => {
      const sp = w.species.get(p.speciesId);
      return '<div class="cp" data-sp="' + sp.id + '"><span class="sp-dot" style="background:' + W.SimRender.speciesColor(sp) + '"></span>'
        + sp.name + ' <b>' + Math.round(p.biomass) + '</b></div>';
    }).join("");
    $("cellInfo").style.display = "block";
    $("cellInfo").innerHTML =
      '<div class="ci-head">REGION ' + c.x + "," + c.y + ' <button class="x" onclick="App.closeCell()">✕</button></div>'
      + '<div class="ci-grid">'
      + ci("lat", c.lat.toFixed(0) + "°") + ci("elev", c.elevation.toFixed(2) + " km")
      + ci("water", c.waterDepth > 0 ? c.waterDepth.toFixed(2) + " km" + (c.ice ? " (ice)" : "") : "dry")
      + ci("temp", c.temp.toFixed(1) + " °C") + ci("moist", (c.moisture * 100).toFixed(0) + "%")
      + ci("energy", Math.round(c.energy + c.ventEnergy)) + ci("type", window.SimNames.regionDescriptor(c))
      + ci("crater", c.crater > 0.05 ? c.crater.toFixed(2) : "—")
      + '</div>'
      + (pops ? '<div class="ci-pops"><div class="ci-sub">POPULATIONS</div>' + pops + '</div>' : '<div class="ci-sub muted">no populations</div>');
    document.querySelectorAll("#cellInfo .cp").forEach(r => r.onclick = () => App.selectSpecies(+r.dataset.sp));
  }
  function ci(k, v) { return '<div class="ci-cell"><span>' + k + '</span><b>' + v + '</b></div>'; }
  App.closeCell = function () { App.selectedCell = null; $("cellInfo").style.display = "none"; fullRender(); };

  function setPanel(p) {
    App.panel = p;
    $("tabTimeline").classList.toggle("active", p === "timeline");
    $("tabSpecies").classList.toggle("active", p === "species");
    $("timelinePanel").style.display = p === "timeline" ? "flex" : "none";
    $("speciesPanel").style.display = p === "species" ? "flex" : "none";
  }

  // ---- wire UI ----
  function init() {
    // speed buttons
    const sc = $("speedRow");
    SPEED_LABELS.forEach((lbl, i) => {
      const b = document.createElement("button");
      b.className = "speed-btn" + (i === 0 ? " active" : "");
      b.textContent = lbl; b.title = SPEEDS[i] === 0 ? "Pause" : SPEEDS[i] + "×";
      b.onclick = () => setSpeed(i);
      sc.appendChild(b);
    });
    $("stepBtn").onclick = () => { setSpeed(0); step(1); fullRender(); };
    $("step10Btn").onclick = () => { setSpeed(0); step(10); fullRender(); };
    $("newBtn").onclick = () => newWorld($("seedInput").value || randomSeed());
    $("randBtn").onclick = () => newWorld(randomSeed());
    $("seedInput").addEventListener("keydown", e => { if (e.key === "Enter") newWorld($("seedInput").value); });

    // overlays
    const ov = $("overlayRow");
    W.SimRender.OVERLAYS.forEach(o => {
      const b = document.createElement("button");
      b.className = "ov-btn" + (o === App.overlay ? " active" : "");
      b.textContent = o; b.dataset.ov = o;
      b.onclick = () => { App.overlay = o; document.querySelectorAll(".ov-btn").forEach(x => x.classList.toggle("active", x.dataset.ov === o)); fullRender(); };
      ov.appendChild(b);
    });

    $("tabTimeline").onclick = () => { setPanel("timeline"); fullRender(); };
    $("tabSpecies").onclick = () => { setPanel("species"); fullRender(); };
    $("impFilter").oninput = () => { $("impVal").textContent = $("impFilter").value; renderTimeline(); };

    // map click -> select cell
    $("mapCanvas").addEventListener("click", e => {
      const rect = e.target.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / rect.width * App.world.grid.W);
      const y = Math.floor((e.clientY - rect.top) / rect.height * App.world.grid.H);
      App.selectedCell = y * App.world.grid.W + x;
      fullRender();
    });

    // tests
    $("testBtn").onclick = runTestsUI;

    // keyboard
    document.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === " ") { e.preventDefault(); setSpeed(App.speedIdx === 0 ? 1 : 0); }
      else if (e.key === "s") { setSpeed(0); step(1); fullRender(); }
      else if (e.key >= "1" && e.key <= "5") setSpeed(+e.key);
      else if (e.key === "n") newWorld(randomSeed());
    });

    newWorld("tethys-12");
    requestAnimationFrame(loop);
  }

  function randomSeed() {
    const a = ["nova", "tethys", "ember", "vesper", "cygnus", "halcyon", "obsidian", "marrow", "azoth", "pallas", "thule", "wren"];
    return a[Math.floor(Date.now() / 7) % a.length] + "-" + (Date.now() % 9000 + 1000);
  }

  function runTestsUI() {
    const out = $("testOutput");
    out.style.display = "block";
    out.textContent = "Running determinism & invariant tests…\n";
    setTimeout(() => {
      const lines = [];
      const res = W.SimWorld.runTests(s => lines.push(s));
      const pass = res.filter(r => r.ok).length;
      out.textContent = lines.join("\n") + "\n\n" + pass + "/" + res.length + " passed.";
      out.className = "test-output " + (pass === res.length ? "ok" : "bad");
    }, 30);
  }

  W.addEventListener("DOMContentLoaded", init);
})();
