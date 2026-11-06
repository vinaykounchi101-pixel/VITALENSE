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
    const body = {
      device_id: payload.client_sync_token || "mobile_device",
      observations: (payload.records || []).map((r) => ({
        metric_name: r.metric_name,
        value: r.numeric_value,
        unit: r.unit,
        measured_at: r.measured_at,
        device_record_id: r.source_record_id || r.record_id,
        metadata: r.metadata_json,
        supersedes_record_id: r.supersedes_record_id,
      })),
      tombstones: (payload.deletions || []).map((d) => ({
        target_record_id: d.record_id,
        device_record_id: d.source_record_id,
        deleted_at: d.deleted_at,
      })),
    };
    const res = await this.request<any>("/api/v1/mobile/sync", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      server_sync_token: res.next_sync_cursor || String(res.server_timestamp),
      records_accepted: res.processed_count ?? 0,
      records_suppressed: res.duplicate_count ?? 0,
      deletions_applied: res.tombstones_processed ?? 0,
      conflicts_detected: 0,
      new_server_records: (res.server_observations || []).map((o: any) => ({
        record_id: o.id || o.record_id,
        source_name: o.source_name || "server",
        source_record_id: o.device_record_id || o.source_record_id,
        metric_name: o.metric_name,
        numeric_value: o.value ?? o.numeric_value,
        unit: o.unit,
        measured_at: o.measured_at,
        recorded_at: o.recorded_at || o.measured_at,
        metadata_json: o.metadata,
        supersedes_record_id: o.supersedes_record_id,
      })),
    };
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
