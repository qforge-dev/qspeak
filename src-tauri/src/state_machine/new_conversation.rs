use chrono::{DateTime, Utc};
use cpal::traits::StreamTrait;
use futures_util::{StreamExt, pin_mut};
use get_selected_text::get_selected_text;
use hound::{WavSpec, WavWriter};
use lazy_static::lazy_static;
use qruhear;
use qspeak_audio_player::{play_cancel_sound, play_paste_sound, play_start_sound, play_stop_sound};
use qspeak_keyboard::set_text_in_clipboard;
use qspeak_screenshot::make_screenshot;
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::BufWriter,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, mpsc::Sender},
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, async_runtime::block_on};
use whisper_rs::WhisperContextParameters;

use crate::constants::QSPEAK_API_V1_URL;
use super::{
    Event, Language,
    errors::{AppError, ConversationError},
    models::TranscriptionProvider,
    new_models::get_transcription_model_path,
    processor::Processor,
    state::{
        ConversationMessage, ConversationState, ConversationTextMessage,
        ConversationToolCallResultMessage, CopyTextState, ScreenshotState,
    },
};
use crate::{
    llm::{
        ChatCompletionMessage, ChatCompletionMessageContent, ChatCompletionMessageContentImageUrl,
        ChatCompletionTextMessage, ChatCompletionToolCall, ChatCompletionToolCallFunction,
        ChatCompletionToolCallMessage, ChatCompletionToolCallResultMessage, ChunkMessage,
        OpenAIClient, OpenAIClientConfig,
    },
    state_machine::{
        AppState,
        new_mcp_processor::MCPProcessor,
        personas::Persona,
        state::{ConversationToolCallMessage, ToolCall, ToolCallFunction},
    },
};

lazy_static! {
    static ref CONVERSATION_PROCESSOR: Mutex<ConversationProcessor> =
        Mutex::new(ConversationProcessor::new());
}

