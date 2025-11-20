use std::{error::Error, thread};

use hf_hub::{Repo, RepoType};
use serde::{Deserialize, Serialize};

use super::{
    Event,
    events::{NewConversationModel, UpdateConversationModel},
    models::{ConversationModel, ModelConfig, TranscriptionModel},
    processor::Processor,
};
use crate::constants::{QSPEAK_API_V1_URL, QSPEAK_API_MODELS_URL, QSPEAK_API_TRANSCRIPTION_MODELS_URL};
use crate::state_machine::{
    AppState,
    models::{DownloadState, VisionModel, TranscriptionProvider},
};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ApiModel {
    pub name: String,
    pub model: String,
    pub supports_tools: bool,
    pub supports_vision: bool,
    pub speed: f64,
    pub intelligence: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ApiTranscriptionModel {
    pub name: String,
    pub model: String,
    pub provider: String,
    pub speed: f64,
    pub intelligence: f64,
}

pub struct ModelsProcessor {}

/// Check if a conversation model is a custom user-added model
/// Custom models have ModelConfig::OpenAI with a URL different from the qSpeak API
fn is_custom_conversation_model(model: &ConversationModel) -> bool {
    match &model.config {
        ModelConfig::OpenAI { url, .. } => {
            // Custom models use non-qspeak URLs
            url != QSPEAK_API_V1_URL
        }
    }
}

/// Check if a conversation model can be deleted
/// Only custom user-added models can be deleted
/// API models and fallback models are protected
fn can_delete_conversation_model(model: &ConversationModel) -> bool {
    // Only custom models (non-qspeak URLs) can be deleted
    is_custom_conversation_model(model)
}

/// Check if a conversation model can be updated/edited
/// Only custom user-added models can be updated
fn can_update_conversation_model(model: &ConversationModel) -> bool {
    // Only custom models can be updated
    is_custom_conversation_model(model)
}

/// Fetch conversation models from the qSpeak API (blocking)
pub fn fetch_conversation_models_from_api() -> Result<Vec<ConversationModel>, Box<dyn Error + Send + Sync>> {
    let client = reqwest::blocking::Client::new();
    let response = client
        .get(QSPEAK_API_MODELS_URL)
        .send()?;
    
    let api_models: Vec<ApiModel> = response.json()?;
    
    let conversation_models = api_models
        .into_iter()
        .map(|api_model| {
            ConversationModel {
                name: api_model.name.clone(),
                model: api_model.model.clone(),
                config: ModelConfig::qspeak(api_model.model.clone()),
                repository: None,
                vision: if api_model.supports_vision {
                    Some(VisionModel {
                        name: api_model.model.clone(),
                        repository: None,
                        is_local: false,
                    })
                } else {
                    None
                },
                supports_tools: api_model.supports_tools,
                supports_vision: api_model.supports_vision,
                size: 0.0,
                parameters: 0.0,
                vram: 0.0,
                download_state: DownloadState::Downloaded,
                is_local: false,
                speed: api_model.speed,
                intelligence: api_model.intelligence,
            }
        })
        .collect();
    
    Ok(conversation_models)
}

/// Fetch models with fallback to default hardcoded models
pub fn fetch_conversation_models_with_fallback() -> Vec<ConversationModel> {
    match fetch_conversation_models_from_api() {
        Ok(models) => {
            log::info!("Successfully fetched {} models from API", models.len());
            models
        }
        Err(e) => {
            log::warn!("Failed to fetch models from API: {}. Using fallback models.", e);
            get_fallback_conversation_models()
        }
    }
}

/// Fallback hardcoded models in case API is unavailable
fn get_fallback_conversation_models() -> Vec<ConversationModel> {
    vec![
        ConversationModel {
            name: "GPT 4.1".to_string(),
            model: "gpt-4.1".to_string(),
            config: ModelConfig::qspeak("gpt-4.1".to_string()),
            repository: None,
            vision: Some(VisionModel {
                name: "gpt-4.1".to_string(),
                repository: None,
                is_local: false,
            }),
            supports_tools: true,
            supports_vision: true,
            size: 0.0,
            parameters: 0.0,
            vram: 0.0,
            download_state: DownloadState::Downloaded,
            is_local: false,
            speed: 4.0,
            intelligence: 5.0,
        },
        ConversationModel {
            name: "GPT 4o".to_string(),
            model: "gpt-4o".to_string(),
            config: ModelConfig::qspeak("gpt-4o".to_string()),
            repository: None,
            vision: Some(VisionModel {
                name: "gpt-4o".to_string(),
                repository: None,
                is_local: false,
            }),
            supports_vision: true,
            size: 0.0,
            parameters: 0.0,
            vram: 0.0,
            download_state: DownloadState::Downloaded,
            is_local: false,
            speed: 3.0,
            intelligence: 4.0,
            supports_tools: true,
        },
    ]
}

impl ModelsProcessor {
    pub fn start() -> Result<(), Box<dyn Error>> {
        Processor::register_event_listener(
            "models",
            Box::new(|event, _app_handle| match event {
                Event::ActionDownloadTranscriptionModel(model_id) => {
                    download_transcription_model(&model_id)
                }
                Event::DownloadTranscriptionModelSuccess(model_id) => AppState::update(|context| {
                    context
                        .models_context
                        .transcription_models
                        .iter_mut()
                        .find(|m| m.model == model_id)
                        .expect("Failed to find transcription model")
                        .download_state = DownloadState::Downloaded;
                }),
                Event::ActionDeleteTranscriptionModel(model_id) => {
                    delete_transcription_model(&model_id)
                }
                Event::ActionDownloadConversationModel(model_id) => {
                    download_conversation_model(&model_id)
                }
                Event::DownloadConversationModelSuccess(model_id) => AppState::update(|context| {
                    context
                        .models_context
                        .conversation_models
                        .iter_mut()
                        .find(|m| m.model == model_id)
                        .expect("Failed to find conversation model")
                        .download_state = DownloadState::Downloaded;
                }),

                Event::ActionDeleteConversationModel(model_id) => {
                    delete_conversation_model(&model_id)
                }
                Event::ActionAddConversationModel(new_model) => add_conversation_model(&new_model),
                Event::ActionUpdateConversationModel(update_model) => {
                    update_conversation_model(&update_model)
                }
                Event::ActionDeleteCustomConversationModel(model_id) => {
                    delete_custom_conversation_model(&model_id)
                }
                Event::ActionRefetchConversationModels => {
                    refetch_conversation_models()
                }
                _ => Ok(()),
            }),
        );
        
        // Initialize models from API
        thread::spawn(move || {
            if let Err(e) = initialize_conversation_models() {
                log::error!("Failed to initialize conversation models: {}", e);
            }
            
            if let Err(e) = initialize_transcription_models() {
                log::error!("Failed to initialize transcription models: {}", e);
            }
        });
        
        refresh_models_state()
    }
}

/// Initialize conversation models from API and update the state
pub fn initialize_conversation_models() -> Result<(), Box<dyn Error + Send + Sync>> {
    let models = fetch_conversation_models_with_fallback();
    
    match AppState::update(|context| {
        context.models_context.conversation_models = models;
    }) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to update models state: {}", e).into()),
    }
}

