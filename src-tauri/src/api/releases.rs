use serde::{Deserialize, Serialize};

use crate::constants::QSPEAK_API_URL;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub id: String,
    pub version: String,
    pub description: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

pub struct ReleasesApi {
    client: reqwest::Client,
    config: ReleasesApiConfig,
}

#[derive(Debug, Clone)]
pub struct ReleasesApiConfig {
    pub base_url: String,
}

impl ReleasesApi {
    pub fn new(config: ReleasesApiConfig) -> Self {
        Self {
            client: reqwest::Client::new(),
            config,
        }
    }

    pub async fn get_releases(&self) -> Result<Vec<Release>, String> {
        let url = format!("{}/releases", self.config.base_url);

        let response_result = self
            .client
            .get(&url)
            .header("Content-Type", "application/json")
            .send()
            .await;

        let response = response_result.map_err(|_| "Failed to fetch releases".to_string())?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API error: {}", error_text));
        }

        let releases = response
            .json::<Vec<Release>>()
            .await
            .map_err(|_| "Failed to parse releases response".to_string())?;

        Ok(releases)
    }
}

impl ReleasesApiConfig {
    pub fn new(base_url: Option<String>) -> Self {
        Self {
            base_url: base_url.unwrap_or_else(|| QSPEAK_API_URL.to_string()),
        }
    }
}
