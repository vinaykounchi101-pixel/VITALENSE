/**
 * VitalSense Mobile API Gateway Client.
 *
 * Implements Bearer JWT authentication, proactive token rotation,
 * hardware-backed secure storage via SecureTokenStorage, and typed interactions.
 */

import {
  AuthSession,
  SyncBatchPayload,
  SyncBatchResponse,
  DashboardSummary,
  DailyBriefing,
  PersonProfile,
} from "../types";
import { SecureTokenStorage } from "./storage/secureTokens";
import { mobileStorage } from "./storage/sqlcipher";

// Default to local/network gateway; configurable via process.env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000";

class MobileApiClient {
  private currentSession: AuthSession | null = null;

  async getSession(): Promise<AuthSession | null> {
    if (this.currentSession) return this.currentSession;
    this.currentSession = await SecureTokenStorage.getSession();
    if (this.currentSession?.user_account_id) {
      await mobileStorage.initialize(this.currentSession.user_account_id);
    }
    return this.currentSession;
  }

  async setSession(session: AuthSession | null): Promise<void> {
    this.currentSession = session;
    if (session) {
      await SecureTokenStorage.saveSession(session);
      await mobileStorage.initialize(session.user_account_id);
    } else {
      await SecureTokenStorage.clearSession();
      await mobileStorage.close();
    }
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const session = await this.getSession();
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const url = `${API_BASE_URL}${endpoint}`;
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration & automatic rotation
    if (response.status === 401 && session?.refresh_token && !endpoint.includes("/auth/")) {
      const refreshed = await this.refreshToken(session.refresh_token);
      if (refreshed) {
        headers.set("Authorization", `Bearer ${refreshed.access_token}`);
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = data.detail || data.error?.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return (data.data !== undefined ? data.data : data) as T;
  }

  private async refreshToken(refreshToken: string): Promise<AuthSession | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/mobile/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.ok) {
        const body: any = await res.json();
        const newSession: AuthSession = {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          user_account_id: body.user_account_id,
          person_id: body.person_id,
          expires_at: Date.now() + 15 * 60 * 1000,
        };
        await this.setSession(newSession);
        return newSession;
      }
    } catch {
      // Rotation failed; clear session
    }
    await this.setSession(null);
    return null;
  }

  // Authentication
  async login(credentials: { email: string; password: string }): Promise<AuthSession> {
    const res = await this.request("/api/v1/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    const session: AuthSession = {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      user_account_id: res.user_account_id,
      person_id: res.person_id,
      expires_at: Date.now() + 15 * 60 * 1000,
    };
    await this.setSession(session);
    return session;
  }

  async register(data: { email: string; password: string }): Promise<AuthSession> {
    const res = await this.request("/api/v1/mobile/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const session: AuthSession = {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      user_account_id: res.user_account_id,
      person_id: res.person_id,
      expires_at: Date.now() + 15 * 60 * 1000,
    };
    await this.setSession(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/v1/mobile/auth/logout", { method: "POST" });
    } finally {
      await this.setSession(null);
    }
  }

  // Synchronization
  async syncBatch(payload: SyncBatchPayload): Promise<SyncBatchResponse> {
    return this.request<SyncBatchResponse>("/api/v1/mobile/sync/batch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Analytics & Intelligence
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>("/api/v1/mobile/analytics/dashboard-summary");
  }

  async getDailyBriefing(): Promise<DailyBriefing> {
    return this.request<DailyBriefing>("/api/v1/mobile/intelligence/daily-briefing");
  }

  async getForecast(metricName: string, days: number = 7): Promise<any> {
    return this.request(`/api/v1/mobile/intelligence/forecast/${metricName}?forecast_days=${days}`);
  }

  // Fitness
  async logWorkout(workout: any): Promise<any> {
    return this.request("/api/v1/mobile/fitness/workouts", {
      method: "POST",
      body: JSON.stringify(workout),
    });
  }

  // Family Profiles
  async listProfiles(): Promise<{ profiles: PersonProfile[] }> {
    return this.request<{ profiles: PersonProfile[] }>("/api/v1/mobile/family/profiles");
  }

  // Privacy
  async exportData(): Promise<any> {
    return this.request("/api/v1/mobile/privacy/export");
  }

  async deleteAccount(password: string): Promise<void> {
    const current = await this.getSession();
    await this.request("/api/v1/mobile/privacy/delete-account", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (current?.user_account_id) {
      await mobileStorage.purgeAccountData(current.user_account_id);
    }
    await this.setSession(null);
  }
}

export const mobileApi = new MobileApiClient();
