class_name ColyseusRoom
extends Node

## One joined Colyseus room (colyseus.js Room, protocol 0.16): the WebSocket, the synced state
## and the messages. Added to the tree so it can poll its socket every frame.
##
##   room.on_message("chatMessage", func(data): ...)
##   room.send("input", {"seq": 1, "dx": 1, "dy": 0})
##   room.state_changed -> after every state patch (see StateCallbacks for onAdd/listen)

signal joined
signal join_failed(code: int, message: String)
signal left(code: int)
signal error(code: int, message: String)
## Emitted after each decoded state message with the changes, in wire order.
signal state_patched(changes: Array)

const HANDSHAKE := 9
const JOIN_ROOM := 10
const ERROR := 11
const LEAVE_ROOM := 12
const ROOM_DATA := 13
const ROOM_STATE := 14
const ROOM_STATE_PATCH := 15
const ROOM_DATA_SCHEMA := 16
const ROOM_DATA_BYTES := 17

var room_id := ""
var session_id := ""
var room_name := ""
var reconnection_token := ""
var has_joined := false
var decoder: Schema.Decoder
var callbacks: StateCallbacks

var _socket := WebSocketPeer.new()
var _handlers := {}  # type -> Array[Callable]
var _closed := false
var _leaving := false


## The root state (Schema.Struct), once the first state arrived.
var state: Schema.Struct:
	get:
		return decoder.state if decoder else null


func connect_to(url: String) -> void:
	_socket.inbound_buffer_size = 1 << 22
	_socket.outbound_buffer_size = 1 << 20
	_socket.max_queued_packets = 4096
	var err := _socket.connect_to_url(url)
	if err != OK:
		_closed = true
		join_failed.emit(err, "WebSocket bağlantısı açılamadı (%d)" % err)


func on_message(type: String, handler: Callable) -> void:
	if not _handlers.has(type):
		_handlers[type] = []
	_handlers[type].append(handler)


func send(type: String, message: Variant = null) -> void:
	if _socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	var packet := PackedByteArray([ROOM_DATA])
	packet.append_array(_schema_string(type))
	if message != null:
		packet.append_array(MsgPack.encode(message))
	_socket.send(packet)


## Leaves the room (the server saves the character); `left` fires once the socket closes.
func leave(consented := true) -> void:
	if _closed:
		left.emit(1000)
		return
	_leaving = true
	if consented and _socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		_socket.send(PackedByteArray([LEAVE_ROOM]))
	else:
		_socket.close()


func _process(_delta: float) -> void:
	if _closed:
		return
	_socket.poll()
	var ready := _socket.get_ready_state()
	while _socket.get_available_packet_count() > 0:
		_on_packet(_socket.get_packet())
	if ready == WebSocketPeer.STATE_CLOSED:
		_closed = true
		var code := _socket.get_close_code()
		if not has_joined:
			join_failed.emit(code, "Odaya bağlanılamadı (%d) %s" % [code, _socket.get_close_reason()])
		else:
			left.emit(code)


func _on_packet(bytes: PackedByteArray) -> void:
	if bytes.is_empty():
		return
	var code: int = bytes[0]
	var it := Schema.Iter.new(bytes, 1)
	match code:
		JOIN_ROOM:
			var token_len: int = bytes[it.o]
			it.o += 1
			reconnection_token = Schema.Prim.utf8(it, token_len)
			var serializer_len: int = bytes[it.o]
			it.o += 1
			var serializer := Schema.Prim.utf8(it, serializer_len)
			if serializer == "schema" and bytes.size() > it.o:
				decoder = Schema.decoder_from_handshake(bytes, it.o)
				callbacks = StateCallbacks.new(decoder.state)
			has_joined = true
			# Acknowledge, then the server sends the full state.
			_socket.send(PackedByteArray([JOIN_ROOM]))
			joined.emit()
		ERROR:
			var err_code := int(Schema.Prim.number(it))
			var message := Schema.Prim.string(it)
			if not has_joined:
				join_failed.emit(err_code, message)
			error.emit(err_code, message)
		LEAVE_ROOM:
			leave()
		ROOM_STATE, ROOM_STATE_PATCH:
			if decoder == null:
				return
			var changes := decoder.decode(bytes, 1)
			callbacks.dispatch(changes)
			state_patched.emit(changes)
		ROOM_DATA:
			var type: String
			if Schema.Prim.is_string(it):
				type = Schema.Prim.string(it)
			else:
				type = "i%d" % int(Schema.Prim.number(it))
			var message = MsgPack.decode(bytes, it.o) if bytes.size() > it.o else null
			_dispatch(type, message)
		ROOM_DATA_BYTES:
			var type: String
			if Schema.Prim.is_string(it):
				type = Schema.Prim.string(it)
			else:
				type = "i%d" % int(Schema.Prim.number(it))
			_dispatch(type, bytes.slice(it.o))


func _dispatch(type: String, message: Variant) -> void:
	var list: Array = _handlers.get(type, [])
	if list.is_empty():
		list = _handlers.get("*", [])
		for h in list:
			h.call(type, message)
		return
	for handler in list.duplicate():
		if handler.is_valid():
			handler.call(message)


static func _schema_string(text: String) -> PackedByteArray:
	var bytes := text.to_utf8_buffer()
	var n := bytes.size()
	var out := PackedByteArray()
	if n < 32:
		out.append(0xa0 | n)
	elif n < 0x100:
		out.append(0xd9)
		out.append(n)
	elif n < 0x10000:
		out.append(0xda)
		out.append(n & 0xff)
		out.append(n >> 8)
	else:
		out.append(0xdb)
		for i in 4:
			out.append((n >> (i * 8)) & 0xff)
	out.append_array(bytes)
	return out
