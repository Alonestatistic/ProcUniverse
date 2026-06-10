# Claude Development Handoff — Procedural Planet & Evolution Simulator

## Working Concept

Build a deterministic, long-running procedural simulation in Godot 4.x that begins with a generated star system and barren planet, develops oceans and climate through geological and impact events, introduces or originates microbial life, and allows lineages to mutate, compete, migrate, speciate, alter the planet, and become extinct.

The long-term vision is a mixture of **Spore, Dwarf Fortress, a colony-management game, an exploration roguelike, and a planetary history simulator**. The player mostly observes and occasionally intervenes during prehistory. Full conventional gameplay begins once intelligent life and civilizations appear.

This is a sandbox. There is no failure state and no required ending. A world should be capable of remaining interesting for hundreds of hours.

---

# 1. Product Pillars

## 1.1 Emergent history over scripted outcomes

Do not force the simulation toward humans, intelligence, civilization, or an Earth-like biosphere. The simulation should generate causal histories from initial conditions, environmental pressure, chance, and player intervention.

## 1.2 Determinism

The same world seed and the same sequence of player actions must produce the same results.

Use a root seed and derive separate deterministic random streams for:

- star system generation
- planet generation
- terrain generation
- impacts
- climate
- abiogenesis or panspermia
- mutation
- migration
- disasters
- naming
- civilization systems later

Never use uncontrolled global randomness.

## 1.3 Simulate aggregates, instantiate details

Never represent billions of organisms as individual game objects.

At global scale, simulate:

- species
- regional populations
- biomass
- genetic averages and variance
- resources
- habitat suitability
- ecological relationships
- migration flows

Only create individual creatures when the player zooms into a local region. Those individuals should be representative samples generated from the regional population data.

## 1.4 Progressive detail

The game must support several conceptual zoom levels:

1. solar system
2. planet
3. continent
4. region
5. biome
6. local terrain
7. organism
8. cell

The first prototype only needs the solar-system, planet, regional ecosystem, species, and timeline levels. Architecture must leave room for deeper levels later.

## 1.5 Performance before spectacle

Target Windows and low-end computers.

Priority order:

1. simulation speed
2. meaningful individual behavior when locally instantiated
3. scientific depth
4. long historical continuity
5. large species counts
6. visual detail

Use ASCII/tile-based presentation initially.

---

# 2. Resolved Design Decisions

The survey contained several intentionally broad or conflicting answers. Use these resolved interpretations.

## 2.1 Planet representation

The first version will use a wrapped equirectangular grid:

- longitude wraps east/west
- latitude is clamped at the poles
- map is displayed as a flat ASCII/tile map
- data model must later support a globe renderer
- initial resolution: configurable, default 128 × 64 cells
- simulation may run at reduced resolution during very large time steps

Do not implement a true 3D spherical globe in the first prototype.

## 2.2 Continents and geology

The final game may simulate continental drift, but the prototype uses procedural continental masks, elevation, volcanism, erosion, sediment, and gradual coarse continental movement during accelerated geological ticks.

Do not build a full plate-tectonics physics simulation initially.

## 2.3 “Everything in the first prototype”

This means the prototype must include a **small but functional version of every essential causal loop**, not the full final feature set.

The first prototype must demonstrate:

- seeded star-system generation
- one generated focus planet
- barren-world terrain
- impacts delivering water and chemicals
- climate regions
- origin or arrival of microbial life
- regional populations
- resource competition
- mutation
- migration
- speciation
- extinction
- simple producer/consumer food relationships
- environmental modification by life
- historical event recording
- visible simulation playback

It does not need:

- civilization
- detailed individual animals
- full local exploration
- combat
- complex chemistry
- realistic orbital physics
- detailed weather
- complete fossils
- full body rendering
- complete mod tools

## 2.4 Population scale

“Billions of populations” is not a literal object count.

Represent population sizes with numeric counts or biomass values. Store only active species-region pairs in a sparse structure.

A planet may contain billions or trillions of organisms while the engine only processes hundreds or thousands of population records.

## 2.5 History storage

Keep important events permanently. Compress low-importance history into summaries.

