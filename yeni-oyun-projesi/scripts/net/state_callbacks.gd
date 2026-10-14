class_name StateCallbacks
extends RefCounted

## onAdd / onRemove / onChange / listen on the decoded room state, the way colyseus.js
## getStateCallbacks() offers them. Each register function returns a Callable that unregisters.

var _add := {}  # ref instance id -> Array[Callable(value, key)]
var _remove := {}  # ref instance id -> Array[Callable(value, key)]
var _change := {}  # struct instance id -> Array[Callable()]
var _listen := {}  # "id:field" -> Array[Callable(value, previous)]
var root: Schema.Struct


func _init(state: Schema.Struct) -> void:
	root = state


static func _push(table: Dictionary, key: Variant, cb: Callable) -> Callable:
	if not table.has(key):
		table[key] = []
	table[key].append(cb)
	return func(): if table.has(key): table[key].erase(cb)


## Called for every entry already in the collection (when `immediate`) and every entry added later.
func on_add(collection: Schema.Ref, cb: Callable, immediate := true) -> Callable:
	if collection == null:
		return func(): pass
	var off := _push(_add, collection.get_instance_id(), cb)
	if immediate:
		for key in collection.items.keys():
			cb.call(collection.items[key], key)
	return off


func on_remove(collection: Schema.Ref, cb: Callable) -> Callable:
	if collection == null:
		return func(): pass
	return _push(_remove, collection.get_instance_id(), cb)


## Once per state patch in which any field of `struct` changed.
func on_change(struct: Schema.Struct, cb: Callable) -> Callable:
	return _push(_change, struct.get_instance_id(), cb)


## A field's changes (value, previous); called at once with the current value when `immediate`.
func listen(struct: Schema.Struct, field: String, cb: Callable, immediate := true) -> Callable:
	var off := _push(_listen, "%d:%s" % [struct.get_instance_id(), field], cb)
	if immediate and struct.values.has(field):
		cb.call(struct.values[field], null)
	return off


func dispatch(changes: Array) -> void:
	var changed: Array = []
	var seen := {}
	for c: Schema.Change in changes:
		var ref := c.ref
		if ref is Schema.Struct:
			var id := ref.get_instance_id()
			var key := "%d:%s" % [id, c.field]
			for cb in _listen.get(key, []).duplicate():
				if cb.is_valid():
					cb.call(c.value, c.previous)
			if not seen.has(id):
				seen[id] = true
				changed.append(ref)
		else:
			var id := ref.get_instance_id()
			var removed := (c.op & Schema.OP_DELETE) == Schema.OP_DELETE
			var added := (c.op & Schema.OP_ADD) == Schema.OP_ADD
			if removed and c.previous != null:
				for cb in _remove.get(id, []).duplicate():
					if cb.is_valid():
						cb.call(c.previous, c.key)
				_forget(c.previous)
			if added and c.value != null:
				for cb in _add.get(id, []).duplicate():
					if cb.is_valid():
						cb.call(c.value, c.key)
	for struct in changed:
		for cb in _change.get(struct.get_instance_id(), []).duplicate():
			if cb.is_valid():
				cb.call()


## A removed entry takes its own listeners with it.
func _forget(value: Variant) -> void:
	if not (value is Schema.Ref):
		return
	var id: int = value.get_instance_id()
	_change.erase(id)
	_add.erase(id)
	_remove.erase(id)
	var prefix := "%d:" % id
	for key in _listen.keys():
		if String(key).begins_with(prefix):
			_listen.erase(key)
