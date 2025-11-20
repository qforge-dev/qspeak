use std::{error::Error, process, sync::Mutex};

use kill_tree::{Config, blocking::kill_tree_with_config};
use lazy_static::lazy_static;
use strum::IntoEnumIterator;
use tauri::{
    AppHandle, Manager,
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem, Submenu},
    tray::TrayIconBuilder,
};

use super::{Event, Language, events::WebsocketServerSettingsPayload, processor::Processor};
use crate::state_machine::AppState;

lazy_static! {
    static ref APP_PROCESSOR: Mutex<AppProcessor> = Mutex::new(AppProcessor::new());
}

pub struct AppProcessor {
    language_submenu: Option<Submenu<tauri::Wry>>,
    input_device_submenu: Option<Submenu<tauri::Wry>>,
    websocket_server_item: Option<CheckMenuItem<tauri::Wry>>,
}

impl AppProcessor {
    pub fn new() -> Self {
        Self {
            language_submenu: None,
            input_device_submenu: None,
            websocket_server_item: None,
        }
    }

    pub fn start(app_handle: AppHandle) -> Result<(), Box<dyn Error>> {
        Processor::register_event_listener(
            "app",
            Box::new(|event, _app_handle| match event {
                Event::ActionChangeTranscriptionLanguage(language) => {
                    AppState::update_language(language.clone())?;

                    let event_id = format!("language_{}", language.to_str());
                    let app_processor = APP_PROCESSOR.lock().expect("Failed to lock app processor");
                    app_processor
                        .language_submenu
                        .as_ref()
                        .expect("Failed to get language submenu")
                        .items()
                        .iter_mut()
                        .for_each(|items| {
                            items.iter_mut().for_each(|item| {
                                if item
                                    .as_check_menuitem()
                                    .expect("Failed to get check menu item")
                                    .id()
                                    == event_id.clone()
                                {
                                    item.as_check_menuitem()
                                        .expect("Failed to get check menu item")
                                        .set_checked(true)
                                        .expect("Failed to set check menu item to true");
                                } else {
                                    item.as_check_menuitem()
                                        .expect("Failed to get check menu item")
                                        .set_checked(false)
                                        .expect("Failed to set check menu item to false");
                                }
                            });
                        });
                    Ok(())
                }
                Event::ActionSwitchToNextPreferredLanguage => {
                    AppState::switch_to_next_preferred_language()?;

                    // Update the tray menu to reflect the new language selection
                    let app_context = AppState::get_context();
                    let event_id = format!("language_{}", app_context.language.to_str());
                    let app_processor = APP_PROCESSOR.lock().expect("Failed to lock app processor");
                    app_processor
                        .language_submenu
                        .as_ref()
                        .expect("Failed to get language submenu")
                        .items()
                        .iter_mut()
                        .for_each(|items| {
                            items.iter_mut().for_each(|item| {
                                if item
                                    .as_check_menuitem()
                                    .expect("Failed to get check menu item")
                                    .id()
                                    == event_id.clone()
                                {
                                    item.as_check_menuitem()
                                        .expect("Failed to get check menu item")
                                        .set_checked(true)
                                        .expect("Failed to set check menu item to true");
                                } else {
                                    item.as_check_menuitem()
                                        .expect("Failed to get check menu item")
                                        .set_checked(false)
                                        .expect("Failed to set check menu item to false");
                                }
                            });
                        });
                    Ok(())
                }
                Event::ActionUpdatePreferredLanguages(preferred_languages) => {
                    AppState::update_preferred_languages(preferred_languages)?;
                    Ok(())
                }
                Event::ActionChangeInputDevice(device) => {
                    AppState::update_input_device(device.clone())?;

                    let device = device.unwrap_or_default();
                    let event_id = format!("device_{}", device.clone());
                    let app_processor = APP_PROCESSOR.lock().expect("Failed to lock app processor");
                    app_processor
                        .input_device_submenu
                        .as_ref()
                        .expect("Failed to get input device submenu")
                        .items()
                        .iter_mut()
                        .for_each(|items| {
                            items.iter_mut().for_each(|item| {
                                if item
                                    .as_check_menuitem()
                                    .expect("Failed to get check menu item")
                                    .id()
                                    == event_id.clone()
                                {
                                    item.as_check_menuitem()
                                        .expect("Failed to get check menu item")
                                        .set_checked(true)
                                        .expect("Failed to set check menu item to true");
                                } else {
                                    item.as_check_menuitem()
                                        .expect("Failed to get check menu item")
                                        .set_checked(false)
                                        .expect("Failed to set check menu item to false");
                                }
                            });
                        });
                    Ok(())
                }
                Event::ActionChangeInterfaceLanguage(language) => {
                    AppState::update_interface_language(language.clone())
                }
                Event::ActionChangeTranscriptionModel(model) => {
                    AppState::update_transcription_model(model.clone())
                }
                Event::ActionChangeConversationModel(model) => {
                    AppState::update_conversation_model(model.clone())
                }
                Event::ActionUpdateWebsocketServerSettings(settings) => {
                    AppState::update_websocket_server_settings(settings.clone())?;

                    let app_processor = APP_PROCESSOR.lock().expect("Failed to lock app processor");
                    if let Some(toggle) = app_processor.websocket_server_item.as_ref() {
                        toggle
                            .set_checked(settings.enabled)
                            .expect("Failed to set websocket toggle state");
                    }

                    Ok(())
                }
                Event::ActionChangePersona(persona) => {
                    AppState::update_active_persona(persona.clone())
                }
                Event::ActionRemoveError(error_id) => AppState::remove_error(error_id),
                _ => Ok(()),
            }),
        );

        setup_tray(app_handle)?;
        setup_onboarding()?;
        setup_kill_switch()?;

        Ok(())
    }
}

