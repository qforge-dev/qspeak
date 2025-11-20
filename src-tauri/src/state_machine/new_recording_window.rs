use std::{
    fs::File,
    path::PathBuf,
    sync::{Arc, Mutex, Once},
};

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{
    AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use super::{
    Event, RecordingWindowState,
    processor::Processor,
    state::{RecordingWindowContext, RecordingWindowView},
};
use crate::state_machine::{AppState, state::RecordingWindowPosition};

static INIT: Once = Once::new();
pub struct RestoringWindowState(pub Mutex<()>);

lazy_static! {
    static ref WINDOW_STATE_CACHE: Arc<Mutex<WindowStateCache>> =
        Arc::new(Mutex::new(WindowStateCache::new()));
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowStateCache {
    maximized_state: WindowState,
    minimized_state: WindowState,
}

trait WindowExtension {
    fn move_window(&self, recording_window_context: RecordingWindowContext);
    fn resize_window(&self, recording_window_context: RecordingWindowContext);
}

impl WindowStateCache {
    fn new() -> Self {
        Self {
            minimized_state: WindowState::default(),
            maximized_state: WindowState::default(),
        }
    }

    pub fn save_static(app_handle: &AppHandle) {
        let window_state_cache = WINDOW_STATE_CACHE.lock().unwrap();
        window_state_cache.save(app_handle);
    }

    pub fn load_static(app_handle: &AppHandle) {
        let mut window_state_cache = WINDOW_STATE_CACHE.lock().unwrap();
        window_state_cache.load(app_handle);
    }

    fn save(&self, app_handle: &AppHandle) {
        let state_path = app_handle
            .path()
            .cache_dir()
            .expect("Failed to get cache dir")
            .join("window_state.json");

        if !state_path.exists() {
            let _ = std::fs::create_dir_all(state_path.parent().unwrap());
        }

        println!("Saving window state to: {:?}", state_path);

        std::fs::write(state_path, serde_json::to_string_pretty(&*self).unwrap()).unwrap();
    }

    fn load(&mut self, app_handle: &AppHandle) {
        let state_path = app_handle
            .path()
            .cache_dir()
            .expect("Failed to get cache dir")
            .join("window_state.json");

        println!("Loading window state from: {:?}", state_path);

        if !state_path.exists() {
            println!("Window state file does not exist, creating it");
            let _ = std::fs::create_dir_all(state_path.parent().unwrap());
            std::fs::write(state_path, serde_json::to_string_pretty(&*self).unwrap()).unwrap();
            return;
        }

        let file = File::open(state_path).unwrap();
        match serde_json::from_reader::<_, WindowStateCache>(file) {
            Ok(window_state_cache) => {
                self.maximized_state = window_state_cache.maximized_state;
                self.minimized_state = window_state_cache.minimized_state;
            }
            Err(e) => {
                println!("Failed to load window state cache: {}", e);
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct WindowState {
    width: u32,
    height: u32,
    x: f64,
    y: f64,

    prev_x: f64,
    prev_y: f64,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 0,
            height: 0,
            x: 0.0,
            y: 0.0,
            prev_x: 0.0,
            prev_y: 0.0,
        }
    }
}

pub struct RecordingWindowProcessor {}

impl RecordingWindowProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "recording_window",
            Box::new(|event, app_handle| {
                let app_context = AppState::get_context();
                match (event, app_context.recording_window_context.state.clone()) {
                    (Event::ActionCenterWindow, _) => {
                        AppState::update_recording_window_state(RecordingWindowState::Open(
                            RecordingWindowView::Recording,
                        ))
                        .ok();
                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        let _ = window.show();
                        let _ = window.center();
                        let _ = window.set_focus();
                        Ok(())
                    }
                    (Event::ActionOpenRecordingWindow, RecordingWindowState::Closed) => {
                        AppState::update_recording_window_state(RecordingWindowState::Open(
                            RecordingWindowView::Recording,
                        ))
                        .ok();

                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        window.move_window(app_context.recording_window_context.clone());

                        Ok(())
                    }

                    (
                        Event::ActionToggleRecordingWindowMinimized,
                        RecordingWindowState::Open(RecordingWindowView::Recording),
                    ) => {
                        match app_context.recording_window_context.minimized {
                            true => {
                                AppState::update_recording_window_minimized(false)
                                    .expect("Failed to update recording window minimized");
                            }
                            false => {
                                AppState::update_recording_window_minimized(true)
                                    .expect("Failed to update recording window minimized");
                            }
                        }

                        let app_context = AppState::get_context();

                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        window.move_window(app_context.recording_window_context.clone());
                        window.resize_window(app_context.recording_window_context.clone());

                        Ok(())
                    }
                    (
                        Event::ActionToggleRecordingWindowMinimized,
                        RecordingWindowState::Open(RecordingWindowView::Persona),
                    ) => {
                        match app_context.recording_window_context.minimized {
                            true => {
                                AppState::update_recording_window_minimized(false)
                                    .expect("Failed to update recording window minimized");
                                AppState::update_recording_window_state(
                                    RecordingWindowState::Open(RecordingWindowView::Persona),
                                )
                                .unwrap();
                            }
                            false => {
                                AppState::update_recording_window_minimized(true)
                                    .expect("Failed to update recording window minimized");
                            }
                        }

                        let app_context = AppState::get_context();

                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        window.move_window(app_context.recording_window_context.clone());
                        window.resize_window(app_context.recording_window_context.clone());

                        Ok(())
                    }

                    (Event::ActionRecording, RecordingWindowState::Closed) => {
                        AppState::update_recording_window_state(RecordingWindowState::Open(
                            RecordingWindowView::Recording,
                        ))
                        .ok();
                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        window.move_window(app_context.recording_window_context.clone());

                        Ok(())
                    }

                    (Event::ActionPersona, RecordingWindowState::Closed) => {
                        AppState::update_recording_window_previous_state(Some(
                            RecordingWindowState::Closed,
                        ))
                        .expect("Failed to update recording window previous state");

                        AppState::update_recording_window_state(RecordingWindowState::Open(
                            RecordingWindowView::Persona,
                        ))
                        .expect("Failed to update recording window state");

                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        window.move_window(app_context.recording_window_context.clone());

                        Ok(())
                    }

                    (
                        Event::ActionPersona,
                        RecordingWindowState::Open(RecordingWindowView::Persona),
                    ) => {
                        Processor::process_event(Event::ActionPersonaCycleNext)
                            .expect("Failed to process persona cycle next event");

                        Ok(())
                    }

                    (
                        Event::ActionPersona,
                        RecordingWindowState::Open(RecordingWindowView::Recording),
                    ) => {
                        AppState::update_recording_window_state(RecordingWindowState::Open(
                            RecordingWindowView::Persona,
                        ))
                        .expect("Failed to update recording window state");

                        Processor::process_event(Event::ActionPersonaCycleNext)
                            .expect("Failed to process persona cycle next event");

                        AppState::update_recording_window_previous_state(Some(
                            RecordingWindowState::Open(RecordingWindowView::Recording),
                        ))
                        .expect("Failed to update recording window previous state");

                        Ok(())
                    }

                    (
                        Event::ActionPersonaCycleNext,
                        RecordingWindowState::Open(RecordingWindowView::Persona),
                    ) => cycle_to_next_persona(),

                    (
                        Event::ActionPersonaCycleNext,
                        RecordingWindowState::Open(RecordingWindowView::Recording),
                    ) => cycle_to_next_persona(),

                    (Event::ActionPersonaCycleEnd, _) => {
                        match app_context.utils.recording_window_previous_state {
                            Some(RecordingWindowState::Closed) => {
                                Processor::process_event(Event::ActionCloseRecordingWindow)
                                    .expect("Failed to process close recording window event");
                            }
                            Some(RecordingWindowState::Open(RecordingWindowView::Recording)) => {
                                AppState::update_recording_window_state(
                                    RecordingWindowState::Open(RecordingWindowView::Recording),
                                )
                                .expect("Failed to update recording window state");
                            }
                            _ => (),
                        }
                        Ok(())
                    }

                    (Event::ActionRecording, RecordingWindowState::Open(_)) => {
                        let window = get_or_create_window(
                            app_handle,
                            app_context.recording_window_context.clone(),
                        );
                        let _ = window.show();
                        AppState::update_recording_window_state(RecordingWindowState::Open(
                            RecordingWindowView::Recording,
                        ))
                    }

                    (Event::ActionCloseRecordingWindow, RecordingWindowState::Open(_)) => {
                        AppState::update(|context| {
                            context.utils.recording_window_previous_state = None;
                            context.recording_window_context.state = RecordingWindowState::Closed;
                        })
                        .expect("Failed to update recording window previous state");

                        let app_handle = app_handle.clone();
                        let window = get_or_create_window(
                            &app_handle,
                            app_context.recording_window_context.clone(),
                        );

                        let _ = window.hide();

                        Ok(())
                    }

                    (Event::ActionChangeTheme(theme), _) => AppState::update_theme(theme),

                    _ => Ok(()),
                }
            }),
        );
    }
}

fn cycle_to_next_persona() -> Result<(), Box<dyn std::error::Error>> {
    let app_context = AppState::get_context();
    let personas = &app_context.personas_context.personas;

    if personas.is_empty() {
        return Ok(());
    }

    let current_persona = app_context.active_persona.clone();

    if current_persona.is_none() {
        let first_persona = personas.first().cloned();
        return AppState::update_active_persona(first_persona);
    }

    let current_index = personas
        .iter()
        .position(|p| p.id == current_persona.as_ref().unwrap().id)
        .unwrap_or(0);

    if current_index == personas.len() - 1 {
        AppState::update_active_persona(None)
    } else {
        let next_persona = personas.get(current_index + 1).cloned();
        AppState::update_active_persona(next_persona)
    }
}

#[allow(dead_code)]
fn get_or_create_window(
    app_handle: &AppHandle,
    recording_window_context: RecordingWindowContext,
) -> WebviewWindow {
    println!("Getting or creating window");
    let window = if let Some(window) = app_handle.get_webview_window("recorder") {
        println!("Window already exists");
        println!("Window inner position: {:?}", window.inner_position());
        println!("Window size: {:?}", window.inner_size());
        window
    } else {
        println!("Creating new window");
        let window_size = get_window_size(recording_window_context.clone());
        let window_position = get_window_position(recording_window_context.clone());

        #[cfg(target_os = "macos")]
        let mut window_builder = WebviewWindowBuilder::new(
            app_handle,
            "recorder",
            WebviewUrl::App(PathBuf::from("recorder.html")),
        )
        .title("qSpeak")
        .inner_size(
            window_size.to_logical(1.0).width,
            window_size.to_logical(1.0).height,
        )
        .visible(false)
        .resizable(!recording_window_context.minimized)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .focused(false)
        .hidden_title(true)
        .title_bar_style(TitleBarStyle::Transparent)
        .shadow(false);

        #[cfg(not(target_os = "macos"))]
        let mut window_builder = WebviewWindowBuilder::new(
            app_handle,
            "recorder",
            WebviewUrl::App(PathBuf::from("recorder.html")),
        )
        .title("qSpeak")
        .inner_size(
            window_size.to_logical(1.0).width,
            window_size.to_logical(1.0).height,
        )
        .visible(false)
        .resizable(!recording_window_context.minimized)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .focused(false);

        if let Some(position) = window_position {
            println!("Setting window position: {:?}", position);
            window_builder = window_builder.position(position.x, position.y);
        }

        let window = window_builder
            .build()
            .expect("Failed to create recording window");

        // Set minimum size constraints for regular (non-minimized) windows
        if !recording_window_context.minimized {
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize {
                width: 500.0,
                height: 400.0,
            })));
        }

        window
    };

    INIT.call_once(|| {
        let window_clone = window.clone();
        window.on_window_event(move |event| match event {
            tauri::WindowEvent::Resized(size) => {
                if window_clone
                    .state::<RestoringWindowState>()
                    .0
                    .try_lock()
                    .is_ok()
                    && !window_clone.is_minimized().unwrap_or_default()
                    && window_clone.is_visible().unwrap_or_default()
                {
                    if AppState::get_context().recording_window_context.minimized {
                        let window_state = &mut WINDOW_STATE_CACHE.lock().unwrap().minimized_state;
                        window_state.width = size.width;
                        window_state.height = size.height;
                    } else {
                        let window_state = &mut WINDOW_STATE_CACHE.lock().unwrap().maximized_state;
                        window_state.width = size.width;
                        window_state.height = size.height;
                    }
                }
            }
            tauri::WindowEvent::Moved(position) => {
                if window_clone
                    .state::<RestoringWindowState>()
                    .0
                    .try_lock()
                    .is_ok()
                    && !window_clone.is_minimized().unwrap_or_default()
                    && window_clone.is_visible().unwrap_or_default()
                {
                    if AppState::get_context().recording_window_context.minimized {
                        let window_state = &mut WINDOW_STATE_CACHE.lock().unwrap().minimized_state;
                        window_state.prev_x = window_state.x;
                        window_state.prev_y = window_state.y;
                        window_state.x = position.x as f64;
                        window_state.y = position.y as f64;
                    } else {
                        let window_state = &mut WINDOW_STATE_CACHE.lock().unwrap().maximized_state;
                        window_state.prev_x = window_state.x;
                        window_state.prev_y = window_state.y;
                        window_state.x = position.x as f64;
                        window_state.y = position.y as f64;
                    }
                }
            }
            _ => (),
        });
    });

    window
}

