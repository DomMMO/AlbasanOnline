import { TILE_SIZE } from "../constants";
import { TOWN_SPOTS } from "../town";

// Asking a guard the way: the places in town anyone might look for, with a line on how to
// recognise them. The compass direction and the distance are worked out from wherever the
// guard stands; guards inside the keep give them from the keep's front door.

export interface TownPlace {
  id: string;
  /** Shown on the question button ("… nerede?"). */
  name: string;
  /** Feet position in town, in pixels. */
  x: number;
  y: number;
  /** How to recognise it once you are close. */
  hint: string;
}

export const TOWN_PLACES: TownPlace[] = [
  { id: "weaponsmith", name: "Silahçı", ...TOWN_SPOTS.weaponsmith, hint: "Kale kapısının hemen içinde, kırmızı çatılı, kılıç tabelalı dükkân. Silahçı Kerem kapıda durur." },
  { id: "armorer", name: "Zırhçı", ...TOWN_SPOTS.armorer, hint: "Çeşme meydanının kuzeydoğusunda, mavi çatılı dükkân. Zırhçı Leyla sokağın köşesinde bekler." },
  { id: "blacksmith", name: "Demirci", ...TOWN_SPOTS.blacksmith, hint: "Batı surunun dibinde, bacası tüten demirhane. Örsün sesini duyarsın." },
  { id: "alchemist", name: "İksirci", ...TOWN_SPOTS.alchemist, hint: "Kuzeybatıdaki arka sokakta, yeşil çatılı, iksir tabelalı dükkân." },
  { id: "scribe", name: "Parşömenci", ...TOWN_SPOTS.scribe, hint: "Kalenin batısında, mor çatılı, parşömen tabelalı dükkân." },
  { id: "jeweler", name: "Kuyumcu", ...TOWN_SPOTS.jeweler, hint: "Güneybatıda, sarı çatılı, yüzük tabelalı dükkân." },
  { id: "craftsman", name: "Zanaatkâr", ...TOWN_SPOTS.craftsman, hint: "Kuyumcu Selin'in hemen yanında. Kazma ve orak ondan alınır." },
  { id: "storekeeper", name: "Depo", ...TOWN_SPOTS.storekeeper, hint: "Pazarın doğusundaki büyük ambar. Depocu Hatice eşyalarını saklar." },
  { id: "market", name: "Pazar", ...TOWN_SPOTS.market, hint: "Şehrin güneyinde, çitle çevrili meydan. Tezgâh yalnızca orada açılır." },
  { id: "commander", name: "Komutan", ...TOWN_SPOTS.commander, hint: "Kale kapısının yanında, kışlanın önünde. Komutan Baran görev verir." },
  { id: "sage", name: "Bilge Ozan", ...TOWN_SPOTS.sage, hint: "Çeşmenin batı kenarında oturur. Hikâyeyi ondan dinle." },
  { id: "cook", name: "Ayşe Teyze", ...TOWN_SPOTS.cook, hint: "Pembe çatılı evinin önünde. Fal da bakar, yemek de ister." },
  { id: "keep", name: "Ustalar", ...TOWN_SPOTS.fromKeep, hint: "İç Kale'nin büyük kapısından gir; yedi usta salonun ortasında, ateşin başında oturur. Yolunu orada seçersin." },
  { id: "arena", name: "Kan Arenası", ...TOWN_SPOTS.pvpPortal, hint: "Kalenin doğusundaki avluda, kırmızı portal. 5. seviyeden önce içeri alınmazsın." },
  { id: "field", name: "Vadi kapısı", ...TOWN_SPOTS.fieldGate, hint: "Doğu kapısından çık, asma köprüyü geç; yolun sonundaki ışınlanma kapısı Başlangıç Vadisi'ne açılır." },
  { id: "harbor", name: "Liman", ...TOWN_SPOTS.harborGate, hint: "Doğu kapısından çıkınca güneye sapan Arnavut kaldırımı yolu izle; sonundaki kapı Liman'a çıkar." },
];

const COMPASS = ["doğuda", "güneydoğuda", "güneyde", "güneybatıda", "batıda", "kuzeybatıda", "kuzeyde", "kuzeydoğuda"];

/** "kuzeydoğuda, yaklaşık 14 adım" from `from` to the place (screen y grows southwards). */
export function directionTo(from: { x: number; y: number }, place: { x: number; y: number }): { compass: string; steps: number } {
  const dx = place.x - from.x;
  const dy = place.y - from.y;
  const steps = Math.round(Math.hypot(dx, dy) / TILE_SIZE);
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return { compass: COMPASS[(sector + 8) % 8], steps };
}