Complete family trees should remain logically recoverable, but ancient insignificant branches may be compressed into lineage summary nodes.

## 2.6 Player intervention

Before civilization, the player primarily observes.

Early interventions eventually include:

- triggering or redirecting an impact
- introducing a disease
- changing a limited environmental variable
- protecting a species through godlike intervention
- accelerating or pausing time

No rewind and no branching timelines.

---

# 3. Non-Negotiable Features

Treat these as the actual non-negotiable foundation:

1. deterministic seeded generation
2. a barren planet that physically and chemically changes over time
3. life that can originate through more than one procedural pathway
4. population-level natural selection rather than scripted evolution
5. mutation, migration, speciation, and extinction
6. lineages and ancestry
7. environmental feedback from organisms
8. mass extinction and recovery
9. a readable historical timeline
10. worlds that may fail, remain sterile, or never produce intelligence
11. no predetermined evolutionary direction
12. simulation systems separated from rendering and UI

---

# 4. Systems That Must Wait

Architect for these, but do not implement them during the first prototype:

- complete procedural animal anatomy
- detailed skeletons and organs
- individual creature AI at planetary scale
- civilization simulation
- language, religion, politics, warfare, and technology
- local roguelike exploration
- colony management
- spacefaring civilizations
- advanced genetic engineering
- full alternative biochemistry
- detailed fossil excavation
- alien ruins and artificial structures
- rare supernatural events
- multiplayer
- complete mod SDK
- high-detail globe rendering
- realistic fluid dynamics
- daily global weather
- neural-network creature brains

---

# 5. Technical Architecture

## 5.1 General rule

The simulation core must not depend on scene-tree Nodes.

Use plain typed GDScript classes, `RefCounted` data objects, Resources where editor configurability is useful, and Nodes only for orchestration, input, UI, and rendering.

Suggested project structure:

```text
res://
  core/
    rng/
    time/
    events/
    serialization/
    math/
  data/
    world/
    astronomy/
    planet/
    climate/
    biology/
    history/
  simulation/
    astronomy/
    geology/
    impacts/
    climate/
    chemistry/
    ecology/
    evolution/
    history/
  presentation/
    map/
    ui/
    ascii/
  scenes/
    main/
    simulation/
  tests/
  config/
```

## 5.2 Suggested autoloads

Keep autoloads minimal:

- `AppState`
- `SimulationController`
- `SaveManager`

Do not turn every system into a singleton.

## 5.3 Primary data model

### WorldState

Contains:

- root seed
- simulation age
- generated star system
- focus planet
- history database
- configuration version
- simulation version

### StarSystemState

Contains:

- stars
- planets
- moons
- asteroid belts
- comet reservoirs
- orbital summaries
- debris density
- radiation environment

### PlanetState

Contains:

- physical properties
- axial tilt
- rotation period
- orbital properties
- atmospheric composition
- hydrosphere totals
- magnetic-field strength
- global temperature
- regional grid
- active species registry
- active regional populations
- extinct lineage archive

### RegionCell

Contains:

- coordinate/index
- latitude and longitude
- elevation
- water depth
- terrain type
- temperature
- moisture
- sunlight
- atmospheric values
- ocean chemistry or soil chemistry
- mineral resources
- producer energy
- neighboring cell indices
- biome classification
- active population IDs

### SpeciesGenome

Use a hybrid genome:

- numerical traits
- categorical traits
- modular biological structures
- behavioral tendencies
- developmental/body-plan data added later

Initial microbial traits:

- size
- reproduction rate
- energy efficiency
- motility
- temperature preference
- temperature tolerance
- salinity tolerance
- radiation resistance
- armor
- toxin production
- photosynthesis efficiency
- chemosynthesis efficiency
- predation ability
- dormancy ability
- oxygen preference
- environmental modification output
- mutation rate
- dispersal tendency

### SpeciesRecord

Contains:

- unique deterministic ID
- parent lineage IDs
- origin time
- extinction time if extinct
- genome
- biochemical family
- common and scientific names
- origin method
- discovered status
- importance score
- compressed ancestry metadata

### PopulationRecord

