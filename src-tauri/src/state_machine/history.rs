use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::block_on;

use super::state::{AppStateContext, ConversationMessage};
use super::{Event, personas::Persona, processor::Processor};
use crate::{
    llm::{ChatCompletionMessage, ChatCompletionMessageContent, ChatCompletionTextMessage, OpenAIClient, OpenAIClientConfig},
    state_machine::AppState,
};
pub struct HistoryProcessor {}

impl HistoryProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "history",
            Box::new(|event, _app_handle| match event {
                Event::ActionUpdateOrCreateHistory(persona, conversation) => AppState::update(|context| {
                    let non_system_messages: Vec<_> = conversation.iter()
                        .filter(|msg| match msg {
                            ConversationMessage::ConversationTextMessage(text_msg) => text_msg.role != "system",
                            _ => true,
                        })
                        .cloned()
                        .collect();

                    if non_system_messages.is_empty() {
                        return;
                    }

                    let current_history_id = context.history_context.current_history_id.clone();
                    

                    if let Some(current_id) = current_history_id {
                        if let Some(history) = context
                            .history_context
                            .history
                            .iter_mut()
                            .find(|h| h.id == current_id)
                        {
                            history.conversation = non_system_messages.clone();
                            if let Some(persona) = persona.as_ref() {
                                history.persona_name = Some(persona.name.clone());
                            }
                            log::info!("Updated history entry {}, conversation has {} messages", current_id, non_system_messages.len());
                        } else {
                            log::warn!("History entry with ID {} not found, creating new one", current_id);
                            create_new_history_entry(context, persona, non_system_messages);
                        }
                    } else {
                        create_new_history_entry(context, persona, non_system_messages);
                    }
                }),
                Event::ActionClearHistory => AppState::update(|context| {
                    context.history_context.history.clear();
                    context.history_context.current_history_id = None;
                }),
                Event::ActionDeleteHistory(id) => AppState::update(|context| {
                    let history = context
                        .history_context
                        .history
                        .iter()
                        .find(|history| history.id == id)
                        .expect("Failed to find history");

                    for message in history.conversation.iter() {
                        match message {
                            ConversationMessage::ConversationTextMessage(text_message) => {
                                if let Some(audio_file_path) = text_message.audio_file_path.clone()
                                {
                                    let _ = std::fs::remove_file(audio_file_path);
                                }
                            }
                            _ => {}
                        }
                    }

                    context.history_context.history.retain(|h| h.id != id);
                    
                    if context.history_context.current_history_id.as_ref() == Some(&id) {
                        context.history_context.current_history_id = None;
                    }
                }),

                Event::ActionGenerateHistoryTitle(history_id) => {
                    generate_title_for_history(history_id);
                    Ok(())
                },

                _ => Ok(()),
            }),
        );
    }
}

