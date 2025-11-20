use super::{
    Event, RecordingWindowState,
    processor::Processor,
    state::{AppStateContext, ConversationState},
};
use crate::state_machine::AppState;
use lazy_static::lazy_static;
use std::{str::FromStr, sync::Mutex, time::SystemTime};
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

lazy_static! {
    static ref KEYBIND_PROCESSOR: Mutex<KeybindsProcessor> = Mutex::new(KeybindsProcessor::new());
}

#[derive(Clone)]
struct RegisteredShortcuts {
    pub recording: Option<String>,
    pub close: Option<String>,
    pub personas: Option<String>,
    pub screenshot: Option<String>,
    pub copy_text: Option<String>,
    pub toggle_minimized: Option<String>,
    pub switch_language: Option<String>,
}

impl Default for RegisteredShortcuts {
    fn default() -> Self {
        Self {
            recording: None,
            close: None,
            personas: None,
            screenshot: None,
            copy_text: None,
            toggle_minimized: None,
            switch_language: None,
        }
    }
}

pub struct KeybindsProcessor {
    registered_shortcuts: RegisteredShortcuts,
}

impl KeybindsProcessor {
    pub fn new() -> Self {
        Self {
            registered_shortcuts: RegisteredShortcuts::default(),
        }
    }

    pub fn start(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        Processor::register_event_listener(
            "shortcuts",
            Box::new(|event, app_handle| match event {
                Event::ActionResetRecordingShortcutTimer => {
                    let app_context = AppState::get_context();
                    let timestamp = SystemTime::now();
                    let mut utils = app_context.utils.clone();
                    utils.recording_timer_ms = Some(timestamp);
                    AppState::update_utils(utils)?;

                    Ok(())
                }
                Event::ShortcutUpdate(shortcuts) => {
                    AppState::update_shortcuts(shortcuts.clone())?;
                    let app_context = AppState::get_context();
                    let mut keybind_processor = KEYBIND_PROCESSOR
                        .lock()
                        .expect("Failed to lock keybind processor");
                    keybind_processor.register_shortcuts(app_context, app_handle)?;

                    Ok(())
                }
                _ => {
                    let app_context = AppState::get_context();
                    let mut keybind_processor = KEYBIND_PROCESSOR
                        .lock()
                        .expect("Failed to lock keybind processor");
                    keybind_processor.register_shortcuts(app_context, app_handle)?;
                    Ok(())
                }
            }),
        );

        let app_context = AppState::get_context();

        KEYBIND_PROCESSOR
            .lock()
            .expect("Failed to lock keybind processor")
            .register_shortcuts(app_context, &app_handle)
            .ok();

        Ok(())
    }

    pub fn register_shortcuts(
        &mut self,
        app_context: AppStateContext,
        app_handle: &AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let recording_shortcut = app_context
            .shortcuts
            .recording
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");
        if self.registered_shortcuts.recording != Some(recording_shortcut.clone())
            && self.registered_shortcuts.recording.is_some()
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .recording
                    .as_ref()
                    .expect("Failed to get recording shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.recording = None;
        }

        if self.registered_shortcuts.recording.is_none() {
            let hotkey = Shortcut::from_str(&recording_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.recording = Some(recording_shortcut);
        }

        let toggle_minimized_shortcut = app_context
            .shortcuts
            .toggle_minimized
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");

        if self.registered_shortcuts.toggle_minimized != Some(toggle_minimized_shortcut.clone())
            && self.registered_shortcuts.toggle_minimized.is_some()
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .toggle_minimized
                    .as_ref()
                    .expect("Failed to get toggle minimized shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.toggle_minimized = None;
        }

        if self.registered_shortcuts.toggle_minimized.is_none() {
            let hotkey = Shortcut::from_str(&toggle_minimized_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.toggle_minimized = Some(toggle_minimized_shortcut);
        }

        let personas_shortcut = app_context
            .shortcuts
            .personas
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");
        if self.registered_shortcuts.personas != Some(personas_shortcut.clone())
            && self.registered_shortcuts.personas.is_some()
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .personas
                    .as_ref()
                    .expect("Failed to get personas shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.personas = None;
        }

        if self.registered_shortcuts.personas.is_none() {
            let hotkey = Shortcut::from_str(&personas_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.personas = Some(personas_shortcut);
        }

        let close_shortcut = app_context
            .shortcuts
            .close
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");
        if self.registered_shortcuts.close.is_none()
            && matches!(
                app_context.recording_window_context.state,
                RecordingWindowState::Open(_)
            )
        {
            let hotkey = Shortcut::from_str(&close_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.close = Some(close_shortcut);
        } else if self.registered_shortcuts.close.is_some()
            && matches!(
                app_context.recording_window_context.state,
                RecordingWindowState::Closed
            )
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .close
                    .as_ref()
                    .expect("Failed to get close shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.close = None;
        }

        let screenshot_shortcut = app_context
            .shortcuts
            .screenshot
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");

        if self.registered_shortcuts.screenshot.is_none()
            && (matches!(
                app_context.conversation_context.state,
                ConversationState::Listening | ConversationState::Idle
            ))
        {
            let hotkey = Shortcut::from_str(&screenshot_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.screenshot = Some(screenshot_shortcut);
        } else if self.registered_shortcuts.screenshot.is_some()
            && !(matches!(
                app_context.conversation_context.state,
                ConversationState::Listening | ConversationState::Idle
            ))
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .screenshot
                    .as_ref()
                    .expect("Failed to get screenshot shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.screenshot = None;
        }

        let copy_text_shortcut = app_context
            .shortcuts
            .copy_text
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");

        if self.registered_shortcuts.copy_text.is_none()
            && (matches!(
                app_context.conversation_context.state,
                ConversationState::Listening | ConversationState::Idle
            ))
        {
            let hotkey = Shortcut::from_str(&copy_text_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.copy_text = Some(copy_text_shortcut);
        } else if self.registered_shortcuts.copy_text.is_some()
            && !(matches!(
                app_context.conversation_context.state,
                ConversationState::Listening | ConversationState::Idle
            ))
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .copy_text
                    .as_ref()
                    .expect("Failed to get copy text shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.copy_text = None;
        }

        let switch_language_shortcut = app_context
            .shortcuts
            .switch_language
            .join("+")
            .to_uppercase()
            .replace("META", "SUPER");

        if self.registered_shortcuts.switch_language != Some(switch_language_shortcut.clone())
            && self.registered_shortcuts.switch_language.is_some()
        {
            let hotkey = Shortcut::from_str(
                &self
                    .registered_shortcuts
                    .switch_language
                    .as_ref()
                    .expect("Failed to get switch language shortcut"),
            )?;
            app_handle.global_shortcut().unregister(hotkey)?;
            self.registered_shortcuts.switch_language = None;
        }

        if self.registered_shortcuts.switch_language.is_none() {
            let hotkey = Shortcut::from_str(&switch_language_shortcut)?;
            app_handle.global_shortcut().register(hotkey).ok();
            self.registered_shortcuts.switch_language = Some(switch_language_shortcut);
        }

        Ok(())
    }
}
