class_name Schema
extends RefCounted

## Colyseus @colyseus/schema 3.x decoder (the server's room state), ported from
## node_modules/@colyseus/schema/src/decoder. The type definitions come from the server in the
## JOIN_ROOM handshake (Reflection), so the server's WorldState can change without touching this.
## Numbers in this format are little-endian (unlike MessagePack).

const SWITCH_TO_STRUCTURE := 255
const TYPE_ID := 213

const OP_ADD := 128
const OP_REPLACE := 0
const OP_DELETE := 64
const OP_DELETE_AND_MOVE := 96
const OP_MOVE_AND_ADD := 160
const OP_DELETE_AND_ADD := 192
const OP_CLEAR := 10
const OP_REVERSE := 15
const OP_MOVE := 32
const OP_DELETE_BY_REFID := 33
const OP_ADD_BY_REFID := 129


## A schema class: fields by index. A field's `type` is a primitive name ("string", "uint8"...),
## a SchemaType (a child structure), or a collection {"map"|"array"|"set"|"collection": child}.
class SchemaType:
	var id := 0
	var name := ""
	var fields: Array = []  # [{name, type}]

	func field_index(field_name: String) -> int:
		for i in fields.size():
			if fields[i].name == field_name:
				return i
		return -1


## An instance of a SchemaType. Read fields with `get_field("hp")` or `values["hp"]`.
class Ref extends RefCounted:
	var ref_id := -1
	## Collections: the child type and the entries (unused by Struct).
	var child: Variant
	var items := {}

	func get_by_index(_index: int) -> Variant:
		return null

	func delete_by_index(_index: int) -> void:
		pass

	func clear() -> void:
		items.clear()


class Struct extends Ref:
	var type: SchemaType
	var values := {}

	func _init(t: SchemaType) -> void:
		type = t

	func get_field(name: String, fallback: Variant = null) -> Variant:
		return values.get(name, fallback)

	func get_by_index(index: int) -> Variant:
		if index < 0 or index >= type.fields.size():
			return null
		return values.get(type.fields[index].name)

	func delete_by_index(index: int) -> void:
		if index >= 0 and index < type.fields.size():
			values.erase(type.fields[index].name)


## MapSchema: string keys; `indexes` maps the wire index of an entry to its key.
class MapRef extends Ref:
	var indexes := {}

	func get_by_index(index: int) -> Variant:
		var key = indexes.get(index)
		return null if key == null else items.get(key)

	func delete_by_index(index: int) -> void:
		var key = indexes.get(index)
		if key != null:
			items.erase(key)
		indexes.erase(index)

	func clear() -> void:
		items.clear()
		indexes.clear()

	func size() -> int:
		return items.size()


## ArraySchema / CollectionSchema: values by position.
class ListRef extends Ref:

	func get_by_index(index: int) -> Variant:
		return items.get(index)

	func delete_by_index(index: int) -> void:
		items.erase(index)

	func clear() -> void:
		items.clear()

	func to_array() -> Array:
		var keys := items.keys()
		keys.sort()
		var out := []
		for k in keys:
			out.append(items[k])
		return out


## One decoded change, in wire order: field changes on a Struct (`field`), entries added or
## removed in a MapRef / ListRef (`key`).
class Change:
	var ref: Ref
	var op: int
	var field := ""
	var key: Variant
	var value: Variant
	var previous: Variant


