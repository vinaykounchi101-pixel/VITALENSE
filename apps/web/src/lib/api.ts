/**
 * VitalSense Web API Client.
 *
 * Implements browser cookie authentication, CSRF double-submit header injection,
 * and typed communication with the FastAPI modular monolith matching OpenAPI contracts.
 */

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  // In Web environment, inject X-CSRF-Token for state-changing calls
  const csrfToken = getCookie("vitalsense_csrf_token");
  if (
    csrfToken &&
    options.method &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(options.method.toUpperCase())
  ) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  // Ensure Content-Type is set for JSON payloads (unless FormData)
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "include", // Transmit HttpOnly authentication cookies
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/auth")
    ) {
      window.location.href = "/auth";
    }

    let errorMsg = data.detail || data.error?.message;
    if (data.error?.details && Array.isArray(data.error.details) && data.error.details.length > 0) {
      const detailsList = data.error.details
        .map((d: any) => (d.field ? `${d.field}: ${d.issue}` : d.issue || JSON.stringify(d)))
        .join("; ");
      errorMsg = `${errorMsg || "Validation Error"} (${detailsList})`;
    }
    if (!errorMsg) {
      errorMsg = `Request failed with status ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  return (data.data !== undefined ? data.data : data) as T;
}

// -----------------------------------------------------------------------------
// Canonical Domain & API Contract Types
// -----------------------------------------------------------------------------

export interface MetricSummary {
  metric_name: string;
  latest_value: number | null;
  latest_timestamp: string | null;
  unit: string;
  rolling_7d_avg: number | null;
  change_from_baseline_pct: number | null;
  status: string;
  trend: string;
}

export interface DashboardSummary {
  person_id: string;
  generated_at: string;
  metrics: Record<string, MetricSummary>;
  recovery_score: number | null;
  data_quality_score: number;
  days_tracked: number;
}

export interface DailyBriefing {
  person_id: string;
  insight_date: string;
  headline: string;
  summary_text: string;
  recovery_score: number | null;
  key_metrics: Record<string, any>;
  recommendations: string[];
  provider: string;
  disclaimer: string;
  generated_at: string;
}

export interface TrendDataPoint {
  bucket_time: string;
  value: number;
  min_value?: number;
  max_value?: number;
  rolling_avg?: number;
}

export interface MetricTrend {
  metric_name: string;
  canonical_unit: string;
  period: string;
  baseline_mean?: number;
  baseline_std?: number;
  data_points: TrendDataPoint[];
}

export interface ForecastPoint {
  date: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  confidence_level: number;
}

export interface HealthForecast {
  metric_name: string;
  unit: string;
  forecast_days: number;
  history_days_used: number;
  has_sufficient_history: boolean;
  model_type: string;
  trend_direction: string;
  trend_slope_per_day: number;
  anomalies_detected: number;
  projections: ForecastPoint[];
  disclaimer: string;
}

export interface PersonProfile {
  id: string;
  user_account_id: string;
  display_name: string;
  relationship_type: string;
  is_primary: boolean;
  created_at: string;
}

export interface ObservationItem {
  metric_name: string;
  value: number;
  unit: string;
  measured_at: string;
  end_timestamp?: string | null;
  source_timezone?: string;
  origin?: "device_sync" | "user_entered" | "calculated" | "imported";
  correction_state?: "original" | "corrected" | "superseded";
  supersedes_record_id?: string | null;
  device_record_id?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, any> | null;
}

export interface TombstoneItem {
  target_record_id: string;
  record_type?: string;
  deleted_at: string;
  device_record_id?: string | null;
}

export interface BatchSyncRequest {
  device_id: string;
  last_sync_timestamp?: string | null;
  observations?: ObservationItem[];
  tombstones?: TombstoneItem[];
}

export interface BatchSyncResponse {
  server_timestamp: string;
  processed_count: number;
  duplicate_count: number;
  tombstones_processed: number;
  next_sync_cursor: string;
  server_observations: any[];
}

export interface MedicalRecordDTO {
  id: string;
  person_id: string;
  record_type: string;
  title: string;
  provider_name?: string | null;
  record_date: string;
  document_metadata?: Record<string, any>;
  clinical_notes?: string | null;
  disclaimer?: string;
  created_at: string;
  // Lenient fallback compatibility fields
  description?: string | null;
  recorded_at?: string;
  metadata_json?: Record<string, any> | null;
}

export interface CreateMedicalRecordRequest {
  record_type: string;
  title: string;
  provider_name?: string | null;
  record_date: string;
  document_metadata?: Record<string, any>;
  clinical_notes?: string | null;
  // Lenient fallback compatibility fields
  description?: string | null;
  recorded_at?: string;
  metadata_json?: Record<string, any> | null;
}

export interface MedicalRecordListResponse {
  records: MedicalRecordDTO[];
  total_count: number;
}

export interface ExerciseSet {
  set_number: number;
  reps: number;
  weight_kg?: number | null;
  rpe?: number | null;
}

export interface ExerciseDetail {
  exercise_name: string;
  target_muscle: string;
  sets?: ExerciseSet[];
}

export interface CreateWorkoutRequest {
  workout_type: string;
  duration_minutes: number;
  measured_at?: string | null;
  exercises?: ExerciseDetail[];
  muscle_groups?: string[];
  notes?: string | null;
}

export interface WorkoutDTO {
  id: string;
  person_id: string;
  workout_type: string;
  duration_minutes: number;
  exercises: Record<string, any>[];
  muscle_groups: string[];
  total_volume_kg?: number | null;
  created_at: string;
}

export interface WorkoutListResponse {
  workouts: WorkoutDTO[];
  total_count: number;
}

export interface UploadResponse {
  import_id: string;
  status: string;
  filename: string;
  platform: string;
  total_records: number;
  imported_records: number;
  rejected_records: number;
  // Lenient compatibility fields
  format_detected?: string;
  records_parsed?: number;
  records_ingested?: number;
  duplicates_suppressed?: number;
}

export interface WebAuthResponse {
  user_account_id: string;
  person_id: string;
  token_type: string;
  expires_in: number;
  // Lenient compatibility fields
  user_id?: string;
  email?: string;
  display_name?: string | null;
}

export interface UserProfileDTO {
  user_account_id: string;
  email: string;
  person_id: string;
  display_name: string | null;
  role: string;
  created_at: string;
  // Lenient fallback fields
  id?: string;
  status?: string;
  persons?: PersonProfile[];
}

export interface SessionDTO {
  family_id: string;
  device_id?: string | null;
  device_name?: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  // Lenient fallback fields
  id?: string;
  device_info?: string | null;
  ip_address?: string | null;
  is_current?: boolean;
}

// -----------------------------------------------------------------------------
// Web API Client
// -----------------------------------------------------------------------------

export const api = {
  auth: {
    login: (credentials: {
      email: string;
      password: string;
      remember_me?: boolean;
      device_id?: string;
      device_name?: string;
    }) => {
      const { remember_me, ...payload } = credentials;
      return apiRequest<WebAuthResponse>("/api/v1/web/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    register: (data: { email: string; password: string; display_name?: string }) =>
      apiRequest<WebAuthResponse>("/api/v1/web/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    logout: () =>
      apiRequest("/api/v1/web/auth/logout", {
        method: "POST",
      }),
    me: () => apiRequest<UserProfileDTO>("/api/v1/web/auth/me"),
    refresh: () =>
      apiRequest<WebAuthResponse>("/api/v1/web/auth/refresh", {
        method: "POST",
      }),
    requestReset: (email: string) =>
      apiRequest("/api/v1/web/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    confirmReset: (data: { token: string; new_password: string }) =>
      apiRequest("/api/v1/web/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getSessions: () => apiRequest<SessionDTO[]>("/api/v1/web/auth/sessions"),
    revokeSession: (familyId: string) =>
      apiRequest("/api/v1/web/auth/sessions/revoke", {
        method: "POST",
        body: JSON.stringify({ family_id: familyId }),
      }),
  },
  analytics: {
    getDashboardSummary: () =>
      apiRequest<DashboardSummary>("/api/v1/web/analytics/dashboard-summary"),
    getTrends: (metricName: string, days: number = 30) =>
      apiRequest<MetricTrend>(`/api/v1/web/analytics/trends/${metricName}?period_days=${days}`),
  },
  intelligence: {
    getDailyBriefing: () =>
      apiRequest<DailyBriefing>("/api/v1/web/intelligence/daily-briefing"),
    getForecast: (metricName: string, days: number = 7) =>
      apiRequest<HealthForecast>(
        `/api/v1/web/intelligence/forecast/${metricName}?forecast_days=${days}`
      ),
  },
  sync: {
    syncBatch: (batch: BatchSyncRequest) =>
      apiRequest<BatchSyncResponse>("/api/v1/web/sync", {
        method: "POST",
        body: JSON.stringify(batch),
      }),
    fullResync: (batch: BatchSyncRequest) =>
      apiRequest<BatchSyncResponse>("/api/v1/web/sync/full-resync", {
        method: "POST",
        body: JSON.stringify(batch),
      }),
  },
  integrations: {
    uploadFile: (formData: FormData) =>
      apiRequest<UploadResponse>("/api/v1/web/integrations/upload", {
        method: "POST",
        body: formData,
      }),
  },
  medical: {
    listRecords: () =>
      apiRequest<MedicalRecordListResponse>("/api/v1/web/medical/records"),
    createRecord: (record: CreateMedicalRecordRequest) =>
      apiRequest<MedicalRecordDTO>("/api/v1/web/medical/records", {
        method: "POST",
        body: JSON.stringify(record),
      }),
  },
  fitness: {
    logWorkout: (workout: CreateWorkoutRequest) =>
      apiRequest<WorkoutDTO>("/api/v1/web/fitness/workouts", {
        method: "POST",
        body: JSON.stringify(workout),
      }),
    listWorkouts: () =>
      apiRequest<WorkoutListResponse>("/api/v1/web/fitness/workouts"),
  },
  family: {
    listProfiles: () =>
      apiRequest<{ profiles: PersonProfile[] }>("/api/v1/web/family/profiles"),
    createProfile: (profile: { display_name: string; relationship_type: string }) =>
      apiRequest<PersonProfile>("/api/v1/web/family/profiles", {
        method: "POST",
        body: JSON.stringify(profile),
      }),
  },
  privacy: {
    exportData: () => apiRequest("/api/v1/web/privacy/export"),
    deleteAccount: (password: string) =>
      apiRequest("/api/v1/web/privacy/delete-account", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
  },
};