One record per active species-region pair:

- species ID
- region ID
- organism count
- biomass
- health
- stored energy
- genetic mean offsets
- genetic variance
- disease pressure
- migration pressure
- isolation duration
- generation count

Use a sparse dictionary or packed indexed store. Never allocate a full species-by-region matrix.

---

# 6. Simulation Clock and Time Scales

Support pause and fast-forward.

Use hierarchical ticks:

- astronomical tick: very large periods
- geological tick
- climate tick
- ecological tick
- local real-time tick later

Suggested prototype ranges:

```text
Barren geological era:
1 tick = 100,000 to 1,000,000 years

Early microbial era:
1 tick = 1,000 to 100,000 years

Complex microbial ecosystem:
1 tick = 10 to 1,000 years
```

The controller may dynamically reduce the time step when:

- life first appears
- a major impact occurs
- climate changes rapidly
- a mass extinction starts
- speciation accelerates

Never tie simulation correctness to frame rate.

Run a deterministic number of simulation steps per frame according to the selected speed, with a per-frame processing budget to avoid freezing the UI.

---

# 7. Core Simulation Pipeline

For each simulation step, process systems in a documented stable order:

1. advance astronomical state
2. schedule or process impacts
3. update geological state
4. update atmosphere and hydrosphere
5. calculate regional climate
6. produce regional resources
7. calculate population resource demand
8. resolve competition
9. resolve predation and grazing
10. resolve environmental stress
11. resolve disease pressure
12. calculate deaths
13. calculate reproduction
14. migrate or disperse populations
15. mutate offspring distributions
16. evaluate lineage divergence and speciation
17. remove extinct populations
18. archive extinct species
19. apply organism-driven planetary changes
20. calculate event importance
21. record history
22. update presentation snapshots

Do not modify collections while iterating them. Queue additions and removals, then apply them at the end of each phase.

---

# 8. Simplified Scientific Models

The game aims for “mostly plausible, like Spore,” not academic simulation accuracy.

## 8.1 Star system

Generate one to three stars, with rare special systems.

Prototype support:

- single star
- binary star
- trinary star
- brown dwarf
- white dwarf
- red giant
- rare neutron-star system
- rogue planet scenario

Generate 1–10 planets, typically around 5.

Model:

- mass
- age
- temperature
- luminosity
- radiation
- lifespan
- habitable zone
- solar wind

Other bodies may exist as summaries until visited:

- moons
- asteroid belts
- comet clouds
- dwarf planets
- rings
- captured objects
- alien artifacts

Do not simulate n-body orbital physics. Generate stable orbital summaries and apply limited deterministic variation.

## 8.2 Terrain

Use layered deterministic noise and macro masks to generate:

- continental regions
- elevation
- mountains
- basins
- volcanic hotspots
- crater terrain

Latitude must influence temperature and climate.

## 8.3 Water delivery

The planet begins with a configurable initial water inventory, often extremely low.

Impacts can deliver:

- water
- ice
- carbon compounds
- amino acids
- metals
- radioactive materials
- durable microbes

Impact effects depend on:

- velocity
- entry heating
- impact location
- atmospheric density
- ocean depth
- microbe durability
- radiation exposure
- deterministic chance

Impacts may:

- create or enlarge oceans
- boil water
- change atmospheric composition
- form crater lakes
- cause extinction
- spread microbes between bodies

## 8.4 Climate

Prototype regional temperature:

```text
temperature =
    stellar_input
    * latitude_factor
    * seasonal_factor
    + greenhouse_effect
    - elevation_cooling
    + ocean_moderation
    + local_variation
```

Prototype moisture:

- evaporation from water cells
- prevailing directional transport
- mountain rain shadows
- local condensation
- river/lake contribution later

Atmosphere and life must affect one another.

Examples:

- photosynthesis raises oxygen
- methane producers increase greenhouse warming
- widespread biological carbon capture cools the planet
- oxygen may poison anaerobic life

## 8.5 Life origin

At world generation, choose one or more possible origin pathways:

- abiogenesis
- asteroid-delivered microbes
- comet-delivered microbes
- multiple unrelated origins
- extremely rare ancient-alien seeding