## The decoder for one room: types (from the handshake), the root state and the reference table.
class Decoder:
	var types := {}  # id -> SchemaType
	var state: Struct
	var refs := {}  # refId -> Ref
	var ref_count := {}
	var deleted := {}

	func _init(root_type: SchemaType, context: Dictionary) -> void:
		types = context
		state = Struct.new(root_type)
		_add_ref(0, state)

	func _add_ref(ref_id: int, ref: Ref, increment := true) -> void:
		refs[ref_id] = ref
		ref.ref_id = ref_id
		if increment:
			ref_count[ref_id] = ref_count.get(ref_id, 0) + 1
		deleted.erase(ref_id)

	func _remove_ref(ref_id: int) -> void:
		if not ref_count.has(ref_id):
			return
		var count: int = ref_count[ref_id]
		if count == 0:
			return
		count -= 1
		ref_count[ref_id] = count
		if count <= 0:
			deleted[ref_id] = true

	func _collect_garbage() -> void:
		while not deleted.is_empty():
			var batch := deleted.keys()
			deleted.clear()
			for ref_id in batch:
				if ref_count.get(ref_id, 0) > 0:
					continue
				var ref: Ref = refs.get(ref_id)
				if ref is Struct:
					for value in (ref as Struct).values.values():
						if value is Ref and not deleted.has(value.ref_id):
							_remove_ref(value.ref_id)
				elif ref is MapRef or ref is ListRef:
					var child = ref.child
					if child is SchemaType:
						for value in ref.items.values():
							if value is Ref:
								_remove_ref(value.ref_id)
				refs.erase(ref_id)
				ref_count.erase(ref_id)

	## Decodes a full state or a patch; returns the changes in order.
	func decode(bytes: PackedByteArray, offset: int) -> Array:
		var changes: Array = []
		var it := Iter.new(bytes, offset)
		var ref: Ref = state
		var total := bytes.size()
		while it.o < total:
			if bytes[it.o] == SWITCH_TO_STRUCTURE:
				it.o += 1
				var next_id := int(Prim.number(it))
				var next: Ref = refs.get(next_id)
				if next == null:
					push_warning("schema: refId %d not found" % next_id)
					_skip_structure(it, total)
				else:
					ref = next
				continue
			var ok := true
			if ref is Struct:
				ok = _decode_struct(it, ref, changes)
			elif ref is MapRef:
				_decode_map(it, ref, changes)
			elif ref is ListRef:
				_decode_list(it, ref, changes)
			if not ok:
				push_warning("schema: definition mismatch")
				_skip_structure(it, total)
		_collect_garbage()
		return changes

	func _skip_structure(it: Iter, total: int) -> void:
		while it.o < total:
			if it.b[it.o] == SWITCH_TO_STRUCTURE:
				var peek := Iter.new(it.b, it.o + 1)
				if refs.has(int(Prim.number(peek))):
					break
			it.o += 1

	func _instance_type(it: Iter, fallback: SchemaType) -> SchemaType:
		if it.o < it.b.size() and it.b[it.o] == TYPE_ID:
			it.o += 1
			var id := int(Prim.number(it))
			return types.get(id, fallback)
		return fallback

	func _new_collection(type: Dictionary) -> Ref:
		var kind: String = type.keys()[0]
		var r: Ref = MapRef.new() if kind == "map" else ListRef.new()
		r.child = type[kind]
		return r

	## Returns [value, previous].
	func _decode_value(it: Iter, op: int, ref, index: int, type: Variant, changes: Array) -> Array:
		var previous = ref.get_by_index(index)
		var value = null
		if (op & OP_DELETE) == OP_DELETE:
			if previous is Ref:
				_remove_ref(previous.ref_id)
			if op != OP_DELETE_AND_ADD:
				ref.delete_by_index(index)
		if op == OP_DELETE:
			pass
		elif type is SchemaType:
			var ref_id := int(Prim.number(it))
			value = refs.get(ref_id)
			if (op & OP_ADD) == OP_ADD:
				var child_type := _instance_type(it, type)
				if value == null:
					value = Struct.new(child_type)
				_add_ref(ref_id, value, value != previous or (op == OP_DELETE_AND_ADD and value == previous))
		elif type is String:
			value = Prim.read(type, it)
		else:
			var ref_id := int(Prim.number(it))
			var existing: Ref = refs.get(ref_id)
			var value_ref: Ref
			if existing != null:
				value_ref = previous if previous is Ref else existing
			else:
				value_ref = _new_collection(type)
			value = value_ref
			if previous is Ref and previous.ref_id != ref_id and (previous is MapRef or previous is ListRef):
				for key in previous.items.keys():
					var child = previous.items[key]
					if child is Ref:
						_remove_ref(child.ref_id)
					var c := Change.new()
					c.ref = previous
					c.op = OP_DELETE
					c.key = key
					c.previous = child
					changes.append(c)
			_add_ref(ref_id, value_ref, value_ref != previous or (op == OP_DELETE_AND_ADD and value_ref == previous))
		return [value, previous]

	func _decode_struct(it: Iter, ref: Struct, changes: Array) -> bool:
		var first: int = it.b[it.o]
		it.o += 1
		var op := (first >> 6) << 6
		var index := first % (op if op != 0 else 255)
		if index >= ref.type.fields.size():
			return false
		var field: Dictionary = ref.type.fields[index]
		var pair := _decode_value(it, op, ref, index, field.type, changes)
		var value = pair[0]
		var previous = pair[1]
		if value != null:
			ref.values[field.name] = value
		if not _same(previous, value):
			var c := Change.new()
			c.ref = ref
			c.op = op
			c.field = field.name
			c.value = value
			c.previous = previous
			changes.append(c)
		return true

	func _decode_map(it: Iter, ref: MapRef, changes: Array) -> void:
		var op: int = it.b[it.o]
		it.o += 1
		if op == OP_CLEAR:
			_clear_collection(ref, changes)
			return
		var index := int(Prim.number(it))
		var key
		if (op & OP_ADD) == OP_ADD:
			key = Prim.string(it)
			ref.indexes[index] = key
		else:
			key = ref.indexes.get(index)
		var pair := _decode_value(it, op, ref, index, ref.child, changes)
		var value = pair[0]
		var previous = pair[1]
		if value != null:
			ref.items[key] = value
		if not _same(previous, value):
			var c := Change.new()
			c.ref = ref
			c.op = op
			c.key = key
			c.value = value
			c.previous = previous
			changes.append(c)

	func _decode_list(it: Iter, ref: ListRef, changes: Array) -> void:
		var op: int = it.b[it.o]
		it.o += 1
		var index := 0
		if op == OP_CLEAR:
			_clear_collection(ref, changes)
			return
		elif op == OP_REVERSE:
			var arr := ref.to_array()
			arr.reverse()
			ref.items.clear()
			for i in arr.size():
				ref.items[i] = arr[i]
			return
		elif op == OP_DELETE_BY_REFID:
			var ref_id := int(Prim.number(it))
			var target = refs.get(ref_id)
			for k in ref.items.keys():
				if ref.items[k] == target:
					ref.items.erase(k)
					var c := Change.new()
					c.ref = ref
					c.op = OP_DELETE
					c.key = k
					c.previous = target
					changes.append(c)
					break
			return
		elif op == OP_ADD_BY_REFID:
			var ref_id := int(Prim.number(it))
			var item = refs.get(ref_id)
			index = -1
			if item != null:
				for k in ref.items.keys():
					if ref.items[k] == item:
						index = k
			if index == -1:
				index = ref.items.size()
		else:
			index = int(Prim.number(it))
		var pair := _decode_value(it, op, ref, index, ref.child, changes)
		var value = pair[0]
		var previous = pair[1]
		if value != null and not _same(previous, value):
			ref.items[index] = value
		if not _same(previous, value):
			var c := Change.new()
			c.ref = ref
			c.op = op
			c.key = index
			c.value = value
			c.previous = previous
			changes.append(c)

	func _clear_collection(ref, changes: Array) -> void:
		var refs_children: bool = ref.child is SchemaType
		for key in ref.items.keys():
			var child = ref.items[key]
			var c := Change.new()
			c.ref = ref
			c.op = OP_DELETE
			c.key = key
			c.previous = child
			changes.append(c)
			if refs_children and child is Ref:
				_remove_ref(child.ref_id)
		ref.clear()

	static func _same(a: Variant, b: Variant) -> bool:
		if typeof(a) != typeof(b):
			return false
		return a == b


