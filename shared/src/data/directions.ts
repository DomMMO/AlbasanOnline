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
  { id: "weaponsmith", name: "Silahçı", ...TOWN_SPOTS.weaponsmith, hint: "Doğu kapısının hemen içinde, kırmızı çatılı, kılıç tabelalı dükkân. Silahçı Kerem kapıda durur." },
  { id: "armorer", name: "Zırhçı", ...TOWN_SPOTS.armorer, hint: "Çeşme meydanının kuzeydoğusunda, mavi çatılı dükkân. Zırhçı Leyla kapısının önünde bekler." },
  { id: "blacksmith", name: "Demirci", ...TOWN_SPOTS.blacksmith, hint: "Batı kapısının hemen içinde, bacası tüten demirhane. Örsün sesini duyarsın." },
  { id: "alchemist", name: "İksirci", ...TOWN_SPOTS.alchemist, hint: "Kuzeybatıda, demirhanenin üstünde; yeşil çatılı, iksir tabelalı dükkân." },
  { id: "scribe", name: "Parşömenci", ...TOWN_SPOTS.scribe, hint: "Kalenin batı yanında, mor çatılı, parşömen tabelalı dükkân." },
  { id: "jeweler", name: "Kuyumcu", ...TOWN_SPOTS.jeweler, hint: "Güneybatıda, kuyunun yakınında; sarı çatılı, yüzük tabelalı dükkân." },
  { id: "craftsman", name: "Zanaatkâr", ...TOWN_SPOTS.craftsman, hint: "Kuyumcu Selin'in hemen yanında. Kazma ve orak ondan alınır." },
  { id: "storekeeper", name: "Depo", ...TOWN_SPOTS.storekeeper, hint: "Güneydoğuda, at çiftliğinin yanındaki büyük ambar. Depocu Hatice eşyalarını saklar." },
  { id: "market", name: "Pazar", ...TOWN_SPOTS.market, hint: "Tezgâhını şehrin istediğin yerinde açabilirsin; tüccarların çoğu çeşme meydanında kurar." },
  { id: "commander", name: "Komutan", ...TOWN_SPOTS.commander, hint: "Doğu kapısına yakın, kışlanın önünde. Komutan Baran görev verir." },
  { id: "sage", name: "Bilge Ozan", ...TOWN_SPOTS.sage, hint: "Çeşme meydanının batı kenarında oturur. Hikâyeyi ondan dinle." },
  { id: "cook", name: "Ayşe Teyze", ...TOWN_SPOTS.cook, hint: "Çeşmenin güneydoğusunda, pembe çatılı evinin önünde. Fal da bakar, yemek de ister." },
  { id: "keep", name: "Ustalar", ...TOWN_SPOTS.fromKeep, hint: "İç Kale'nin büyük kapısından gir; yedi usta salonun ortasında, ateşin başında oturur. Yolunu orada seçersin." },
  { id: "stable", name: "At Çiftliği", ...TOWN_SPOTS.stableMaster, hint: "Surların içinde, güneydoğuda çitle çevrili otlak. Seyis Yusuf çiftliğin kapısında at satar." },
  { id: "barber", name: "Berber", ...TOWN_SPOTS.barber, hint: "Çeşme meydanının batısında, tabelasız evin kapısında. Berber Cemil saçını keser, boyar." },
  { id: "pets", name: "Petçi", ...TOWN_SPOTS.petKeeper, hint: "At çiftliğinin kapısının birkaç adım batısında. Petçi Nuri ganimet toplayan evcil hayvanlar satar." },
  { id: "arena", name: "Kan Arenası", ...TOWN_SPOTS.pvpPortal, hint: "Kalenin batısındaki kum avluda, kırmızı portal. 5. seviyeden önce içeri alınmazsın." },
  { id: "field", name: "Vadi kapısı", ...TOWN_SPOTS.fieldGate, hint: "Doğu kapısından çık, yolu adanın doğu ucuna kadar yürü; ışınlanma kapısı Başlangıç Vadisi'ne açılır." },
  { id: "pier", name: "İskele", ...TOWN_SPOTS.pier, hint: "Çeşmeden güneye inen yolu adanın ucuna kadar izle; iskelenin başında Balıkçı Rıfat olta satar. Batı ve doğu yollarının sonunda da birer iskele var." },
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
