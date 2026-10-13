import { skillIconUrl } from "../gfx/skillIcons";
import { inventoryState } from "./inventory";
import { hideSkillTooltip, showSkillTooltip } from "./skillTooltip";
import { SKILL_DRAG_TYPE } from "./hud";
import {
  classOf,
  classPassives,
  PASSIVE_MAX_RANK,
  SKILL_CATEGORY_NAMES,
  SKILL_MAX_RANK,
  SKILL_RANK_BONUS,
  SKILLS,
  type SkillDef,
  type SkillRanksEvent,
  type LifeSkillsEvent,
  LIFE_SKILL_IDS,
  LIFE_SKILLS,
} from "../../../shared/src";

// Skills window (K): the class's active skills and passives with their ranks. + spends a
// skill point, − takes one back. The server checks everything. Two columns so the whole
// page fits without scrolling; the long descriptions live in the hover tooltip.

export interface SkillsActions {
  change(id: string, delta: 1 | -1): void;
  playerLevel(): number;
  playerClass(): string;
}

const $ = (id: string) => document.getElementById(id)!;
const windowEl = $("skills-window");
const bodyEl = $("skills-body");
const pointsEl = $("skills-points");

let actions: SkillsActions;
let state: SkillRanksEvent = { ranks: {}, points: 0 };
let initialised = false;

export function initSkills(skillActions: SkillsActions) {
  actions = skillActions;
  if (initialised) return;
  initialised = true;
  $("skills-close").addEventListener("click", () => toggleSkills(false));
}

/** Madencilik and Botanik levels (Meslekler section). */
let lifeSkills: LifeSkillsEvent["skills"] = {};

export function setLifeSkills(event: LifeSkillsEvent) {
  lifeSkills = event.skills;
  if (!windowEl.hidden) render();
}

function lifeSkillRows(): HTMLElement[] {
  return LIFE_SKILL_IDS.map((id) => {
    const info = LIFE_SKILLS[id];
    const progress = lifeSkills[id] ?? { level: 1, xp: 0, next: 1 };
    const row = document.createElement("div");
    row.className = "life-row";
    const name = Object.assign(document.createElement("span"), { className: "life-name", textContent: `${info.name}` });
    const level = Object.assign(document.createElement("span"), { className: "life-level", textContent: `Sv ${progress.level}` });
    const bar = document.createElement("div");
    bar.className = "life-bar";
    bar.style.setProperty("--fill", progress.next > 0 ? `${(progress.xp / progress.next) * 100}%` : "100%");
    bar.style.setProperty("--color", info.color);
    bar.title = progress.next > 0 ? `${progress.xp} / ${progress.next}` : "Ustalık";
    row.append(name, level, bar);
    return row;
  });
}

export function setSkillRanks(event: SkillRanksEvent) {
  state = event;
  if (!windowEl.hidden) render();
}

export function skillRank(id: string): number {
  return state.ranks[id] ?? 0;
}

