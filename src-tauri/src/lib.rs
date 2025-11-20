use device_query::{DeviceQuery, DeviceState, Keycode};
#[allow(unused_imports)]
use std::{
    any::{Any, TypeId},
    borrow::Cow,
    str::FromStr,
    sync::mpsc,
    time::{Duration, SystemTime},
};
use std::{net::TcpStream, sync::Mutex};
use tauri::Manager;
use tauri_plugin_fs::FsExt;
use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};
use tauri_plugin_sentry::{minidump, sentry};
// Add the state machine module
mod api;
mod constants;
mod feature_flags;
mod state_machine;

use state_machine::{
    Event,
    account::AccountProcessor,
    challenges::ChallengeProcessor,
    history::HistoryProcessor,
    new_app::{AppProcessor, cleanup_children},
    new_conversation::ConversationProcessor,
    new_mcp_processor::MCPProcessor,
    new_models::ModelsProcessor,
    new_onboarding_window::OnboardingWindowProcessor,
    new_personas::PersonasProcessor,
    new_recording_window::RecordingWindowProcessor,
    new_settings_window::SettingsWindowProcessor,
    new_shortcuts::KeybindsProcessor,
    new_update::UpdateProcessor,
    permissions::PermissionsProcessor,
    processor::Processor,
    releases::ReleasesProcessor,
    state::{AppState, AppStateChannelMessage, AppStateContext, ConversationState},
    websocket_server::WebsocketServerProcessor,
};

use crate::state_machine::new_recording_window::{RestoringWindowState, WindowStateCache};
mod koboldcpp_server;
mod llm;
// Add the koboldcpp server module

// KoboldCPP server state

#[tauri::command]
async fn get_new_app_state() -> Result<AppStateContext, String> {
    let app_state = AppState::get_context();
    Ok(app_state)
}

#[tauri::command]
async fn subscribe_to_new_app_state(
    channel: tauri::ipc::Channel<AppStateChannelMessage>,
) -> Result<(), String> {
    let receiver = AppState::subscribe();
    tauri::async_runtime::spawn(async move {
        channel
            .send(AppStateChannelMessage::FullState(AppState::get_context()))
            .expect("Failed to send initial app state");
        while let Ok(state) = receiver.recv() {
            match channel.send(state) {
                Ok(_) => (),
                Err(_) => {
                    break;
                }
            }
        }
    });
    Ok(())
}

#[tauri::command]
async fn get_audio_devices() -> Result<Vec<String>, String> {
    let device_names =
        tauri::async_runtime::spawn_blocking(|| qspeak_audio_recording::get_audio_input_devices())
            .await // Await the completion of the spawned task
            .map_err(|e| format!("Thread join error: {}", e))? // Handle any join errors
            .map_err(|e| format!("Device enumeration error: {}", e))?; // Handle any device enumeration errors

    Ok(device_names)
}

// New command to send any event to all state machines
#[tauri::command]
async fn event(event: Event) -> Result<(), String> {
    Processor::process_event(event.clone()).expect("Failed to process event");

    Ok(())
}

#[tauri::command]
fn listen_for_audio_data(channel: tauri::ipc::Channel<Vec<i16>>) -> Result<(), String> {
    Processor::register_audio_listener(Box::new(move |data| {
        channel.send(data).expect("Failed to send audio data");
        Ok(())
    }));
    Ok(())
}

