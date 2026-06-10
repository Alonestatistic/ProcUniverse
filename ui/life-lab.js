"use strict";
(function () {
  const Lab = { open: false, tab: "creature", speciesId: null };
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]); }
  function world() { return window.App && window.App.world; }
  function biomass(spId) {
    let total = 0, regions = 0;
    const w = world(); if (!w) return { total, regions };
    for (const [, p] of w.populations) if (p.speciesId === spId) { total += p.biomass; regions++; }
    return { total, regions };
  }
  function livingSpecies() {
    const w = world(); if (!w) return [];
    return [...w.species.values()].filter(s => s.extinctTime === null).sort((a, b) => biomass(b.id).total - biomass(a.id).total);
  }
  function currentSpecies() {
    const w = world(); if (!w) return null;
    let sp = Lab.speciesId ? w.species.get(Lab.speciesId) : null;
    if (!sp) sp = livingSpecies()[0] || [...w.species.values()][0] || null;
    if (sp) Lab.speciesId = sp.id;
    return sp;
  }
  function stageInfo() {
    const w = world();
    if (!w || !w.firstLifeRecorded) return ["PREBIOTIC WORLD", "Awaiting the first self-sustaining lineage"];
    if (!w.lifePresent) return ["POST-BIOTIC WORLD", "Life existed here, but the biosphere collapsed"];
    if (w.atm.o2 > 8 && window.SimWorld.aliveSpeciesCount(w) > 20) return ["COMPLEX BIOSPHERE", "Diverse oxygen-rich ecosystems are emerging"];
    if (w.firstPredationRecorded) return ["ECOLOGICAL RADIATION", "Predators, prey and competing niches now coexist"];
    return ["MICROBIAL AGE", "Early lineages are adapting and spreading"];
  }
  function record(type, importance, text) {
    const w = world();
    w.history.record(w, { type, importance, text });
  }
  function selectSpecies(id) { Lab.speciesId = +id; render(); }
  function buildShell() {
    const btn = document.createElement("button");
    btn.id = "lifeLabBtn"; btn.className = "ctrl-btn"; btn.textContent = "✦ LIFE LAB";
    btn.onclick = open;
    const footer = document.querySelector("footer");
    footer.insertBefore(btn, footer.querySelector(".grow"));

    const root = document.createElement("div"); root.id = "lifeLabRoot"; root.className = "life-lab-backdrop";
    root.innerHTML = '<section class="life-lab" role="dialog" aria-modal="true">'
      + '<header class="life-lab-head"><div><div class="life-lab-title">✦ EVOLUTION LIFE LAB</div><div class="life-lab-sub">Observe forms, trace ancestry, and interfere with natural history</div></div>'
      + '<div class="life-lab-grow"></div><button class="life-lab-close" id="lifeLabClose">CLOSE ✕</button></header>'
      + '<div class="life-layout"><aside class="life-sidebar"><div class="life-tabs">'
      + '<button class="life-tab active" data-tab="creature">FORM</button><button class="life-tab" data-tab="lineage">LINEAGE</button><button class="life-tab" data-tab="tools">GOD TOOLS</button>'
      + '</div><div class="life-stage" id="lifeStage"></div><div class="life-species-list" id="lifeSpeciesList"></div></aside><main class="life-main" id="lifeMain"></main></div></section>';
    document.body.appendChild(root);
    $("lifeLabClose").onclick = close;
    root.onclick = e => { if (e.target === root) close(); };
    root.querySelectorAll(".life-tab").forEach(b => b.onclick = () => { Lab.tab = b.dataset.tab; render(); });
  }
  function open() { Lab.open = true; $("lifeLabRoot").classList.add("open"); render(); }
  function close() { Lab.open = false; $("lifeLabRoot").classList.remove("open"); }
  function render() {
    if (!Lab.open) return;
    const w = world(); if (!w) return;
    const [title, sub] = stageInfo();
    $("lifeStage").innerHTML = '<b>' + esc(title) + '</b><span>' + esc(sub) + '</span>';
    document.querySelectorAll(".life-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === Lab.tab));
    renderSpeciesList();
    if (Lab.tab === "creature") renderCreature();
    else if (Lab.tab === "lineage") renderLineage();
    else renderTools();
  }
  function renderSpeciesList() {
    const w = world();
    const list = [...w.species.values()].sort((a, b) => {
      if ((a.extinctTime === null) !== (b.extinctTime === null)) return a.extinctTime === null ? -1 : 1;
      return biomass(b.id).total - biomass(a.id).total;
    }).slice(0, 100);
    $("lifeSpeciesList").innerHTML = list.length ? list.map(sp => {
      const col = window.SimRender.speciesColor(sp), dead = sp.extinctTime !== null;
      return '<button class="life-species' + (sp.id === Lab.speciesId ? ' active' : '') + (dead ? ' extinct' : '') + '" data-id="' + sp.id + '">'
        + '<i class="life-species-dot" style="background:' + col + '"></i><span>' + esc(sp.genus) + '<br><small>' + esc(sp.role) + (dead ? ' · extinct' : '') + '</small></span></button>';
    }).join("") : '<div class="life-empty">No species exist yet.<br>Use God Tools to encourage the first spark.</div>';
    document.querySelectorAll(".life-species").forEach(b => b.onclick = () => selectSpecies(b.dataset.id));
  }
  function stat(g, key, label) {
    const v = g[key] || 0;
    return '<div class="life-stat"><span>' + label + '</span><div class="life-bar"><i style="width:' + Math.round(v * 100) + '%"></i></div><b>' + Math.round(v * 100) + '</b></div>';
  }
  function renderCreature() {
    const sp = currentSpecies();
    if (!sp) { $("lifeMain").innerHTML = '<div class="life-empty"><div><h2>The planet is lifeless.</h2><p>Advance time or intervene through God Tools.</p></div></div>'; return; }
    const b = biomass(sp.id), parent = sp.parentId ? world().species.get(sp.parentId) : null;
    $("lifeMain").innerHTML = '<div class="life-creature-grid"><section class="life-card"><h3>PROCEDURAL ORGANISM VIEW</h3><canvas id="lifeCanvas" class="life-canvas" width="680" height="470"></canvas></section>'
      + '<section class="life-card"><h3>GENOME EXPRESSION</h3><div class="life-stats">'
      + stat(sp.genome,"size","size") + stat(sp.genome,"motility","motility") + stat(sp.genome,"energyEff","efficiency")
      + stat(sp.genome,"armor","armor") + stat(sp.genome,"toxin","toxin") + stat(sp.genome,"predation","predation")
      + stat(sp.genome,"dispersal","dispersal") + stat(sp.genome,"tempTol","temp tolerance") + stat(sp.genome,"mutationRate","mutation") + '</div>'
      + '<div class="life-meta"><b>' + esc(window.ProcCreature.morphotype(sp)) + '</b><br>' + esc(sp.role) + ' · ' + esc(sp.biochem)
      + '<br>' + (sp.extinctTime === null ? Math.round(b.total) + ' biomass in ' + b.regions + ' regions' : 'Extinct at ' + window.SimNames.fmtAge(sp.extinctTime))
      + '<br>Origin: ' + esc(sp.origin) + (parent ? '<br>Ancestor: ' + esc(parent.name) : '<br>Founder lineage') + '</div></section></div>';
    window.ProcCreature.draw($("lifeCanvas"), sp);
  }
  function ancestors(sp) {
    const out = [], w = world(); let cur = sp;
    while (cur && cur.parentId) { cur = w.species.get(cur.parentId); if (cur) out.unshift(cur); }
    return out;
  }
  function node(sp, current) {
    const b = biomass(sp.id);
    return '<button class="life-node' + (current ? ' current' : '') + '" data-id="' + sp.id + '">' + esc(sp.name)
      + '<small>' + esc(sp.role) + ' · ' + (sp.extinctTime === null ? Math.round(b.total) + ' bm' : 'extinct') + '</small></button>';
  }
  function renderLineage() {
    const sp = currentSpecies();
    if (!sp) { $("lifeMain").innerHTML = '<div class="life-empty">No lineage tree exists yet.</div>'; return; }
    const w = world(), parents = ancestors(sp), children = sp.childrenIds.map(id => w.species.get(id)).filter(Boolean);
    $("lifeMain").innerHTML = '<section class="life-card"><h3>EVOLUTIONARY FAMILY TREE</h3><div class="life-tree">'
      + '<div class="life-node-column"><h4>ANCESTORS</h4>' + (parents.length ? parents.map(x => node(x,false)).join("") : '<div class="life-empty">founder lineage</div>') + '</div>'
      + '<div class="life-node-column"><h4>SELECTED</h4>' + node(sp,true) + '</div>'
      + '<div class="life-node-column"><h4>DESCENDANTS</h4>' + (children.length ? children.map(x => node(x,false)).join("") : '<div class="life-empty">no descendants yet</div>') + '</div></div></section>';
    document.querySelectorAll(".life-node").forEach(b => b.onclick = () => selectSpecies(b.dataset.id));
  }
  const TOOL_DEFS = [
    ["seed", "Seed Primordial Life", "Attempt to establish a founder organism in the best currently viable ocean region."],
    ["comet", "Redirect an Icy Comet", "Deliver water and organics, add impact heat, and reshape the future climate."],
    ["radiate", "Induce Adaptive Radiation", "Push the selected lineage through a controlled burst of heritable variation."],
    ["sanctuary", "Bless a Survivor Lineage", "Improve dormancy, radiation resistance and environmental tolerance."],
    ["warm", "Thicken the Greenhouse", "Add atmospheric carbon dioxide and force a warming episode."],
    ["cool", "Trigger Carbon Drawdown", "Remove carbon dioxide and cool the long-term climate."],
  ];
  function renderTools() {
    $("lifeMain").innerHTML = '<div class="life-tools">' + TOOL_DEFS.map(t => '<section class="life-tool"><h3>' + t[1] + '</h3><p>' + t[2] + '</p><button class="life-action' + (t[0] === 'comet' ? ' danger' : '') + '" data-tool="' + t[0] + '">INTERVENE</button></section>').join("") + '</div>';
    document.querySelectorAll(".life-action").forEach(b => b.onclick = () => intervene(b.dataset.tool));
  }
  function bestFoundingCell() {
    const w = world(); let best = null, score = -Infinity;
    for (const c of w.grid.cells) {
      if (c.waterDepth <= 0 || c.ice || c.temp < -5 || c.temp > 65) continue;
      const s = c.energy + c.ventEnergy - Math.abs(c.temp - 25) * .6;
      if (s > score) { score = s; best = c; }
    }
    return best;
  }
  function intervene(tool) {
    const w = world(), sp = currentSpecies();
    if (tool === "seed") {
      const cell = bestFoundingCell();
      if (cell && window.SimBiology.foundSpecies(w, cell, "directed panspermia")) record("firstlife", 9, "An unknown hand seeded viable organisms in " + window.SimNames.regionDescriptor(cell) + ". Evolution gained a deliberate beginning.");
      else record("ecology", 4, "A directed seeding attempt failed; the planet offered no stable founding niche.");
    } else if (tool === "comet") {
      w.hydro = Math.min(400, w.hydro + 16); w.seaLevelDirty = true; w.tempPulse += 5;
      record("impact", 8, "A redirected icy comet delivered a major pulse of water and organics. Coastlines and ecological pressures will shift.");
    } else if (tool === "radiate" && sp) {
      const r = w.rng.derive("god/radiate/" + sp.id + "/" + w.tickCount);
      for (let i = 0; i < 5; i++) { const k = window.SimBiology.TRAITS[r.int(0, window.SimBiology.TRAITS.length - 1)]; sp.genome[k] = Math.max(.02, Math.min(.98, sp.genome[k] + r.gauss(0,.09))); }
      sp.importance += 1; record("speciation", 7, sp.name + " experienced an unnatural adaptive pulse. Its descendants may exploit entirely new niches.");
    } else if (tool === "sanctuary" && sp) {
      sp.genome.dormancy = Math.min(.98, sp.genome.dormancy + .16); sp.genome.radResist = Math.min(.98, sp.genome.radResist + .16); sp.genome.tempTol = Math.min(.98, sp.genome.tempTol + .12);
      record("ecology", 6, sp.name + " was granted exceptional survival adaptations, altering the odds of future extinction.");
    } else if (tool === "warm") {
      w.atm.co2 = Math.min(60, w.atm.co2 + 4); w.tempPulse += 3; record("atmosphere", 7, "Atmospheric carbon surged after deliberate planetary intervention. A greenhouse episode began.");
    } else if (tool === "cool") {
      w.atm.co2 = Math.max(.05, w.atm.co2 - 3.5); record("atmosphere", 7, "Accelerated carbon drawdown weakened the greenhouse and redirected climate evolution.");
    }
    if (window.App) { window.App.selectedSpecies = Lab.speciesId; }
    render();
  }
  function init() {
    buildShell();
    document.addEventListener("keydown", e => { if (e.key === "Escape" && Lab.open) close(); if ((e.key === "l" || e.key === "L") && e.target.tagName !== "INPUT") open(); });
  }
  window.ProcLifeLab = { open, close, render, selectSpecies };
  window.addEventListener("DOMContentLoaded", init);
})();