/// Fetch transcription models from the qSpeak API (blocking)
pub fn fetch_transcription_models_from_api() -> Result<Vec<TranscriptionModel>, Box<dyn Error + Send + Sync>> {
    let client = reqwest::blocking::Client::new();
    let response = client
        .get(QSPEAK_API_TRANSCRIPTION_MODELS_URL)
        .send()?;
    
    let api_models: Vec<ApiTranscriptionModel> = response.json()?;
    
    let transcription_models = api_models
        .into_iter()
        .map(|api_model| {
            let provider = match api_model.provider.as_str() {
                "openai" => TranscriptionProvider::OpenAI,
                "mistral" => TranscriptionProvider::Mistral,
                _ => TranscriptionProvider::OpenAI, // Default to OpenAI for unknown providers
            };
            
            TranscriptionModel {
                name: api_model.name.clone(),
                model: api_model.model.clone(),
                provider,
                size: 0.0,
                parameters: 0.0,
                vram: 0.0,
                download_state: DownloadState::Downloaded,
                is_local: false,
                speed: api_model.speed,
                intelligence: api_model.intelligence,
            }
        })
        .collect();
    
    Ok(transcription_models)
}

/// Fetch transcription models with fallback to default cloud models
pub fn fetch_transcription_models_with_fallback() -> Vec<TranscriptionModel> {
    match fetch_transcription_models_from_api() {
        Ok(models) => {
            log::info!("Successfully fetched {} transcription models from API", models.len());
            models
        }
        Err(e) => {
            log::warn!("Failed to fetch transcription models from API: {}. Using fallback models.", e);
            get_fallback_transcription_models()
        }
    }
}

