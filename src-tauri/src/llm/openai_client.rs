use async_stream::stream;
use chrono::{DateTime, Utc};
use eventsource_stream::Eventsource;
use futures_util::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::error::Error;

use crate::constants::QSPEAK_API_V1_URL;
use crate::state_machine::models::ModelConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunk {
    pub id: String,
    pub choices: Vec<ChatCompletionChunkChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunkChoice {
    pub index: i32,
    pub delta: ChatCompletionChunkDelta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunkDelta {
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ChatCompletionChunkToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunkToolCall {
    pub id: Option<String>,
    pub index: i32,
    pub r#type: Option<String>,
    pub function: ChatCompletionChunkToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionChunkToolCallFunction {
    pub name: Option<String>,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ChatCompletionMessage {
    ChatCompletionTextMessage(ChatCompletionTextMessage),
    ChatCompletionToolCallMessage(ChatCompletionToolCallMessage),
    ChatCompletionToolCallResultMessage(ChatCompletionToolCallResultMessage),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionTextMessage {
    pub role: String,
    pub content: Vec<ChatCompletionMessageContent>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionToolCallMessage {
    pub role: String,
    pub tool_calls: Vec<ChatCompletionToolCall>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionToolCall {
    pub id: String,
    pub r#type: String,
    pub function: ChatCompletionToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionToolCallResultMessage {
    pub role: String,
    pub content: String,
    pub tool_call_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatCompletionMessageContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    Image {
        image_url: ChatCompletionMessageContentImageUrl,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionMessageContentImageUrl {
    pub url: String,
}

pub struct OpenAIClient {
    client: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIClientConfig {
    pub model: String,
    pub url: String,
    #[allow(dead_code)]
    pub supports_vision: bool,
    pub supports_tools: bool,
    pub api_key: Option<String>,
}

impl OpenAIClientConfig {
    pub fn from_model_config(model_config: ModelConfig) -> Self {
        match model_config {
            ModelConfig::OpenAI {
                url,
                model,
                api_key,
                supports_vision,
                supports_tools,
            } => Self {
                model: model,
                url: url,
                supports_vision: supports_vision,
                supports_tools: supports_tools,
                api_key: api_key,
            },
        }
    }
    pub fn local() -> Self {
        Self {
            model: "".to_string(),
            url: "http://localhost:5001/v1".to_string(),
            supports_vision: false,
            supports_tools: false,
            api_key: None,
        }
    }

    pub fn openai(model: String) -> Self {
        Self {
            model: model,
            url: QSPEAK_API_V1_URL.to_string(),
            // url: "http://localhost:3000/api/v1".to_string(),
            supports_vision: true,
            supports_tools: true,
            api_key: None,
        }
    }
}

impl OpenAIClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    pub async fn chat_completion(
        &self,
        mut messages: Vec<ChatCompletionMessage>,
        tools: Option<Vec<serde_json::Value>>,
        config: OpenAIClientConfig,
        api_key: Option<String>,
    ) -> Result<impl Stream<Item = ChunkMessage>, Box<dyn Error>> {
        let model = config.model;
        let url = config.url;

        if let Some(first_message) = messages.get_mut(0) {
            let current_time_iso = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let time_xml = format!("<current_time>{}</current_time>\\n", current_time_iso);

            match first_message {
                ChatCompletionMessage::ChatCompletionTextMessage(text_message) => {
                    let time_xml_for_text_content = time_xml.clone();
                    let time_xml_for_new_part = time_xml.trim_end().to_string();

                    let mut prepended_to_existing_text = false;
                    for content_part in text_message.content.iter_mut() {
                        if let ChatCompletionMessageContent::Text { text } = content_part {
                            *text = format!("{}{}", time_xml_for_text_content, text);
                            prepended_to_existing_text = true;
                            break;
                        }
                    }

                    if !prepended_to_existing_text {
                        text_message.content.insert(
                            0,
                            ChatCompletionMessageContent::Text {
                                text: time_xml_for_new_part,
                            },
                        );
                    }
                }
                ChatCompletionMessage::ChatCompletionToolCallResultMessage(tool_result_message) => {
                    tool_result_message.content =
                        format!("{}{}", time_xml, tool_result_message.content);
                }
                ChatCompletionMessage::ChatCompletionToolCallMessage(_) => {
                    // Intentionally do nothing for this message type as it lacks a direct content field
                }
            }
        }

        let formatted_messages = messages
            .iter_mut()
            .map(|message| match message {
                ChatCompletionMessage::ChatCompletionToolCallMessage(tool_call_message) => {
                    ChatCompletionMessage::ChatCompletionToolCallMessage(
                        ChatCompletionToolCallMessage {
                            role: tool_call_message.role.clone(),
                            tool_calls: tool_call_message
                                .tool_calls
                                .iter()
                                .map(|tool_call| ChatCompletionToolCall {
                                    id: tool_call.id.clone(),
                                    r#type: tool_call.r#type.clone(),
                                    function: ChatCompletionToolCallFunction {
                                        name: tool_call.function.name.clone(),
                                        arguments: if tool_call.function.arguments == "" {
                                            "{}".to_string()
                                        } else {
                                            tool_call.function.arguments.clone()
                                        },
                                    },
                                })
                                .collect(),
                        },
                    )
                }
                _ => message.clone(),
            })
            .collect::<Vec<_>>();

        let payload = json!({
            "model": model,
            "messages": formatted_messages,
            "stream": true,
            "tools": if config.supports_tools {
                tools
            } else {
                None
            },
        });

        let url = format!("{}/chat/completions", url);

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

        if let Err(e) = response_result {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to get OpenAI response: {}", e),
            )));
        }

        let response = response_result.expect("Failed to get OpenAI response");

        if !response.status().is_success() {
            let status = response.status();
            let error_message = response.text().await.unwrap_or_default();
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!(
                    "Failed to get OpenAI response: {} {}",
                    status, error_message
                ),
            )));
        }

        let mut stream = response.bytes_stream().eventsource();

        let message_stream = stream! {
            let mut tool_calls: Vec<ChatCompletionChunkToolCall> = Vec::new();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(event) => {
                        let json_str = event.data;

                        if json_str == "[DONE]" {
                            for tool_call in tool_calls.iter() {
                                yield ChunkMessage::ToolCall(tool_call.clone());
                            }
                            continue;
                        }

                        match serde_json::from_str::<ChatCompletionChunk>(&json_str) {
                            Ok(chunk) => {
                                let delta = &chunk.choices[0].delta;

                                if let Some(new_tool_calls) = &delta.tool_calls {
                                    for tool_call in new_tool_calls {
                                        let tool_call_index = &tool_call.index;

                                        let existing_tool_call = tool_calls.iter_mut().find(|call| call.index == *tool_call_index);

                                        if let Some(existing_call) = existing_tool_call {
                                            existing_call.function.arguments += &tool_call.function.arguments;
                                        } else {
                                            tool_calls.push(tool_call.clone());
                                        }
                                    }
                                } else if let Some(content) = &delta.content {
                                    yield ChunkMessage::Text(content.clone());
                                } else {
                                }
                            }
                            Err(_e) => {
                                ()
                            }
                        }
                    }
                    Err(_e) => {
                        ()
                    }
                }
            }
        };

        Ok(message_stream)
    }

    pub async fn chat_completion_non_streaming(
        &self,
        mut messages: Vec<ChatCompletionMessage>,
        tools: Option<Vec<serde_json::Value>>,
        config: OpenAIClientConfig,
        api_key: Option<String>,
        response_format: Option<serde_json::Value>,
    ) -> Result<String, Box<dyn Error>> {
        let model = config.model;
        let url = config.url;

        if let Some(first_message) = messages.get_mut(0) {
            let current_time_iso = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let time_xml = format!("<current_time>{}</current_time>\\n", current_time_iso);

            match first_message {
                ChatCompletionMessage::ChatCompletionTextMessage(text_message) => {
                    let time_xml_for_text_content = time_xml.clone();
                    let time_xml_for_new_part = time_xml.trim_end().to_string();

                    let mut prepended_to_existing_text = false;
                    for content_part in text_message.content.iter_mut() {
                        if let ChatCompletionMessageContent::Text { text } = content_part {
                            *text = format!("{}{}", time_xml_for_text_content, text);
                            prepended_to_existing_text = true;
                            break;
                        }
                    }

                    if !prepended_to_existing_text {
                        text_message.content.insert(
                            0,
                            ChatCompletionMessageContent::Text {
                                text: time_xml_for_new_part,
                            },
                        );
                    }
                }
                ChatCompletionMessage::ChatCompletionToolCallResultMessage(tool_result_message) => {
                    tool_result_message.content =
                        format!("{}{}", time_xml, tool_result_message.content);
                }
                ChatCompletionMessage::ChatCompletionToolCallMessage(_) => {
                    // Intentionally do nothing for this message type as it lacks a direct content field
                }
            }
        }

        let formatted_messages = messages
            .iter_mut()
            .map(|message| match message {
                ChatCompletionMessage::ChatCompletionToolCallMessage(tool_call_message) => {
                    ChatCompletionMessage::ChatCompletionToolCallMessage(
                        ChatCompletionToolCallMessage {
                            role: tool_call_message.role.clone(),
                            tool_calls: tool_call_message
                                .tool_calls
                                .iter()
                                .map(|tool_call| ChatCompletionToolCall {
                                    id: tool_call.id.clone(),
                                    r#type: tool_call.r#type.clone(),
                                    function: ChatCompletionToolCallFunction {
                                        name: tool_call.function.name.clone(),
                                        arguments: if tool_call.function.arguments == "" {
                                            "{}".to_string()
                                        } else {
                                            tool_call.function.arguments.clone()
                                        },
                                    },
                                })
                                .collect(),
                        },
                    )
                }
                _ => message.clone(),
            })
            .collect::<Vec<_>>();

        let mut payload = json!({
            "model": model,
            "messages": formatted_messages,
            "stream": false,
            "tools": if config.supports_tools {
                tools
            } else {
                None
            },
        });

        // Add response_format if provided
        if let Some(format) = response_format {
            payload["response_format"] = format;
        }

        let url = format!("{}/chat/completions", url);

        let response = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .header(
                "Authorization",
                format!("Bearer {}", api_key.unwrap_or_default()),
            )
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_message = response.text().await.unwrap_or_default();
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!(
                    "Failed to get OpenAI response: {} {}",
                    status, error_message
                ),
            )));
        }

        let response_json: serde_json::Value = response.json().await?;
        
        if let Some(choices) = response_json.get("choices") {
            if let Some(first_choice) = choices.get(0) {
                if let Some(message) = first_choice.get("message") {
                    if let Some(content) = message.get("content") {
                        if let Some(content_str) = content.as_str() {
                            return Ok(content_str.to_string());
                        }
                    }
                }
            }
        }

        Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Failed to parse OpenAI response",
        )))
    }
}

#[allow(dead_code)]
pub enum ChunkMessage {
    Text(String),
    ToolCall(ChatCompletionChunkToolCall),
    Error(String),
}