class Iter:
	var b: PackedByteArray
	var o: int

	func _init(bytes: PackedByteArray, offset: int) -> void:
		b = bytes
		o = offset


## Primitive readers (little-endian, schema encoding).
class Prim:
	static func u8(it: Iter) -> int:
		var v: int = it.b[it.o]
		it.o += 1
		return v

	static func i8(it: Iter) -> int:
		var v := u8(it)
		return v - 256 if v >= 128 else v

	static func u16(it: Iter) -> int:
		var v := it.b.decode_u16(it.o)
		it.o += 2
		return v

	static func i16(it: Iter) -> int:
		var v := it.b.decode_s16(it.o)
		it.o += 2
		return v

	static func u32(it: Iter) -> int:
		var v := it.b.decode_u32(it.o)
		it.o += 4
		return v

	static func i32(it: Iter) -> int:
		var v := it.b.decode_s32(it.o)
		it.o += 4
		return v

	static func f32(it: Iter) -> float:
		var v := it.b.decode_float(it.o)
		it.o += 4
		return v

	static func f64(it: Iter) -> float:
		var v := it.b.decode_double(it.o)
		it.o += 8
		return v

	static func i64(it: Iter) -> int:
		var v := it.b.decode_s64(it.o)
		it.o += 8
		return v

	static func u64(it: Iter) -> int:
		var v := it.b.decode_u64(it.o)
		it.o += 8
		return v

	static func utf8(it: Iter, length: int) -> String:
		var end := mini(it.o + length, it.b.size())
		var s := it.b.slice(it.o, end).get_string_from_utf8()
		it.o += length
		return s

	static func string(it: Iter) -> String:
		var prefix := u8(it)
		var length := 0
		if prefix < 0xc0:
			length = prefix & 0x1f
		elif prefix == 0xd9:
			length = u8(it)
		elif prefix == 0xda:
			length = u16(it)
		elif prefix == 0xdb:
			length = u32(it)
		return utf8(it, length)

	static func is_string(it: Iter) -> bool:
		var p: int = it.b[it.o]
		return (p < 0xc0 and p > 0xa0) or p == 0xd9 or p == 0xda or p == 0xdb

	static func number(it: Iter) -> Variant:
		var prefix := u8(it)
		if prefix < 0x80:
			return prefix
		match prefix:
			0xca:
				return f32(it)
			0xcb:
				return f64(it)
			0xcc:
				return u8(it)
			0xcd:
				return u16(it)
			0xce:
				return u32(it)
			0xcf:
				return u64(it)
			0xd0:
				return i8(it)
			0xd1:
				return i16(it)
			0xd2:
				return i32(it)
			0xd3:
				return i64(it)
		if prefix > 0xdf:
			return prefix - 0x100
		return 0

	static func read(type: String, it: Iter) -> Variant:
		match type:
			"string":
				return string(it)
			"number":
				return number(it)
			"boolean":
				return u8(it) > 0
			"int8":
				return i8(it)
			"uint8":
				return u8(it)
			"int16":
				return i16(it)
			"uint16":
				return u16(it)
			"int32":
				return i32(it)
			"uint32":
				return u32(it)
			"int64":
				return i64(it)
			"uint64":
				return u64(it)
			"float32":
				return f32(it)
			"float64":
				return f64(it)
			"bigint64":
				return i64(it)
			"biguint64":
				return u64(it)
		push_warning("schema: unknown primitive %s" % type)
		return null