/// Fallback cloud transcription models if API is unavailable
fn get_fallback_transcription_models() -> Vec<TranscriptionModel> {
    vec![
        TranscriptionModel {
            name: "OpenAI Whisper".to_string(),
            model: "whisper-1".to_string(),
            provider: TranscriptionProvider::OpenAI,
            size: 0.0,
            parameters: 0.0,
            vram: 0.0,
            download_state: DownloadState::Downloaded,
            is_local: false,
            speed: 3.0,
            intelligence: 5.0,
        },
        TranscriptionModel {
            name: "Mistral Voxtral".to_string(),
            model: "voxtral-mini-2507".to_string(),
            provider: TranscriptionProvider::Mistral,
            size: 0.0,
            parameters: 0.0,
            vram: 0.0,
            download_state: DownloadState::Downloaded,
            is_local: false,
            speed: 3.0,
            intelligence: 5.0,
        },
    ]
}

/// Initialize transcription models from API and merge with local models
pub fn initialize_transcription_models() -> Result<(), Box<dyn Error + Send + Sync>> {
    let cloud_models = fetch_transcription_models_with_fallback();
    
    match AppState::update(|context| {
        // Get existing local models
        let local_models: Vec<TranscriptionModel> = context
            .models_context
            .transcription_models
            .iter()
            .filter(|m| m.provider == TranscriptionProvider::WhisperLocal)
            .cloned()
            .collect();
        
        // Merge: cloud models + local models
        let mut all_models = cloud_models;
        all_models.extend(local_models);
        
        context.models_context.transcription_models = all_models;
    }) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to update transcription models state: {}", e).into()),
    }
}

/// Refetch conversation models from API while preserving custom models
fn refetch_conversation_models() -> Result<(), Box<dyn Error>> {
    thread::spawn(move || {
        if let Err(e) = do_refetch_conversation_models() {
            log::error!("Failed to refetch conversation models: {}", e);
        }
    });
    Ok(())
}

/// Internal function to refetch models and merge with custom models
fn do_refetch_conversation_models() -> Result<(), Box<dyn Error + Send + Sync>> {
    // Get current custom models (user-added models with custom URLs)
    let current_models = AppState::get_context().models_context.conversation_models;
    let custom_models: Vec<ConversationModel> = current_models
        .into_iter()
        .filter(|model| is_custom_conversation_model(model))
        .collect();

    // Fetch new models from API (includes fallback on failure)
    let mut api_models = fetch_conversation_models_with_fallback();
    
    // Merge custom models back - they are never lost during refetch
    api_models.extend(custom_models);
    
    match AppState::update(|context| {
        context.models_context.conversation_models = api_models;
    }) {
        Ok(_) => {
            log::info!("Successfully refetched conversation models from API");
            Ok(())
        }
        Err(e) => Err(format!("Failed to update models state: {}", e).into()),
    }
}

