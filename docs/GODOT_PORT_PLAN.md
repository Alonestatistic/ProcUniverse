# ProcUniverse Godot Port Plan

## Goal

Turn the browser prototype into a proper Godot 4.x game project while preserving the deterministic simulation design.

The web prototype should stay in the repository as a playable reference. The Godot version should become the main long-term game target.

## Why Godot

Godot is a better fit for the project once ProcUniverse moves from a simulation dashboard into playable stages:

- native desktop builds
- stronger scene organization
- real input/controller handling
- 2D/3D rendering options
- playable Cell and Creature stages
- save/load support
- future moddable content pipeline

## Current Godot Scaffold

This branch adds a first runnable Godot vertical slice:

- `project.godot`
- `scenes/Main.tscn`
- `scripts/sim/Rng.gd`
- `scripts/sim/World.gd`
- `scripts/ui/Main.gd`
- `icon.svg`

Implemented in the Godot slice:

- deterministic seed-based planet generation
- 128x64 wrapped planet map
- ocean, land, craters, biomass coloring
- deep-time ticking
- abiogenesis chance
- biomass spread
- simple speciation
- simple extinction
- oxygen and carbon dioxide feedback
- live stats panel
- species list
- event timeline

This is intentionally not a full one-to-one port yet. It is the foundation that lets the repo open as a Godot project and gives us a stable place to port systems one at a time.

## Recommended Development Strategy

Do **not** convert everything in one monster pass.

Port in layers:

1. Project shell and map renderer
2. Deterministic RNG parity
3. Terrain generation parity
4. Star system generation parity
5. Climate and hydrosphere parity
6. Impacts parity
7. Biology/genome data model parity
8. Population/ecology parity
9. History/timeline parity
10. Life Lab and creature visuals
11. Save/load
12. Cell Stage prototype

Each layer should include a small determinism or invariant test before moving on.

## Architecture Target

```text
res://
  scenes/
    Main.tscn
    life_lab/
    cell_stage/
    creature_stage/
  scripts/
    sim/
      Rng.gd
      StarSystem.gd
      Terrain.gd
      Climate.gd
      Biology.gd
      Ecology.gd
      History.gd
      World.gd
    ui/
      Main.gd
      PlanetMap.gd
      TimelinePanel.gd
      SpeciesPanel.gd
      LifeLab.gd
    playable/
      CellStage.gd
      CreatureController.gd
  assets/
    fonts/
    icons/
    shaders/
  docs/
```

## Important Porting Rules

### Keep simulation data separate from UI

The simulator should not depend on scenes, controls or rendering nodes.

Good:

```gdscript
var world := World.new(seed)
world.tick(100)
```

Bad:

```gdscript
world.tick_and_update_labels(ui_label)
```

### Aggregate first, instantiate later

Planetary scale should remain aggregate:

- species records
- population records
- region records
- event records

Only instantiate individual creatures in playable scenes such as Cell Stage or Creature Stage.

### Determinism matters

Avoid `randf()` and `randi()` for simulation logic. Use the custom `Rng.gd` streams so the same seed can reproduce the same history.

### Do not rewrite the design around Godot nodes

A species should not be a Node. A population should not be a Node. These are data records. Nodes are for rendering and interaction.

## Immediate Next Milestone

### Godot Milestone 1 — Simulation Parity Skeleton

Tasks:

- Replace the simplified `World.gd` generation with direct ports of the browser files:
  - `sim/starsystem.js`
  - `sim/terrain.js`
  - `sim/climate.js`
  - `sim/impacts.js`
  - `sim/biology.js`
  - `sim/ecology.js`
  - `sim/history.js`
- Add a `SimTests.gd` script with:
  - same seed creates same world hash
  - different seed creates different world hash
  - populations never go negative
  - atmosphere and hydrosphere stay bounded
  - extinct species have no active populations
- Keep the current map UI as the visual smoke test

### Godot Milestone 2 — Life Lab Native UI

Tasks:

- Rebuild the HTML Life Lab as Godot scenes
- Native species detail panel
- Native lineage tree panel
- Native intervention buttons
- Native procedural creature portrait drawn with `_draw()` or generated texture

### Godot Milestone 3 — Cell Stage Prototype

Tasks:

- Pick a living species
- Generate a local playable microbe arena from one region
- Move a cell-like organism
- Eat/gather energy
- Avoid hazards or predators
- Reproduce
- Write result back to aggregate population

## How To Run

1. Checkout this branch.
2. Open the repository folder in Godot 4.x.
3. Open `project.godot`.
4. Press Play.

If the editor asks to import resources, allow it.

## Known Limitations

- The Godot simulation is currently a simplified vertical slice, not yet a full parity port.
- The browser version still contains the richer ecology model.
- The Godot UI is functional but intentionally plain.
- No save/load yet.
- No native Life Lab yet.
- No playable Cell Stage yet.

## Success Criteria For The Port

The Godot version becomes the primary version when it can:

- reproduce the major browser sim systems
- render planet overlays natively
- inspect species and lineages
- run deterministic tests
- save and load worlds
- support a small playable Cell Stage loop

After that, the browser build can become a historical prototype or web demo.
