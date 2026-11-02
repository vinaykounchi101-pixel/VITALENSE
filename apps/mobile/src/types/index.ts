/**
 * VitalSense Mobile Types & Data Contracts.
 */

export interface HealthMetricRecord {
  record_id: string;
  source_name: string;
  source_record_id: string;
  metric_name: string;
  numeric_value: number;
  unit: string;
  measured_at: string;
  recorded_at: string;
  metadata_json?: Record<string, any>;
  supersedes_record_id?: string | null;
}

export interface SyncTombstoneRecord {
  record_id: string;
  source_name: string;
  source_record_id: string;
  deleted_at: string;
}

export interface SyncBatchPayload {
  client_sync_token: string;
  records: HealthMetricRecord[];
  deletions: SyncTombstoneRecord[];
}

export interface SyncBatchResponse {
  server_sync_token: string;
  records_accepted: number;
  records_suppressed: number;
  deletions_applied: number;
  conflicts_detected: number;
  new_server_records: HealthMetricRecord[];
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user_account_id: string;
  person_id: string;
  expires_at: number;
}

export interface MetricSummary {
  metric_name: string;
  latest_value: number | null;
  latest_timestamp: string | null;
  unit: string;
  rolling_7d_avg: number | null;
  status: "optimal" | "caution" | "critical" | "insufficient_data";
  trend: "up" | "down" | "stable";
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
  recommendations: string[];
  provider: string;
  disclaimer: string;
}

export interface PersonProfile {
  id: string;
  display_name: string;
  relationship_type: string;
  is_primary: boolean;
}