pub fn get_transcription_model_path(model_id: &str) -> String {
    let cache = hf_hub::Cache::from_env();
    let model = cache.model("ggerganov/whisper.cpp".to_string());
    model
        .get(model_id)
        .expect("Failed to get transcription model")
        .to_string_lossy()
        .to_string()
}

fn refresh_models_state() -> Result<(), Box<dyn Error>> {
    AppState::update(|context| {
        context
            .models_context
            .transcription_models
            .iter_mut()
            .for_each(|m| {
                m.download_state = get_transcription_model_cache_state(&m);
            });
        context
            .models_context
            .conversation_models
            .iter_mut()
            .for_each(|m| {
                m.download_state = get_conversation_model_cache_state(&m);
            });
    })
}

fn get_transcription_model_cache_state(model: &TranscriptionModel) -> DownloadState {
    if !model.is_local {
        return DownloadState::Downloaded;
    }
    let cache = hf_hub::Cache::from_env();
    let model_value = cache.model("ggerganov/whisper.cpp".to_string());
    match model_value.get(model.model.as_str()) {
        Some(_) => DownloadState::Downloaded,
        None => DownloadState::Idle,
    }
}

pub fn get_conversation_model_cache_state(model: &ConversationModel) -> DownloadState {
    if !model.is_local {
        return DownloadState::Downloaded;
    }
    let cache = hf_hub::Cache::from_env();
    let main_model_cache_repo = cache.model(
        model
            .repository
            .clone()
            .expect("Failed to get cache repository"),
    );
    let main_model = match main_model_cache_repo.get(model.model.as_str()) {
        Some(_) => DownloadState::Downloaded,
        None => DownloadState::Idle,
    };
    let vision_model = if model.vision.is_some() {
        let vision_model_cache_repo = cache.model(
            model
                .vision
                .as_ref()
                .expect("Failed to get vision model cache repo")
                .repository
                .clone()
                .expect("Failed to get cache repository"),
        );
        match vision_model_cache_repo.get(
            model
                .vision
                .as_ref()
                .expect("Failed to get vision model")
                .name
                .clone()
                .as_str(),
        ) {
            Some(_) => DownloadState::Downloaded,
            None => DownloadState::Idle,
        }
    } else {
        DownloadState::Downloaded
    };
    match (vision_model, main_model) {
        (DownloadState::Downloaded, DownloadState::Downloaded) => DownloadState::Downloaded,
        _ => DownloadState::Idle,
    }
}

fn download_transcription_model(model_id: &str) -> Result<(), Box<dyn Error>> {
    AppState::update(|context| {
        context
            .models_context
            .transcription_models
            .iter_mut()
            .find(|m| m.model == model_id)
            .expect("Failed to find transcription model")
            .download_state = DownloadState::Downloading { progress: 0.0 };
    })?;

    let model_id = model_id.to_string();

    thread::spawn(move || {
        let api = hf_hub::api::sync::Api::new().expect("Failed to create api");
        match api
            .repo(Repo::new(
                "ggerganov/whisper.cpp".to_string(),
                RepoType::Model,
            ))
            .download_with_progress(
                &model_id,
                Progress::new(model_id.clone(), ModelType::Transcription),
            ) {
            Ok(_) => {
                Processor::process_event(Event::DownloadTranscriptionModelSuccess(model_id.clone()))
                    .expect("Failed to process event")
            }
            Err(e) => Processor::process_event(Event::DownloadTranscriptionModelError(
                model_id.clone(),
                e.to_string(),
            ))
            .expect("Failed to process event"),
        }
    });

    Ok(())
}

struct Progress {
    last_published_progress: f64,
    total: usize,
    current: usize,
    model_id: String,
    model_type: ModelType,
}

enum ModelType {
    Transcription,
    Conversation(ConversationModelType),
}