pub struct ConversationProcessor {
    audio_recorder_sender: Option<Sender<RecordingCommand>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResult {
    pub tool_call_id: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

enum RecordingCommand {
    Start(PathBuf, Option<String>, bool),
    Stop,
    Cancel,
}

#[derive(Debug, Clone)]
pub struct TransformationContext {
    pub is_text_message: bool,
}

fn convert_conversation_to_chat_completion_messages(
    conversation: &[ConversationMessage],
) -> Vec<ChatCompletionMessage> {
    let mut chat_messages: Vec<ChatCompletionMessage> = conversation
        .iter()
        .map(|message| match message {
            ConversationMessage::ConversationTextMessage(text_message) => {
                ChatCompletionMessage::ChatCompletionTextMessage(ChatCompletionTextMessage {
                    role: text_message.role.clone(),
                    content: text_message.content.clone(),
                    created_at: text_message.created_at.clone(),
                })
            }
            ConversationMessage::ConversationToolCallMessage(tool_call_message) => {
                ChatCompletionMessage::ChatCompletionToolCallMessage(
                    ChatCompletionToolCallMessage {
                        role: tool_call_message.role.clone(),
                        tool_calls: tool_call_message
                            .tool_calls
                            .iter()
                            .map(|tool_call| ChatCompletionToolCall {
                                id: tool_call.id.clone(),
                                function: ChatCompletionToolCallFunction {
                                    name: format!(
                                        "{}--{}",
                                        tool_call.function.client_name, tool_call.function.name
                                    ),
                                    arguments: "".to_string(),
                                },
                                r#type: "function".to_string(),
                            })
                            .collect(),
                    },
                )
            }
            ConversationMessage::ConversationToolCallResultMessage(tool_call_result_message) => {
                ChatCompletionMessage::ChatCompletionToolCallResultMessage(
                    ChatCompletionToolCallResultMessage {
                        role: tool_call_result_message.role.clone(),
                        tool_call_id: tool_call_result_message.tool_call_id.clone(),
                        content: tool_call_result_message.content.clone(),
                    },
                )
            }
        })
        .collect();

    // Inject few-shot examples from active persona after system message
    let app_context = AppState::get_context();
    if let Some(active_persona) = &app_context.active_persona {
        // Find the system message index (should be first)
        let system_message_index = chat_messages.iter().position(|msg| {
            matches!(msg, ChatCompletionMessage::ChatCompletionTextMessage(text_msg) if text_msg.role == "system")
        });

        if let Some(system_index) = system_message_index {
            let mut examples_to_insert = Vec::new();

            // Create example messages for few-shot prompting
            for example in &active_persona.examples {
                if !example.question.trim().is_empty() && !example.answer.trim().is_empty() {
                    // Add user example
                    examples_to_insert.push(ChatCompletionMessage::ChatCompletionTextMessage(
                        ChatCompletionTextMessage {
                            role: "user".to_string(),
                            content: vec![ChatCompletionMessageContent::Text {
                                text: example.question.clone(),
                            }],
                            created_at: Utc::now(),
                        },
                    ));

                    // Add assistant example
                    examples_to_insert.push(ChatCompletionMessage::ChatCompletionTextMessage(
                        ChatCompletionTextMessage {
                            role: "assistant".to_string(),
                            content: vec![ChatCompletionMessageContent::Text {
                                text: example.answer.clone(),
                            }],
                            created_at: Utc::now(),
                        },
                    ));
                }
            }

            // Insert examples after system message
            for (i, example_msg) in examples_to_insert.into_iter().enumerate() {
                chat_messages.insert(system_index + 1 + i, example_msg);
            }
        }
    }

    chat_messages
}

impl ConversationProcessor {
    pub fn new() -> Self {
        Self {
            audio_recorder_sender: None,
        }
    }

    pub fn start() {
        Processor::register_event_listener(
            "conversation",
            Box::new(|event, app_handle| {
                let app_context = AppState::get_context();
                match (event, app_context.conversation_context.state.clone()) {
                    (Event::ActionRecording, ConversationState::Idle) => {
                        start_recording(&app_handle)
                    }
                    (Event::ActionCloseRecordingWindow, ConversationState::Listening) => {
                        cancel_recording(&app_handle)
                    }
                    (Event::ActionRecording, ConversationState::Listening) => {
                        stop_recording(&app_handle)?;
                        
                        match start_transcription(&app_handle) {
                            Ok(_) => Ok(()),
                            Err(_e) => AppState::update(|context| {
                                context
                                    .reset_state_with_error(AppError::with_message(
                                        "Transcription model not picked. Please pick a model in the settings.".to_string(),
                                    ))
                                    .unwrap();
                            }),
                        }
                    }
                    (
                        Event::ActionTextMessage(text),
                        ConversationState::Listening | ConversationState::Idle,
                    ) => {
                        start_transformation(
                            &app_handle,
                            text,
                            TransformationContext {
                                is_text_message: true,
                            },
                        )?;
                        Ok(())
                    }

                    (
                        Event::ActionLoadHistoryConversation(conversation_id),
                        ConversationState::Idle,
                    ) => {
                        let conversation = app_context
                            .history_context
                            .history
                            .iter()
                            .find(|conversation| conversation.id == conversation_id)
                            .cloned();
                        if let Some(conversation) = conversation {
                            AppState::update(|context| {
                                context.conversation_context.conversation =
                                    conversation.conversation.clone();
                                context.history_context.current_history_id = None;
                            })
                            .unwrap();
                        }
                        Ok(())
                    }
                    (Event::ActionTranscriptionSuccess(text), ConversationState::Transcribing) => {
                        log::info!("Transcription success!");
                        let personas = app_context.personas_context.personas.clone();
                        let (new_persona, text) =
                            get_persona_and_text_from_transcription(text, personas);

                        if new_persona.is_some() {
                            AppState::update(|context| {
                                context.update_active_persona(new_persona.clone()).unwrap();
                            })
                            .unwrap();
                            Processor::process_event(Event::ActionChangePersonaByVoice).ok();
                        }

                        start_transformation(
                            &app_handle,
                            text,
                            TransformationContext {
                                is_text_message: false,
                            },
                        )
                    }
                    (Event::ActionTranscriptionError(e), ConversationState::Transcribing) => {
                        AppState::update(|context| {
                            context
                                .reset_state_with_error(AppError::with_message(e))
                                .unwrap();
                        })
                    }
                    (Event::ActionTransformationChunk(chunk), ConversationState::Transforming) => {
                        AppState::update(|context| {
                            context.conversation_context.add_chunk(chunk).unwrap();
                        })
                    }
                    (
                        Event::ActionTransformationToolCall(tool_call),
                        ConversationState::Transforming,
                    ) => AppState::update(|context| {
                        let tool_call_name = tool_call.function.name.unwrap().clone();
                        let tool_call_id = tool_call.id.unwrap().clone();
                        let (mcp_client_name, mcp_tool_name) = match tool_call_name.split_once("--")
                        {
                            Some((client_name, tool_name)) => (client_name, tool_name),
                            None => {
                                context.errors.push(AppError::with_message(format!(
                                    "Invalid tool call name: {}",
                                    tool_call_name
                                )));
                                context.conversation_context.state = ConversationState::Idle;
                                return ();
                            }
                        };
                        let mcp_client_name = mcp_client_name.to_string();
                        let mcp_tool_name = mcp_tool_name.to_string();
                        let mcp_client_name_clone = mcp_client_name.clone();
                        let mcp_tool_name_clone = mcp_tool_name.clone();
                        let arguments_clone = tool_call.function.arguments.clone();

                        // Add tool call ID to pending list
                        context
                            .conversation_context
                            .pending_tool_call_ids
                            .push(tool_call_id.clone());

                        // Check if we already have a tool call message for this assistant response
                        let last_message = context.conversation_context.conversation.last_mut();
                        match last_message {
                            Some(ConversationMessage::ConversationToolCallMessage(
                                tool_call_message,
                            )) => {
                                // Add to existing tool call message
                                tool_call_message.tool_calls.push(ToolCall {
                                    function: ToolCallFunction {
                                        client_name: mcp_client_name_clone,
                                        name: mcp_tool_name_clone,
                                        arguments: arguments_clone,
                                    },
                                    id: tool_call_id.clone(),
                                });
                            }
                            _ => {
                                // Create new tool call message
                                context.conversation_context.conversation.push(
                                    ConversationMessage::ConversationToolCallMessage(
                                        ConversationToolCallMessage {
                                            role: "assistant".to_string(),
                                            tool_calls: vec![ToolCall {
                                                function: ToolCallFunction {
                                                    client_name: mcp_client_name_clone,
                                                    name: mcp_tool_name_clone,
                                                    arguments: arguments_clone,
                                                },
                                                id: tool_call_id.clone(),
                                            }],
                                            created_at: Utc::now(),
                                        },
                                    ),
                                );
                            }
                        }

                        let arguments =
                            serde_json::from_str(&tool_call.function.arguments).unwrap();
                        std::thread::spawn(move || {
                            let result = block_on(MCPProcessor::call_tool(
                                mcp_client_name,
                                mcp_tool_name,
                                arguments,
                            ));
                            match result {
                                Ok(result) => {
                                    let content = serde_json::to_string(&result).unwrap();
                                    Processor::process_event(
                                        Event::ActionTransformationToolCallResult(ToolCallResult {
                                            tool_call_id: tool_call_id.clone(),
                                            content: content,
                                            created_at: Utc::now(),
                                        }),
                                    )
                                    .expect(
                                        "Failed to process transformation tool call result event",
                                    );
                                }
                                Err(e) => {
                                    Processor::process_event(
                                        Event::ActionTransformationToolCallResult(ToolCallResult {
                                            tool_call_id: tool_call_id.clone(),
                                            content: format!("Error calling tool: {:?}", e),
                                            created_at: Utc::now(),
                                        }),
                                    )
                                    .expect("Failed to process transformation error event");
                                }
                            }
                        });
                    }),
                    (
                        Event::ActionTransformationToolCallResult(tool_call_result),
                        ConversationState::Transforming,
                    ) => {
                        AppState::update(|context| {
                            // Add the tool call result to conversation
                            context.conversation_context.conversation.push(
                                ConversationMessage::ConversationToolCallResultMessage(
                                    ConversationToolCallResultMessage {
                                        role: "tool".to_string(),
                                        tool_call_id: tool_call_result.tool_call_id.clone(),
                                        content: tool_call_result.content,
                                        created_at: tool_call_result.created_at,
                                    },
                                ),
                            );

                            // Remove this tool call ID from pending list
                            context
                                .conversation_context
                                .pending_tool_call_ids
                                .retain(|id| id != &tool_call_result.tool_call_id);

                            // Update history after adding tool call result
                            Processor::process_event(Event::ActionUpdateOrCreateHistory(
                                context.active_persona.clone(),
                                context.conversation_context.conversation.clone(),
                            ))
                            .ok();
                        })
                        .ok();

                        let app_context = AppState::get_context();
                        if app_context.conversation_context.state == ConversationState::Idle {
                            return Ok(());
                        }

                        // Only continue conversation if all tool calls are completed
                        if !app_context
                            .conversation_context
                            .pending_tool_call_ids
                            .is_empty()
                        {
                            return Ok(());
                        }

                        let active_model = app_context
                            .conversation_model
                            .clone()
                            .expect("Failed to get conversation model");
                        let conversation = app_context.conversation_context.conversation.clone();
                        std::thread::spawn(move || {
                            let model = AppState::get_context()
                                .models_context
                                .conversation_models
                                .iter()
                                .find(|model| model.model == active_model)
                                .cloned();

                            if model.is_none() {
                                AppState::update(|context| {
                                context.errors.push(AppError::with_message(
                                    "Transformation model not found. Please pick a model in the settings."
                                        .to_string(),
                                ));
                            })
                            .expect("Failed to update app state");
                                return;
                            }

                            let model = model.unwrap();

                            let openai_client = OpenAIClient::new();
                            let config = if model.is_local {
                                OpenAIClientConfig::local()
                            } else {
                                OpenAIClientConfig::openai(model.model.clone())
                            };

                            let api_key = AppState::get_context()
                                .account_context
                                .account
                                .token
                                .clone();

                            let messages =
                                convert_conversation_to_chat_completion_messages(&conversation);

                            match block_on(transform_with_openai(
                                messages,
                                openai_client,
                                config,
                                api_key,
                            )) {
                                Ok(_) => {
                                    Processor::process_event(Event::ActionTransformationSuccess())
                                        .expect("Failed to process transformation success event");
                                }
                                Err(e) => {
                                    Processor::process_event(Event::ActionTransformationError(
                                        e.to_string(),
                                    ))
                                    .expect("Failed to process transformation error event");
                                }
                            }
                        });

                        Ok(())
                    }
                    (Event::ActionTransformationSuccess(), ConversationState::Transforming) => {
                        AppState::update(|context| {
                            let active_persona = context.active_persona.clone();

                            if let Some(last_message) =
                                context.conversation_context.conversation.last()
                            {
                                match last_message {
                                    ConversationMessage::ConversationTextMessage(last_message) => {
                                        if last_message.role == "assistant" {
                                            if let Some(ChatCompletionMessageContent::Text {
                                                text,
                                            }) = last_message.content.last()
                                            {
                                                context.conversation_context.state =
                                                    ConversationState::Idle;
                                                if active_persona.is_some()
                                                    && active_persona.unwrap().paste_on_finish
                                                {
                                                    set_text_in_clipboard_and_paste(
                                                        text, app_handle,
                                                    );
                                                }
                                                if let Err(e) = set_text_in_clipboard(text) {
                                                    context.errors.push(AppError::with_message(
                                                        e.to_string(),
                                                    ));
                                                }
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }

                            Processor::process_event(Event::ActionUpdateOrCreateHistory(
                                context.active_persona.clone(),
                                context.conversation_context.conversation.clone(),
                            ))
                            .ok();
                        })
                    }
                    (Event::ActionTransformationError(e), ConversationState::Transforming) => {
                        AppState::update(|context| {
                            context
                                .reset_state_with_error(AppError::with_message(e))
                                .unwrap();
                        })
                    }
                    (Event::ActionChangePersona(_persona), _) => AppState::update(|context| {
                        Self::reset_conversation_state(context);
                    }),
                    (Event::ActionPersonaCycleNext, _) => AppState::update(|context| {
                        Self::reset_conversation_state(context);
                    }),
                    (
                        Event::ActionAddImage(data_url),
                        ConversationState::Idle | ConversationState::Listening,
                    ) => AppState::update(|context| {
                        context.conversation_context.conversation.push(
                            ConversationMessage::ConversationTextMessage(ConversationTextMessage {
                                audio_file_path: None,
                                role: "user".to_string(),
                                content: vec![ChatCompletionMessageContent::Image {
                                    image_url: ChatCompletionMessageContentImageUrl {
                                        url: data_url,
                                    },
                                }],
                                created_at: Utc::now(),
                            }),
                        );
                        // Update history after adding image
                        Processor::process_event(Event::ActionUpdateOrCreateHistory(
                            context.active_persona.clone(),
                            context.conversation_context.conversation.clone(),
                        ))
                        .ok();
                    }),
                    (
                        Event::ActionAddFile(binary_data),
                        ConversationState::Idle | ConversationState::Listening,
                    ) => AppState::update(|context| {
                        let decoded_file = match decode_binary_file(&binary_data) {
                            Ok(file) => file,
                            Err(e) => {
                                log::error!("Failed to decode binary file: {}", e);
                                println!("Failed to decode binary file: {}", e);
                                return;
                            }
                        };

                        #[allow(deprecated)]
                        let base64_data = base64::encode(&decoded_file.data);
                        let data_url = format!(
                            "data:{};base64,{}",
                            decoded_file.metadata.file_type, base64_data
                        );

                        context.conversation_context.conversation.push(
                            ConversationMessage::ConversationTextMessage(ConversationTextMessage {
                                audio_file_path: None,
                                role: "user".to_string(),
                                content: vec![ChatCompletionMessageContent::Image {
                                    image_url: ChatCompletionMessageContentImageUrl {
                                        url: data_url,
                                    },
                                }],
                                created_at: Utc::now(),
                            }),
                        );
                        Processor::process_event(Event::ActionUpdateOrCreateHistory(
                            context.active_persona.clone(),
                            context.conversation_context.conversation.clone(),
                        ))
                        .ok();
                    }),
                    (
                        Event::ActionScreenshot,
                        ConversationState::Idle | ConversationState::Listening,
                    ) => {
                        let app_handle_clone = app_handle.clone();
                        if app_context.conversation_context.screenshot_state
                            == ScreenshotState::Screenshotting
                        {
                            return Ok(());
                        }
                        AppState::update(|context| {
                            context.conversation_context.screenshot_state =
                                ScreenshotState::Screenshotting;
                        })
                        .ok();
                        std::thread::spawn(move || {
                            let png_data = make_screenshot().expect("Failed to make screenshot");

                            #[allow(deprecated)]
                            let base64_img = base64::encode(&png_data);
                            let data_url = format!("data:image/png;base64,{}", base64_img);

                            Processor::process_event(Event::ActionAddImage(data_url))
                                .expect("Failed to process screenshot event");

                            save_screenshot_to_file(&png_data, &app_handle_clone);
                            AppState::update(|context| {
                                context.conversation_context.screenshot_state =
                                    ScreenshotState::Idle;
                            })
                            .ok();
                        });
                        Ok(())
                    }
                    (
                        Event::ActionCopyText,
                        ConversationState::Listening | ConversationState::Idle,
                    ) => {
                        if app_context.conversation_context.copy_text_state
                            == CopyTextState::Copying
                        {
                            return Ok(());
                        }

                        copy_text();

                        Ok(())
                    }
                    (
                        Event::ActionAddText(text),
                        ConversationState::Listening | ConversationState::Idle,
                    ) => AppState::update(|context| {
                        context.conversation_context.conversation.push(
                            ConversationMessage::ConversationTextMessage(ConversationTextMessage {
                                audio_file_path: None,
                                role: "user".to_string(),
                                content: vec![ChatCompletionMessageContent::Text { text }],
                                created_at: Utc::now(),
                            }),
                        );
                        Processor::process_event(Event::ActionUpdateOrCreateHistory(
                            context.active_persona.clone(),
                            context.conversation_context.conversation.clone(),
                        ))
                        .ok();
                    }),
                    (
                        Event::ActionAddDictionaryItem(term),
                        ConversationState::Idle | ConversationState::Listening,
                    ) => AppState::update(|context| {
                        context.conversation_context.dictionary.push(term);
                    }),
                    (
                        Event::ActionDeleteDictionaryItem(term),
                        ConversationState::Idle | ConversationState::Listening,
                    ) => AppState::update(|context| {
                        let index = context
                            .conversation_context
                            .dictionary
                            .iter()
                            .position(|item| item == &term)
                            .unwrap();
                        context.conversation_context.dictionary.remove(index);
                    }),
                    (Event::ActionStartNewConversation, _) => AppState::update(|context| {
                        Self::reset_conversation_state(context);
                    }),
                    _ => Ok(()),
                }
            }),
        );
    }

    fn reset_conversation_state(context: &mut super::state::AppStateContext) {
        context.history_context.current_history_id = None;
        context.conversation_context.state = ConversationState::Idle;
        context.conversation_context.conversation = vec![];
        context.conversation_context.pending_tool_call_ids.clear();
    }
}

fn get_persona_and_text_from_transcription(
    text: String,
    personas: Vec<Persona>,
) -> (Option<Persona>, String) {
    let persona = personas.iter().find(|persona| {
        if persona.voice_command.trim().is_empty() {
            return false;
        }

        text.to_lowercase()
            .replace(" ", "")
            .replace(".", "")
            .replace(",", "")
            .starts_with(
                &persona
                    .voice_command
                    .to_lowercase()
                    .replace(" ", "")
                    .replace(".", "")
                    .replace(",", ""),
            )
    });

    let mut text = text.clone();
    if let Some(persona) = persona {
        // Instead of direct replacement, trim the command from the beginning
        let command_lowercase = persona.voice_command.to_lowercase();
        let command_words: Vec<&str> = command_lowercase.split_whitespace().collect();

        // Skip any leading non-alphabetic characters to find where actual text begins
        let first_letter_pos = text.find(|c: char| c.is_alphabetic()).unwrap_or(0);
        let text_for_comparison = &text[first_letter_pos..];

        let text_lower = text_for_comparison.to_lowercase();
        let text_start = text_lower
            .split_whitespace()
            .take(command_words.len())
            .collect::<Vec<&str>>()
            .join(" ");

        // Check if beginning of text matches the command
        if text_start.contains(&command_words.join(" ")) {
            // Find where the command ends in the text (after any leading non-alphabetic chars)
            let words_count = command_words.len();
            let mut spaces_found = 0;
            let mut trim_pos = 0;

            for (i, c) in text_for_comparison.char_indices() {
                if c.is_whitespace() {
                    spaces_found += 1;
                    if spaces_found == words_count {
                        trim_pos = i;
                        break;
                    }
                }
            }

            if trim_pos > 0 || words_count == 1 {
                // If we found the position or it's a single word command
                if words_count == 1 && trim_pos == 0 {
                    // For single word commands, find the first word length
                    trim_pos = text_for_comparison
                        .find(' ')
                        .unwrap_or(text_for_comparison.len());
                }

                // Trim the command and any following punctuation/spaces, accounting for initial offset
                text = text_for_comparison[trim_pos..]
                    .trim_start_matches(|c: char| {
                        c.is_whitespace() || c == '!' || c == '.' || c == ',' || c == ':'
                    })
                    .to_string();
            }
        }
    }

    (persona.cloned(), text)
}

fn start_recording(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sender = CONVERSATION_PROCESSOR
        .lock()
        .expect("Failed to lock conversation processor")
        .audio_recorder_sender
        .clone();
    if sender.is_none() {
        let (sender, receiver) = std::sync::mpsc::channel();
        let mut conversation_processor = CONVERSATION_PROCESSOR
            .lock()
            .expect("Failed to lock conversation processor");
        conversation_processor.audio_recorder_sender = Some(sender);
        std::thread::spawn(move || {
            let mut stream_option: Option<cpal::Stream> = None;
            let mut output_ruhear_option: Option<qruhear::RUHear> = None;
            let mut current_input_file: Option<PathBuf> = None;
            let mut current_output_file: Option<PathBuf> = None;

            while let Ok(command) = receiver.recv() {
                match command {
                    RecordingCommand::Start(file_path, input_device_name, record_output_audio) => {
                        play_start_sound();

                        stream_option.take().map(|stream| {
                            drop(stream);
                        });
                        #[allow(unused_mut)]
                        if let Some(mut ruhear) = output_ruhear_option.take() {
                            let _ = ruhear.stop();
                        }

                        // Store the input file path
                        current_input_file = Some(file_path.clone());

                        let input_device = qspeak_audio_recording::get_device_by_name_or_default(
                            input_device_name,
                        );

                        // Start input recording
                        build_wav_writer(&file_path)
                            .and_then(|wav_writer| {
                                qspeak_audio_recording::build_stream(
                                    &input_device,
                                    &wav_writer,
                                    |data| {
                                        Processor::process_audio_data(data)
                                            .expect("Failed to process audio data");
                                    },
                                    |err| {
                                        log::error!(
                                            "an error occurred on the input audio stream: {}",
                                            err
                                        );
                                    },
                                )
                            })
                            .and_then(|stream| {
                                stream
                                    .play()
                                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)
                                    .map(|_| stream)
                            })
                            .map(|stream| {
                                stream_option = Some(stream);
                            })
                            .expect("Failed to record input audio");

                        // Start output recording if output device is specified
                        if record_output_audio {
                            // Create output file path with "_output" suffix
                            let output_file_path = {
                                let input_path = file_path.clone();
                                let stem = input_path.file_stem().unwrap().to_string_lossy();
                                let extension = input_path.extension().unwrap().to_string_lossy();
                                input_path.with_file_name(format!("{}_output.{}", stem, extension))
                            };

                            // Store the output file path
                            current_output_file = Some(output_file_path.clone());

                            println!("Recording output file path: {:?}", output_file_path);

                            // Use ruhear to capture system audio
                            match qspeak_audio_recording::build_wav_writer(&output_file_path) {
                                Ok(output_wav_writer) => {
                                    match qspeak_audio_recording::build_system_output_stream(
                                        &output_wav_writer,
                                        |data| {
                                            Processor::process_audio_data(data)
                                                .expect("Failed to process audio data");
                                        },
                                    ) {
                                        Ok(mut ruhear) => {
                                            let _ = ruhear.start();
                                            output_ruhear_option = Some(ruhear);
                                            log::info!(
                                                "Successfully started system audio recording using ruhear to: {:?}",
                                                output_file_path
                                            );
                                        }
                                        Err(e) => {
                                            log::warn!(
                                                "Failed to create system audio stream with ruhear: {}",
                                                e
                                            );
                                        }
                                    }
                                }
                                Err(e) => {
                                    log::warn!(
                                        "Failed to create WAV writer for system audio: {}",
                                        e
                                    );
                                }
                            }
                        }
                    }
                    RecordingCommand::Stop => {
                        if let Some(stream) = stream_option {
                            play_stop_sound();
                            drop(stream);
                        }
                        #[allow(unused_mut)]
                        if let Some(mut ruhear) = output_ruhear_option.take() {
                            let _ = ruhear.stop();
                        }

                        // Combine audio files if both exist
                        if let (Some(input_file), Some(output_file)) =
                            (&current_input_file, &current_output_file)
                        {
                            // Create combined file path with "_combined" suffix
                            let combined_file_path = {
                                let stem = input_file.file_stem().unwrap().to_string_lossy();
                                let extension = input_file.extension().unwrap().to_string_lossy();
                                input_file
                                    .with_file_name(format!("{}_combined.{}", stem, extension))
                            };

                            match qspeak_audio_recording::combine_audio_files_with_echo_cancellation(
                                input_file,
                                output_file,
                                &combined_file_path,
                                qspeak_audio_recording::EchoCancellationMode::Advanced,
                            ) {
                                Ok(_) => {
                                    log::info!(
                                        "Successfully combined audio files into: {:?}",
                                        combined_file_path
                                    );
                                }
                                Err(e) => {
                                    log::warn!("Failed to combine audio files: {}", e);
                                }
                            }
                        }

                        stream_option = None;
                        output_ruhear_option = None;
                        current_input_file = None;
                        current_output_file = None;
                    }
                    RecordingCommand::Cancel => {
                        if let Some(stream) = stream_option {
                            drop(stream);
                        }
                        #[allow(unused_mut)]
                        if let Some(mut ruhear) = output_ruhear_option.take() {
                            let _ = ruhear.stop();
                        }
                        stream_option = None;
                        output_ruhear_option = None;
                        current_input_file = None;
                        current_output_file = None;
                    }
                }
            }
        });
    }

    let app_context = AppState::get_context();
    let record_output_audio = app_context
        .active_persona
        .clone()
        .map(|persona| persona.record_output_audio)
        .unwrap_or(false);

    let input_device_name = app_context.input_device;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let file_path = app_handle
        .path()
        .cache_dir()
        .expect("Failed to get cache dir")
        .join("audio")
        .join(format!("recording_{}.wav", timestamp));

    println!("file_path: {:?}", file_path);

    AppState::update(|context| {
        context.conversation_context.current_audio_file_path =
            Some(file_path.to_string_lossy().to_string());
        context.conversation_context.state = ConversationState::Listening;
    })?;

    let sender = CONVERSATION_PROCESSOR
        .lock()
        .expect("Failed to lock conversation processor")
        .audio_recorder_sender
        .clone();
    sender
        .expect("Failed to send start command")
        .send(RecordingCommand::Start(
            file_path,
            input_device_name,
            record_output_audio,
        ))?;

    Ok(())
}

fn stop_recording(_app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sender = CONVERSATION_PROCESSOR
        .lock()
        .expect("Failed to lock conversation processor")
        .audio_recorder_sender
        .clone();
    sender
        .expect("Failed to send stop command")
        .send(RecordingCommand::Stop)?;

    Ok(())
}

fn cancel_recording(_app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sender = CONVERSATION_PROCESSOR
        .lock()
        .expect("Failed to lock conversation processor")
        .audio_recorder_sender
        .clone();
    sender
        .expect("Failed to send cancel command")
        .send(RecordingCommand::Cancel)?;
    play_cancel_sound();
    AppState::update(|context| {
        context.conversation_context.state = ConversationState::Idle;
    })?;
    Ok(())
}

fn start_transcription(_app_handle: &AppHandle) -> Result<(), ConversationError> {
    let app_context = AppState::get_context();
    let language = app_context.language.clone();
    let model_id = app_context
        .transcription_model
        .clone()
        .ok_or(ConversationError::TranscriptionModelNotFoundError)?;
    let file_path = app_context
        .conversation_context
        .current_audio_file_path
        .clone()
        .expect("Failed to get current audio file path");

    // Check if persona has combined audio enabled
    let should_wait_for_combined = app_context
        .active_persona
        .clone()
        .map(|persona| persona.record_output_audio)
        .unwrap_or(false);

    // Try to use combined file if it exists and persona wants combined audio, otherwise fall back to input file
    let transcription_file_path = get_transcription_file_path(&file_path, should_wait_for_combined);

    AppState::update(|context| {
        context.conversation_context.state = ConversationState::Transcribing;
    })
    .unwrap();

    std::thread::spawn(move || {
        let context = AppState::get_context();
        let api_key = context.account_context.account.token.clone();
        
        // Find the transcription model to determine its provider
        let model = context
            .models_context
            .transcription_models
            .iter()
            .find(|m| m.model == model_id)
            .expect("Transcription model not found");
        
        // Dispatch based on provider type
        match model.provider {
            TranscriptionProvider::OpenAI => {
                match block_on(transcribe_audio_with_openai_api(
                    transcription_file_path,
                    language,
                    api_key,
                )) {
                    Ok(text) => {
                        Processor::process_event(Event::ActionTranscriptionSuccess(text))
                            .expect("Failed to process transcription success event");
                    }
                    Err(e) => {
                        Processor::process_event(Event::ActionTranscriptionError(e.to_string()))
                            .expect("Failed to process transcription error event");
                    }
                }
            }
            TranscriptionProvider::Mistral => {
                match block_on(transcribe_audio_with_mistral_api(
                    transcription_file_path,
                    language,
                    api_key,
                )) {
                    Ok(text) => {
                        Processor::process_event(Event::ActionTranscriptionSuccess(text))
                            .expect("Failed to process transcription success event");
                    }
                    Err(e) => {
                        Processor::process_event(Event::ActionTranscriptionError(e.to_string()))
                            .expect("Failed to process transcription error event");
                    }
                }
            }
            TranscriptionProvider::WhisperLocal => {
                match transcribe_audio_with_local_model(transcription_file_path, language, model_id) {
                    Ok(text) => {
                        Processor::process_event(Event::ActionTranscriptionSuccess(text))
                            .expect("Failed to process transcription success event");
                    }
                    Err(e) => {
                        Processor::process_event(Event::ActionTranscriptionError(e.to_string()))
                            .expect("Failed to process transcription error event");
                    }
                }
            }
        }
    });

    Ok(())
}

// Helper function to determine which file to use for transcription
fn get_transcription_file_path(input_file_path: &str, should_wait_for_combined: bool) -> String {
    use std::path::Path;

    // If persona doesn't have combined audio enabled, use input file directly
    if !should_wait_for_combined {
        println!(
            "Persona doesn't have combined audio enabled, using input file for transcription: {}",
            input_file_path
        );
        return input_file_path.to_string();
    }

    let input_path = Path::new(input_file_path);

    // Create combined file path with "_combined" suffix
    let combined_file_path = {
        let stem = input_path.file_stem().unwrap().to_string_lossy();
        let extension = input_path.extension().unwrap().to_string_lossy();
        input_path.with_file_name(format!("{}_combined.{}", stem, extension))
    };

    // Wait up to 3 seconds for the combined file to be created
    let start_time = Instant::now();
    let timeout = Duration::from_secs(3);

    while start_time.elapsed() < timeout {
        if combined_file_path.exists() {
            // Check if file has some content (not just created but still being written)
            if let Ok(metadata) = std::fs::metadata(&combined_file_path) {
                if metadata.len() > 1000 {
                    // File has some substantial content
                    println!(
                        "Using combined audio file for transcription: {:?}",
                        combined_file_path
                    );
                    return combined_file_path.to_string_lossy().to_string();
                }
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    // Timeout reached or combined file not found, use input file
    println!(
        "Combined file not ready within timeout, using input file for transcription: {}",
        input_file_path
    );
    input_file_path.to_string()
}

fn transcribe_audio_with_local_model(
    file_path: String,
    language: Language,
    model_id: String,
) -> Result<String, Box<dyn std::error::Error>> {
    println!("Local transcription using file: {}", file_path);

    let model_path = get_transcription_model_path(model_id.as_str());
    let ctx = whisper_rs::WhisperContext::new_with_params(
        model_path.as_str(),
        WhisperContextParameters::default(),
    )
    .expect("Failed to create whisper context");

    let mut reader = hound::WavReader::open(&file_path).expect("Failed to open wav reader");

    // Debug WAV file properties
    let spec = reader.spec();
    println!(
        "WAV file spec: channels={}, sample_rate={}, bits_per_sample={}, sample_format={:?}",
        spec.channels, spec.sample_rate, spec.bits_per_sample, spec.sample_format
    );

    let audio_data: Vec<f32> = reader.samples::<f32>().map(|s| s.unwrap_or(0.0)).collect();

    println!("Audio data length: {} samples", audio_data.len());

    if audio_data.len() < 20_000 {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            "The audio file is too short to be transcribed. Please try again.",
        )));
    }

    let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::BeamSearch {
        beam_size: 1,
        patience: 1.0,
    });

    params.set_language(Some(language.to_str()));

    let app_context = AppState::get_context();
    let initial_prompt = "Glossary: ".to_string()
        + &app_context
            .conversation_context
            .dictionary
            .clone()
            .join(", ");

    params.set_initial_prompt(&initial_prompt);

    params.set_print_progress(false);
    params.set_print_realtime(false);

    let mut state = ctx.create_state().expect("Failed to create whisper state");
    state
        .full(params, &audio_data)
        .expect("Failed to transcribe audio");

    let num_segments = state
        .full_n_segments()
        .expect("Failed to get number of segments");
    let mut transcribed_text = String::new();
    for i in 0..num_segments {
        let segment = state
            .full_get_segment_text(i)
            .expect("Failed to get segment text");
        transcribed_text.push_str(&segment);
        transcribed_text.push(' ');
    }

    let text = transcribed_text.trim().to_string();

    Ok(text)
}

async fn transcribe_audio_with_openai_api(
    file_path: String,
    language: Language,
    api_key: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    // Wait for file to be ready and validate it
    let file_bytes = std::fs::read(&file_path)?;

    // Create a form part for the file
    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_path)
        .mime_str("audio/wav")?;

    // Create a multipart form with the file and model parameters
    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1")
        .text("response_format", "json");

    // Add language if specified
    let form = if !language.to_str().is_empty() && language.to_str() != "auto" {
        form.text("language", language.to_str().to_string())
    } else {
        form
    };

    let app_context = AppState::get_context();
    let initial_prompt = "Glossary: ".to_string()
        + &app_context
            .conversation_context
            .dictionary
            .clone()
            .join(", ");

    let form = form.text("prompt", initial_prompt);

    // Send the request
    let response = client
        .post(format!("{}/audio/transcriptions", QSPEAK_API_V1_URL))
        .header(
            "Authorization",
            format!("Bearer {}", api_key.unwrap_or_default()),
        )
        .multipart(form)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        log::error!("OpenAI API error: {}", error_text);
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("OpenAI API error: {}", error_text),
        )));
    }

    #[derive(Debug, Deserialize)]
    struct TranscriptionResponse {
        text: String,
    }

    let transcription: TranscriptionResponse = response.json().await?;

    let text = transcription.text.trim().to_string();
    Ok(text)
}


