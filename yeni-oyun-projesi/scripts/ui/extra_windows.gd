class_name ExtraWindows
extends RefCounted

## Storage, stable, pets, the barber, friends, trade, the market stall, the passive tree, the damage meter and
## the PvP leaderboard.

var ui: GameUi
var parent: Control
var hud_root: Control
var storage: StorageWindow
var friends: FriendsWindow
var leaderboard: LeaderboardWindow
var stable: StableWindow
var pet: PetWindow
var barber: BarberWindow
var trade: TradeWindow
var market: MarketUi
var passives: PassivesWindow
var meter: DamageMeter


func _init(owner_ui: GameUi, windows: Control, root: Control) -> void:
	ui = owner_ui
	parent = windows
	hud_root = root
	storage = StorageWindow.new(ui)
	windows.add_child(storage)
	friends = FriendsWindow.new(ui)
	windows.add_child(friends)
	leaderboard = LeaderboardWindow.new(ui)
	windows.add_child(leaderboard)
	stable = StableWindow.new(ui)
	windows.add_child(stable)
	pet = PetWindow.new(ui)
	windows.add_child(pet)
	barber = BarberWindow.new(ui)
	windows.add_child(barber)
	trade = TradeWindow.new(ui)
	windows.add_child(trade)
	market = MarketUi.new(ui, windows)
	passives = PassivesWindow.new(ui)
	windows.add_child(passives)
	meter = DamageMeter.new(ui)
	root.add_child(meter)


func update_inventory(event: Dictionary) -> void:
	storage.update(event)
	passives.update(event)
	stable.refresh()
	pet.refresh()
	barber.refresh()
	market.refresh()
	trade.refresh()


func reset() -> void:
	meter.reset_all()
	market.reset()


# ---- Storage ----

func storage_npc() -> Dictionary:
	return storage.npc if storage.visible else {}


func open_storage(npc: Dictionary) -> void:
	storage.open_for(npc)


func close_storage() -> void:
	storage.close_window()


# ---- Stable ----

func stable_npc() -> Dictionary:
	return stable.npc if stable.visible else {}


func open_stable(npc: Dictionary) -> void:
	stable.open_for(npc)


func close_stable() -> void:
	stable.close_window()


func set_horse_state(event: Dictionary) -> void:
	stable.set_state(event)


# ---- Pets ----

func pet_npc() -> Dictionary:
	return pet.npc if pet.visible else {}


func open_pets(npc: Dictionary) -> void:
	pet.open_for(npc)


func close_pets() -> void:
	pet.close_window()


func set_pet_state(event: Dictionary) -> void:
	pet.set_state(event)


# ---- Barber ----

func barber_npc() -> Dictionary:
	return barber.npc if barber.visible else {}


func open_barber(npc: Dictionary) -> void:
	barber.open_for(npc)


func close_barber() -> void:
	barber.close_window()


# ---- Friends ----

func toggle_friends() -> void:
	friends.toggle_window()


func set_friend_list(event: Dictionary) -> void:
	friends.set_list(event)


func is_friend_or_pending(name: String) -> bool:
	return friends.is_friend_or_pending(name)


# ---- Leaderboard ----

func toggle_leaderboard() -> void:
	leaderboard.toggle_window()


# ---- Trade ----

func on_trade_state(event: Dictionary) -> void:
	trade.on_state(event)


func is_trade_open() -> bool:
	return trade.visible


func add_to_trade(index: int) -> void:
	trade.add(index)


# ---- Market ----

func on_my_stall(event: Dictionary) -> void:
	market.on_my_stall(event)


func show_stall_contents(event: Dictionary) -> void:
	market.show_contents(event)


func on_stall_closed(seller_id: String) -> void:
	market.on_closed(seller_id)


func browsing_seller() -> String:
	return market.browsing_seller()


func close_browse() -> void:
	market.close_browse()


func open_stall_setup() -> void:
	market.open_setup()


func is_stall_setup_open() -> bool:
	return market.is_setup_open()


func add_to_stall(index: int) -> void:
	market.add(index)


# ---- Passives ----

func toggle_passives() -> void:
	passives.toggle_window()


# ---- Damage meter ----

func record_combat(event: Dictionary, w: World) -> void:
	meter.record(event, w)
