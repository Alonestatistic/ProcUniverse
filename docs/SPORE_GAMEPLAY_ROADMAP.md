# ProcUniverse — Spore-Inspired Gameplay Roadmap

## Vision

ProcUniverse should keep its deterministic, simulation-heavy foundation while becoming a game in which the player develops an emotional attachment to lineages, deliberately influences evolution, and eventually plays inside the history the simulation creates.

This is not intended to be a direct Spore clone. The target is:

- Spore's readable evolution fantasy and escalating scale
- Dwarf Fortress-style historical continuity
- A scientifically flavored procedural biosphere simulation
- Player choices that permanently alter the timeline
- Aggregate simulation at planetary scale, with individuals instantiated only when the player zooms into a playable scene

## Current Foundation — Milestones 0–7

Already implemented:

- Deterministic root seed and independent RNG streams
- Procedural star system and focus planet
- Wrapped planetary terrain grid
- Impacts, water delivery, volcanism and climate
- Abiogenesis and panspermia pathways
- Aggregate populations rather than one object per organism
- Competition, predation, migration and local adaptation
- Mutation, speciation, extinction and mass extinction recovery
- Atmospheric feedback from life
- Named species, lineage links and historical events
- Planet overlays, region inspection and deterministic tests

The current build is a strong simulation dashboard. The next milestones turn that dashboard into a game.

---

## Milestone 8 — Evolution Life Lab

**Goal:** Make species feel like creatures rather than rows of numbers.

Features:

- Genome-driven procedural organism portraits
- Visual traits derived from size, armor, motility, toxin, predation, dispersal and metabolism
- Species browser integrated into a dedicated Life Lab
- Clickable ancestor and descendant navigation
- Biosphere stage readout
- Initial player interventions:
  - Seed primordial life
  - Redirect an icy comet
  - Induce adaptive radiation
  - Bless a survivor lineage
  - Warm the greenhouse
  - Trigger carbon drawdown
- Every intervention produces a permanent timeline event

Completion criteria:

- The same seed and species always produces the same visual form
- The Life Lab can inspect living and extinct species
- Interventions alter real world state rather than only changing UI
- The original deterministic simulation tests still pass

---

## Milestone 9 — Cell Stage

**Goal:** Let the player temporarily inhabit one organism while the planet continues to simulate around it.

Core loop:

1. Choose a living microbial lineage.
2. Enter a local region as an instantiated individual.
3. Gather energy, avoid hazards, consume prey and reproduce.
4. Earn adaptation points through survival and ecological success.
5. Return to planetary time and allow the selected lineage to spread.

Systems:

- Top-down or side-view microbe arena generated from the selected region
- Food particles, vents, sunlight zones, toxins and currents
- Simple locomotion based on motility traits
- Feeding behavior based on photosynthesis, chemosynthesis, grazing and predation
- Local predators generated from coexisting simulated species
- Temporary individual simulation that writes results back into aggregate biomass and local genetic offsets
- Death is meaningful but does not automatically erase the whole lineage

Technical rule:

The world simulator remains authoritative. The Cell Stage is a temporary high-detail projection of one region, not a second independent simulation.

---

## Milestone 10 — Heritable Creature Editor

**Goal:** Give the player expressive control without allowing free, consequence-free redesigns.

Features:

- Edit a chosen lineage only at reproduction or speciation moments
- Trait costs tied to energy demand and environmental pressures
- Body modules generated from genome traits:
  - Locomotion
  - Sensory organs
  - Feeding structures
  - Armor
  - Toxins
  - Reproductive strategy
  - Thermal and radiation adaptations
- Changes create a daughter species rather than rewriting the ancestor
- Preview estimated habitat suitability before committing
- Mutation budget influenced by population size, mutation rate and accumulated adaptation points

Design rule:

The editor should feel creative like Spore, but every part must have ecological costs and simulated consequences.

---

## Milestone 11 — Multicellular and Creature Stage

**Goal:** Transition successful lineages from microbial colonies into mobile multicellular organisms.

Simulation additions:

- Multicellularity threshold based on oxygen, energy availability and ecological pressure
- New aggregate traits:
  - Body plan
  - Symmetry
  - Skeletal support
  - Circulation
  - Nervous complexity
  - Reproductive mode
  - Social tendency
- Land, ocean and amphibious niches
- Life cycles and juvenile survival
- Sexual selection and mate competition
- Predator-prey arms races

