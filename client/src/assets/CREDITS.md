# Asset credits

**Third-party files live in `licensed/` (this folder), which is git-ignored: they stay on the
owner's machine and are never committed or pushed.** A fresh clone or a build without them
still runs: monsters with sprite sheets are drawn as code look-alikes
(`withFallback` in `gfx/imageSprites.ts`), items show their drawn icon, titles use a serif and
bosses have no music. Copy the files back into `licensed/` to get them in a local build.

| Asset | Source | Used for |
| --- | --- | --- |
| `licensed/bosses/jack.png` | "Jack" pumpkin character frames from `jackfree.zip`, provided by the project owner. Downscaled and packed into a sprite sheet (`jack.json` holds frame size, feet anchor and animation ranges). | Boss "Kabak Jack" |

| `licensed/mobs/*`, `licensed/items/*` | CraftPix.net free "tiny style" 2D sprites: Golem (#891178), Satyr (#891179), Minotaur (#484869), Wraith (#563568). License: https://craftpix.net/file-licenses/ (use in games, also commercial, allowed; the source files must not be redistributed or resold as they are). Frames downscaled, cropped and packed into sheets by `tools/build_sprites.py`; weapons cut from each pack's `Weapon.png` part. | Satyrs, golems, minotaurs, wraiths and their weapons |
| `licensed/fonts/CloisterBlackTR.ttf` | "Cloister Black" by Typographer Mediengestaltung / Dieter Steffmann (freeware), provided by the project owner. Turkish letters ğ Ğ ş Ş İ were missing and were added as composites of the font's own shapes (s/S + cedilla, g/G + a drawn breve, I + the dot of i). | Titles, names, buttons |
| `licensed/music/elder_dragon.weba` | Song provided by the project owner (from YouTube; rights not cleared). | Boss music, Kadim Ejder Azhdar |

Check each pack's license before a public release.

Everything else (tiles, characters, items, effects) is drawn in code.
