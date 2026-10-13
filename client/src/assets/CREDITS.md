# Asset credits

| Asset | Source | Used for |
| --- | --- | --- |
| `bosses/jack.png` | "Jack" pumpkin character frames from `jackfree.zip`, provided by the project owner. Downscaled and packed into a sprite sheet (`jack.json` holds frame size, feet anchor and animation ranges). | Boss "Kabak Jack" |

| `mobs/*`, `items/*` | CraftPix.net free "tiny style" 2D sprites: Golem (#891178), Satyr (#891179), Minotaur (#484869), Wraith (#563568). License: https://craftpix.net/file-licenses/ (use in games, also commercial, allowed; the source files must not be redistributed or resold as they are). Frames downscaled, cropped and packed into sheets by `tools/build_sprites.py`; weapons cut from each pack's `Weapon.png` part. | Satyrs, golems, minotaurs, wraiths and their weapons |
| `fonts/CloisterBlackTR.ttf` | "Cloister Black" by Typographer Mediengestaltung / Dieter Steffmann (freeware), provided by the project owner. Turkish letters ğ Ğ ş Ş İ were missing and were added as composites of the font's own shapes (s/S + cedilla, g/G + a drawn breve, I + the dot of i). | Titles, names, buttons |

Check each pack's license before a public release.

Everything else (tiles, characters, items, effects) is drawn in code.