Do not guarantee that any pathway succeeds.

The initial simulation begins at single-celled life, not self-replicating molecule chemistry.

## 8.6 Ecology

Each region has a renewable energy/resource budget.

Microbial ecological roles may include:

- photosynthetic producer
- chemosynthetic producer
- grazer
- predator
- decomposer
- parasite-like consumer
- symbiont

Population growth must be constrained by available energy, habitat suitability, predation, competition, disease, and waste/toxicity.

Avoid unconstrained exponential growth.

## 8.7 Mutation and selection

Mutation changes inherited traits. Selection emerges because trait values alter survival and reproduction.

Mutation may occasionally produce failure, but bizarre nonviable mutations should not dominate.

Do not use a generic “fitness” stat as the only mechanism. Fitness must be contextual to each region and ecological interaction.

## 8.8 Speciation

A population may become a new species when several conditions combine:

- prolonged geographic isolation
- sufficient genetic distance
- different ecological niche
- reproductive incompatibility
- stable population size

Use a divergence accumulator rather than testing every individual genome.

## 8.9 Extinction

A species becomes extinct when no active populations remain.

Support:

- local extinction
- global extinction
- near-extinction refuges
- recovery after mass extinction
- permanent planetary sterilization

## 8.10 Environmental engineering

Microbes can gradually alter:

- oxygen
- carbon dioxide
- methane
- ocean chemistry
- mineral deposition
- soil precursor formation
- toxicity
- global temperature

---

# 9. Historical Event System

Record events only when meaningful.

Each event receives an importance score based on:

- novelty
- rarity
- population affected
- percentage of biosphere affected
- geographic extent
- duration
- environmental magnitude
- number of descendant lineages influenced
- whether it is a first-ever event

Name an event automatically when its score crosses a threshold.

Examples:

- first stable life
- first photosynthesis
- first predation
- first multicellular lineage later
- first global oxygen rise
- first mass extinction
- first land colonization later
- major impact
- origin of a dominant clade
- emergence of intelligence later

Use deterministic procedural naming based on geography, cause, dominant lineage, or era.

Low-importance repeated events should be aggregated:

```text
“Between 1.42 and 1.37 billion years ago, twelve minor coastal lineages became extinct during sustained cooling.”
```

---

# 10. User Interface for the Prototype

Use a functional ASCII/tile interface.

Required screens:

## Solar System View

Display:

- generated stars
- planets and moons
- focus planet
- basic orbit summaries
- debris and impact risk
- habitability indicators

## Planet Map

Display a wrapped map with switchable overlays:

- elevation
- temperature
- moisture
- water
- atmosphere
- biome
- microbial biomass
- dominant species
- species richness
- impact craters

## Species Browser

Display:

- name
- genome traits
- origin
- ecological role
- current populations
- total biomass
- ancestor
- descendants
- environmental tolerances
- population history
- extinction state

## Timeline

Display important events in chronological order with filters.

## Simulation Controls

Include:

- pause
- speed levels
- single-step
- new world
- enter seed
- save
- load
- overlay selection

No rewind.

---

# 11. Save System

Save:

- configuration version
- root seed
- current simulation age
- deterministic RNG states or event counters
- planetary state
- active populations
- species registry
- compressed lineage archive
- event history
- player interventions

Use a versioned save format.

Do not serialize scene-tree Nodes as core world state.

A saved world must resume deterministically.

---

# 12. Testing Requirements

Create automated or headless tests for:

1. same seed generates the same star system
2. same seed generates the same terrain
3. same seed and tick count generate the same biological outcome
4. different seeds produce meaningfully different worlds
5. populations cannot become negative
6. resource totals remain bounded
7. extinct species have no active populations
8. speciation creates valid parent-child lineage links
9. migration respects map boundaries and longitude wrapping
10. saving and loading preserves deterministic continuation
11. a sterile planet can remain sterile
12. a viable planet can sometimes develop life
13. mass extinction can leave refuges
14. long simulation runs do not grow memory without bounds

Include a soak-test mode that can run thousands of ticks without rendering and print performance and biology statistics.

---