enum ConversationModelType {
    TextOnly,
    Text,
    Vision,
}

impl Progress {
    fn new(model_id: String, model_type: ModelType) -> Self {
        Self {
            last_published_progress: 0.0,
            total: 0,
            current: 0,
            model_id,
            model_type,
        }
    }
}

impl hf_hub::api::Progress for Progress {
    fn init(&mut self, total: usize, _: &str) {
        self.total = total;
    }

    fn update(&mut self, size: usize) {
        let previous_progress = self.last_published_progress;
        self.current += size;
        let current_progress = self.current as f64 / self.total as f64;

        if current_progress - previous_progress > 0.05 {
            AppState::update(|context| match self.model_type {
                ModelType::Transcription => {
                    context
                        .models_context
                        .transcription_models
                        .iter_mut()
                        .find(|m| m.model == self.model_id)
                        .expect("Failed to find transcription model")
                        .download_state = DownloadState::Downloading {
                        progress: current_progress as f64,
                    };
                }
                ModelType::Conversation(ConversationModelType::TextOnly) => {
                    context
                        .models_context
                        .conversation_models
                        .iter_mut()
                        .find(|m| m.model == self.model_id)
                        .expect("Failed to find conversation model")
                        .download_state = DownloadState::Downloading {
                        progress: current_progress as f64,
                    };
                }
                ModelType::Conversation(ConversationModelType::Text) => {
                    context
                        .models_context
                        .conversation_models
                        .iter_mut()
                        .find(|m| m.model == self.model_id)
                        .expect("Failed to find conversation model")
                        .download_state = DownloadState::Downloading {
                        progress: current_progress as f64 / 2.0,
                    };
                }
                ModelType::Conversation(ConversationModelType::Vision) => {
                    context
                        .models_context
                        .conversation_models
                        .iter_mut()
                        .find(|m| m.model == self.model_id)
                        .expect("Failed to find conversation model")
                        .download_state = DownloadState::Downloading {
                        progress: (current_progress as f64 / 2.0) + 0.5,
                    };
                }
            })
            .expect("Failed to update progress");
            self.last_published_progress = current_progress;
        }
    }

    fn finish(&mut self) {
        log::info!("Download finished");
    }
}

fn download_conversation_model(model_id: &str) -> Result<(), Box<dyn Error>> {
    let model = AppState::get_context()
        .models_context
        .conversation_models
        .iter()
        .find(|m| m.model == model_id)
        .expect("Failed to find conversation model")
        .clone();

    AppState::update(|context| {
        context
            .models_context
            .conversation_models
            .iter_mut()
            .find(|m| m.model == model_id)
            .expect("Failed to find conversation model")
            .download_state = DownloadState::Downloading { progress: 0.0 };
    })?;

    thread::spawn(move || {
        let api =
            hf_hub::api::sync::Api::new().expect("Failed to create hf conversation model api");
        let has_vision = model.vision.is_some();
        let progress = Progress::new(
            model.model.clone(),
            ModelType::Conversation(if has_vision {
                ConversationModelType::Text
            } else {
                ConversationModelType::TextOnly
            }),
        );
        api.repo(Repo::new(
            model
                .repository
                .clone()
                .expect("Failed to get conversation model repository"),
            RepoType::Model,
        ))
        .download_with_progress(&model.model, progress)
        .expect("Failed to download conversation model");
        if has_vision {
            let progress = Progress::new(
                model.model.clone(),
                ModelType::Conversation(ConversationModelType::Vision),
            );
            Some(
                api.repo(Repo::new(
                    model
                        .vision
                        .as_ref()
                        .expect("Failed to get vision model")
                        .repository
                        .clone()
                        .expect("Failed to get vision model repository"),
                    RepoType::Model,
                ))
                .download_with_progress(
                    &model
                        .vision
                        .as_ref()
                        .expect("Failed to get vision model")
                        .name,
                    progress,
                )
                .expect("Failed to download vision model"),
            )
        } else {
            None
        };
        Processor::process_event(Event::DownloadConversationModelSuccess(model.model.clone()))
            .expect("Failed to process event");
    });

    Ok(())
}

