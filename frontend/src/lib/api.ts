import { clearSession, getToken } from "./auth";
import type { ActivityRecord, AuthUser, ClassProgressRecord, Feedback, LearningModule, Section, SectionSummary } from "../types/domain";

const API_URL = import.meta.env?.VITE_API_URL || "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  // A response from an old session must not log out or populate a new one.
  if (token !== getToken()) throw new ApiError(409, "Session changed. Please try again.");
  if (!response.ok) {
    if (response.status === 401 && token) clearSession(true);
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error || `API request failed: ${response.status}`);
  }

  const body = await response.json() as T;
  if (token !== getToken()) throw new ApiError(409, "Session changed. Please try again.");
  return body;
}

export function fetchModules() {
  return request<LearningModule[]>("/modules");
}

export function syncRecords(records: ActivityRecord[]) {
  return request<{ records: ActivityRecord[] }>("/sync", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}

export function fetchMyRecords() {
  return request<{ records: ActivityRecord[]; feedback: Feedback[] }>("/sync/mine");
}

export function fetchMyAccount() {
  return request<{ user: AuthUser }>("/auth/me");
}

export function login(username: string, password: string) {
  return request<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function registerTeacher(username: string, password: string, name: string) {
  return request<{ token: string; user: AuthUser }>("/auth/register-teacher", {
    method: "POST",
    body: JSON.stringify({ username, password, name }),
  });
}

export function fetchClassProgress() {
  return request<{ students: AuthUser[]; records: ClassProgressRecord[] }>("/auth/class-progress");
}

export function createSection(name: string) {
  return request<{ section: Section }>("/sections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function listSections() {
  return request<{ sections: SectionSummary[] }>("/sections");
}

export function getSection(sectionId: string) {
  return request<{ section: Section; students: AuthUser[]; records: ClassProgressRecord[]; feedback: Feedback[] }>(`/sections/${sectionId}`);
}

export function createSectionStudent(sectionId: string, username: string, password: string, name: string) {
  return request<{ user: AuthUser }>(`/sections/${sectionId}/students`, {
    method: "POST",
    body: JSON.stringify({ username, password, name }),
  });
}

export function setStudentPassword(sectionId: string, studentId: string, password: string) {
  return request<{ ok: true }>(`/sections/${sectionId}/students/${studentId}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function resetStudentProgress(studentId: string, moduleId?: string) {
  return request<{ deleted: number }>(`/auth/students/${studentId}/reset-progress`, {
    method: "POST",
    body: JSON.stringify(moduleId ? { moduleId } : {}),
  });
}

export function submitFeedback(sectionId: string, studentId: string, moduleId: string, score: number | null, comment: string) {
  return request<{ feedback: Feedback }>(`/sections/${sectionId}/students/${studentId}/modules/${moduleId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ score, comment }),
  });
}