pub fn cleanup_children() -> Result<(), Box<dyn Error>> {
    let current_process_id = std::process::id();
    let config = Config {
        include_target: false,
        ..Default::default()
    };
    let result = kill_tree_with_config(current_process_id, &config);
    log::info!(
        "Kill switch triggered, killed {} processes",
        result.expect("Failed to kill tree").len()
    );
    Ok(())
}

fn setup_kill_switch() -> Result<(), Box<dyn Error>> {
    ctrlc::set_handler(move || {
        cleanup_children().expect("Failed to cleanup children");
        process::exit(0);
    })?;

    Ok(())
}

fn setup_onboarding() -> Result<(), Box<dyn Error>> {
    let context = AppState::get_context();
    let display_onboarding = context.input_device.is_none()
        || context.transcription_model.is_none()
        || context.conversation_model.is_none();

    if display_onboarding {
        Processor::process_event(Event::OpenOnboarding)?;
    }

    Ok(())
}

fn setup_tray(app_handle: AppHandle) -> Result<(), Box<dyn Error>> {
    let image = Image::from_path(
        app_handle
            .path()
            .resolve("icons/icon.png", tauri::path::BaseDirectory::Resource)
            .expect("Failed to resolve icon path"),
    )
    .expect("Failed to create image");

    let tray = {
        #[cfg(target_os = "macos")]
        {
            TrayIconBuilder::with_id("tray")
                .tooltip("qSpeak")
                .icon(image)
                .icon_as_template(true)
                .build(&app_handle)
                .expect("tray failed")
        }

        #[cfg(not(target_os = "macos"))]
        {
            TrayIconBuilder::with_id("tray")
                .tooltip("qSpeak")
                .icon(image)
                .build(&app_handle)
                .expect("tray failed")
        }
    };

    let context = AppState::get_context();

    let current_language = context.language;
    let current_input_device = context.input_device;
    let language_submenu = create_language_submenu(&app_handle, &current_language);
    let input_device_submenu = create_input_device_submenu(&app_handle, &current_input_device);

    let submenus = vec![language_submenu.clone(), input_device_submenu.clone()];
    let websocket_enabled = context.websocket_server_context.enabled;
    let (menu, websocket_toggle_item) = build_tray_menu(&app_handle, submenus, websocket_enabled);
    let _ = tray.set_menu(Some(menu));

    let language_submenu_clone = language_submenu.clone();
    let input_device_submenu_clone = input_device_submenu.clone();
    let mut app_processor = APP_PROCESSOR.lock().expect("Failed to lock app processor");
    app_processor.language_submenu = Some(language_submenu_clone);
    app_processor.input_device_submenu = Some(input_device_submenu_clone);
    app_processor.websocket_server_item = Some(websocket_toggle_item.clone());

    tray.on_menu_event(move |app, event| {
        let event_id = event.id.as_ref();

        if event_id.starts_with("language_") {
            let language = event_id
                .split("_")
                .nth(1)
                .expect("Failed to get language from event id");
            let language = Language::from_str(language).unwrap_or(Language::English);

            Processor::process_event(Event::ActionChangeTranscriptionLanguage(language))
                .expect("Failed to process change transcription language event");
        }

        if event_id.starts_with("device_") {
            let device = event_id
                .split("_")
                .nth(1)
                .expect("Failed to get device from event id");
            let device = Some(device.to_string());
            Processor::process_event(Event::ActionChangeInputDevice(device))
                .expect("Failed to process change input device event");
        }

        match event_id {
            "quit" => {
                cleanup_children().expect("Failed to cleanup children");
                app.exit(0);
            }
            "recording" => {
                Processor::process_event(Event::ActionOpenRecordingWindow)
                    .expect("Failed to process open recording window event");
            }
            "settings" => {
                Processor::process_event(Event::OpenSettings)
                    .expect("Failed to process open settings event");

                Processor::process_event(Event::ActionOpenSettingsFromTray)
                    .expect("Failed to process open settings from tray event");

                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.eval("window.location.hash = '/settings';");
                }
            }
            "home" => {
                Processor::process_event(Event::OpenSettings)
                    .expect("Failed to process open settings event");

                Processor::process_event(Event::ActionOpenSettingsFromTray)
                    .expect("Failed to process open settings from tray event");

                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.eval("window.location.hash = '/';");
                }
            }
            "onboarding" => {
                Processor::process_event(Event::OpenOnboarding)
                    .expect("Failed to process open onboarding event");
            }
            "center_window" => {
                Processor::process_event(Event::ActionCenterWindow)
                    .expect("Failed to process center window event");
            }
            "websocket_server_toggle" => {
                let context = AppState::get_context();
                let target_state = !context.websocket_server_context.enabled;
                Processor::process_event(Event::ActionUpdateWebsocketServerSettings(
                    WebsocketServerSettingsPayload {
                        enabled: target_state,
                        port: context.websocket_server_context.port,
                        password: context.websocket_server_context.password.clone(),
                    },
                ))
                .expect("Failed to toggle websocket server");
            }
            _ => {}
        }
    });
    Ok(())
}

