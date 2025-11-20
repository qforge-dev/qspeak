use crate::{koboldcpp_server::KoboldCppServerState, llm::ChatCompletionMessageContent, state_machine::history::PersonaHistory};

use super::{
    InterfaceTheme, Language,
    account::{Account, AccountContext, LoginState},
    challenges::{Challenge, ChallengeContext, get_default_challenges},
    errors::AppError,
    events::{Shortcuts, WebsocketServerSettingsPayload},
    history::{History, HistoryContext},
    models::{ModelsContext, TranscriptionModel, ConversationModel, TranscriptionProvider},
    new_mcp_processor::{MCPServerConfig, MCPContext},
    permissions::PermissionsContext,
    personas::{Persona, PersonasContext},
    challenges::{create_customize_shortcuts_challenge, ChallengeName},
    releases::ReleasesContext,
};
use chrono::{DateTime, Utc};
use json_patch::{Patch, diff};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use std::{
    error::Error,
    sync::{
        Mutex,
        mpsc::{self, Receiver, Sender},
    },
    time::{SystemTime, Duration, Instant},
};
use strum::{Display, EnumString};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILENAME: &str = "app_state.json";
const STORE_KEY: &str = "app_state";
const DEFAULT_WEBSOCKET_PORT: u16 = 4456;

lazy_static! {
    static ref APP_STATE: Mutex<AppState> = Mutex::new(AppState::new());
    static ref LAST_SAVE_TIME: Mutex<Instant> = Mutex::new(Instant::now());
}