async fn transcribe_audio_with_mistral_api(
    file_path: String,
    _language: Language,
    api_key: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    // Wait for file to be ready and validate it
    #[cfg(target_os = "macos")]
    let file_bytes = wait_for_file_ready(&file_path)?;
    #[cfg(not(target_os = "macos"))]
    let file_bytes = std::fs::read(&file_path)?;
    
    // Create a form part for the file
    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_path.clone())
        .mime_str("audio/wav")?;

    // Create a multipart form with the file and model parameters
    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", "voxtral-mini-2507");
    // .text("response_format", "json");

    // Add language if specified
    // let form = if !language.to_str().is_empty() && language.to_str() != "auto" {
    //     form.text("language", language.to_str().to_string())
    // } else {
    //     form
    // };

    // let app_context = AppState::get_context();
    // let initial_prompt = "Glossary: ".to_string()
    //     + &app_context
    //         .conversation_context
    //         .dictionary
    //         .clone()
    //         .join(", ");

    // let form = form.text("prompt", initial_prompt);

    // Send the request
    let request = client
        .post(format!("{}/audio/transcriptions", QSPEAK_API_V1_URL))
        .header(
            "Authorization",
            format!("Bearer {}", api_key.unwrap_or_default()),
        )
        .header("x-provider", "use_mistral")
        .multipart(form);

    
    let response = request.send().await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        log::error!("OpenAI API error: {}", error_text);
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("OpenAI API error: {}", error_text),
        )));
    }

    #[derive(Debug, Deserialize)]
    struct TranscriptionResponse {
        text: String,
    }

    let transcription: TranscriptionResponse = response.json().await?;

    let text = transcription.text.trim().to_string();
    Ok(text)
}

