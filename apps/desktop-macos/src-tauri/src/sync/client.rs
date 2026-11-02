//! macOS Sync Client (SYNC-001).

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct SyncBatchRequest {
    pub client_sync_token: String,
    pub records: Vec<serde_json::Value>,
    pub deletions: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SyncBatchResponse {
    pub server_sync_token: String,
    pub records_accepted: usize,
    pub records_suppressed: usize,
    pub deletions_applied: usize,
}

pub struct DesktopSyncClient {
    client: reqwest::Client,
    base_url: String,
}

impl DesktopSyncClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url,
        }
    }

    pub async fn sync_batch(
        &self,
        token: &str,
        payload: &SyncBatchRequest,
    ) -> Result<SyncBatchResponse, reqwest::Error> {
        let url = format!("{}/api/v1/mobile/sync/batch", self.base_url);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(payload)
            .send()
            .await?
            .error_for_status()?
            .json::<SyncBatchResponse>()
            .await?;
        Ok(resp)
    }
}

