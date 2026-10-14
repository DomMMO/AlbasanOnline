class_name LeaderboardWindow
extends GameWindow

## PvP Sıralaması: the arena rating table from /api/leaderboard.

var ui: GameUi
var _grid: GridContainer
var _status: Label


func _init(owner_ui: GameUi) -> void:
	super._init("leaderboard", "PvP Sıralaması", 420)
	ui = owner_ui
	_grid = GridContainer.new()
	_grid.columns = 6
	_grid.add_theme_constant_override("h_separation", 14)
	body.add_child(_grid)
	_status = UiTheme.muted("", 12)
	body.add_child(_status)
	body.add_child(UiTheme.muted("Ö: öldürme · Ö'n: ölüm. Kan Arenası'nda oyuncu yenerek puan kazanılır.", 12))


func toggle_window(force: Variant = null) -> void:
	var want: bool = (not visible) if force == null else bool(force)
	if not want:
		close_window()
		return
	open()
	_load()


func _load() -> void:
	for c in _grid.get_children():
		c.queue_free()
	for h in ["#", "Karakter", "Sınıf", "Puan", "Ö", "Ö'n"]:
		_grid.add_child(UiTheme.label(h, 13, UiTheme.GOLD, true))
	_status.text = "Yükleniyor…"
	var r: Dictionary = await Net.leaderboard()
	if not r.ok or not (r.data is Array):
		_status.text = "Sıralama alınamadı."
		return
	var entries: Array = r.data
	_status.text = "Henüz kimse arenada dövüşmedi." if entries.is_empty() else ""
	for i in entries.size():
		var e: Dictionary = entries[i]
		var cls := GameData.class_of(String(e.get("class", "")))
		_grid.add_child(UiTheme.label(str(i + 1), 13))
		_grid.add_child(UiTheme.label(String(e.name) + (" ●" if e.get("online", false) else ""), 13, Color(String(cls.get("color", "#ffffff"))), true))
		_grid.add_child(UiTheme.label("%s %d" % [cls.get("name", ""), int(e.get("level", 1))], 13))
		_grid.add_child(UiTheme.label(str(int(e.rating)), 13))
		_grid.add_child(UiTheme.label(str(int(e.kills)), 13))
		_grid.add_child(UiTheme.label(str(int(e.deaths)), 13))
