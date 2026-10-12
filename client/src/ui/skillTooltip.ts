import {
  classOf,
  SKILL_CATEGORY_NAMES,
  SKILL_MAX_RANK,
  SKILL_RANK_BONUS,
  skillPower,
  TILE_SIZE,
  type CombatStats,
  type SkillDef,
} from "../../../shared/src";
import { skillIconUrl } from "../gfx/skillIcons";

// Detailed skill panel (hotbar and Yetenekler page), in the same wooden frame as item
// tooltips: what the skill does with real numbers worked out from the character's current
// attack (equipment, jewels, ranks and buffs from Zeka included), its cost, cooldown, cast
// time, range, rank and what the next rank adds.

const tooltip = document.getElementById("tooltip")!;

export interface SkillTooltipContext {
  rank: number;
  playerLevel: number;
  playerClass: string;
  /** Current stats (attack, skill bonuses); without them only multipliers are shown. */
  stats?: CombatStats;
  footer?: string;
}

const pct = (n: number) => `%${Math.round(n * 100)}`;
const sec = (ms: number) => `${(ms / 1000).toLocaleString("tr-TR")} sn`;
const tiles = (px: number) => `${(px / TILE_SIZE).toLocaleString("tr-TR")} kare`;

/** What the skill does, in sentences, with numbers when the stats are known. */
function effectLines(skill: SkillDef, ctx: SkillTooltipContext): string[] {
  const e = skill.effect;
  const power = ctx.stats ? skillPower(ctx.stats, skill.id) : 1;
  const attack = ctx.stats ? ctx.stats.attack * power : undefined;
  const dmg = (mult: number, bonus = 0) =>
    attack !== undefined ? ` (≈ ${Math.round(attack * mult + bonus * power)})` : "";
  const hit = (mult: number, bonus = 0) => `saldırı gücünün ${pct(mult)}'i${bonus ? ` + ${bonus}` : ""} kadar hasar${dmg(mult, bonus)}`;

  switch (e.type) {
    case "strike":
      return [`Hedefe ${hit(e.multiplier, e.bonus)} vurur.`];
    case "whirlwind":
      return [`Etrafındaki ${tiles(e.radius)} içindeki bütün düşmanlara ${hit(e.multiplier)} vurur.`];
    case "heal":
      return [`Anında en yüksek canının ${pct(e.percent * power)}'ini yeniler.`];
    case "nova":
      return [
        `Etrafındaki ${tiles(e.radius)} içindeki bütün düşmanlara ${hit(e.multiplier)} vurur.`,
        `Vurduklarını ${sec(e.rootMs)} dondurur: yerlerinden kıpırdayamazlar (saldırabilirler). Boss'lar etkilenmez; oyuncularda süre yarıya iner.`,
      ];
    case "healTarget":
      return [`Seçili dost oyuncuyu (yoksa kendini) saldırı gücünün ${pct(e.multiplier)}'i + ${e.bonus} kadar iyileştirir${dmg(e.multiplier, e.bonus)}.`];
    case "shield":
      return [`Seçili dost oyuncuya (yoksa kendine) ${sec(e.durationMs)} boyunca saldırı gücünün ${pct(e.multiplier)}'i + ${e.bonus} kadar hasarı emen bir kalkan verir${dmg(e.multiplier, e.bonus)}.`];
    case "drain":
      return [`Hedefe ${hit(e.multiplier, e.bonus)} vurur ve verdiği hasarın ${pct(e.healFraction)}'i kadar seni iyileştirir.`];
    case "summon": {
      const count = ctx.stats?.minionCount ?? 1;
      return [
        `${sec(e.durationMs)} kalan ${count > 1 ? `${count} ${e.name}` : `bir ${e.name}`} çağırır. Senin saldırdığın hedefe, yoksa sana saldırana koşar.`,
        `Her ${sec(e.swingMs)}'de ${hit(e.multiplier * (1 + (ctx.stats?.minionDamage ?? 0)))} vurur. Yaratıklar iskeletlere saldırmaz; sen ölünce ya da bölge değiştirince dağılırlar.`,
      ];
    }
    case "guard":
      return [`${sec(e.durationMs)} boyunca aldığın bütün hasar ${pct(e.reduction)} azalır.`];
    case "stun":
      return [
        `Hedefe ${hit(e.multiplier, e.bonus)} vurur ve ${sec(e.stunMs)} sersemletir: ne yürüyebilir ne saldırabilir.`,
        "Boss'lar sersemlemez; oyunculara (PvP, düello) süre yarıya iner.",
      ];
    case "blast":
      return [`Hedefin ${tiles(e.radius)} çevresindeki bütün düşmanlara ${hit(e.multiplier)} vurur.`];
    case "radiance":
      return [
        `Etrafındaki ${tiles(e.radius)} içindeki bütün düşmanlara ${hit(e.multiplier)} vurur.`,
        `Aynı alandaki seni ve grup arkadaşlarını saldırı gücünün ${pct(e.healMultiplier)}'i kadar iyileştirir${dmg(e.healMultiplier)}.`,
      ];
    case "dash": {
      const lines = [
        e.mode === "forward"
          ? `Baktığın yöne anında ${tiles(e.distance)} ilerlersin; duvarlar seni durdurur.`
          : e.mode === "behindTarget"
            ? `En çok ${tiles(e.distance)} uzaktaki hedefin arkasında belirirsin.`
            : `En çok ${tiles(e.distance)} uzaktaki hedefin yanına atılırsın.`,
      ];
      if (e.landRadius && e.multiplier) lines.push(`İndiğin yerin ${tiles(e.landRadius)} çevresindeki bütün düşmanlara ${hit(e.multiplier)} vurursun.`);
      else if (e.multiplier) lines.push(`Hedefe ${hit(e.multiplier)} vurursun.`);
      if (e.stunMs) lines.push(`Çarptığın hedef ${sec(e.stunMs)} sersemler (boss'lar hariç).`);
      if (e.healPercent) lines.push(`Canının ${pct(e.healPercent * power)}'i yenilenir.`);
      if (e.shieldPercent) lines.push(`Canının ${pct(e.shieldPercent * power)}'i kadar hasar emen bir kalkan kazanırsın.`);
      return lines;
    }
    case "buff": {
      const parts: string[] = [];
      if (e.attackPct) parts.push(`verdiğin hasar ve iyileştirme ${pct(e.attackPct * power)} artar`);
      if (e.speedPct) parts.push(`${pct(e.speedPct * power)} daha hızlı saldırırsın`);
      if (e.reductionPct) parts.push(`aldığın hasar ${pct(e.reductionPct)} azalır`);
      const lines = [`${sec(e.durationMs)} boyunca ${parts.join(", ")}.`];
      if (e.partyRadius) lines.push(`${tiles(e.partyRadius)} içindeki grup arkadaşların da aynı gücü kazanır.`);
      if (e.hpCostPercent) lines.push(`Bedeli: kullanınca canının ${pct(e.hpCostPercent)}'ini kaybedersin.`);
      return lines;
    }
  }
}

