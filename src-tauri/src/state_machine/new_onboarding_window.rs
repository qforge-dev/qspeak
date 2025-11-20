use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::{Event, OnboardingWindowState, processor::Processor};
use crate::state_machine::AppState;

pub struct OnboardingWindowProcessor {}

impl OnboardingWindowProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "onboarding_window",
            Box::new(|event, app_handle| {
                let app_context = AppState::get_context();
                match (event, app_context.onboarding_window_context.state.clone()) {
                    (Event::OpenOnboarding, OnboardingWindowState::Closed) => {
                        let app_handle = app_handle;
                        let window = get_or_create_onboarding_window(app_handle);
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                        AppState::update_onboarding_window_state(OnboardingWindowState::Open)
                    }

                    (Event::CloseOnboarding, OnboardingWindowState::Open) => {
                        let app_handle = app_handle;
                        let window = get_or_create_onboarding_window(app_handle);
                        let _ = window.close();
                        AppState::update_onboarding_window_state(OnboardingWindowState::Closed)
                    }

                    (Event::FinishOnboarding, OnboardingWindowState::Open) => {
                        let app_handle = app_handle;
                        let window = get_or_create_onboarding_window(app_handle);
                        let _ = window.close();
                        AppState::update_onboarding_window_state(OnboardingWindowState::Closed)
                            .ok();
                        Processor::process_event(Event::OpenSettings).ok();
                        Ok(())
                    }

                    _ => Ok(()),
                }
            }),
        );
    }
}

#[allow(dead_code)]
fn get_or_create_onboarding_window(app_handle: &AppHandle) -> WebviewWindow {
    if let Some(window) = app_handle.get_webview_window("onboarding") {
        window
    } else {
        #[cfg(target_os = "macos")]
        let window = WebviewWindowBuilder::new(
            app_handle,
            "onboarding",
            WebviewUrl::App(PathBuf::from("onboarding.html")),
        )
        .title("qSpeak")
        .inner_size(1200.0, 700.0)
        .center()
        .visible(false)
        .resizable(false)
        .decorations(false)
        .always_on_top(false)
        .transparent(true)
        .build()
        .expect("Failed to create onboarding window");
        #[cfg(not(target_os = "macos"))]
        let window = WebviewWindowBuilder::new(
            app_handle,
            "onboarding",
            WebviewUrl::App(PathBuf::from("onboarding.html")),
        )
        .title("qSpeak")
        .inner_size(1200.0, 700.0)
        .center()
        .visible(false)
        .resizable(false)
        .decorations(false)
        .always_on_top(false)
        .transparent(true)
        .build()
        .expect("Failed to create onboarding window");

        window
    }
}