pub struct AppState {
    pub context: AppStateContext,
    pub app_handle: Option<AppHandle>,
    pub subscribers: Vec<Sender<AppStateChannelMessage>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            context: AppStateContext::default(),
            app_handle: None,
            subscribers: Vec::new(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Utils {
    pub recording_timer_ms: Option<SystemTime>,
    pub recording_window_previous_state: Option<RecordingWindowState>,
}

impl Default for Utils {
    fn default() -> Self {
        Self {
            recording_timer_ms: None,
            recording_window_previous_state: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AppStateContext {
    pub update_context: UpdateContext,
    pub errors: Vec<AppError>,
    pub utils: Utils,
    pub shortcuts: Shortcuts,
    pub default_shortcuts: Shortcuts,
    pub language: Language,
    pub interface_language: Language,
    pub preferred_languages: Vec<Language>,
    pub input_device: Option<String>,
    pub transcription_model: Option<String>,
    pub conversation_model: Option<String>,
    pub active_persona: Option<Persona>,
    pub recording_window_context: RecordingWindowContext,
    pub models_context: ModelsContext,
    pub settings_window_context: SettingsWindowContext,
    pub onboarding_window_context: OnboardingWindowContext,
    pub personas_context: PersonasContext,
    pub default_personas_context: PersonasContext,
    pub conversation_context: ConversationContext,
    pub koboldcpp_server_context: KoboldCppServerContext,
    pub history_context: HistoryContext,
    pub account_context: AccountContext,
    pub permissions_context: PermissionsContext,
    pub challenge_context: ChallengeContext,
    pub mcp_context: MCPContext,
    pub websocket_server_context: WebsocketServerContext,
    pub releases_context: ReleasesContext,
}

impl AppStateContext {
    pub fn dump(&self) -> AppStateContextDump {
        AppStateContextDump::from_context(self)
    }

    pub fn load(dump: AppStateContextDump) -> Self {
        Self {
            update_context: UpdateContext::default(),
            errors: Vec::new(),
            utils: Utils::default(),
            shortcuts: dump.shortcuts,
            default_shortcuts: Shortcuts::default(),
            language: dump.language,
            interface_language: dump.interface_language,
            preferred_languages: dump.preferred_languages,
            input_device: dump.input_device,
            transcription_model: dump.transcription_model,
            conversation_model: dump.conversation_model,
            active_persona: dump.active_persona.clone(),
            challenge_context: ChallengeContext {
                challenges: dump.challenge_context.challenges,
            },
            recording_window_context: RecordingWindowContext {
                minimized: dump.recording_window_context.minimized,
                minimized_position: dump.recording_window_context.minimized_position,
                maximized_position: dump.recording_window_context.maximized_position,
                theme: dump.recording_window_context.theme,
                ..RecordingWindowContext::default()
            },
            models_context: ModelsContext {
                transcription_models: ModelsContext::default().transcription_models,
                conversation_models: dump.models_context.conversation_models,
            },
            settings_window_context: SettingsWindowContext {
                state: SettingsWindowState::Closed,
                open_settings_on_start: dump.settings_window_context.open_settings_on_start,
            },
            onboarding_window_context: OnboardingWindowContext::default(),
            personas_context: PersonasContext {
                personas: dump.personas_context.personas,
            },
            default_personas_context: PersonasContext::default(),
            conversation_context: ConversationContext {
                dictionary: dump.conversation_context.dictionary,
                replacements: dump.conversation_context.replacements,
                ..ConversationContext::default()
            },
            koboldcpp_server_context: KoboldCppServerContext {
                state: dump.koboldcpp_server_context.state,
            },
            history_context: HistoryContext {
                history: dump.history_context.history,
                last_persona: dump.active_persona.as_ref().map(|persona| PersonaHistory {
                    id: persona.id.clone(),
                    name: persona.name.clone(),
                }),
                current_history_id: dump.history_context.current_history_id,
            },
            account_context: AccountContext {
                account: Account {
                    email: dump.account_context.account.email,
                    token: dump.account_context.account.token,
                },
                login: LoginState {
                    step: None,
                    state: None,
                },
            },
            permissions_context: PermissionsContext {
                accessibility: dump.permissions_context.accessibility,
                microphone: dump.permissions_context.microphone,
            },
            mcp_context: MCPContext {
                server_configs: dump.mcp_context.server_configs,
            },
            websocket_server_context: WebsocketServerContext {
                enabled: dump.websocket_server_context.enabled,
                port: dump.websocket_server_context.port,
                password: dump.websocket_server_context.password.clone(),
            },
            releases_context: ReleasesContext::default(),
        }
    }

    pub fn reset_state_with_error(&mut self, error: AppError) -> Result<(), Box<dyn Error>> {
        self.errors.push(error);
        self.conversation_context.set_idle_state().unwrap();
        self.conversation_context.pending_tool_call_ids = vec![];
        Ok(())
    }


    pub fn update_active_persona(&mut self, persona: Option<Persona>) -> Result<(), Box<dyn Error>> {
        self.active_persona = persona;
        self.conversation_context.conversation = vec![];
        Ok(())
    }
}


fn default_active_persona() -> Option<Persona> {
    None
}

fn default_preferred_languages() -> Vec<Language> {
    vec![Language::English, Language::Auto]
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AppStateContextDump {
    pub shortcuts: Shortcuts,
    pub language: Language,
    pub interface_language: Language,
    #[serde(default = "default_preferred_languages")]
    pub preferred_languages: Vec<Language>,
    pub input_device: Option<String>,
    pub transcription_model: Option<String>,
    pub conversation_model: Option<String>,
    #[serde(default = "default_active_persona")]
    pub active_persona: Option<Persona>,
    #[serde(default)]
    pub recording_window_context: RecordingWindowContextDump,
    pub models_context: ModelsContextDump,
    #[serde(default)]
    pub settings_window_context: SettingsWindowContextDump,
    pub onboarding_window_context: OnboardingWindowContextDump,
    #[serde(default)]
    pub personas_context: PersonasContextDump,
    #[serde(default)]
    pub conversation_context: ConversationContextDump,
    #[serde(default)]
    pub koboldcpp_server_context: KoboldCppServerContextDump,
    #[serde(default)]
    pub history_context: HistoryContextDump,
    #[serde(default)]
    pub account_context: AccountContextDump,
    #[serde(default)]
    pub permissions_context: PermissionsContextDump,
    #[serde(default)]
    pub challenge_context: ChallengeContextDump,
    #[serde(default)]
    pub websocket_server_context: WebsocketServerContextDump,
    #[serde(default)]
    pub mcp_context: MCPContextDump,
}

impl AppStateContextDump {
    pub fn from_context(context: &AppStateContext) -> Self {
        Self {
            shortcuts: context.shortcuts.clone(),
            language: context.language.clone(),
            interface_language: context.interface_language.clone(),
            preferred_languages: context.preferred_languages.clone(),
            input_device: context.input_device.clone(),
            transcription_model: context.transcription_model.clone(),
            conversation_model: context.conversation_model.clone(),
            active_persona: context.active_persona.clone(),
            recording_window_context: RecordingWindowContextDump {
                minimized: context.recording_window_context.minimized,
                minimized_position: context.recording_window_context.minimized_position.clone(),
                maximized_position: context.recording_window_context.maximized_position.clone(),
                theme: context.recording_window_context.theme.clone(),
            },
            models_context: ModelsContextDump {
                transcription_models: context.models_context.transcription_models.clone(),
                conversation_models: context.models_context.conversation_models.clone(),
            },
            settings_window_context: SettingsWindowContextDump {
                open_settings_on_start: context.settings_window_context.open_settings_on_start,
            },
            onboarding_window_context: OnboardingWindowContextDump {},
            personas_context: PersonasContextDump {
                personas: context.personas_context.personas.clone(),
            },
            conversation_context: ConversationContextDump {
                dictionary: context.conversation_context.dictionary.clone(),
                replacements: context.conversation_context.replacements.clone(),
            },
            koboldcpp_server_context: KoboldCppServerContextDump {
                state: context.koboldcpp_server_context.state.clone(),
            },
            history_context: HistoryContextDump {
                history: context.history_context.history.clone(),
                last_persona: context.history_context.last_persona.clone(),
                current_history_id: None
            },
            account_context: AccountContextDump {
                account: Account {
                    email: context.account_context.account.email.clone(),
                    token: context.account_context.account.token.clone(),
                },
            },
            permissions_context: PermissionsContextDump {
                accessibility: context.permissions_context.accessibility,
                microphone: context.permissions_context.microphone,
            },
            challenge_context: ChallengeContextDump {
                challenges: context.challenge_context.challenges.clone(),
            },
            websocket_server_context: WebsocketServerContextDump {
                enabled: context.websocket_server_context.enabled,
                port: context.websocket_server_context.port,
                password: context.websocket_server_context.password.clone(),
            },
            mcp_context: MCPContextDump {
                server_configs: context.mcp_context.server_configs.clone(),
            },
        }
    }

}

#[derive(Clone, Serialize, Deserialize)]
pub struct RecordingWindowContextDump {
    #[serde(default = "default_minimized")]
    pub minimized: bool,
    pub minimized_position: Option<RecordingWindowPosition>,
    pub maximized_position: Option<RecordingWindowPosition>,
    #[serde(default = "default_theme")]
    pub theme: Option<InterfaceTheme>,
}

fn default_minimized() -> bool {
    false
}

fn default_theme() -> Option<InterfaceTheme> {
    Some(InterfaceTheme::Dark)
}

fn default_open_settings_on_start() -> bool {
    true
}

impl Default for RecordingWindowContextDump {
    fn default() -> Self {
        Self {
            minimized: false,
            minimized_position: None,
            maximized_position: None,
            theme: Some(InterfaceTheme::Dark),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ChallengeContextDump {
    #[serde(default = "get_default_challenges")]
    pub challenges: Vec<Challenge>,
}

impl Default for ChallengeContextDump {
    fn default() -> Self {
        Self {
            challenges: get_default_challenges(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct MCPContextDump {
    #[serde(default = "default_server_configs")]
    pub server_configs: Vec<MCPServerConfig>,
}

fn default_server_configs() -> Vec<MCPServerConfig> {
    vec![]
}

impl Default for MCPContextDump {
    fn default() -> Self {
        Self {
            server_configs: default_server_configs(),
        }
    }
}
#[derive(Clone, Serialize, Deserialize)]
pub struct SettingsWindowContextDump {
    #[serde(default = "default_open_settings_on_start")]
    pub open_settings_on_start: bool,
}

impl Default for SettingsWindowContextDump {
    fn default() -> Self {
        Self {
            open_settings_on_start: default_open_settings_on_start(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct OnboardingWindowContextDump {}

#[derive(Clone, Serialize, Deserialize)]
pub struct ModelsContextDump {
    #[serde(default = "default_transcription_models")]
    pub transcription_models: Vec<TranscriptionModel>,
    #[serde(default = "default_conversation_models")]
    pub conversation_models: Vec<ConversationModel>,
}

fn default_transcription_models() -> Vec<TranscriptionModel> {
    ModelsContext::default().transcription_models.clone()
}

fn default_conversation_models() -> Vec<ConversationModel> {
    ModelsContext::default().conversation_models.clone()
}

impl Default for ModelsContextDump {
    fn default() -> Self {
        Self {
            transcription_models: default_transcription_models(),
            conversation_models: default_conversation_models(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PersonasContextDump {
    #[serde(default = "default_personas")]
    pub personas: Vec<Persona>,
}

impl Default for PersonasContextDump {
    fn default() -> Self {
        Self {
            personas: default_personas(),
        }
    }
}

fn default_personas() -> Vec<Persona> {
    PersonasContext::default().personas.clone()
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PermissionsContextDump {
    pub accessibility: bool,
    pub microphone: bool,
}

impl Default for PermissionsContextDump {
    fn default() -> Self {
        Self {
            accessibility: true,
            microphone: true,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct HistoryContextDump {
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

impl Default for HistoryContextDump {
    fn default() -> Self {
        Self {
            history: Vec::new(),
            last_persona: None,
            current_history_id: None,
        }
    }
}
#[derive(Clone, Serialize, Deserialize)]
pub struct AccountContextDump {
    pub account: Account,
}

impl Default for AccountContextDump {
    fn default() -> Self {
        Self {
            account: Account::default(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct KoboldCppServerContextDump {
    pub state: KoboldCppServerState,
}

impl Default for KoboldCppServerContextDump {
    fn default() -> Self {
        Self {
            state: KoboldCppServerState::Idle,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct WebsocketServerContextDump {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_websocket_port")]
    pub port: u16,
    #[serde(default)]
    pub password: Option<String>,
}

fn default_enabled() -> bool {
    false
}

fn default_websocket_port() -> u16 {
    DEFAULT_WEBSOCKET_PORT
}

impl Default for WebsocketServerContextDump {
    fn default() -> Self {
        Self {
            enabled: false,
            port: DEFAULT_WEBSOCKET_PORT,
            password: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RecordingWindowPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RecordingWindowContext {
    pub state: RecordingWindowState,
    pub minimized: bool,
    pub minimized_position: Option<RecordingWindowPosition>,
    pub maximized_position: Option<RecordingWindowPosition>,
    pub theme: Option<InterfaceTheme>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RecordingWindowState {
    Closed,
    Open(RecordingWindowView),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RecordingWindowView {
    Recording,
    Persona,
}

impl Default for RecordingWindowContext {
    fn default() -> Self {
        Self {
            state: RecordingWindowState::Closed,
            minimized: true,
            minimized_position: None,
            maximized_position: None,
            theme: Some(InterfaceTheme::Dark),
        }
    }
}

// Settings Window State Machine
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SettingsWindowState {
    Closed,
    Open,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsWindowContext {
    pub state: SettingsWindowState,
    pub open_settings_on_start: bool,
}

impl Default for SettingsWindowContext {
    fn default() -> Self {
        Self {
            state: SettingsWindowState::Closed,
            open_settings_on_start: true,
        }
    }
}

// Onboarding Window State Machine
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum OnboardingWindowState {
    Closed,
    Open,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnboardingWindowContext {
    pub state: OnboardingWindowState,
}

impl Default for OnboardingWindowContext {
    fn default() -> Self {
        Self {
            state: OnboardingWindowState::Closed,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Display, EnumString)]
pub enum ConversationState {
    Idle,
    Listening,
    Transcribing,
    Transforming,
    Error,
} // Context data that's associated with the state machine

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConversationMessage {
    ConversationToolCallMessage(ConversationToolCallMessage),
    ConversationToolCallResultMessage(ConversationToolCallResultMessage),
    ConversationTextMessage(ConversationTextMessage),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationTextMessage {
    pub audio_file_path: Option<String>,
    pub role: String,
    #[serde(default = "default_content")]
    pub content: Vec<ChatCompletionMessageContent>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationToolCallMessage {
    pub role: String,
    pub tool_calls: Vec<ToolCall>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub client_name: String,
    pub name: String,
    pub arguments: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub id: String,
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationToolCallResultMessage {
    pub role: String,
    pub tool_call_id: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

fn default_content() -> Vec<ChatCompletionMessageContent> {
    Vec::new()
}



#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CopyTextState {
    Idle,
    Copying,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ScreenshotState {
    Idle,
    Screenshotting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationContext {
    pub dictionary: Vec<String>,
    pub replacements: Vec<(String, String)>,
    pub transcription_text: String,
    pub current_audio_file_path: Option<String>,
    pub conversation: Vec<ConversationMessage>,
    pub state: ConversationState,
    pub copy_text_state: CopyTextState,
    pub screenshot_state: ScreenshotState,
    pub pending_tool_call_ids: Vec<String>,
}

impl Default for ConversationContext {
    fn default() -> Self {
        Self {
            dictionary: Vec::new(),
            replacements: Vec::new(),
            transcription_text: String::new(),
            current_audio_file_path: None,
            conversation: Vec::new(),
            state: ConversationState::Idle,
            copy_text_state: CopyTextState::Idle,
            screenshot_state: ScreenshotState::Idle,
            pending_tool_call_ids: Vec::new(),
        }
    }
}

impl ConversationContext {
    pub fn set_idle_state(&mut self) -> Result<(), Box<dyn Error>> {
        self.state = ConversationState::Idle;
        self.copy_text_state = CopyTextState::Idle;
        self.screenshot_state = ScreenshotState::Idle;
        self.pending_tool_call_ids = Vec::new();
        Ok(())
    }



    pub fn add_chunk(&mut self, chunk: String) -> Result<(), Box<dyn Error>> {
        let last_message = self.conversation.last().expect("Failed to get last message while adding chunk");

        match last_message {
            ConversationMessage::ConversationTextMessage(text_message) => {
                if text_message.role == "user" {
                    // Add a new assistant message
                    self.conversation.push(
                        ConversationMessage::ConversationTextMessage(
                            ConversationTextMessage {
                                audio_file_path: None,
                                role: "assistant".to_string(),
                                content: vec![
                                    ChatCompletionMessageContent::Text {
                                        text: chunk.clone(),
                                    },
                                ],
                                created_at: Utc::now(),
                            },
                        ),
                    );
                } else {
                    // Update the existing assistant message
                    // Get the index of the last message
                    let last_index =
                        self.conversation.len() - 1;

                    // Update the content directly in the vector
                    if let ConversationMessage::ConversationTextMessage(
                        text_message,
                    ) = &mut self.conversation
                        [last_index]
                    {
                        if let Some(ChatCompletionMessageContent::Text {
                            text,
                        }) = text_message.content.last_mut()
                        {
                            *text = text.clone() + &chunk;
                        }
                    }
                }
            }
            ConversationMessage::ConversationToolCallResultMessage(_) => {
                self.conversation.push(
                    ConversationMessage::ConversationTextMessage(
                        ConversationTextMessage {
                            audio_file_path: None,
                            role: "assistant".to_string(),
                            content: vec![ChatCompletionMessageContent::Text {
                                text: chunk.clone(),
                            }],
                            created_at: Utc::now(),
                        },
                    ),
                );
            }
            _ => {}
        }

        Ok(())
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ConversationContextDump {
    #[serde(default = "default_dictionary")]
    pub dictionary: Vec<String>,
    #[serde(default = "default_replacements")]
    pub replacements: Vec<(String, String)>,
}

fn default_dictionary() -> Vec<String> {
    Vec::new()
}

fn default_replacements() -> Vec<(String, String)> {
    Vec::new()
}

impl Default for ConversationContextDump {
    fn default() -> Self {
        Self {
            dictionary: Vec::new(),
            replacements: Vec::new(),
        }
    }
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct KoboldCppServerContext {
    pub state: KoboldCppServerState,
}

impl Default for KoboldCppServerContext {
    fn default() -> Self {
        Self {
            state: KoboldCppServerState::Idle,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct WebsocketServerContext {
    pub enabled: bool,
    pub port: u16,
    pub password: Option<String>,
}

impl Default for WebsocketServerContext {
    fn default() -> Self {
        Self {
            enabled: false,
            port: DEFAULT_WEBSOCKET_PORT,
            password: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Display, EnumString)]
pub enum UpdateState {
    Idle,
    CheckingForUpdates,
    UpdateAvailable,
    NoUpdateAvailable,
    DownloadingUpdate(u64),
    UpdateDownloaded,
    Error(String),
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct UpdateContext {
    pub state: UpdateState,
}

impl Default for UpdateContext {
    fn default() -> Self {
        Self {
            state: UpdateState::Idle,
        }
    }
}

impl Default for AppStateContext {
    fn default() -> Self {
        Self {
            update_context: UpdateContext::default(),
            errors: Vec::new(),
            utils: Utils::default(),
            shortcuts: Shortcuts::default(),
            default_shortcuts: Shortcuts::default(),
            language: Language::English,
            interface_language: Language::English,
            preferred_languages: default_preferred_languages(),
            input_device: None,
            transcription_model: Some("whisper-1".to_string()),
            conversation_model: Some("gpt-4.1-mini".to_string()),
            active_persona: None,
            recording_window_context: RecordingWindowContext::default(),
            models_context: ModelsContext::default(),
            settings_window_context: SettingsWindowContext::default(),
            onboarding_window_context: OnboardingWindowContext::default(),
            personas_context: PersonasContext::default(),
            default_personas_context: PersonasContext::default(),
            conversation_context: ConversationContext::default(),
            koboldcpp_server_context: KoboldCppServerContext::default(),
            history_context: HistoryContext::default(),
            account_context: AccountContext::default(),
            permissions_context: PermissionsContext::default(),
            challenge_context: ChallengeContext::default(),
            mcp_context: MCPContext::default(),
            websocket_server_context: WebsocketServerContext::default(),
            releases_context: ReleasesContext::default(),
        }
    }
}

#[allow(dead_code)]
impl AppState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_app_handle(app_handle: AppHandle) {
        let mut app_state = APP_STATE.lock().expect("Failed to lock app state");
        app_state.app_handle = Some(app_handle);
    }

    fn subscribe_self(&mut self) -> Receiver<AppStateChannelMessage> {
        let (sender, receiver) = mpsc::channel();
        self.subscribers.push(sender);
        receiver
    }

    pub fn notify_subscribers(
        &mut self,
        previous_context: AppStateContext,
        new_context: AppStateContext,
    ) -> Result<(), Box<dyn Error>> {
        let mut subscribers = self.subscribers.clone();
        
        std::thread::spawn(move || {
            let diff = diff(&json!(previous_context), &json!(new_context));
            if diff.is_empty() {
                return;
            }

            subscribers.retain(|subscriber| {
                match subscriber.send(AppStateChannelMessage::Patch(diff.clone())) {
                    Ok(_) => true,
                    Err(_) => false,
                }
            });
        });

        Ok(())
    }

    pub fn subscribe() -> Receiver<AppStateChannelMessage> {
        let mut app_state = APP_STATE.lock().expect("Failed to lock app state");
        app_state.subscribe_self()
    }

    fn update_self(
        &mut self,
        update_fn: impl FnOnce(&mut AppStateContext),
    ) -> Result<(), Box<dyn Error>> {
        let previous_context = self.context.clone();
        update_fn(&mut self.context);
        self.notify_subscribers(previous_context, self.context.clone())?;
        self.save_context_to_store()?;
        Ok(())
    }

    fn save_context_to_store(&self) -> Result<(), Box<dyn Error>> {
        let mut last_save = LAST_SAVE_TIME.lock().expect("Failed to lock last save time");
        let now = Instant::now();
        
        if now.duration_since(*last_save) < Duration::from_millis(100) {
            return Ok(());
        }
        
        *last_save = now;
        
        let app_handle = self
            .app_handle
            .as_ref()
            .expect("Failed to get app handle")
            .clone();
        let context = self.context.clone();
        let app_handle = app_handle.clone();

        std::thread::spawn(move || {
            let dump = context.dump();
            let store = app_handle.store(STORE_FILENAME).expect("Failed to get store");
            store.set(STORE_KEY, json!(dump));
        });
        Ok(())
    }

    pub fn load_context_from_store() -> Result<(), Box<dyn Error>> {
        let mut app_state = APP_STATE.lock().expect("Failed to lock app state");
        let app_handle = app_state
            .app_handle
            .as_ref()
            .expect("Failed to get app handle")
            .clone();
        let store = app_handle.store(STORE_FILENAME)?;
        let dump = store.get(STORE_KEY);
        if let Some(dump) = dump {
            let mut dump = serde_json::from_value::<AppStateContextDump>(dump.clone()).unwrap();
            run_migrations(&mut dump)?;

            app_state.context = AppStateContext::load(dump);
            log::info!("App state loaded from store");
        }
        Ok(())
    }

    pub fn update(update_fn: impl FnOnce(&mut AppStateContext)) -> Result<(), Box<dyn Error>> {
        let mut app_state = APP_STATE.lock().expect("Failed to lock app state");
        app_state.update_self(update_fn)?;
        Ok(())
    }

    pub fn get_context() -> AppStateContext {
        let app_state = APP_STATE.lock().expect("Failed to lock app state");
        app_state.context.clone()
    }

    pub fn update_shortcuts(shortcuts: Shortcuts) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_shortcuts_fn(context, shortcuts).unwrap();
        })
    }

    pub fn update_shortcuts_fn(context: &mut AppStateContext, shortcuts: Shortcuts) -> Result<(), Box<dyn Error>> {
        context.shortcuts = shortcuts;
        Ok(())
    }

    pub fn update_utils(utils: Utils) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_utils_fn(context, utils).unwrap();
        })
    }

    pub fn update_utils_fn(context: &mut AppStateContext, utils: Utils) -> Result<(), Box<dyn Error>> {
        context.utils = utils;
        Ok(())
    }

    pub fn update_language(language: Language) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_language_fn(context, language).unwrap();
        })
    }

    pub fn update_language_fn(context: &mut AppStateContext, language: Language) -> Result<(), Box<dyn Error>> {
        context.language = language;
        Ok(())
    }

    pub fn update_interface_language(language: Language) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_interface_language_fn(context, language).unwrap();
        })
    }

    pub fn update_interface_language_fn(context: &mut AppStateContext, language: Language) -> Result<(), Box<dyn Error>> {
        context.interface_language = language;
        Ok(())
    }

    pub fn update_input_device(device: Option<String>) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_input_device_fn(context, device).unwrap();
        })
    }

    pub fn update_input_device_fn(context: &mut AppStateContext, device: Option<String>) -> Result<(), Box<dyn Error>> {
        context.input_device = device;
        Ok(())
    }

    pub fn update_transcription_model(model: Option<String>) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_transcription_model_fn(context, model).unwrap();
        })
    }

    pub fn update_transcription_model_fn(context: &mut AppStateContext, model: Option<String>) -> Result<(), Box<dyn Error>> {
        context.transcription_model = model;
        Ok(())
    }

    pub fn update_conversation_model(model: Option<String>) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_conversation_model_fn(context, model).unwrap();
        })
    }

    pub fn update_conversation_model_fn(context: &mut AppStateContext, model: Option<String>) -> Result<(), Box<dyn Error>> {
        context.conversation_model = model;
        Ok(())
    }

    pub fn update_websocket_server_settings(settings: WebsocketServerSettingsPayload) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_websocket_server_settings_fn(context, settings.clone()).unwrap();
        })
    }

    pub fn update_websocket_server_settings_fn(
        context: &mut AppStateContext,
        settings: WebsocketServerSettingsPayload,
    ) -> Result<(), Box<dyn Error>> {
        context.websocket_server_context.enabled = settings.enabled;
        let port = if settings.port == 0 {
            DEFAULT_WEBSOCKET_PORT
        } else {
            settings.port
        };
        context.websocket_server_context.port = port;
        context.websocket_server_context.password =
            settings.password.filter(|value| !value.trim().is_empty());
        Ok(())
    }

    pub fn update_active_persona(persona: Option<Persona>) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_active_persona_fn(context, persona).unwrap();
        })
    }

    pub fn update_active_persona_fn(context: &mut AppStateContext, persona: Option<Persona>) -> Result<(), Box<dyn Error>> {
        context.active_persona = persona;
        Ok(())
    }

    pub fn update_recording_window_state(
        state: RecordingWindowState,
    ) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_recording_window_state_fn(context, state).unwrap();
        })
    }

    pub fn update_recording_window_state_fn(context: &mut AppStateContext, state: RecordingWindowState) -> Result<(), Box<dyn Error>> {
        context.recording_window_context.state = state;
        Ok(())
    }

    pub fn update_recording_window_minimized(minimized: bool) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            context.recording_window_context.minimized = minimized;
        })
    }

    pub fn update_settings_window_state(state: SettingsWindowState) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_settings_window_state_fn(context, state).unwrap();
        })
    }

    pub fn update_settings_window_state_fn(context: &mut AppStateContext, state: SettingsWindowState) -> Result<(), Box<dyn Error>> {
        context.settings_window_context.state = state;
        Ok(())
    }

    pub fn update_open_settings_on_start(open_settings_on_start: bool) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_open_settings_on_start_fn(context, open_settings_on_start).unwrap();
        })
    }

    pub fn update_open_settings_on_start_fn(context: &mut AppStateContext, open_settings_on_start: bool) -> Result<(), Box<dyn Error>> {
        context.settings_window_context.open_settings_on_start = open_settings_on_start;
        Ok(())
    }

    pub fn update_onboarding_window_state(
        state: OnboardingWindowState,
    ) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_onboarding_window_state_fn(context, state).unwrap();
        })
    }

    pub fn update_onboarding_window_state_fn(context: &mut AppStateContext, state: OnboardingWindowState) -> Result<(), Box<dyn Error>> {
        context.onboarding_window_context.state = state;
        Ok(())
    }

    pub fn update_conversation_state(state: ConversationState) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_conversation_state_fn(context, state).unwrap();
        })
    }

    pub fn update_conversation_state_fn(context: &mut AppStateContext, state: ConversationState) -> Result<(), Box<dyn Error>> {
        context.conversation_context.state = state;
        Ok(())
    }

    pub fn update_kobold_cpp_server_state(
        state: KoboldCppServerState,
    ) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_kobold_cpp_server_state_fn(context, state).unwrap();
        })
    }

    pub fn update_kobold_cpp_server_state_fn(context: &mut AppStateContext, state: KoboldCppServerState) -> Result<(), Box<dyn Error>> {
        context.koboldcpp_server_context.state = state;
        Ok(())
    }

    pub fn add_error(error: AppError) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::add_error_fn(context, error).unwrap();
        })
    }

    pub fn add_error_fn(context: &mut AppStateContext, error: AppError) -> Result<(), Box<dyn Error>> {
        context.errors.push(error);
        Ok(())
    }

    pub fn remove_error(error_id: String) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::remove_error_fn(context, error_id).unwrap();
        })
    }

    pub fn remove_error_fn(context: &mut AppStateContext, error_id: String) -> Result<(), Box<dyn Error>> {
        let index = context.errors.iter().position(|e| e.id == error_id);
        if let Some(index) = index {
            context.errors.remove(index);
        }
        Ok(())
    }

    pub fn update_account(account: Account) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_account_fn(context, account).unwrap();
        })
    }

    pub fn update_account_fn(context: &mut AppStateContext, account: Account) -> Result<(), Box<dyn Error>> {
        context.account_context.account = account;
        Ok(())
    }

    pub fn update_recording_window_previous_state(
        state: Option<RecordingWindowState>,
    ) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_recording_window_previous_state_fn(context, state).unwrap();
        })
    }

    pub fn update_recording_window_previous_state_fn(context: &mut AppStateContext, state: Option<RecordingWindowState>) -> Result<(), Box<dyn Error>> {
        context.utils.recording_window_previous_state = state;
        Ok(())
    }

    pub fn update_theme(theme: Option<InterfaceTheme>) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_theme_fn(context, theme).unwrap();
        })
    }

    pub fn update_theme_fn(context: &mut AppStateContext, theme: Option<InterfaceTheme>) -> Result<(), Box<dyn Error>> {
        context.recording_window_context.theme = theme;
        Ok(())
    }

    pub fn update_preferred_languages(preferred_languages: Vec<Language>) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::update_preferred_languages_fn(context, preferred_languages).unwrap();
        })
    }

    pub fn update_preferred_languages_fn(context: &mut AppStateContext, preferred_languages: Vec<Language>) -> Result<(), Box<dyn Error>> {
        context.preferred_languages = preferred_languages;
        Ok(())
    }

    pub fn switch_to_next_preferred_language() -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            AppState::switch_to_next_preferred_language_fn(context).unwrap();
        })
    }

    pub fn switch_to_next_preferred_language_fn(context: &mut AppStateContext) -> Result<(), Box<dyn Error>> {
        if context.preferred_languages.is_empty() {
            return Ok(());
        }

        let current_index = context
            .preferred_languages
            .iter()
            .position(|lang| *lang == context.language)
            .unwrap_or(0);
        
        let next_index = (current_index + 1) % context.preferred_languages.len();
        context.language = context.preferred_languages[next_index].clone();
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppStateChannelMessage {
    FullState(AppStateContext),
    Patch(Patch),
}

pub trait Migration {
    fn apply(&self, state: &mut AppStateContextDump) -> Result<bool, Box<dyn Error>>;
    fn name(&self) -> &str;
}

struct AddCustomizeShortcutsChallengeMigration {
    name: String,
}

impl Migration for AddCustomizeShortcutsChallengeMigration {
    fn apply(&self, state: &mut AppStateContextDump) -> Result<bool, Box<dyn Error>> {
        let challenge_exists = state.challenge_context.challenges.iter()
            .any(|challenge| matches!(challenge.id, ChallengeName::CustomizeShortcuts));

        if !challenge_exists {
            state.challenge_context.challenges.push(create_customize_shortcuts_challenge());
            return Ok(true);
        }
        
        Ok(false) 
    }
    
    fn name(&self) -> &str {
        &self.name
    }
}

struct MigrateSinglePersonaShortcut {
    name: String,
}

impl Migration for MigrateSinglePersonaShortcut {
    fn apply(&self, state: &mut AppStateContextDump) -> Result<bool, Box<dyn Error>> {

        let shortcuts = state.shortcuts.clone();

        if shortcuts.personas.len() == 1 {
            state.shortcuts.personas = Shortcuts::default().personas;

            return Ok(true);
        }

        Ok(false)
    }

    fn name(&self) -> &str {
        &self.name
    }
}

struct MigratePersonasDuplicatedId {
    name: String,
}

impl Migration for MigratePersonasDuplicatedId {
    fn apply(&self, state: &mut AppStateContextDump) -> Result<bool, Box<dyn Error>> {
        let mut seen_ids = std::collections::HashSet::new();
        let mut modified = false;

        for persona in &mut state.personas_context.personas {
            if !seen_ids.insert(persona.id.clone()) {
                // If we've seen this ID before, generate a new one
                persona.id = Uuid::new_v4().to_string();
                modified = true;
            }
        }

        Ok(modified)
    }

    fn name(&self) -> &str {
        &self.name
    }
}

struct MigrateTranscriptionModelIds {
    name: String,
}

impl Migration for MigrateTranscriptionModelIds {
    fn apply(&self, state: &mut AppStateContextDump) -> Result<bool, Box<dyn Error>> {
        let mut modified = false;

        // Migrate the selected transcription model ID
        if let Some(transcription_model) = &state.transcription_model {
            let new_model_id = match transcription_model.as_str() {
                "use_openai" => Some("whisper-1".to_string()),
                "use_mistral" => Some("voxtral-mini-2507".to_string()),
                _ => None,
            };

            if let Some(new_id) = new_model_id {
                state.transcription_model = Some(new_id);
                modified = true;
            }
        }

        // Migrate provider field in transcription models list
        for model in &mut state.models_context.transcription_models {
            // If the model has default provider (WhisperLocal) but the model ID suggests otherwise, fix it
            if model.provider == TranscriptionProvider::WhisperLocal && !model.is_local {
                // This is a cloud model that got the default provider during deserialization
                let correct_provider = match model.model.as_str() {
                    "use_openai" | "whisper-1" => TranscriptionProvider::OpenAI,
                    "use_mistral" | "voxtral-mini-2507" => TranscriptionProvider::Mistral,
                    _ if model.model.ends_with(".bin") => TranscriptionProvider::WhisperLocal,
                    _ => TranscriptionProvider::OpenAI, // Default for unknown cloud models
                };
                
                model.provider = correct_provider;
                modified = true;
            }
            
            // Also migrate the model ID if it's an old one
            match model.model.as_str() {
                "use_openai" => {
                    model.model = "whisper-1".to_string();
                    model.provider = TranscriptionProvider::OpenAI;
                    modified = true;
                }
                "use_mistral" => {
                    model.model = "voxtral-mini-2507".to_string();
                    model.provider = TranscriptionProvider::Mistral;
                    modified = true;
                }
                _ => {}
            }
        }

        Ok(modified)
    }

    fn name(&self) -> &str {
        &self.name
    }
}


pub fn run_migrations(state: &mut AppStateContextDump) -> Result<(), Box<dyn Error>> {
    let migrations: Vec<Box<dyn Migration>> = vec![
        Box::new(AddCustomizeShortcutsChallengeMigration { 
            name: "Add customize shortcuts challenge to the user's challenges".to_string() 
        }),
        Box::new(MigrateSinglePersonaShortcut {
            name: "Migrate persona shortcut to shortcut that has at least one modifier and one character".to_string()
        }),
        Box::new(MigratePersonasDuplicatedId {
            name: "Migrate personas with duplicated IDs".to_string()
        }),
        Box::new(MigrateTranscriptionModelIds {
            name: "Migrate old transcription model IDs (use_openai, use_mistral) to new API model IDs".to_string()
        }),
        //   more here
    ];
    
    for migration in migrations {
        let applied = migration.apply(state)?;
        if applied {
            log::info!("Applied migration: {}", migration.name());
        }
    }
    
    Ok(())
}