function el(text: string, className = "", color?: string) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  if (color) div.style.color = color;
  return div;
}

export function showSkillTooltip(skill: SkillDef, ctx: SkillTooltipContext, anchor: HTMLElement) {
  const resource = classOf(ctx.playerClass).resource;
  const resourceName = { rage: "öfke", mana: "mana", energy: "enerji" }[resource];
  const locked = ctx.playerLevel < skill.level;

  const head = document.createElement("div");
  head.className = "tt-skill-head";
  const icon = document.createElement("img");
  icon.src = skillIconUrl(skill);
  const titles = document.createElement("div");
  titles.append(el(skill.name, "tt-title", skill.color), el(`${SKILL_CATEGORY_NAMES[skill.category]} · ${ctx.rank > 0 ? `Derece ${ctx.rank}/${SKILL_MAX_RANK}` : "Öğrenilmedi"}`, "tt-muted"));
  head.append(icon, titles);

  const facts = [
    skill.cost ? `${skill.cost} ${resourceName}` : "Bedelsiz",
    skill.castMs ? `${sec(skill.castMs)} büyü (yürürsen bozulur)` : "Anında",
    skill.cooldownMs ? `${sec(skill.cooldownMs)} bekleme` : "Bekleme yok",
    skill.target === "enemy" ? (skill.range <= TILE_SIZE * 2 ? "Yakın dövüş" : `Menzil ${tiles(skill.range)}`) : skill.target === "friendly" ? `Dost hedef, ${tiles(skill.range)}` : "Hedef gerekmez",
  ];

  const lines: HTMLElement[] = [head, el(facts.join(" · "), "tt-facts")];
  lines.push(el(skill.description, "tt-desc"));
  for (const text of effectLines(skill, ctx)) lines.push(el(text, "tt-effect"));
  if (ctx.rank > 1) lines.push(el(`Dereceler: etkisi +${pct(((ctx.rank - 1) * SKILL_RANK_BONUS) / 100)} (hesaba katıldı)`, "tt-affix"));
  if (ctx.rank < SKILL_MAX_RANK) lines.push(el(`Sonraki derece: +%${SKILL_RANK_BONUS} etki (1 yetenek puanı)`, "tt-muted"));
  if (locked) lines.push(el(`Seviye ${skill.level} gerekli`, "", "#ff5a5a"));
  else if (ctx.rank === 0) lines.push(el("Kullanmak için Yetenekler (K) sayfasından puan ver.", "", "#ffb347"));
  if (ctx.footer) lines.push(el(ctx.footer, "tt-muted"));

  tooltip.replaceChildren(...lines);
  tooltip.classList.add("skill");
  tooltip.hidden = false;

  // Above the anchor when it sits low on the screen (the hotbar), otherwise beside it.
  const rect = anchor.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  let left: number;
  let top: number;
  if (rect.top > window.innerHeight / 2) {
    left = rect.left + rect.width / 2 - tip.width / 2;
    top = rect.top - tip.height - 8;
  } else {
    left = rect.left - tip.width - 8;
    if (left < 8) left = rect.right + 8;
    top = rect.top;
  }
  tooltip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - tip.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(top, window.innerHeight - tip.height - 8))}px`;
}

export function hideSkillTooltip() {
  tooltip.hidden = true;
  tooltip.classList.remove("skill");
}
