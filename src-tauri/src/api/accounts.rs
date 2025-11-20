use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::constants::QSPEAK_API_ACCOUNTS_URL;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginVerifyResponse {
    pub token: String,
    pub email: String,
}

pub struct AccountsApi {
    client: reqwest::Client,
    config: AccountsApiConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountsApiConfig {
    pub api_key: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub message: String,
}

impl AccountsApi {
    pub fn new(config: AccountsApiConfig) -> Self {
        Self {
            client: reqwest::Client::new(),
            config: config,
        }
    }

    pub async fn login(&self, email: String) -> Result<LoginResponse, String> {
        let api_key = self.config.api_key.clone();
        let url = self.config.url.clone();

        let payload = json!({
            "email": email,
        });

        let url = format!("{}/login", url);

        let response_result = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .header(
                "Authorization",
                format!("Bearer {}", api_key.unwrap_or_default()),
            )
            .json(&payload)
            .send()
            .await;

        if let Err(_) = response_result {
            return Err("Failed to login".to_string());
        }

        let response = response_result.expect("Failed to get login response");

        if !response.status().is_success() {
            let error_message = response.json::<ErrorResponse>().await.unwrap();
            return Err(error_message.message);
        }

        let login_response = response.json::<LoginResponse>().await.unwrap();

        Ok(login_response)
    }

    pub async fn login_verify(
        &self,
        email: String,
        code: String,
    ) -> Result<LoginVerifyResponse, String> {
        let api_key = self.config.api_key.clone();
        let url = self.config.url.clone();

        let payload = json!({
            "email": email,
            "code": code,
        });

        let url = format!("{}/login-verify", url);

        let response_result = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .header(
                "Authorization",
                format!("Bearer {}", api_key.unwrap_or_default()),
            )
            .json(&payload)
            .send()
            .await;

        if let Err(_) = response_result {
            return Err("Failed to login".to_string());
        }

        let response = response_result.expect("Failed to login verify");

        if !response.status().is_success() {
            let error_message = response.json::<ErrorResponse>().await.unwrap();
            return Err(error_message.message);
        }

        let login_response = response.json::<LoginVerifyResponse>().await.unwrap();

        Ok(login_response)
    }
}

impl AccountsApiConfig {
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            api_key: api_key,
            url: QSPEAK_API_ACCOUNTS_URL.to_string(),
        }
    }
}
