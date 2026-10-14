class_name MsgPack
extends RefCounted

## MessagePack (big-endian, the standard format) for Colyseus room messages.
## The server packs with msgpackr (useRecords: false), which is plain MessagePack; `undefined`
## arrives as fixext 1 type 0 and is read as null.


static func encode(value: Variant) -> PackedByteArray:
	var out := PackedByteArray()
	_write(out, value)
	return out


static func _write(out: PackedByteArray, value: Variant) -> void:
	match typeof(value):
		TYPE_NIL:
			out.append(0xc0)
		TYPE_BOOL:
			out.append(0xc3 if value else 0xc2)
		TYPE_INT:
			_write_int(out, value)
		TYPE_FLOAT:
			var f: float = value
			# Whole numbers go as integers (what JavaScript's msgpackr does too).
			if f == floorf(f) and absf(f) < 9007199254740992.0:
				_write_int(out, int(f))
			else:
				out.append(0xcb)
				var b := PackedByteArray()
				b.resize(8)
				b.encode_double(0, f)
				b.reverse()
				out.append_array(b)
		TYPE_STRING, TYPE_STRING_NAME:
			var bytes := String(value).to_utf8_buffer()
			var n := bytes.size()
			if n < 32:
				out.append(0xa0 | n)
			elif n < 0x100:
				out.append(0xd9)
				out.append(n)
			elif n < 0x10000:
				out.append(0xda)
				_be(out, n, 2)
			else:
				out.append(0xdb)
				_be(out, n, 4)
			out.append_array(bytes)
		TYPE_PACKED_BYTE_ARRAY:
			var raw: PackedByteArray = value
			var size := raw.size()
			if size < 0x100:
				out.append(0xc4)
				out.append(size)
			elif size < 0x10000:
				out.append(0xc5)
				_be(out, size, 2)
			else:
				out.append(0xc6)
				_be(out, size, 4)
			out.append_array(raw)
		TYPE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_STRING_ARRAY:
			var list: Array = Array(value)
			var count := list.size()
			if count < 16:
				out.append(0x90 | count)
			elif count < 0x10000:
				out.append(0xdc)
				_be(out, count, 2)
			else:
				out.append(0xdd)
				_be(out, count, 4)
			for item in list:
				_write(out, item)
		TYPE_DICTIONARY:
			var dict: Dictionary = value
			var keys := dict.keys()
			var count := keys.size()
			if count < 16:
				out.append(0x80 | count)
			elif count < 0x10000:
				out.append(0xde)
				_be(out, count, 2)
			else:
				out.append(0xdf)
				_be(out, count, 4)
			for key in keys:
				_write(out, str(key) if typeof(key) == TYPE_STRING_NAME else key)
				_write(out, dict[key])
		_:
			push_warning("MsgPack: cannot encode %s" % type_string(typeof(value)))
			out.append(0xc0)


static func _write_int(out: PackedByteArray, n: int) -> void:
	if n >= 0:
		if n < 0x80:
			out.append(n)
		elif n < 0x100:
			out.append(0xcc)
			out.append(n)
		elif n < 0x10000:
			out.append(0xcd)
			_be(out, n, 2)
		elif n < 0x100000000:
			out.append(0xce)
			_be(out, n, 4)
		else:
			out.append(0xcf)
			_be(out, n, 8)
	else:
		if n >= -32:
			out.append(n & 0xff)
		elif n >= -128:
			out.append(0xd0)
			out.append(n & 0xff)
		elif n >= -32768:
			out.append(0xd1)
			_be(out, n & 0xffff, 2)
		elif n >= -2147483648:
			out.append(0xd2)
			_be(out, n & 0xffffffff, 4)
		else:
			out.append(0xd3)
			_be(out, n, 8)


static func _be(out: PackedByteArray, n: int, size: int) -> void:
	for i in range(size - 1, -1, -1):
		out.append((n >> (i * 8)) & 0xff)


## Decodes one value starting at `offset`; returns it (the reader's position is not reported).
static func decode(bytes: PackedByteArray, offset := 0) -> Variant:
	var reader := Reader.new(bytes, offset)
	return reader.read()


class Reader:
	var b: PackedByteArray
	var o: int

	func _init(bytes: PackedByteArray, offset: int) -> void:
		b = bytes
		o = offset

	func _u(size: int) -> int:
		var n := 0
		for i in size:
			n = (n << 8) | b[o + i]
		o += size
		return n

	func _s(size: int) -> int:
		var n := _u(size)
		var bits := size * 8
		if bits < 64 and n >= (1 << (bits - 1)):
			n -= 1 << bits
		return n

	func _str(size: int) -> String:
		var s := b.slice(o, o + size).get_string_from_utf8()
		o += size
		return s

	func _arr(count: int) -> Array:
		var list := []
		list.resize(count)
		for i in count:
			list[i] = read()
		return list

	func _map(count: int) -> Dictionary:
		var dict := {}
		for i in count:
			var key = read()
			dict[key] = read()
		return dict

	func _float(size: int) -> float:
		var raw := b.slice(o, o + size)
		raw.reverse()
		o += size
		return raw.decode_float(0) if size == 4 else raw.decode_double(0)

	func read() -> Variant:
		if o >= b.size():
			return null
		var t: int = b[o]
		o += 1
		if t < 0x80:
			return t
		if t >= 0xe0:
			return t - 0x100
		if t >= 0xa0 and t <= 0xbf:
			return _str(t & 0x1f)
		if t >= 0x90 and t <= 0x9f:
			return _arr(t & 0x0f)
		if t >= 0x80 and t <= 0x8f:
			return _map(t & 0x0f)
		match t:
			0xc0:
				return null
			0xc2:
				return false
			0xc3:
				return true
			0xc4:
				var n := _u(1)
				var raw := b.slice(o, o + n)
				o += n
				return raw
			0xc5:
				var n := _u(2)
				var raw := b.slice(o, o + n)
				o += n
				return raw
			0xc6:
				var n := _u(4)
				var raw := b.slice(o, o + n)
				o += n
				return raw
			0xc7, 0xc8, 0xc9:
				var n := _u(1 if t == 0xc7 else (2 if t == 0xc8 else 4))
				o += 1 + n
				return null
			0xca:
				return _float(4)
			0xcb:
				return _float(8)
			0xcc:
				return _u(1)
			0xcd:
				return _u(2)
			0xce:
				return _u(4)
			0xcf:
				return _u(8)
			0xd0:
				return _s(1)
			0xd1:
				return _s(2)
			0xd2:
				return _s(4)
			0xd3:
				return _s(8)
			0xd4:
				o += 2
				return null
			0xd5:
				o += 3
				return null
			0xd6:
				o += 5
				return null
			0xd7:
				o += 9
				return null
			0xd8:
				o += 17
				return null
			0xd9:
				return _str(_u(1))
			0xda:
				return _str(_u(2))
			0xdb:
				return _str(_u(4))
			0xdc:
				return _arr(_u(2))
			0xdd:
				return _arr(_u(4))
			0xde:
				return _map(_u(2))
			0xdf:
				return _map(_u(4))
		push_warning("MsgPack: unknown byte 0x%x" % t)
		return null