fn get_window_size(recording_window_context: RecordingWindowContext) -> tauri::Size {
    if let RecordingWindowState::Open(RecordingWindowView::Persona) = recording_window_context.state
    {
        return tauri::Size::Logical(tauri::LogicalSize {
            width: 500.0,
            height: 400.0,
        });
    }

    if recording_window_context.minimized {
        tauri::Size::Logical(tauri::LogicalSize {
            width: 110.0,
            height: 25.0,
        })
    } else {
        tauri::Size::Logical(tauri::LogicalSize {
            width: 500.0,
            height: 400.0,
        })
    }
}

fn get_window_position(
    recording_window_context: RecordingWindowContext,
) -> Option<RecordingWindowPosition> {
    let window_state_cache = WINDOW_STATE_CACHE.lock().unwrap();
    println!("Window state cache: {:?}", window_state_cache);
    if recording_window_context.minimized {
        return Some(RecordingWindowPosition {
            x: window_state_cache.minimized_state.x as f64,
            y: window_state_cache.minimized_state.y as f64,
        });
    }

    Some(RecordingWindowPosition {
        x: window_state_cache.maximized_state.x as f64,
        y: window_state_cache.maximized_state.y as f64,
    })
}

impl WindowExtension for WebviewWindow {
    fn move_window(self: &WebviewWindow, recording_window_context: RecordingWindowContext) {
        let _ = self.show();
        let window_position = get_window_position(recording_window_context);

        if let Some(position) = window_position {
            let window_size = self.inner_size().unwrap();
            let mut fits_on_screen = false;

            // Check if window fits on any screen
            if let Ok(screens) = self.available_monitors() {
                for screen in screens {
                    let screen_position = screen.position();
                    let screen_size = screen.size();

                    // Check if window fits within screen bounds
                    if position.x >= screen_position.x as f64
                        && position.y >= screen_position.y as f64
                        && position.x + window_size.width as f64
                            <= screen_position.x as f64 + screen_size.width as f64
                        && position.y + window_size.height as f64
                            <= screen_position.y as f64 + screen_size.height as f64
                    {
                        fits_on_screen = true;
                        break;
                    }
                }
            }

            if fits_on_screen {
                let _ = self.set_position(PhysicalPosition {
                    x: position.x as f64,
                    y: position.y as f64,
                });
            } else {
                let _ = self.center();
            }
        }
    }

    fn resize_window(self: &WebviewWindow, recording_window_context: RecordingWindowContext) {
        let window_size = get_window_size(recording_window_context.clone());
        let _ = self.set_size(window_size);
        
        if recording_window_context.minimized {
            let _ = self.set_resizable(false);
        } else {
            let _ = self.set_resizable(true);
            let _ = self.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize {
                width: 500.0,
                height: 400.0,
            })));
        }
    }
}
