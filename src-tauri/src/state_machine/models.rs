use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

use crate::constants::QSPEAK_API_V1_URL;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelConfig {
    #[serde(rename = "openai")]
    OpenAI {
        url: String,
        model: String,
        api_key: Option<String>,
        #[serde(default = "default_supports_vision")]
        supports_vision: bool,
        #[serde(default = "default_supports_tools")]
        supports_tools: bool,
    },
}

fn default_supports_vision() -> bool {
    true
}

fn default_supports_tools() -> bool {
    true
}

impl ModelConfig {
    pub fn qspeak(model: String) -> Self {
        Self::OpenAI {
            url: QSPEAK_API_V1_URL.to_string(),
            model: model,
            api_key: None,
            supports_vision: true,
            supports_tools: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionProvider {
    #[serde(rename = "openai")]
    OpenAI,
    #[serde(rename = "mistral")]
    Mistral,
    #[serde(rename = "whisper_local")]
    WhisperLocal,
}

impl Default for TranscriptionProvider {
    fn default() -> Self {
        TranscriptionProvider::WhisperLocal
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionModel {
    pub name: String,
    pub model: String,
    #[serde(default)]
    pub provider: TranscriptionProvider,
    pub size: f64,
    pub parameters: f64,
    pub vram: f64,
    pub download_state: DownloadState,
    pub is_local: bool,
    pub speed: f64,
    pub intelligence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationModel {
    pub name: String,
    pub model: String,
    pub config: ModelConfig,
    pub repository: Option<String>,
    pub vision: Option<VisionModel>,
    #[serde(default = "default_supports_tools")]
    pub supports_tools: bool,
    #[serde(default = "default_supports_vision")]
    pub supports_vision: bool,
    pub size: f64,
    pub parameters: f64,
    pub vram: f64,
    pub download_state: DownloadState,
    pub is_local: bool,
    pub speed: f64,
    pub intelligence: f64,
}

#[allow(dead_code)]
impl ConversationModel {
    pub fn get_path(&self) -> Option<String> {
        if !self.is_local {
            return None;
        }
        let cache = hf_hub::Cache::from_env();
        let model = cache.model(
            self.repository
                .clone()
                .expect("Failed to get cache repository"),
        );
        Some(
            model
                .get(self.model.as_str())
                .expect("Failed to get model from cache")
                .to_string_lossy()
                .to_string(),
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionModel {
    pub name: String,
    pub repository: Option<String>,
    pub is_local: bool,
}

#[allow(dead_code)]
impl VisionModel {
    pub fn get_path(&self) -> Option<String> {
        if !self.is_local {
            return None;
        }
        let cache = hf_hub::Cache::from_env();
        let model = cache.model(
            self.repository
                .clone()
                .expect("Failed to get cache repository"),
        );
        Some(
            model
                .get(self.name.as_str())
                .expect("Failed to get vision model from cache")
                .to_string_lossy()
                .to_string(),
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum DownloadState {
    #[serde(rename = "idle")]
    Idle,

    #[serde(rename = "downloading")]
    Downloading { progress: f64 },

    #[serde(rename = "downloaded")]
    Downloaded,

    #[serde(rename = "error")]
    Error { error: String },
}

// State definitions for the audio transcription state machine
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Display, EnumString)]
pub enum ModelsState {}

// Context data that's associated with the state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsContext {
    pub transcription_models: Vec<TranscriptionModel>,
    pub conversation_models: Vec<ConversationModel>,
}

impl Default for ModelsContext {
    fn default() -> Self {
        Self {
            // Cloud transcription models (OpenAI, Mistral) will be loaded from API
            // Only local Whisper models are hardcoded here
            transcription_models: vec![
                TranscriptionModel {
                    name: "Whisper Tiny".to_string(),
                    model: "ggml-tiny.bin".to_string(),
                    provider: TranscriptionProvider::WhisperLocal,
                    size: 77.0,
                    parameters: 0.39,
                    vram: 200.0,
                    download_state: DownloadState::Idle,
                    is_local: true,
                    speed: 5.0,
                    intelligence: 2.0,
                },
                TranscriptionModel {
                    name: "Whisper Base".to_string(),
                    model: "ggml-base.bin".to_string(),
                    provider: TranscriptionProvider::WhisperLocal,
                    size: 148.0,
                    parameters: 0.74,
                    vram: 400.0,
                    download_state: DownloadState::Idle,
                    is_local: true,
                    speed: 4.0,
                    intelligence: 3.0,
                },
                TranscriptionModel {
                    name: "Whisper Small".to_string(),
                    model: "ggml-small.bin".to_string(),
                    provider: TranscriptionProvider::WhisperLocal,
                    size: 466.0,
                    parameters: 0.244,
                    vram: 1200.0,
                    download_state: DownloadState::Idle,
                    is_local: true,
                    speed: 3.0,
                    intelligence: 4.0,
                },
            ],
            // Conversation models will be loaded from API in ModelsProcessor::start()
            conversation_models: vec![],
        }
    }
}

// The complete state that will be propagated to the frontend
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsMachineState {
    pub context: ModelsContext,
}

impl Default for ModelsMachineState {
    fn default() -> Self {
        Self {
            context: ModelsContext::default(),
        }
    }
}
