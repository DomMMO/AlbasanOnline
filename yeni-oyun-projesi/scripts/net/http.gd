class_name Http
extends Node

## Small awaitable JSON-over-HTTP helper:  var r := await Http.request_json(self, "POST", url, body, headers)
## Returns {"ok": bool, "status": int, "data": Variant, "error": String}.

static func request_json(owner: Node, method: String, url: String, body: Variant = null, headers: PackedStringArray = PackedStringArray()) -> Dictionary:
	var req := HTTPRequest.new()
	req.timeout = 20.0
	owner.add_child(req)
	var all_headers := PackedStringArray(["Content-Type: application/json", "Accept: application/json"])
	all_headers.append_array(headers)
	var methods := {"GET": HTTPClient.METHOD_GET, "POST": HTTPClient.METHOD_POST, "DELETE": HTTPClient.METHOD_DELETE, "PUT": HTTPClient.METHOD_PUT}
	var payload := "" if body == null else JSON.stringify(body)
	var err := req.request(url, all_headers, methods.get(method, HTTPClient.METHOD_GET), payload)
	if err != OK:
		req.queue_free()
		return {"ok": false, "status": 0, "data": null, "error": "Sunucuya bağlanılamadı. Sunucu çalışıyor mu?"}
	var result: Array = await req.request_completed
	req.queue_free()
	var status: int = result[1]
	var raw: PackedByteArray = result[3]
	if result[0] != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "status": 0, "data": null, "error": "Sunucuya bağlanılamadı. Sunucu çalışıyor mu?"}
	var text := raw.get_string_from_utf8()
	var data = JSON.parse_string(text) if not text.is_empty() else {}
	if data == null:
		data = {}
	var ok := status >= 200 and status < 300
	var message := ""
	if not ok:
		message = data.get("error", "Beklenmeyen hata (%d)" % status) if data is Dictionary else "Beklenmeyen hata (%d)" % status
	return {"ok": ok, "status": status, "data": data, "error": message}
