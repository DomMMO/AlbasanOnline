import { classOf, type LeaderboardEntry, type PvpKillEvent } from "../../../shared/src";

// PvP UI: kill feed, your own rating line, and the leaderboard window (L).

const $ = (id: string) => document.getElementById(id)!;
const feed = $("killfeed");
const stats = $("pvp-stats");
const board = $("leaderboard");
const boardBody = $("leaderboard-body");
let initialised = false;

const nameSpan = (name: string, cls: string) => {
  const span = document.createElement("span");
  span.textContent = name;
  span.style.color = classOf(cls).color;
  return span;
};

export function addKillFeed(event: PvpKillEvent, myName: string) {
  const line = document.createElement("div");
  line.className = `kill${event.killer === myName ? " mine" : event.victim === myName ? " died" : ""}`;
  line.append(nameSpan(event.killer, event.killerClass), " ⚔ ", nameSpan(event.victim, event.victimClass));
  if (event.ratingGain > 0) line.append(Object.assign(document.createElement("small"), { textContent: ` +${event.ratingGain}` }));
  if (event.streak >= 3) line.append(Object.assign(document.createElement("b"), { textContent: ` ${event.streak} seri!` }));
  feed.prepend(line);
  while (feed.children.length > 5) feed.lastElementChild!.remove();
  setTimeout(() => line.remove(), 8000);
}

/** Your rating and K/D, shown while in a PvP zone (null hides it). */
export function setPvpStats(data: { rating: number; kills: number; deaths: number } | null) {
  stats.hidden = data === null;
  if (data) stats.textContent = `PvP puanı ${data.rating} · ${data.kills} öldürme / ${data.deaths} ölüm`;
}

export function initLeaderboard() {
  if (initialised) return;
  initialised = true;
  $("leaderboard-close").addEventListener("click", () => toggleLeaderboard(false));
}

export async function toggleLeaderboard(open = board.hidden) {
  board.hidden = !open;
  if (!open) return;
  boardBody.innerHTML = `<tr><td colspan="6" class="muted">Yükleniyor…</td></tr>`;
  try {
    const entries: LeaderboardEntry[] = await (await fetch("/api/leaderboard")).json();
    if (entries.length === 0) {
      boardBody.innerHTML = `<tr><td colspan="6" class="muted">Henüz kimse arenada dövüşmedi.</td></tr>`;
      return;
    }
    boardBody.replaceChildren(
      ...entries.map((entry, index) => {
        const row = document.createElement("tr");
        const cells = [String(index + 1), "", `${classOf(entry.class).name} ${entry.level}`, String(entry.rating), String(entry.kills), String(entry.deaths)];
        cells.forEach((text, i) => {
          const td = document.createElement("td");
          if (i === 1) {
            td.append(nameSpan(entry.name, entry.class));
            if (entry.online) td.append(Object.assign(document.createElement("span"), { className: "online-dot", title: "Çevrimiçi" }));
          } else td.textContent = text;
          row.append(td);
        });
        return row;
      }),
    );
  } catch {
    boardBody.innerHTML = `<tr><td colspan="6" class="muted">Sıralama alınamadı.</td></tr>`;
  }
}

export function isLeaderboardOpen() {
  return !board.hidden;
}