Playable loop:

- Explore a generated habitat as a member of the selected species
- Find food, shelter and mates
- Defend territory or migrate
- Discover other species and environmental hazards
- Complete generational objectives that affect the lineage's simulated future

---

## Milestone 12 — Ecosystem Story Engine

**Goal:** Turn simulation changes into understandable stories.

Features:

- Named continents, oceans, biomes and ecological provinces
- Signature species and keystone lineages
- Rivalry records between predator and prey clades
- Migration waves
- Adaptive radiations
- Living fossils
- Invasive species
- Disease outbreaks
- Symbiosis and parasitism
- Fossil record and geological layers
- Timeline chapters for major planetary eras
- A planet codex that fills through observation rather than revealing all data immediately

The player should be able to say, "this predator exists because I warmed the planet 300 million years ago," and see that causal chain in the history.

---

## Milestone 13 — Intelligence and Tribal Stage

**Goal:** Allow one lineage to cross from animal behavior into culture.

Requirements for intelligence:

- High neural complexity
- Sufficient energy budget
- Manipulation ability
- Social learning
- Long juvenile development
- Environmental pressure favoring planning

Systems:

- Procedural cultures based on biology and habitat
- Tribes that remember migration, disasters and important species
- Hunting, gathering, shelter and primitive tools
- Cooperation, rivalry and kinship
- Rituals based on real planetary history
- Domestication of procedurally evolved plants and animals
- Player control of one tribe while other cultures remain simulated

---

## Milestone 14 — Civilization Stage

**Goal:** Grow cultures into settlements, states and technological societies.

Features:

- Settlements generated from terrain, climate, resources and inherited culture
- Agriculture, trade, warfare, religion and governance
- Technology trees influenced by available biology and planetary chemistry
- Ecological consequences from industry and land use
- Factions with historical grievances and shared ancestry
- Civilization collapse, dark ages and recovery
- Ability to switch between direct settlement play and planetary observation

The civilization layer must remain connected to the biosphere. Technology should not erase ecology from the game.

---

## Milestone 15 — Space Stage

**Goal:** Return to the star-system scale with a civilization shaped by the entire planetary history.

Features:

- Launch capability derived from civilization technology
- Exploration of generated planets, moons and asteroid belts
- Terraforming with real climate and ecosystem consequences
- Directed panspermia
- Alien biospheres generated by the same simulation rules
- Diplomacy between independently evolved civilizations
- Archaeology of extinct worlds
- Interstellar lineage and culture tracking
- A galaxy timeline that preserves planetary histories

---

## Cross-Milestone Systems

### Save and Replay

- Versioned save format
- Root seed plus intervention log
- Reproducible world history
- Branching alternate timelines from saved checkpoints

### Information and Discovery

The player should not begin with omniscient access.

- Early observation reveals broad environmental clues
- Scanning and research reveal traits
- Fossils reveal extinct lineages
- Intelligent civilizations develop their own incomplete scientific models

### Player Influence Economy

God powers should use a limited resource earned by:

- Reaching new evolutionary milestones
- Preserving biodiversity
- Surviving extinction events
- Discovering rare adaptations
- Completing playable-stage objectives

This prevents interventions from becoming consequence-free debug controls.

### Performance Architecture

- Continue simulating species, populations and regions as aggregate records
- Instantiate individuals only in the active playable scene
- Convert playable outcomes back into aggregate state
- Use deterministic content generation instead of storing every visual asset
- Add worker-thread simulation only after profiling demonstrates a need

---

## Immediate Development Order

1. Finish and test Milestone 8 Life Lab.
2. Add save/load before player interventions become more numerous.
3. Add a local-region scene generator.
4. Build the smallest possible Cell Stage loop: move, consume, survive, reproduce.
5. Write Cell Stage outcomes back into population biomass and gene offsets.
6. Add adaptation points and constrained heritable editing.
7. Expand the simulation toward multicellularity only after the Cell Stage is fun.

## Definition of Success

ProcUniverse feels Spore-like when:

- The player recognizes and remembers individual lineages.
- Evolution creates visible changes, not only numerical changes.
- The player can directly play at several scales.
- Choices made in one era meaningfully reshape later eras.
- A complete run tells a unique history from barren planet to spacefaring life.
- The deep simulation remains functional even when the player does nothing.