fn delete_transcription_model(model_id: &str) -> Result<(), Box<dyn Error>> {
    // Check if this is a predefined model that shouldn't be deleted
    if !is_local_predefined_transcription_model(model_id) {
        return Err(format!(
            "Cannot delete predefined cloud transcription model: {}",
            model_id
        )
        .into());
    }

    let cache = hf_hub::Cache::from_env();
    let model = cache.model("ggerganov/whisper.cpp".to_string());
    match model.get(model_id) {
        Some(path) => {
            std::fs::remove_file(path).expect("Failed to remove transcription model");
        }
        None => {}
    }
    AppState::update(|context| {
        context
            .models_context
            .transcription_models
            .iter_mut()
            .find(|m| m.model == model_id)
            .expect("Failed to find transcription model")
            .download_state = DownloadState::Idle;
    })
}

fn delete_conversation_model(model_id: &str) -> Result<(), Box<dyn Error>> {
    // This function deletes LOCAL model files from disk (not removing from list)
    // It's used for downloaded models that have files stored locally
    // API models and custom API models don't have local files
    
    let cache = hf_hub::Cache::from_env();
    let model = AppState::get_context()
        .models_context
        .conversation_models
        .iter()
        .find(|m| m.model == model_id)
        .expect("Failed to find conversation model")
        .clone();

    // Verify this is a local model with a repository
    if !model.is_local {
        log::warn!("Attempted to delete files for non-local model: {}", model_id);
        return Err(format!("Cannot delete files for non-local model: {}", model_id).into());
    }

    // Get the repository - if None, this isn't a downloadable local model
    let repository = model.repository.ok_or_else(|| {
        format!("Model {} has no repository - cannot delete files", model_id)
    })?;

    // Delete main model file
    let model_cache_repo = cache.model(repository.clone());
    if let Some(path) = model_cache_repo.get(model.model.as_str()) {
        std::fs::remove_file(path).map_err(|e| {
            format!("Failed to remove model file for {}: {}", model_id, e)
        })?;
        log::info!("Deleted model file for: {}", model_id);
    }

    // Delete vision model file if it exists
    if let Some(vision_model) = &model.vision {
        if let Some(vision_repo) = &vision_model.repository {
            let vision_cache_repo = cache.model(vision_repo.clone());
            if let Some(path) = vision_cache_repo.get(&vision_model.name) {
                std::fs::remove_file(path).map_err(|e| {
                    format!("Failed to remove vision model file for {}: {}", model_id, e)
                })?;
                log::info!("Deleted vision model file for: {}", model_id);
            }
        }
    }

    // Update download state to Idle
    AppState::update(|context| {
        if let Some(model) = context
            .models_context
            .conversation_models
            .iter_mut()
            .find(|m| m.model == model_id)
        {
            model.download_state = DownloadState::Idle;
        }
    })
}

fn add_conversation_model(new_model: &NewConversationModel) -> Result<(), Box<dyn Error>> {
    AppState::update(|context| {
        // Create a custom model configuration
        // Custom models use ModelConfig::OpenAI with user-provided URLs
        let config = ModelConfig::OpenAI {
            url: new_model.url.clone(),
            model: new_model.model.clone(),
            api_key: new_model.api_key.clone(),
            supports_vision: new_model.supports_vision,
            supports_tools: new_model.supports_tools,
        };

        let conversation_model = ConversationModel {
            name: new_model.model.clone(),
            model: new_model.model.clone(),
            config,
            repository: None, // Custom models have no local repository
            vision: new_model.supports_vision.then(|| VisionModel {
                name: new_model.model.clone(),
                repository: None,
                is_local: false,
            }),
            supports_tools: new_model.supports_tools,
            supports_vision: new_model.supports_vision,
            size: 0.0,
            parameters: 0.0,
            vram: 0.0,
            download_state: DownloadState::Downloaded, // Custom models are always "ready"
            is_local: false,                           // Custom models are external API endpoints
            speed: 3.0,                                // Default values for custom models
            intelligence: 4.0,
        };

        context
            .models_context
            .conversation_models
            .push(conversation_model);

        log::info!("Added custom conversation model: {} ({})", new_model.model, new_model.url);
    })
}