# 13. Coding Rules for Claude

Follow these rules strictly.

1. Inspect the existing repository before changing anything.
2. Do not replace working systems without explaining why.
3. Use typed GDScript.
4. Avoid giant scripts; separate data, systems, orchestration, and UI.
5. Avoid identifiers that shadow Godot built-ins, including names such as `seed`, `sign`, `range`, `print`, or other engine/global names.
6. Match inherited Godot method signatures exactly.
7. Compile or run the project after every milestone.
8. Fix all parser errors before continuing.
9. Do not suppress warnings without a reason.
10. Do not claim a feature is complete if it is a placeholder.
11. Do not create fake simulation depth through random flavor text.
12. Every displayed historical event must correspond to actual state changes.
13. Keep generation deterministic.
14. Keep simulation independent from frame rate.
15. Do not optimize prematurely, but never create one Node per organism, population, or map cell.
16. Use sparse data structures for active populations.
17. Add concise comments for formulas and non-obvious decisions.
18. Document all configuration constants.
19. Add tests with every major system.
20. Stop at the end of the requested milestone and report:
    - files changed
    - systems implemented
    - tests run
    - known limitations
    - exact next milestone

Do not repeatedly rewrite the plan. Implement the requested milestone.

---

# 14. Milestone Roadmap

## Milestone 0 — Repository Audit and Simulation Skeleton

Deliver:

- repository inspection
- Godot project launches without errors
- agreed folder structure
- typed base data classes
- deterministic RNG stream utility
- simulation clock
- empty world state
- basic test runner
- developer/debug panel

Acceptance criteria:

- project opens and runs
- same root seed produces identical derived streams
- simulation can pause, step, and accelerate
- no biology yet

## Milestone 1 — Seeded Solar-System Generator

Deliver:

- one to three stars
- 1–10 planets
- moons and summarized minor bodies
- orbital summaries
- planet physical properties
- focus-planet selection
- ASCII solar-system screen
- tests for determinism and valid ranges

Acceptance criteria:

- entering the same seed creates identical systems
- visibly different seeds create different systems
- at least some systems contain no viable habitable planet
- system generation does not use uncontrolled randomness

## Milestone 2 — Barren Planet Generator

Deliver:

- 128 × 64 wrapped regional grid
- elevation
- continental mask
- mountains
- basins
- volcanism
- craters
- initial atmosphere
- initial temperature
- basic map overlays

Acceptance criteria:

- same seed produces the same map
- east/west wrapping works
- polar latitude behavior is valid
- terrain statistics are displayed
- map renders without one Node per cell

## Milestone 3 — Impacts, Water, and Geological Time

Deliver:

- comet and asteroid event scheduler
- impact payloads
- crater placement
- water delivery
- ocean formation
- atmospheric effects
- impact history events
- geological fast-forward

Acceptance criteria:

- a dry planet can gradually accumulate oceans
- some impacts remove water or heat the world
- biologically insignificant impacts may be summarized
- event results are deterministic

## Milestone 4 — Regional Climate and Resources

Deliver:

- temperature
- moisture
- sunlight
- ocean moderation
- elevation cooling
- simple greenhouse model
- biome/habitat classification
- regional energy/resource production
- climate overlays

Acceptance criteria:

- equatorial and polar differences are visible
- mountains affect temperature and moisture
- atmosphere changes global and regional climate
- climate remains bounded during long runs

## Milestone 5 — First Life and Microbial Ecology

Deliver:

- procedural life-origin selection
- species genome
- species registry
- sparse regional populations
- producers and consumers
- resource competition
- births and deaths
- migration/dispersal
- local and global extinction
- species browser

Acceptance criteria:

- some worlds remain sterile
- some worlds develop or receive life
- populations spread only into viable regions
- resource scarcity limits population growth
- species can become extinct

## Milestone 6 — Mutation, Speciation, and Lineages

Deliver:

- heritable mutation
- regional genetic variance
- isolation tracking
- speciation
- hybridization only for close relatives if represented
- family-tree data
- compressed extinct lineage storage
- first meaningful evolutionary histories

Acceptance criteria:

- a population can diverge into a descendant species
- ancestry remains valid
- traits evolve in response to environmental conditions
- no forced march toward intelligence or complexity
- convergent trait outcomes are possible

## Milestone 7 — Planetary Feedback and Mass Extinction

Deliver:

- oxygen, carbon dioxide, and methane feedback
- biological climate modification
- toxic transitions
- global disasters
- refuges
- extinction severity calculation
- post-extinction radiation into empty niches
- historical era naming

Acceptance criteria:

- life can alter planetary habitability
- an atmospheric transition can help some species and destroy others
- near-total extinction can leave survivors
- recovery produces new lineages
- permanent sterilization is possible

## Milestone 8 — Prototype Presentation and Persistence

Deliver:

- polished ASCII/tile UI
- all required overlays
- solar-system view
- timeline
- species viewer
- pause/speed/step controls
- save/load
- world-seed sharing
- headless soak test
- export of timeline and basic world data

Acceptance criteria:

- the player can create a world and watch a full barren-to-microbial history
- the simulation remains responsive
- saving and loading resumes correctly
- the same seed and same actions reproduce the same history
- watching the simulation is interesting without scripted events

This milestone marks the first concept-complete prototype.

---

# 15. Post-Prototype Roadmap

Only begin after the microbial prototype is stable and interesting.

## Phase A — Multicellular Life

- colonial organisms
- modular body plans
- tissues and organs
- locomotion
- predation
- reproduction strategies
- visible vestigial structures
- procedural ASCII creature representations

## Phase B — Complex Ecosystems

- plants, fungi, animals, decomposers
- food webs
- keystone species
- parasites and simplified diseases
- island evolution
- gigantism and dwarfism
- ecosystem engineers
- migration seasons

## Phase C — Local Organism Simulation

- generate representative individuals on zoom-in
- utility AI
- state machines
- learning
- deformities and rare traits
- nests, hunting, parenting, and social behavior
- return local outcomes to regional aggregate state

## Phase D — Intelligence and Culture

- separate cognitive traits
- communication
- teaching
- cultural inheritance
- tool use
- ritual and mourning
- rare hive minds
- rare intelligent plants, fungi, colonies, or ocean life

## Phase E — Civilization

- tribes
- cities
- languages
- religion
- traditions
- fighting styles
- political systems
- democracy, authoritarianism, pacifism, militarism
- agriculture
- domestication
- trade
- warfare
- medicine
- industry
- environmental destruction and conservation
- fossil discovery
- ruins
- eventual spaceflight

## Phase F — Player-Facing Game

- local roguelike exploration
- colony management
- playable intelligent species
- scientific discovery
- intervention systems
- asteroid redirection
- world exports
- expanded mod support

---

# 16. The Exact Vertical Slice

The first truly playable proof of concept must be able to produce this unscripted sequence:

1. A seeded star system forms.
2. One barren focus planet is generated.
3. Impacts alter the planet and deliver water.
4. Oceans and regional climates emerge.
5. One or more microbial lineages originate or arrive.
6. Populations spread through viable regions.
7. Producers alter resources and atmospheric chemistry.
8. Consumers or predators evolve and apply ecological pressure.
9. Isolated populations diverge.
10. At least one descendant species appears.
11. Climate or impact pressure causes local and possibly global extinction.
12. Survivors occupy empty niches.
13. The timeline explains why each major event occurred.

The sequence must not be hard-coded. Not every world must complete it.

---

# 17. First Instruction to Execute

Begin with **Milestone 0 only**.

Before writing code:

1. inspect the entire repository
2. identify the current Godot version and project structure
3. list reusable systems
4. list broken or conflicting systems
5. identify parser errors and warnings
6. propose the smallest compatible architecture adjustment

Then implement the deterministic simulation skeleton.

Do not begin solar-system generation until Milestone 0 compiles, runs, and passes its tests.

At completion, provide:

- a concise summary
- exact files created or modified
- test output
- remaining technical risks
- the command or editor action needed to run the project
- the proposed Milestone 1 task

Do not ask broad design questions unless repository evidence makes implementation impossible. Make conservative assumptions and document them.
