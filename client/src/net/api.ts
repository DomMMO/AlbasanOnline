import type { AuthResponse, CharacterSummary } from "../../../shared/src";

// REST calls for accounts and characters. In dev, Vite proxies /api to the game server.

const TOKEN_KEY = "mmo.token";

let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  // Storage unavailable (private mode): the player just logs in every time.
}

export function getToken() {
  return token;
}

function setToken(value: string | null) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // See above.
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Sunucuya bağlanılamadı. Sunucu çalışıyor mu?", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) setToken(null);
    throw new ApiError(data.error ?? `Beklenmeyen hata (${response.status})`, response.status);
  }
  return data as T;
}

export const api = {
  async register(username: string, password: string) {
    const result = await request<AuthResponse>("POST", "/register", { username, password });
    setToken(result.token);
    return result;
  },
  async login(username: string, password: string) {
    const result = await request<AuthResponse>("POST", "/login", { username, password });
    setToken(result.token);
    return result;
  },
  async logout() {
    await request("POST", "/logout").catch(() => {});
    setToken(null);
  },
  me: () => request<{ username: string; isAdmin: boolean }>("GET", "/me"),
  listCharacters: () => request<CharacterSummary[]>("GET", "/characters"),
  createCharacter: (name: string, classId: string) => request<CharacterSummary>("POST", "/characters", { name, classId }),
};
