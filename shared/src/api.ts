// HTTP API contract (accounts and characters) plus validation rules both sides apply.

import type { CharacterLook } from "./data/appearance";

export const MAX_CHARACTERS_PER_ACCOUNT = 3;

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  username: string;
}

export interface CharacterSummary {
  id: number;
  name: string;
  class: string;
  level: number;
  /** Zone the character logged out in. */
  zone: string;
  /** Tunic colour. */
  color: number;
  look: CharacterLook;
  /** What they wear, so the character select screen can draw them (item def ids, "" = nothing). */
  gear: { weapon: string; weaponPlus: number; head: string; chest: string; legs: string; feet: string };
  /** Time spent in the world, in seconds. */
  playSeconds: number;
}

export interface CreateCharacterRequest {
  name: string;
  look: CharacterLook;
  /** One of TUNIC_COLORS. */
  color: number;
}

export interface LeaderboardEntry {
  name: string;
  class: string;
  level: number;
  rating: number;
  kills: number;
  deaths: number;
  online: boolean;
}

export interface ApiError {
  error: string;
}

/** Returns an error message, or null when valid. Messages are shown to the player as-is. */
export function validateUsername(username: string): string | null {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return "Kullanıcı adı 3-16 karakter olmalı (harf, rakam, _)";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return "Şifre en az 6 karakter olmalı";
  // bcrypt ignores everything past 72 bytes.
  if (new TextEncoder().encode(password).length > 72) return "Şifre çok uzun";
  return null;
}

export function validateCharacterName(name: string): string | null {
  if (!/^\p{L}{3,16}$/u.test(name)) return "Karakter adı 3-16 harf olmalı (boşluk ve rakam yok)";
  return null;
}
