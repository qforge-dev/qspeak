use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::{Event, SettingsWindowState, processor::Processor};
use crate::state_machine::AppState;

pub struct SettingsWindowProcessor {}

impl SettingsWindowProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "settings_window",
            Box::new(|event, app_handle| {
                let app_context = AppState::get_context();
                match (event, app_context.settings_window_context.state.clone()) {
                    (Event::OpenSettings, _) => {
                        let app_handle = app_handle;
                        let window = get_or_create_settings_window(app_handle);
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                        AppState::update_settings_window_state(SettingsWindowState::Open)
                    }

                    (Event::CloseSettings, _) => {
                        let app_handle = app_handle;
                        let window = get_or_create_settings_window(app_handle);
                        let _ = window.close();
                        AppState::update_settings_window_state(SettingsWindowState::Closed)
                    }

                    (Event::MinimizeSettings, _) => {
                        let app_handle = app_handle;
                        let window = get_or_create_settings_window(app_handle);
                        let _ = window.minimize();
                        Ok(())
                    }

                    (Event::ActionChangeOpenSettingsOnStart(open_settings_on_start), _) => {
                        AppState::update_open_settings_on_start(open_settings_on_start)
                    }

                    _ => Ok(()),
                }
            }),
        );
    }
}

fn get_or_create_settings_window(app_handle: &AppHandle) -> WebviewWindow {
    if let Some(window) = app_handle.get_webview_window("settings") {
        window
    } else {
        let window = WebviewWindowBuilder::new(
            app_handle,
            "settings",
            WebviewUrl::App(PathBuf::from("settings.html")),
        )
        .title("Settings")
        .inner_size(1000.0, 670.0)
        .center()
        .visible(false)
        .resizable(false)
        .decorations(false)
        .always_on_top(false)
        .transparent(true)
        .build()
        .expect("Failed to create settings window");

        let app_handle_clone = app_handle.clone();
        let window_clone = window.clone();
        window.on_window_event(move |event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let windows = app_handle_clone.webview_windows();
                let window_count = windows.len();

                if window_count <= 1 {
                    // This is the last window, hide instead of closing to keep app alive
                    api.prevent_close();
                    let _ = window_clone.hide();
                    let _ = AppState::update_settings_window_state(SettingsWindowState::Closed);
                } else {
                    // Other windows are open, allow normal close to free up RAM
                    let _ = AppState::update_settings_window_state(SettingsWindowState::Closed);
                }
            }
            _ => {}
        });

        window
    }
}