fn update_conversation_model(update_model: &UpdateConversationModel) -> Result<(), Box<dyn Error>> {
    AppState::update(|context| {
        // Find the model to update by its original model identifier
        let model_index = context
            .models_context
            .conversation_models
            .iter()
            .position(|m| m.model == update_model.original_model)
            .expect("Failed to find conversation model to update");

        let existing_model = &mut context.models_context.conversation_models[model_index];

        // Verify this is a custom model that can be updated
        // API models and fallback models are immutable
        if !can_update_conversation_model(existing_model) {
            log::warn!(
                "Attempted to update non-custom model: {}. Only custom models can be updated.",
                update_model.original_model
            );
            return; // Silently ignore attempts to update protected models
        }

        // Update the model configuration
        let config = ModelConfig::OpenAI {
            url: update_model.url.clone(),
            model: update_model.model.clone(),
            api_key: update_model.api_key.clone(),
            supports_vision: update_model.supports_vision,
            supports_tools: update_model.supports_tools,
        };

        // Update all the changeable fields
        existing_model.model = update_model.model.clone();
        existing_model.name = update_model.model.clone();
        existing_model.config = config;
        existing_model.supports_tools = update_model.supports_tools;
        existing_model.supports_vision = update_model.supports_vision;

        // Update vision model if vision support changed
        existing_model.vision = update_model.supports_vision.then(|| VisionModel {
            name: update_model.model.clone(),
            repository: None,
            is_local: false,
        });

        log::info!("Updated custom conversation model: {}", update_model.model);
    })
}

fn delete_custom_conversation_model(model_id: &str) -> Result<(), Box<dyn Error>> {
    AppState::update(|context| {
        // Find the model to delete
        let model_index = context
            .models_context
            .conversation_models
            .iter()
            .position(|m| m.model == model_id);

        match model_index {
            Some(index) => {
                let model = &context.models_context.conversation_models[index];

                // Verify this is a custom model that can be deleted
                // API models and fallback models are protected
                if can_delete_conversation_model(model) {
                    let model_name = model.name.clone();
                    context.models_context.conversation_models.remove(index);
                    log::info!("Successfully deleted custom conversation model: {} ({})", model_name, model_id);
                } else {
                    log::warn!(
                        "Deletion denied for protected model: {} ({}). Only custom models can be deleted.",
                        model.name, model_id
                    );
                }
            }
            None => {
                log::warn!("Attempted to delete non-existent model: {}", model_id);
            }
        }
    })
}

fn is_local_predefined_transcription_model(model_id: &str) -> bool {
    const LOCAL_PREDEFINED_TRANSCRIPTION_MODELS: &[&str] =
        &["ggml-tiny.bin", "ggml-base.bin", "ggml-small.bin"];

    LOCAL_PREDEFINED_TRANSCRIPTION_MODELS.contains(&model_id)
}

// Commented out - not currently used
// fn is_predefined_transcription_model(model_id: &str) -> bool {
//     // List of predefined transcription models that should not be deletable
//     const PREDEFINED_TRANSCRIPTION_MODELS: &[&str] = &[
//         "use_openai",
//         "use_mistral",
//         "ggml-tiny.bin",
//         "ggml-base.bin",
//         "ggml-small.bin",
//     ];

//     PREDEFINED_TRANSCRIPTION_MODELS.contains(&model_id)
// }