fn create_new_history_entry(
    context: &mut AppStateContext,
    persona: Option<Persona>,
    conversation: Vec<ConversationMessage>,
) {
    let history_id = uuid::Uuid::new_v4().to_string();
    log::info!("Creating new history entry with ID: {}", history_id);
    
    context.history_context.history.push(History {
        id: history_id.clone(),
        title: None,
        persona_name: persona.as_ref().map(|p| p.name.clone()),
        model_name: context
            .conversation_model
            .clone()
            .expect("Failed to get conversation model"),
        conversation: conversation.clone(),
        created_at: Utc::now(),
    });
    
    context.history_context.current_history_id = Some(history_id.clone());
    
    log::info!("History entry created, conversation has {} messages", conversation.len());
    
    if let Some(persona) = persona {
        context.history_context.last_persona = Some(PersonaHistory {
            id: persona.id.clone(),
            name: persona.name.clone(),
        });
    }

    Processor::process_event(Event::ActionGenerateHistoryTitle(history_id))
        .expect("Failed to process generate history title event");
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct History {
    pub id: String,
    #[serde(default = "default_title")]
    pub title: Option<String>,
    pub persona_name: Option<String>,
    pub model_name: String,
    pub conversation: Vec<ConversationMessage>,
    pub created_at: DateTime<Utc>,
}

fn default_title() -> Option<String> {
    None
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaHistory {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryContext {
    pub history: Vec<History>,
    #[serde(default = "default_last_persona")]
    pub last_persona: Option<PersonaHistory>,
    #[serde(default = "default_current_history_id")]
    pub current_history_id: Option<String>,
}

fn default_last_persona() -> Option<PersonaHistory> {
    None
}

fn default_current_history_id() -> Option<String> {
    None
}

impl Default for HistoryContext {
    fn default() -> Self {
        Self {
            history: vec![],
            last_persona: None,
            current_history_id: None,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryMachineState {
    pub context: HistoryContext,
}

impl Default for HistoryMachineState {
    fn default() -> Self {
        Self {
            context: HistoryContext::default(),
        }
    }
}

fn generate_title_for_history(history_id: String) {
    let app_context = AppState::get_context();
    
    let history = app_context
        .history_context
        .history
        .iter()
        .find(|h| h.id == history_id)
        .cloned();
    
    if let Some(history) = history {
        let conversation_text = extract_conversation_for_title(&history.conversation);
        
        if conversation_text.is_empty() {
            return;
        }

        let conversation_model = app_context.conversation_model.clone();
        if conversation_model.is_none() {
            return;
        }

        let active_model = conversation_model.unwrap();

        std::thread::spawn(move || {
            let model = AppState::get_context()
                .models_context
                .conversation_models
                .iter()
                .find(|model| model.model == active_model)
                .cloned();

                if model.is_none() {
                log::error!("Title generation: Conversation model not found");
                return;
            }

            let model = model.unwrap();
            let openai_client = OpenAIClient::new();
            let config = OpenAIClientConfig::from_model_config(model.config.clone());

            let api_key = AppState::get_context()
                .account_context
                .account
                .token
                .clone();

                let messages = vec![
                ChatCompletionMessage::ChatCompletionTextMessage(ChatCompletionTextMessage {
                    role: "system".to_string(),
                    content: vec![ChatCompletionMessageContent::Text {
                        text: "You are a helpful assistant that creates concise, descriptive titles for conversations. Create a short title (2-5 words, under 50 characters) that captures the main topic, request, or question from the conversation. Use the same language as the conversation. Examples: 'Firewall DLP Block Explanation', 'Copying Document Issues', 'Startup Tweet Ideas', 'CSS vs Tailwind'. Respond with a JSON object containing the title field.".to_string(),
                    }],
                    created_at: Utc::now(),
                }),
                ChatCompletionMessage::ChatCompletionTextMessage(ChatCompletionTextMessage {
                    role: "user".to_string(),
                    content: vec![ChatCompletionMessageContent::Text {
                        text: format!("Create a title for this conversation:\n\n{}", conversation_text),
                    }],
                    created_at: Utc::now(),
                }),
            ];

            let response_format = serde_json::json!({
                "type": "json_schema",
                "json_schema": {
                    "name": "title_response",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "A concise title for the conversation"
                            }
                        },
                        "required": ["title"],
                        "additionalProperties": false
                    }
                }
            });

            match block_on(generate_title_with_llm(messages, openai_client, config, api_key, Some(response_format))) {
                Ok(title) => {
                    log::info!("Generated title for history {}: {}", history_id, title);
                    AppState::update(|context| {
                        if let Some(history) = context
                            .history_context
                            .history
                            .iter_mut()
                            .find(|h| h.id == history_id)
                        {
                            history.title = Some(title);
                        }
                    }).expect("Failed to update history with generated title");
                }
                Err(e) => {
                    log::error!("Failed to generate title for history {}: {}", history_id, e);
                }
            }
        });
    }
}

fn extract_conversation_for_title(conversation: &[ConversationMessage]) -> String {
    let mut text_parts = Vec::new();
    
    for message in conversation.iter().take(10) { 
        match message {
            ConversationMessage::ConversationTextMessage(text_msg) => {
                if text_msg.role != "system" {
                    for content in &text_msg.content {
                        match content {
                            ChatCompletionMessageContent::Text { text } => {
                                let role_prefix = if text_msg.role == "user" { "User" } else { "Assistant" };
                                text_parts.push(format!("{}: {}", role_prefix, text.chars().take(200).collect::<String>()));
                            }
                            _ => {}
                        }
                    }
                }
            }
            _ => {}
        }
    }
    
    text_parts.join("\n").chars().take(1000).collect()
}

async fn generate_title_with_llm(
    messages: Vec<ChatCompletionMessage>,
    openai_client: OpenAIClient,
    config: OpenAIClientConfig,
    api_key: Option<String>,
    response_format: Option<serde_json::Value>,
) -> Result<String, Box<dyn std::error::Error>> {
    let response = openai_client
        .chat_completion_non_streaming(messages, None, config, api_key, response_format)
        .await?;

    let cleaned_response = response.trim();
    
    if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(cleaned_response) {
        if let Some(title_value) = parsed_json.get("title") {
            if let Some(title_str) = title_value.as_str() {
                let final_title = title_str.chars().take(60).collect::<String>();
                return Ok(if final_title.is_empty() { "New Chat".to_string() } else { final_title });
            }
        }
    }
    
    let final_title = cleaned_response.chars().take(60).collect::<String>();
    if final_title.is_empty() {
        Ok("New Chat".to_string())
    } else {
        Ok(final_title)
    }
}