fn start_transformation(
    app_handle: &AppHandle,
    text: String,
    ctx: TransformationContext,
) -> Result<(), Box<dyn std::error::Error>> {
    AppState::update(|context| {
        context.conversation_context.pending_tool_call_ids.clear();

        let active_persona = context.active_persona.clone();
        let active_model = context.conversation_model.clone();

        if active_persona.is_none() || active_model.is_none() {
            context.conversation_context.state = ConversationState::Idle;
            set_text_in_clipboard_and_paste(&text, app_handle);
        } else {
            context.conversation_context.state = ConversationState::Transforming;
        }

        context.conversation_context.transcription_text = text.clone();

        if active_persona.is_some()
            && !context
                .conversation_context
                .conversation
                .iter()
                .any(|message| match message {
                    ConversationMessage::ConversationTextMessage(text_message) => {
                        text_message.role == "system"
                    }
                    _ => false,
                })
        {
            context.conversation_context.conversation.insert(
                0,
                ConversationMessage::ConversationTextMessage(ConversationTextMessage {
                    audio_file_path: None,
                    role: "system".to_string(),
                    content: vec![ChatCompletionMessageContent::Text {
                        text: active_persona
                            .expect("Failed to get active persona")
                            .system_prompt
                            .clone(),
                    }],
                    created_at: Utc::now(),
                }),
            );
        }

        context.conversation_context.conversation.push(
            ConversationMessage::ConversationTextMessage(ConversationTextMessage {
                audio_file_path: if ctx.is_text_message {
                    None
                } else {
                    context.conversation_context.current_audio_file_path.clone()
                },
                role: "user".to_string(),
                content: vec![ChatCompletionMessageContent::Text { text: text.clone() }],
                created_at: Utc::now(),
            }),
        );
    })?;

    let app_context = AppState::get_context();
    if app_context.conversation_context.state == ConversationState::Idle {
        return Ok(());
    }

    let active_model = app_context
        .conversation_model
        .clone()
        .expect("Failed to get conversation model");
    let conversation = app_context.conversation_context.conversation.clone();

    std::thread::spawn(move || {
        let model = AppState::get_context()
            .models_context
            .conversation_models
            .iter()
            .find(|model| model.model == active_model)
            .cloned();

        if model.is_none() {
            AppState::update(|context| {
                context.errors.push(AppError::with_message(
                    "Transformation model not found. Please pick a model in the settings."
                        .to_string(),
                ));
            })
            .expect("Failed to update app state");
            return;
        }

        let model = model.unwrap();

        let openai_client = OpenAIClient::new();
        let config = OpenAIClientConfig::from_model_config(model.config);
        let config_clone = config.clone();

        let api_key = match config.api_key {
            Some(api_key) => api_key,
            None => AppState::get_context()
                .account_context
                .account
                .token
                .clone()
                .unwrap_or_default(),
        };

        let messages = convert_conversation_to_chat_completion_messages(&conversation);

        match block_on(transform_with_openai(
            messages,
            openai_client,
            config_clone,
            Some(api_key),
        )) {
            Ok(_) => {
                Processor::process_event(Event::ActionTransformationSuccess())
                    .expect("Failed to process transformation success event");
            }
            Err(e) => {
                Processor::process_event(Event::ActionTransformationError(e.to_string()))
                    .expect("Failed to process transformation error event");
            }
        }
    });
    Ok(())
}

