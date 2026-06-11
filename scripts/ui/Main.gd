extends Control

const MAP_W := World.W
const MAP_H := World.H

var world: World
var running := true
var ticks_per_second := 12.0
var tick_accum := 0.0
var map_image: Image
var map_texture: ImageTexture

@onready var era_label: Label = %EraLabel
@onready var age_label: Label = %AgeLabel
@onready var seed_edit: LineEdit = %SeedEdit
@onready var map_rect: TextureRect = %Map
@onready var stats: RichTextLabel = %Stats
@onready var species_list: ItemList = %SpeciesList
@onready var events: RichTextLabel = %Events
@onready var pause_button: Button = %PauseButton
@onready var step_button: Button = %StepButton
@onready var run_button: Button = %RunButton
@onready var load_button: Button = %LoadButton

func _ready() -> void:
	load_button.pressed.connect(_on_load_pressed)
	pause_button.pressed.connect(func(): running = false)
	run_button.pressed.connect(func(): running = true)
	step_button.pressed.connect(func(): _step_world(1))
	_new_world(seed_edit.text)

func _process(delta: float) -> void:
	if not running:
		return
	tick_accum += delta * ticks_per_second
	var budget := 0
	while tick_accum >= 1.0 and budget < 48:
		world.tick()
		tick_accum -= 1.0
		budget += 1
	if budget > 0:
		_refresh()

func _on_load_pressed() -> void:
	_new_world(seed_edit.text if seed_edit.text.strip_edges() != "" else "tethys-12")

func _new_world(seed_text: String) -> void:
	world = World.new(seed_text)
	seed_edit.text = seed_text
	map_image = Image.create(MAP_W, MAP_H, false, Image.FORMAT_RGBA8)
	map_texture = ImageTexture.create_from_image(map_image)
	map_rect.texture = map_texture
	_refresh()

func _step_world(n: int) -> void:
	running = false
	world.tick(n)
	_refresh()

func _refresh() -> void:
	era_label.text = world.era
	age_label.text = world.fmt_age()
	_render_map()
	_render_stats()
	_render_species()
	_render_events()

func _render_map() -> void:
	for c in world.cells:
		var color := _cell_color(c)
		map_image.set_pixel(int(c["x"]), int(c["y"]), color)
	map_texture.update(map_image)

func _cell_color(c: Dictionary) -> Color:
	if float(c["biomass"]) > 1.0 and int(c["dominant_species"]) >= 0 and int(c["dominant_species"]) < world.species.size():
		var sp: Dictionary = world.species[int(c["dominant_species"])]
		var base: Color = sp["color"]
		var strength: float = clamp(float(c["biomass"]) / 180.0, 0.25, 1.0)
		return Color(base.r * strength, base.g * strength, base.b * strength, 1.0).lerp(Color.WHITE, 0.12)
	if bool(c["water"]):
		var depth := clamp(-float(c["elevation"]), 0.0, 1.4)
		return Color(0.03, 0.12 + depth * 0.13, 0.22 + depth * 0.28)
	if float(c["crater"]) > 0.05:
		return Color(0.28 + float(c["crater"]) * 0.25, 0.23, 0.18)
	if float(c["elevation"]) > 0.65:
		return Color(0.43, 0.39, 0.34)
	if float(c["moisture"]) > 0.58 and world.o2 > 1.0:
		return Color(0.16, 0.34, 0.18)
	return Color(0.22 + float(c["moisture"]) * 0.16, 0.18 + float(c["moisture"]) * 0.12, 0.12)

func _render_stats() -> void:
	var live := 0
	for sp in world.species:
		if not bool(sp["extinct"]):
			live += 1
	stats.text = "[b]WORLD STATE[/b]\n"
	stats.text += "seed: %s\n" % world.seed_string
	stats.text += "ticks: %s\n" % world.tick_count
	stats.text += "ocean: %.1f%%\n" % (world.ocean_frac * 100.0)
	stats.text += "global temp: %.1f °C\n" % world.global_temp
	stats.text += "O₂: %.3f kPa\n" % world.o2
	stats.text += "CO₂: %.2f kPa\n" % world.co2
	stats.text += "species: %d / %d living\n" % [live, world.species.size()]
	stats.text += "biomass: %d" % int(world.total_biomass())

func _render_species() -> void:
	species_list.clear()
	for sp in world.species:
		var suffix := "" if not bool(sp["extinct"]) else " †"
		species_list.add_item("%s · %s · %d bm%s" % [sp["name"], sp["role"], int(sp["biomass"]), suffix])

func _render_events() -> void:
	var lines: Array[String] = []
	var start := max(0, world.events.size() - 24)
	for i in range(world.events.size() - 1, start - 1, -1):
		var e: Dictionary = world.events[i]
		lines.append("[color=#ffe9a8]%s[/color] %s" % [_fmt_event_time(float(e["time"])), e["text"]])
	events.text = "\n\n".join(lines)

func _fmt_event_time(years: float) -> String:
	if years >= 1000000000.0:
		return "%.2f Gyr" % (years / 1000000000.0)
	if years >= 1000000.0:
		return "%.1f Myr" % (years / 1000000.0)
	if years >= 1000.0:
		return "%.0f kyr" % (years / 1000.0)
	return "%d yr" % int(years)
