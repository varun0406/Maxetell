import axios from "axios";
import { clearAuthToken, getAuthToken } from "./auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001",
});

api.interceptors.request.use((config) => {
  const t = getAuthToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const url = String(err.config?.url ?? "");
      if (!url.includes("/auth/login") && !url.includes("/auth/register-first")) {
        clearAuthToken();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
      }
    }
    return Promise.reject(err);
  },
);

export type AuthStatus = { enabled: boolean; can_bootstrap: boolean; has_db_users: boolean };
export type AuthSession = { username: string; role: string };
export type AppUserRow = { id: number; username: string; role: string; created_at: string };

export async function fetchAuthStatus() {
  return (await api.get<AuthStatus>("/auth/status")).data;
}
export async function fetchAuthSession() {
  return (await api.get<AuthSession>("/auth/session")).data;
}
export async function fetchAppUsers() {
  return (await api.get<{ data: AppUserRow[] }>("/auth/users")).data.data;
}
export async function createAppUser(body: { username: string; password: string; role?: string }) {
  return (await api.post<{ data: AppUserRow }>("/auth/users", body)).data.data;
}
export async function deleteAppUser(id: number) {
  await api.delete(`/auth/users/${id}`);
}
export async function registerFirstAdmin(body: { username: string; password: string }) {
  return (await api.post<{ token: string; expires_in: number; username: string; role: "admin" }>("/auth/register-first", body)).data;
}