async fn transform_with_openai(
    conversation: Vec<ChatCompletionMessage>,
    openai_client: OpenAIClient,
    config: OpenAIClientConfig,
    api_key: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let tools = MCPProcessor::list_all_tools().await?;
    let tools: Vec<serde_json::Value> = tools
        .into_iter()
        .map(|tool| {
            serde_json::json!({
                "type": "function",
                "function": {
                    "name": format!("{}--{}", tool.name, tool.tool.name),
                    "description": tool.tool.description,
                    "parameters": tool.tool.input_schema,
                }
            })
        })
        .collect();

    let message_stream = openai_client
        .chat_completion(conversation, Some(tools), config, api_key)
        .await
        .map_err(|e| {
            log::error!("Error: {}", e);
            println!("Error: {}", e);
            Processor::process_event(Event::ActionTransformationError(e.to_string()))
                .expect("Failed to process transformation error event");
        })
        .unwrap();
    pin_mut!(message_stream);

    while let Some(message) = message_stream.next().await {
        match message {
            ChunkMessage::Text(text) => {
                Processor::process_event(Event::ActionTransformationChunk(text))
                    .expect("Failed to process transformation chunk event");
            }
            ChunkMessage::Error(error) => {
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("OpenAI API error: {}", error),
                )));
            }
            ChunkMessage::ToolCall(tool_call) => {
                Processor::process_event(Event::ActionTransformationToolCall(tool_call))
                    .expect("Failed to process transformation tool call event");
            }
        }
    }
    Ok(())
}

