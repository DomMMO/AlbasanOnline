class_name BossMusic
extends AudioStreamPlayer

## Boss fight music: a boss with a theme starts it when its
## health bar comes up and it fades out when the fight ends. The songs are third-party and
## kept out of the repository: art/licensed/music/<mob id>.ogg (or .mp3). Godot does not play
## .weba files; convert them (ffmpeg -i elder_dragon.weba elder_dragon.ogg).

const VOLUME_DB := -5.2  # 0.55 linear
const FADE := 1.5

var playing_kind := ""
var _tween: Tween


func _ready() -> void:
	Settings.changed.connect(func(): if not Settings.get_value("bossMusic") and not playing_kind.is_empty(): set_boss(""))


static func theme_for(kind: String) -> AudioStream:
	for ext in ["ogg", "mp3", "wav"]:
		var path := "res://art/licensed/music/%s.%s" % [kind, ext]
		if ResourceLoader.exists(path):
			return load(path)
	return null


## The boss whose bar is showing (its mob kind), or "" when there is none. Cheap every frame.
func set_boss(kind: String) -> void:
	var song: AudioStream = theme_for(kind) if not kind.is_empty() and Settings.get_value("bossMusic") else null
	var wanted := kind if song else ""
	if wanted == playing_kind:
		return
	playing_kind = wanted
	if _tween:
		_tween.kill()
	if wanted.is_empty():
		_tween = create_tween()
		_tween.tween_property(self, "volume_db", -60.0, FADE)
		_tween.tween_callback(stop)
		return
	stream = song
	if stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
	elif stream is AudioStreamMP3:
		(stream as AudioStreamMP3).loop = true
	volume_db = -60.0
	play()
	_tween = create_tween()
	_tween.tween_property(self, "volume_db", VOLUME_DB, FADE)
