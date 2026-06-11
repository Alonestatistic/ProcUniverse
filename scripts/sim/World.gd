class_name World
extends RefCounted

const W := 128
const H := 64

var seed_string := "tethys-12"
var rng: Rng
var age_years := 0.0
var tick_count := 0
var cells: Array[Dictionary] = []
var species: Array[Dictionary] = []
var events: Array[Dictionary] = []
var ocean_frac := 0.0
var global_temp := 0.0
var hydro := 42.0
var o2 := 0.0
var co2 := 18.0
var ch4 := 0.02
var era := "FORMATION ERA"

func _init(seed_text: String = "tethys-12") -> void:
	seed_string = seed_text
	rng = Rng.new(seed_string)
	_generate_planet()
	_record("geology", 8, "Planet formed as a barren procedural world. Oceans, climate and life are ready to emerge from simulation time.")

func _generate_planet() -> void:
	cells.clear()
	var terrain_rng := rng.derive("terrain")
	var water_count := 0
	var temp_sum := 0.0
	for y in range(H):
		var lat := lerp(-90.0, 90.0, float(y) / float(H - 1))
		for x in range(W):
			var nx := float(x) / float(W)
			var ny := float(y) / float(H)
			var e := _value_noise(nx * 5.0, ny * 3.0, terrain_rng) * 2.0 - 1.0
			e += (_value_noise(nx * 12.0 + 9.1, ny * 8.0 - 3.0, terrain_rng) * 2.0 - 1.0) * 0.38
			var polar := abs(lat) / 90.0
			var temp := 33.0 * (1.0 - polar) - 18.0 + e * 8.0
			var water := e < -0.08
			if water:
				water_count += 1
			temp_sum += temp
			cells.append({
				"x": x,
				"y": y,
				"lat": lat,
				"elevation": e,
				"water": water,
				"temp": temp,
				"moisture": clamp(1.0 - max(0.0, e) + terrain_rng.randf01() * 0.18, 0.0, 1.0),
				"biomass": 0.0,
				"dominant_species": -1,
				"crater": 0.0
			})
	ocean_frac = float(water_count) / float(W * H)
	global_temp = temp_sum / float(W * H)

func _value_noise(x: float, y: float, stream: Rng) -> float:
	var xi := int(floor(x))
	var yi := int(floor(y))
	var xf := x - floor(x)
	var yf := y - floor(y)
	var a := _hash_float(xi, yi, stream.state)
	var b := _hash_float(xi + 1, yi, stream.state)
	var c := _hash_float(xi, yi + 1, stream.state)
	var d := _hash_float(xi + 1, yi + 1, stream.state)
	var u := xf * xf * (3.0 - 2.0 * xf)
	var v := yf * yf * (3.0 - 2.0 * yf)
	return lerp(lerp(a, b, u), lerp(c, d, u), v)

func _hash_float(x: int, y: int, salt: int) -> float:
	var h := int((x * 374761393 + y * 668265263 + salt * 1442695041) & 0xffffffff)
	h = int(((h ^ (h >> 13)) * 1274126177) & 0xffffffff)
	return float((h ^ (h >> 16)) & 0xffff) / 65535.0

func tick(steps: int = 1) -> void:
	for _i in range(steps):
		_tick_once()

func _tick_once() -> void:
	tick_count += 1
	age_years += _pick_dt()
	if rng.chance(0.018):
		_resolve_impact()
	if species.is_empty() and ocean_frac > 0.18 and global_temp > -10.0 and global_temp < 55.0 and rng.chance(0.028):
		_seed_life("abiogenesis")
	_update_life()
	_update_era()

func _pick_dt() -> float:
	if species.is_empty():
		return 250000.0
	return 50000.0

func _resolve_impact() -> void:
	var idx := rng.range_int(0, cells.size() - 1)
	cells[idx]["crater"] = min(1.0, float(cells[idx]["crater"]) + rng.range_float(0.1, 0.55))
	hydro = min(400.0, hydro + rng.range_float(0.2, 2.8))
	co2 = min(60.0, co2 + rng.range_float(0.02, 0.3))
	global_temp += rng.range_float(0.05, 0.7)
	_record("impact", 4, "A volatile-rich impactor altered climate and scarred region %s,%s." % [cells[idx]["x"], cells[idx]["y"]])

func seed_life_directed(origin: String = "directed panspermia") -> void:
	_seed_life(origin)

func _seed_life(origin: String) -> void:
	var best_idx := -1
	var best_score := -999999.0
	for i in range(cells.size()):
		var c := cells[i]
		if not bool(c["water"]):
			continue
		var score := float(c["moisture"]) * 10.0 - abs(float(c["temp"]) - 24.0) * 0.2 + rng.randf01()
		if score > best_score:
			best_score = score
			best_idx = i
	if best_idx < 0:
		return
	var sp := {
		"id": species.size(),
		"name": _species_name(species.size()),
		"role": "photosynth",
		"origin": origin,
		"origin_time": age_years,
		"extinct": false,
		"color": Color.from_hsv(rng.randf01(), 0.72, 0.88),
		"traits": {
			"size": rng.range_float(0.18, 0.45),
			"motility": rng.range_float(0.1, 0.4),
			"predation": rng.range_float(0.0, 0.12),
			"armor": rng.range_float(0.05, 0.25),
			"mutation": rng.range_float(0.2, 0.7),
			"efficiency": rng.range_float(0.35, 0.8)
		},
		"biomass": 60.0,
		"regions": [best_idx]
	}
	species.append(sp)
	cells[best_idx]["biomass"] = 60.0
	cells[best_idx]["dominant_species"] = sp["id"]
	_record("firstlife", 10, "First stable life, %s, emerged through %s." % [sp["name"], origin])

