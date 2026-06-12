class_name Rng
extends RefCounted

var state: int = 0

static func fnv1a(text: String) -> int:
	var h := 2166136261
	for i in text.length():
		h = h ^ text.unicode_at(i)
		h = int((h * 16777619) & 0xffffffff)
	return h & 0xffffffff

func _init(seed_text: String = "procuniverse") -> void:
	state = fnv1a(seed_text)
	if state == 0:
		state = 0x6d2b79f5

func derive(name: String) -> Rng:
	return Rng.new(str(state) + "/" + name)

func next_u32() -> int:
	state = int((state + 0x6d2b79f5) & 0xffffffff)
	var t := state
	t = int(((t ^ (t >> 15)) * (t | 1)) & 0xffffffff)
	t ^= int((t + (((t ^ (t >> 7)) * (t | 61)) & 0xffffffff)) & 0xffffffff)
	return int((t ^ (t >> 14)) & 0xffffffff)

func randf01() -> float:
	return float(next_u32()) / 4294967296.0

func range_float(a: float, b: float) -> float:
	return a + (b - a) * randf01()

func range_int(a: int, b: int) -> int:
	return a + int(floor(randf01() * float(b - a + 1)))

func chance(p: float) -> bool:
	return randf01() < clamp(p, 0.0, 1.0)

func pick(items: Array):
	if items.is_empty():
		return null
	return items[range_int(0, items.size() - 1)]