## The Reflection schema (fixed by @colyseus/schema): how the server describes its types.
static func _reflection_types() -> Dictionary:
	var field := SchemaType.new()
	field.id = 0
	field.name = "ReflectionField"
	field.fields = [{"name": "name", "type": "string"}, {"name": "type", "type": "string"}, {"name": "referencedType", "type": "number"}]
	var rtype := SchemaType.new()
	rtype.id = 1
	rtype.name = "ReflectionType"
	rtype.fields = [{"name": "id", "type": "number"}, {"name": "extendsId", "type": "number"}, {"name": "fields", "type": {"array": field}}]
	var root := SchemaType.new()
	root.id = 2
	root.name = "Reflection"
	root.fields = [{"name": "types", "type": {"array": rtype}}, {"name": "rootType", "type": "number"}]
	return {"root": root}


## Reads the handshake (Reflection.encode on the server) and returns a Decoder for the state.
static func decoder_from_handshake(bytes: PackedByteArray, offset: int) -> Decoder:
	var meta := _reflection_types()
	var reflection := Decoder.new(meta.root, {})
	reflection.decode(bytes, offset)
	var refl: Struct = reflection.state
	var type_list: Array = (refl.get_field("types") as ListRef).to_array() if refl.get_field("types") != null else []
	var context := {}
	var by_id := {}
	for t in type_list:
		var st := SchemaType.new()
		st.id = int(t.get_field("id", 0))
		context[st.id] = st
		by_id[st.id] = t
	for t in type_list:
		var st: SchemaType = context[int(t.get_field("id", 0))]
		# Parent fields first (inheritance), then this type's own.
		var chain: Array = []
		var cur = t
		while cur != null:
			chain.push_front(cur)
			var parent_id = cur.get_field("extendsId")
			cur = by_id.get(int(parent_id)) if parent_id != null else null
		for rt in chain:
			var fields_ref = rt.get_field("fields")
			if fields_ref == null:
				continue
			for f in (fields_ref as ListRef).to_array():
				var fname: String = f.get_field("name", "")
				var ftype: String = f.get_field("type", "")
				var referenced = f.get_field("referencedType")
				var type: Variant = ftype
				if referenced != null:
					var ref_type = context.get(int(referenced))
					var kind := ftype
					var child: Variant = ref_type
					if ref_type == null:
						var parts := ftype.split(":")
						kind = parts[0]
						child = parts[1] if parts.size() > 1 else "string"
					if kind == "ref":
						type = child
					else:
						type = {kind: child}
				st.fields.append({"name": fname, "type": type})
	var root_id := int(refl.get_field("rootType", 0))
	var root_type: SchemaType = context.get(root_id)
	if root_type == null:
		root_type = SchemaType.new()
	return Decoder.new(root_type, context)
