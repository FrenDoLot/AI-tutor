import type {
  AdminCreateUserResponse,
  AdminLimits,
  AdminUser,
  AuthResponse,
  Chat,
  User,
  UserSettings
} from "../types";

const TOKEN_KEY = "ai_tutor_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // Keep the generic status message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function loginUser(email: string, password: string) {
  const response = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  setToken(response.token);
  return response.user;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await request<AuthResponse>("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  setToken(response.token);
  return response.user;
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; resetToken?: string }> {
  return request<{ ok: boolean; resetToken?: string }>("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword })
  });
}

export async function logoutUser() {
  try {
    await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export async function getCurrentUser(): Promise<User> {
  return request<User>("/api/me");
}

export async function updateSettings(settings: UserSettings): Promise<UserSettings> {
  return request<UserSettings>("/api/me/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
}

export async function updateProfile(name: string, avatar: string | null): Promise<User> {
  return request<User>("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, avatar })
  });
}

export async function clearHistory(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/me/history", {
    method: "DELETE"
  });
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>("/api/admin/users");
}

export async function getAdminLimits(): Promise<AdminLimits> {
  return request<AdminLimits>("/api/admin/limits");
}

export async function updateAdminLimits(
  dailyMessageLimit: number,
  warningAfterMessages: number
): Promise<AdminLimits> {
  return request<AdminLimits>("/api/admin/limits", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dailyMessageLimit, warningAfterMessages })
  });
}

export async function adminCreateUser(
  name: string,
  email: string,
  plan: string,
  subscriptionDuration: string
): Promise<AdminCreateUserResponse> {
  return request<AdminCreateUserResponse>("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, plan, subscriptionDuration })
  });
}

export async function adminExtendSubscription(
  userId: string,
  subscriptionDuration: string
): Promise<AdminUser> {
  return request<AdminUser>(`/api/admin/users/${userId}/extend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriptionDuration })
  });
}

export async function getChats(): Promise<Chat[]> {
  return request<Chat[]>("/api/chats");
}

export async function createChat(): Promise<Chat> {
  return request<Chat>("/api/chats", { method: "POST" });
}

export async function sendMessage(
  chatId: string,
  content: string,
  files: File[]
): Promise<Chat> {
  const form = new FormData();
  form.append("content", content);
  files.forEach((file) => form.append("files", file));

  return request<Chat>(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: form
  });
}