fn build_wav_writer(
    file_path: &Path,
) -> Result<Arc<Mutex<WavWriter<BufWriter<File>>>>, Box<dyn std::error::Error>> {
    let spec = WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let writer = WavWriter::create(file_path, spec)
        .map_err(|e| {
            log::error!("Error creating WavWriter: {}", e);
            e
        })
        .expect("Failed to create WavWriter");
    Ok(Arc::new(Mutex::new(writer)))
}

fn save_screenshot_to_file(png_data: &[u8], app_handle: &AppHandle) {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("screenshot_{}.png", timestamp);

    let cache_dir = app_handle
        .path()
        .cache_dir()
        .expect("Failed to get cache dir")
        .join("audio");

    if !cache_dir.exists() {
        let _ = fs::create_dir_all(&cache_dir);
    }

    let save_path = cache_dir.join(&filename);

    match fs::write(&save_path, png_data) {
        Ok(_) => log::info!("Screenshot saved to: {:?}", save_path),
        Err(e) => log::error!("Error saving screenshot: {:?}", e),
    }
}

fn set_text_in_clipboard_and_paste(text: &str, app_handle: &AppHandle) {
    let text_to_paste = text.to_string();

    app_handle
        .run_on_main_thread(move || {
            qspeak_keyboard::set_text_in_clipboard_and_paste(&text_to_paste)
                .map_err(|e| match e {
                    qspeak_keyboard::KeyboardError::MissingAccessibilityPermissionsError => {
                        Processor::process_event(
                            Event::ActionCheckAndRequestAccessibilityPermission,
                        )
                        .unwrap();
                        let _ = AppState::add_error(AppError::with_message(
                            "Missing accessibility permissions".to_string(),
                        ));
                    }
                    _ => {}
                })
                .and_then(|_| {
                    play_paste_sound();
                    Ok(())
                })
                .ok();
        })
        .ok();
}