func _update_life() -> void:
	if species.is_empty():
		return
	for s_i in range(species.size()):
		var sp := species[s_i]
		if bool(sp["extinct"]):
			continue
		var traits: Dictionary = sp["traits"]
		var new_regions: Array = []
		var total := 0.0
		for idx in sp["regions"]:
			var c := cells[int(idx)]
			var fit := clamp(1.0 - abs(float(c["temp"]) - 22.0) / 70.0, 0.0, 1.0) * (1.0 if bool(c["water"]) else 0.28)
			var growth := 0.92 + fit * 0.22 + float(traits["efficiency"]) * 0.08
			c["biomass"] = clamp(float(c["biomass"]) * growth, 0.0, 260.0)
			if float(c["biomass"]) > 1.0:
				new_regions.append(int(idx))
				total += float(c["biomass"])
				c["dominant_species"] = sp["id"]
			if float(c["biomass"]) > 18.0 and rng.chance(0.14 + float(traits["motility"]) * 0.12):
				var n := _neighbor_idx(int(idx))
				var target: int = n[rng.range_int(0, n.size() - 1)]
				if bool(cells[target]["water"]) or rng.chance(float(traits["motility"]) * 0.35):
					cells[target]["biomass"] = float(cells[target]["biomass"]) + float(c["biomass"]) * 0.18
					cells[target]["dominant_species"] = sp["id"]
					if not new_regions.has(target):
						new_regions.append(target)
		sp["regions"] = new_regions
		sp["biomass"] = total
		if total < 0.5:
			sp["extinct"] = true
			_record("extinction", 8, "%s vanished from the biosphere." % sp["name"])
		elif total > 900.0 and species.size() < 32 and rng.chance(0.025 + float(traits["mutation"]) * 0.03):
			_speciate(sp)
		species[s_i] = sp
	o2 = clamp(o2 + total_biomass() * 0.0000009, 0.0, 35.0)
	co2 = clamp(co2 - total_biomass() * 0.00000025, 0.02, 60.0)

func _speciate(parent: Dictionary) -> void:
	var parent_regions: Array = parent["regions"]
	if parent_regions.is_empty():
		return
	var child := parent.duplicate(true)
	child["id"] = species.size()
	child["name"] = _species_name(int(child["id"]))
	child["origin"] = "speciation from " + str(parent["name"])
	child["origin_time"] = age_years
	var parent_color: Color = parent["color"]
	child["color"] = Color.from_hsv(fmod(parent_color.h + rng.range_float(0.08, 0.18), 1.0), 0.75, 0.9)
	child["regions"] = [parent_regions[rng.range_int(0, parent_regions.size() - 1)]]
	var child_traits: Dictionary = child["traits"]
	for k in child_traits.keys():
		child_traits[k] = clamp(float(child_traits[k]) + rng.range_float(-0.12, 0.12), 0.02, 0.98)
	child["traits"] = child_traits
	child["biomass"] = float(cells[int(child["regions"][0])]["biomass"]) * 0.4
	species.append(child)
	_record("speciation", 7, "%s diverged from %s." % [child["name"], parent["name"]])

func _neighbor_idx(idx: int) -> Array[int]:
	var x := idx % W
	var y := int(idx / W)
	var out: Array[int] = []
	out.append(y * W + ((x + W - 1) % W))
	out.append(y * W + ((x + 1) % W))
	if y > 0:
		out.append((y - 1) * W + x)
	if y < H - 1:
		out.append((y + 1) * W + x)
	return out

func _update_era() -> void:
	if species.is_empty():
		era = "OCEANIC ERA" if ocean_frac > 0.08 else "FORMATION ERA"
	elif o2 > 2.5:
		era = "OXYGENATION ERA"
	else:
		era = "EARLY BIOSPHERE ERA"

func _record(type: String, importance: int, text: String) -> void:
	events.append({"time": age_years, "type": type, "importance": importance, "text": text})
	if events.size() > 300:
		events.pop_front()

func _species_name(id: int) -> String:
	var a := ["Kel", "Vor", "Ash", "Tau", "Ner", "Oph", "Cyn", "Dra", "Hel", "Mir", "Ix", "Zar"]
	var b := ["ius", "ara", "eth", "on", "ia", "ux", "ane", "or", "is", "ea", "yx", "ova"]
	return a[(id * 7 + seed_string.length()) % a.size()] + b[(id * 11 + Rng.fnv1a(seed_string)) % b.size()]

func total_biomass() -> float:
	var t := 0.0
	for sp in species:
		if not bool(sp["extinct"]):
			t += float(sp["biomass"])
	return t

func fmt_age() -> String:
	if age_years >= 1000000000.0:
		return "%.2f Gyr" % (age_years / 1000000000.0)
	if age_years >= 1000000.0:
		return "%.1f Myr" % (age_years / 1000000.0)
	if age_years >= 1000.0:
		return "%.0f kyr" % (age_years / 1000.0)
	return "%d yr" % int(age_years)
