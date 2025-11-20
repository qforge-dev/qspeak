use serde::{Deserialize, Serialize};

use crate::state_machine::personas::PersonaExample;
use crate::{
    api::accounts::LoginVerifyResponse, koboldcpp_server::KoboldCppServerState,
    llm::ChatCompletionChunkToolCall,
};

use super::{
    InterfaceTheme, Language, account::LoginVerifyPayload, new_conversation::ToolCallResult,
    new_mcp_processor::MCPServerConfig, personas::Persona, state::ConversationMessage,
};

use crate::api::releases::Release;

use crate::state_machine::challenges::ChallengeName;

// Shortcuts structure for keyboard shortcuts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shortcuts {
    pub recording: Vec<String>,
    pub close: Vec<String>,
    pub personas: Vec<String>,
    pub screenshot: Vec<String>,
    pub copy_text: Vec<String>,
    pub toggle_minimized: Vec<String>,
    #[serde(default = "default_switch_language")]
    pub switch_language: Vec<String>,
}

fn default_switch_language() -> Vec<String> {
    vec!["Control".to_string(), "Shift".to_string(), "L".to_string()]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewPersona {
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub voice_command: String,
    pub paste_on_finish: bool,
    pub icon: String,
    pub record_output_audio: bool,
    #[serde(default)]
    pub examples: Vec<PersonaExample>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewConversationModel {
    pub model: String,
    pub url: String,
    pub api_key: Option<String>,
    #[serde(default)]
    pub supports_tools: bool,
    #[serde(default)]
    pub supports_vision: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConversationModel {
    pub original_model: String, // Original model identifier to find the existing model
    pub model: String,          // New model identifier
    pub url: String,
    pub api_key: Option<String>,
    pub supports_tools: bool,
    pub supports_vision: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsocketServerSettingsPayload {
    pub enabled: bool,
    pub port: u16,
    pub password: Option<String>,
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            recording: vec!["Control".to_string(), "Space".to_string()],
            close: vec!["Escape".to_string()],
            personas: vec![
                "Control".to_string(),
                "Alt".to_string(),
                "Space".to_string(),
            ],
            screenshot: vec!["Control".to_string(), "Shift".to_string(), "S".to_string()],
            copy_text: vec!["Control".to_string(), "Shift".to_string(), "C".to_string()],
            toggle_minimized: vec!["Control".to_string(), "M".to_string()],
            switch_language: vec!["Control".to_string(), "Shift".to_string(), "L".to_string()],
        }
    }
}

// Unified Event type for the entire application
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "name", content = "payload")]
pub enum Event {
    ActionCenterWindow,
    ActionPersona,
    ActionPersonaCycleEnd,
    ActionPersonaCycleNext,
    ActionScreenshot,
    ActionCopyText,
    ActionRecording,
    ActionToggleRecordingWindowMinimized,
    ActionOpenRecordingWindow,
    ActionCloseRecordingWindow,
    ActionChangeTranscriptionLanguage(Language),
    ActionSwitchToNextPreferredLanguage,
    ActionUpdatePreferredLanguages(Vec<Language>),
    ActionDownloadTranscriptionModel(String),
    ActionDownloadConversationModel(String),
    ActionCancelDownloadTranscriptionModel(String),
    ActionCancelDownloadConversationModel(String),
    ActionDeleteTranscriptionModel(String),
    ActionDeleteConversationModel(String),
    DownloadTranscriptionModelSuccess(String),
    DownloadTranscriptionModelError(String, String),
    DownloadConversationModelSuccess(String),
    ActionTranscriptionNoAudioData,
    ActionChangePersona(Option<Persona>),
    ActionAddPersona(NewPersona),
    ActionDuplicatePersona(Persona),
    ActionUpdatePersona(Persona),
    ActionDeletePersona(String),
    ActionAddConversationModel(NewConversationModel),
    ActionUpdateConversationModel(UpdateConversationModel),
    ActionDeleteCustomConversationModel(String),
    ActionRefetchConversationModels,
    ActionAddImage(String),
    ActionAddFile(Vec<u8>),
    ActionAddText(String),
    ActionChangeInterfaceLanguage(Language),
    ActionTranscriptionSuccess(String),
    ActionTranscriptionError(String),
    ActionTransformationChunk(String),
    ActionTransformationToolCall(ChatCompletionChunkToolCall),
    ActionTransformationToolCallResult(ToolCallResult),
    ActionTransformationError(String),
    ActionTransformationSuccess(),
    ActionTextMessage(String),
    ActionLoadHistoryConversation(String),
    ActionStartNewConversation,

    ActionUpdateOrCreateHistory(Option<Persona>, Vec<ConversationMessage>),
    ActionGenerateHistoryTitle(String),
    ActionDeleteHistory(String),
    ActionClearHistory,

    ActionLogin(String),
    ActionLoginSuccess(String),
    ActionLoginError(String),
    ActionLoginVerify(LoginVerifyPayload),
    ActionLoginVerifySuccess(LoginVerifyResponse),
    ActionLoginVerifyError(String),

    ActionAddDictionaryItem(String),
    ActionDeleteDictionaryItem(String),

    ActionAddTool(MCPServerConfig),
    ActionDeleteTool(String),
    ActionEnableTool(String),
    ActionDisableTool(String),
    ActionUpdateTool(MCPServerConfig),

    // TODO: FIX ALL EVENTS BELOW

    // Transcription events
    StartListening,
    StopListening,
    PauseTranscription,
    ResumeTranscription,
    TranscriptionError(String),
    ResetTranscription,
    ActionChangeTranscriptionModel(Option<String>),
    ActionChangeConversationModel(Option<String>),
    ActionUpdateWebsocketServerSettings(WebsocketServerSettingsPayload),
    // Recording window events
    ActionChangeTheme(Option<InterfaceTheme>),

    // Settings window events
    OpenSettings,
    CloseSettings,
    MinimizeSettings,
    ActionChangeOpenSettingsOnStart(bool),

    // Onboarding window events
    OpenOnboarding,
    CloseOnboarding,
    FinishOnboarding,

    // Shortcut events
    ActionResetRecordingShortcutTimer,
    ShortcutUpdate(Shortcuts),
    ShortcutPressed(String),

    // Input device events
    ActionChangeInputDevice(Option<String>),
    // KoboldCPP server events
    KoboldCppServerStateChange(KoboldCppServerState),

    ActionRemoveError(String),

    // Update events
    ActionCheckForUpdates,
    ActionUpdateAndRestart,

    // Permissions events
    ActionCheckAccessibilityPermission,
    ActionCheckAndRequestAccessibilityPermission,
    ActionRequestAccessibilityPermission,
    ActionCheckMicrophonePermission,
    ActionCheckAndRequestMicrophonePermission,
    ActionRequestMicrophonePermission,

    // Challenge events
    ActionChallengeCompleted(ChallengeName),
    ActionChangePersonaByVoice,
    ActionOpenSettingsFromTray,

    // Releases events
    ActionGetReleases,
    ActionGetReleasesSuccess(Vec<Release>),
    ActionGetReleasesError(String),
}