fn copy_text() {
    AppState::update(|context| {
        context.conversation_context.copy_text_state = CopyTextState::Copying;
    })
    .ok();
    match get_selected_text() {
        Ok(text) => {
            Processor::process_event(Event::ActionAddText(text)).ok();
            AppState::update(|context| {
                context.conversation_context.copy_text_state = CopyTextState::Idle;
            })
            .ok();
        }
        Err(e) => {
            log::error!("Error getting text from clipboard: {}", e);
        }
    }
}

#[derive(Debug, Clone)]
pub struct FileMetadata {
    pub file_type: String,
}

#[derive(Debug)]
pub struct DecodedFile {
    pub metadata: FileMetadata,
    pub data: Vec<u8>,
}

pub fn decode_binary_file(binary_data: &[u8]) -> Result<DecodedFile, String> {
    if binary_data.len() < 4 {
        return Err("Invalid binary data: too short".to_string());
    }

    let metadata_size = u32::from_be_bytes([
        binary_data[0],
        binary_data[1],
        binary_data[2],
        binary_data[3],
    ]) as usize;

    if binary_data.len() < 4 + metadata_size {
        return Err("Invalid binary data: metadata size mismatch".to_string());
    }

    let metadata_bytes = &binary_data[4..4 + metadata_size];
    let metadata_json = String::from_utf8(metadata_bytes.to_vec())
        .map_err(|e| format!("Failed to parse metadata as UTF-8: {}", e))?;

    let metadata: serde_json::Value = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;

    let file_size = metadata["file_size"].as_u64().unwrap_or(0);
    let file_type = metadata["file_type"]
        .as_str()
        .unwrap_or("application/octet-stream")
        .to_string();

    let file_data = binary_data[4 + metadata_size..].to_vec();

    if file_data.len() != file_size as usize {
        log::warn!(
            "File size mismatch: expected {}, got {}",
            file_size,
            file_data.len()
        );
    }

    Ok(DecodedFile {
        metadata: FileMetadata { file_type },
        data: file_data,
    })
}