#[tauri::command]
async fn check_online() -> bool {
    TcpStream::connect_timeout(&"8.8.8.8:53".parse().unwrap(), Duration::from_secs(3)).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    let client = sentry::init({});

    #[cfg(not(debug_assertions))]
    let client = sentry::init((
        "https://d3d5518de0f2a26658ad89b4c63c5307@o4509276259155968.ingest.de.sentry.io/4509276261580880",
        sentry::ClientOptions {
            release: Some(Cow::Borrowed("0.2.11")),
            debug: true,
            attach_stacktrace: true,
            ..Default::default()
        },
    ));

    let _guard = minidump::init(&client);

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| ()))
        .plugin(tauri_plugin_sentry::init(&client))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::default()
                .with_handler(move |_app_handle, shortcut, event| {
                    let app_context = AppState::get_context();

                    let recording_shortcut =
                        Shortcut::from_str(&app_context.shortcuts.recording.join("+"))
                            .expect("Failed to parse recording shortcut");

                    let close_shortcut = Shortcut::from_str(&app_context.shortcuts.close.join("+"))
                        .expect("Failed to parse close shortcut");

                    let personas_shortcut =
                        Shortcut::from_str(&app_context.shortcuts.personas.join("+"))
                            .expect("Failed to parse personas shortcut");

                    let screenshot_shortcut =
                        Shortcut::from_str(&app_context.shortcuts.screenshot.join("+"))
                            .expect("Failed to parse screenshot shortcut");

                    let copy_text_shortcut =
                        Shortcut::from_str(&app_context.shortcuts.copy_text.join("+"))
                            .expect("Failed to parse copy text shortcut");

                    let toggle_minimized_shortcut =
                        Shortcut::from_str(&app_context.shortcuts.toggle_minimized.join("+"))
                            .expect("Failed to parse toggle minimized shortcut");

                    let switch_language_shortcut =
                        Shortcut::from_str(&app_context.shortcuts.switch_language.join("+"))
                            .expect("Failed to parse switch language shortcut");

                    match event.state {
                        ShortcutState::Pressed => {
                            if &recording_shortcut == shortcut {
                                Processor::process_event(Event::ActionResetRecordingShortcutTimer)
                                    .expect(
                                        "Failed to process reset recording shortcut timer event",
                                    );
                                Processor::process_event(Event::ActionRecording)
                                    .expect("Failed to process recording event");
                            }

                            if &personas_shortcut == shortcut {
                                Processor::process_event(Event::ActionPersona)
                                    .expect("Failed to process persona event");
                            }
                        }
                        ShortcutState::Released => {
                            if &recording_shortcut == shortcut {
                                // if timer is more thatn 500ms, process recording event
                                // and if recording state is recording, process recording event
                                let conversation_state = app_context.conversation_context.state;
                                if let Some(timestamp) = app_context.utils.recording_timer_ms {
                                    if timestamp.elapsed().unwrap().as_millis() > 500 {
                                        if conversation_state == ConversationState::Listening {
                                            Processor::process_event(Event::ActionRecording)
                                                .expect("Failed to process recording event");
                                        }
                                    }
                                }
                            }

                            if &close_shortcut == shortcut {
                                Processor::process_event(Event::ActionCloseRecordingWindow)
                                    .expect("Failed to process close recording window event");
                            }

                            if &personas_shortcut == shortcut {
                                let app_context = AppState::get_context();

                                if app_context.shortcuts.personas.len() == 1 {
                                    Processor::process_event(Event::ActionPersonaCycleEnd)
                                        .expect("Persona shortcut has only one key");
                                    return;
                                }

                                std::thread::spawn(move || {
                                    let modifier_key =
                                        app_context.shortcuts.personas.first().unwrap();

                                    let dev = DeviceState::new();
                                    loop {
                                        let keys = dev.get_keys();
                                        let modifier_key_still_down = match modifier_key.as_str() {
                                            "Control" => {
                                                keys.contains(&Keycode::LControl)
                                                    || keys.contains(&Keycode::RControl)
                                            }
                                            "Shift" => {
                                                keys.contains(&Keycode::LShift)
                                                    || keys.contains(&Keycode::RShift)
                                            }
                                            "Alt" => {
                                                keys.contains(&Keycode::LAlt)
                                                    || keys.contains(&Keycode::RAlt)
                                            }
                                            _ => false,
                                        };

                                        if !modifier_key_still_down {
                                            Processor::process_event(Event::ActionPersonaCycleEnd)
                                                .expect("failed to hide view");
                                            break;
                                        }

                                        std::thread::sleep(Duration::from_millis(50));
                                    }
                                });
                            }

                            if &screenshot_shortcut == shortcut {
                                Processor::process_event(Event::ActionScreenshot)
                                    .expect("Failed to process screenshot event");
                            }

                            if &copy_text_shortcut == shortcut {
                                Processor::process_event(Event::ActionCopyText)
                                    .expect("Failed to process copy text event");
                            }

                            if &toggle_minimized_shortcut == shortcut {
                                Processor::process_event(
                                    Event::ActionToggleRecordingWindowMinimized,
                                )
                                .expect("Failed to process toggle minimized event");
                            }

                            if &switch_language_shortcut == shortcut {
                                Processor::process_event(
                                    Event::ActionSwitchToNextPreferredLanguage,
                                )
                                .expect("Failed to process switch language event");
                            }
                        }
                    }
                })
                .build(),
        );

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_devtools::init());
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::new()
            .targets(vec![
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                    file_name: Some("logs.log".to_string()),
                }),
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            ])
            .max_file_size(1024 * 1024 * 100) // 100MB
            .level(log::LevelFilter::Info)
            .filter(|metadata| metadata.target() != "tracing::span")
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
            .build(),
    );

    let app = builder
        .setup(|app| {
            app.manage(RestoringWindowState(Mutex::new(())));
            WindowStateCache::load_static(&app.handle().clone());
            let (sender, receiver) = mpsc::channel();
            AppState::set_app_handle(app.handle().clone());
            AppState::load_context_from_store().expect("Failed to load context from store");

            let app_context = AppState::get_context();
            let user_email = app_context
                .account_context
                .account
                .email
                .as_deref()
                .unwrap_or("email_not_set");

            sentry::configure_scope(|scope| {
                scope.set_user(Some(sentry::User {
                    email: Some(user_email.into()),
                    ..Default::default()
                }));
            });

            Processor::start(app.handle().clone(), sender, receiver)
                .expect("Failed to start processor");
            AppProcessor::start(app.handle().clone()).expect("Failed to start app processor");
            RecordingWindowProcessor::start();
            ModelsProcessor::start().expect("Failed to start models processor");
            SettingsWindowProcessor::start();
            OnboardingWindowProcessor::start();
            PersonasProcessor::start();
            ConversationProcessor::start();
            KeybindsProcessor::start(app.handle().clone())
                .expect("Failed to start keybinds processor");
            HistoryProcessor::start();
            AccountProcessor::start();
            UpdateProcessor::start().expect("Failed to start update processor");
            PermissionsProcessor::start();
            ChallengeProcessor::start();
            MCPProcessor::start().expect("Failed to start MCP processor");
            ReleasesProcessor::start();
            WebsocketServerProcessor::start().expect("Failed to start websocket server processor");
            // KoboldCppServerProcessor::start(app.handle().clone())?;

            let scope = app.fs_scope();
            let cache_dir = app
                .path()
                .cache_dir()
                .expect("Failed to get cache dir")
                .join("audio");
            std::fs::create_dir_all(&cache_dir).expect("Failed to create audio dir");
            scope.allow_directory(cache_dir, true)?;

            let app_context = AppState::get_context();
            if app_context.transcription_model.is_none()
                || app_context.conversation_model.is_none()
                || app_context.input_device.is_none()
                || app_context.account_context.account.token.is_none()
            {
                Processor::process_event(Event::OpenOnboarding)
                    .expect("Failed to process open onboarding window event");
            } else if app_context.settings_window_context.open_settings_on_start {
                Processor::process_event(Event::OpenSettings)
                    .expect("Failed to process open settings window event");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_audio_devices,
            listen_for_audio_data,
            check_online,
            event,
            get_new_app_state,
            subscribe_to_new_app_state,
        ])
        .build(tauri::generate_context!())
        .expect("Failed to build app");
    app.run(move |app_handle, event| match event {
        tauri::RunEvent::Exit { .. } => {
            WindowStateCache::save_static(&app_handle);
            cleanup_children().expect("Failed to cleanup children");
        }
        _ => (),
    })
}