fn build_tray_menu(
    app_handle: &AppHandle,
    submenus: Vec<Submenu<tauri::Wry>>,
    websocket_enabled: bool,
) -> (Menu<tauri::Wry>, CheckMenuItem<tauri::Wry>) {
    let recording_i = MenuItem::with_id(app_handle, "recording", "Recording", true, None::<&str>)
        .expect("Failed to create recording menu item");
    let center_window_i = MenuItem::with_id(
        app_handle,
        "center_window",
        "Center Recording Window",
        true,
        None::<&str>,
    )
    .expect("Failed to create center window menu item");
    let quit_i = MenuItem::with_id(app_handle, "quit", "Quit", true, None::<&str>)
        .expect("Failed to create quit menu item");
    let settings_i = MenuItem::with_id(app_handle, "settings", "Settings", true, None::<&str>)
        .expect("Failed to create settings menu item");
    let home_i = MenuItem::with_id(app_handle, "home", "Home", true, None::<&str>)
        .expect("Failed to create home menu item");
    let onboarding_i =
        MenuItem::with_id(app_handle, "onboarding", "Onboarding", true, None::<&str>)
            .expect("Failed to create onboarding menu item");
    let websocket_toggle_i = CheckMenuItem::with_id(
        app_handle,
        "websocket_server_toggle",
        "WebSocket Server",
        true,
        websocket_enabled,
        None::<&str>,
    )
    .expect("Failed to create WebSocket server toggle");

    let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<_>> = vec![
        &recording_i,
        &center_window_i,
        &home_i,
        &settings_i,
        &onboarding_i,
    ];

    for submenu in &submenus {
        menu_items.push(submenu);
    }

    menu_items.push(&websocket_toggle_i);
    menu_items.push(&quit_i);

    let menu = Menu::with_items(app_handle, &menu_items).expect("Failed to create tray menu");
    (menu, websocket_toggle_i)
}

fn create_language_submenu(
    app_handle: &AppHandle,
    current_language: &Language,
) -> Submenu<tauri::Wry> {
    let mut language_check_items = Vec::new();

    for lang in Language::iter() {
        let menu_id = format!("language_{}", lang.to_str());
        let is_checked = lang.to_str() == current_language.to_str();

        let check_item = CheckMenuItem::with_id(
            app_handle,
            menu_id.as_str(),
            lang.get_display_name(),
            true,
            is_checked,
            None::<&str>,
        )
        .expect("Failed to create language check item");

        language_check_items.push(check_item);
    }

    let language_refs: Vec<&dyn tauri::menu::IsMenuItem<_>> = language_check_items
        .iter()
        .map(|item| item as &dyn tauri::menu::IsMenuItem<_>)
        .collect();

    Submenu::with_items(app_handle, "Language", true, &language_refs)
        .expect("Failed to create language submenu")
}

fn create_input_device_submenu(
    app_handle: &AppHandle,
    current_input_device: &Option<String>,
) -> Submenu<tauri::Wry> {
    let mut input_device_menu_items = Vec::new();

    if let Ok(devices) = qspeak_audio_recording::get_audio_input_devices() {
        for device_name in devices {
            let menu_id = format!("device_{}", device_name.clone());
            let is_checked = device_name.to_string()
                == current_input_device.clone().unwrap_or_default().to_string();
            let check_item = CheckMenuItem::with_id(
                app_handle,
                menu_id.as_str(),
                &device_name,
                true,
                is_checked,
                None::<&str>,
            )
            .expect("Failed to create input device check item");

            input_device_menu_items.push(check_item);
        }
    } else {
        log::info!("No devices found");
    }

    let input_device_refs: Vec<&dyn tauri::menu::IsMenuItem<_>> = input_device_menu_items
        .iter()
        .map(|item| item as &dyn tauri::menu::IsMenuItem<_>)
        .collect();

    Submenu::with_items(app_handle, "Device", true, &input_device_refs)
        .expect("Failed to create input device submenu")
}
