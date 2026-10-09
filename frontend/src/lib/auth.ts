import { LoginResponse } from "./api";

export interface User {
  email: string;
  full_name: string;
  role: "applicant" | "officer" | "admin";
}

export function saveSession(data: LoginResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("rop_token", data.access_token);
  localStorage.setItem(
    "rop_user",
    JSON.stringify({
      email: data.email,
      full_name: data.full_name,
      role: data.role,
    })
  );
}

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("rop_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("rop_token");
  localStorage.removeItem("rop_user");
}

export function getDashboardPath(role: string): string {
  switch (role) {
    case "officer":
      return "/officer/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/applicant/dashboard";
  }
}