#[cfg(target_os = "macos")]
fn wait_for_file_ready(file_path: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    use std::path::Path;
    
    let path = Path::new(file_path);
    let start_time = Instant::now();
    let timeout = Duration::from_secs(10); // Increased timeout
    
    println!("Waiting for file to be ready: {}", file_path);
    
    // Wait for file to exist and be stable
    let mut last_size = 0;
    let mut stable_count = 0;
    
    while start_time.elapsed() < timeout {
        println!("Waiting for file to be ready: {}", file_path);
        if path.exists() {
            if let Ok(metadata) = std::fs::metadata(path) {
                let current_size = metadata.len();
                
                // Check if file size is stable (not growing)
                if current_size == last_size && current_size > 1000 {
                    stable_count += 1;
                    if stable_count >= 3 { // File size stable for 3 checks (300ms)
                        println!("File is stable with size: {} bytes", current_size);
                        break;
                    }
                } else {
                    stable_count = 0;
                    last_size = current_size;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    
    if !path.exists() {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("File not found: {}", file_path),
        )));
    }
    
    // Validate file format by trying to read it as WAV
    match hound::WavReader::open(path) {
        Ok(reader) => {
            let spec = reader.spec();
            println!("WAV validation - channels: {}, sample_rate: {}, bits_per_sample: {}", 
                spec.channels, spec.sample_rate, spec.bits_per_sample);
            
            // Check for reasonable audio file properties
            if spec.sample_rate < 8000 || spec.sample_rate > 48000 {
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Invalid sample rate: {}", spec.sample_rate),
                )));
            }
        }
        Err(e) => {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Invalid WAV file: {}", e),
            )));
        }
    }
    
    // Read the file contents
    let file_bytes = std::fs::read(path)?;
    
    Ok(file_bytes)
}