function row(opts: {
  id: string;
  badge?: { icon: string; color: string; skill: SkillDef };
  name: string;
  tag: string;
  description: string;
  detail: string;
  rank: number;
  max: number;
  level: number;
}): HTMLElement {
  const level = actions.playerLevel();
  const locked = level < opts.level;
  const el = document.createElement("div");
  el.className = `skill-row${locked ? " locked" : ""}${opts.rank > 0 ? " learned" : ""}`;

  const badge = document.createElement("span");
  badge.className = "skill-badge";
  if (opts.badge) {
    const skill = opts.badge.skill;
    badge.append(Object.assign(document.createElement("img"), { src: opts.badge.icon, alt: skill.name, draggable: false }));
    badge.style.setProperty("--skill-color", opts.badge.color);
    // Drag the icon onto a hotbar slot.
    badge.draggable = true;
    badge.title = "Hotbar'a sürükle";
    badge.addEventListener("dragstart", (event) => {
      event.dataTransfer!.setData(SKILL_DRAG_TYPE, JSON.stringify({ skillId: skill.id }));
      event.dataTransfer!.effectAllowed = "copy";
      hideSkillTooltip();
    });
    // The whole row shows the detailed panel.
    el.addEventListener("mouseenter", () =>
      showSkillTooltip(skill, { rank: opts.rank, playerLevel: level, playerClass: actions.playerClass(), stats: inventoryState()?.stats }, badge),
    );
    el.addEventListener("mouseleave", hideSkillTooltip);
  } else {
    badge.classList.add("passive");
    badge.textContent = "✦";
    el.title = `${opts.name}
${opts.description}
${opts.detail}`;
  }

  const text = document.createElement("div");
  text.className = "skill-text";
  const title = document.createElement("div");
  title.className = "skill-title";
  title.innerHTML = `<b></b> <span class="skill-tag"></span>`;
  title.querySelector("b")!.textContent = opts.name;
  title.querySelector(".skill-tag")!.textContent = locked ? `${opts.tag} · Sv ${opts.level}` : opts.tag;
  const desc = document.createElement("div");
  desc.className = "skill-desc";
  desc.textContent = opts.description;
  const detail = document.createElement("div");
  detail.className = "skill-detail";
  detail.textContent = opts.detail;
  text.append(title, desc, detail);

  const controls = document.createElement("div");
  controls.className = "skill-controls";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.tabIndex = -1;
  minus.textContent = "−";
  minus.disabled = opts.rank === 0;
  minus.addEventListener("click", () => actions.change(opts.id, -1));
  const rank = document.createElement("span");
  rank.className = "skill-rank";
  rank.textContent = `${opts.rank}/${opts.max}`;
  const plus = document.createElement("button");
  plus.type = "button";
  plus.tabIndex = -1;
  plus.textContent = "+";
  plus.disabled = locked || opts.rank >= opts.max || state.points <= 0;
  plus.addEventListener("click", () => actions.change(opts.id, 1));
  controls.append(minus, rank, plus);

  el.append(badge, text, controls);
  return el;
}

function render() {
  const cls = actions.playerClass();
  pointsEl.textContent = `Boş puan: ${state.points}`;
  const section = (title: string) => Object.assign(document.createElement("h3"), { className: "skills-section", textContent: title });

  const active = classOf(cls).skills.map((id) => {
    const skill = SKILLS[id];
    const rank = skillRank(id);
    const bonus = rank > 1 ? ` · +%${SKILL_RANK_BONUS * (rank - 1)} etki` : "";
    const cost = skill.cost ? `${skill.cost} ${{ rage: "öfke", mana: "mana", energy: "enerji" }[classOf(cls).resource]}` : "bedelsiz";
    const cooldown = skill.cooldownMs ? ` · ${skill.cooldownMs / 1000} sn bekleme` : "";
    return row({
      id,
      badge: { icon: skillIconUrl(skill), color: skill.color, skill },
      name: skill.name,
      tag: SKILL_CATEGORY_NAMES[skill.category],
      description: skill.description,
      detail: `${rank === 0 ? "Öğrenilmedi" : `Derece ${rank}${bonus}`} · ${cost}${cooldown} · her derece +%${SKILL_RANK_BONUS}`,
      rank,
      max: SKILL_MAX_RANK,
      level: skill.level,
    });
  });
  const passives = classPassives(cls).map((p) => {
    const rank = skillRank(p.id);
    return row({
      id: p.id,
      name: p.name,
      tag: "Pasif",
      description: p.description,
      detail: rank === 0 ? "Puan verilmedi" : `Şu an: derece ${rank}`,
      rank,
      max: PASSIVE_MAX_RANK,
      level: p.level,
    });
  });
  const lifeHint = Object.assign(document.createElement("p"), {
    className: "muted life-hint",
    textContent: "Maden damarlarına ve bitkilere tıklayarak toplanır. Kazma ve orak Zanaatkâr Murat'tan (şehir) alınır.",
  });
  const wrap = (rows: HTMLElement[]) => {
    const el = document.createElement("div");
    el.className = "skills-grid";
    el.append(...rows);
    return el;
  };
  bodyEl.replaceChildren(section("Aktif Yetenekler"), wrap(active), section("Pasif Yetenekler"), wrap(passives), section("Meslekler"), wrap(lifeSkillRows()), lifeHint);
}

export function toggleSkills(open = windowEl.hidden) {
  windowEl.hidden = !open;
  if (open) render();
  else hideSkillTooltip();
}
