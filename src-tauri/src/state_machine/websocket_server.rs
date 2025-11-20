use std::{
    error::Error,
    sync::{Arc, Mutex},
};

use futures_util::{SinkExt, StreamExt};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use tauri::async_runtime::{self, JoinHandle};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::oneshot,
};
use tokio_tungstenite::{accept_async, tungstenite::Message};

use crate::state_machine::{
    Event,
    errors::AppError,
    events::WebsocketServerSettingsPayload,
    processor::Processor,
    state::AppState,
};

pub struct WebsocketServerProcessor;

impl WebsocketServerProcessor {
    pub fn start() -> Result<(), Box<dyn Error>> {
        Processor::register_event_listener(
            "websocket_server",
            Box::new(|event, _app_handle| match event {
                Event::ActionUpdateWebsocketServerSettings(settings) => {
                    WebsocketServerController::apply_settings(settings)?;
                    Ok(())
                }
                _ => Ok(()),
            }),
        );

        let context = AppState::get_context();
        WebsocketServerController::apply_settings(WebsocketServerSettingsPayload {
            enabled: context.websocket_server_context.enabled,
            port: context.websocket_server_context.port,
            password: context.websocket_server_context.password.clone(),
        })?;

        Ok(())
    }
}

lazy_static! {
    static ref WEBSOCKET_SERVER: Mutex<WebsocketServerController> =
        Mutex::new(WebsocketServerController::new());
}

#[derive(Clone, PartialEq, Eq)]
struct WebsocketServerConfig {
    port: u16,
    password: Option<String>,
}

struct WebsocketServerHandle {
    shutdown: Option<oneshot::Sender<()>>,
    task: JoinHandle<()>,
    config: WebsocketServerConfig,
}

struct WebsocketServerController {
    handle: Option<WebsocketServerHandle>,
}

impl WebsocketServerController {
    fn new() -> Self {
        Self { handle: None }
    }

    fn apply_settings(settings: WebsocketServerSettingsPayload) -> Result<(), Box<dyn Error>> {
        let mut guard = WEBSOCKET_SERVER.lock().expect("Failed to lock websocket server");
        guard.apply_settings_internal(settings)
    }

    fn apply_settings_internal(
        &mut self,
        settings: WebsocketServerSettingsPayload,
    ) -> Result<(), Box<dyn Error>> {
        if !settings.enabled {
            self.stop();
            return Ok(());
        }

        let config = WebsocketServerConfig {
            port: settings.port,
            password: settings.password,
        };

        let requires_restart = self
            .handle
            .as_ref()
            .map(|handle| handle.config != config)
            .unwrap_or(true);

        if !requires_restart {
            return Ok(());
        }

        self.stop();
        self.start(config)
    }

    fn start(&mut self, config: WebsocketServerConfig) -> Result<(), Box<dyn Error>> {
        let listener = match async_runtime::block_on(async { TcpListener::bind(("0.0.0.0", config.port)).await }) {
            Ok(listener) => listener,
            Err(err) => {
                report_error(format!(
                    "Unable to start WebSocket server on port {}: {}",
                    config.port, err
                ));
                return Err(Box::new(err));
            }
        };
        let bound_port = listener.local_addr().map(|addr| addr.port()).unwrap_or(config.port);
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let runtime_config = config.clone();

        let task = async_runtime::spawn(async move {
            if let Err(err) = run_server(listener, runtime_config, shutdown_rx).await {
                log::error!("WebSocket server stopped: {}", err);
            }
        });

        self.handle = Some(WebsocketServerHandle {
            shutdown: Some(shutdown_tx),
            task,
            config,
        });

        log::info!("WebSocket server listening on 0.0.0.0:{}", bound_port);

        Ok(())
    }

    fn stop(&mut self) {
        if let Some(mut handle) = self.handle.take() {
            if let Some(shutdown) = handle.shutdown.take() {
                let _ = shutdown.send(());
            }

            async_runtime::spawn(async move {
                let _ = handle.task.await;
            });

            log::info!("WebSocket server stopped");
        }
    }
}

async fn run_server(
    listener: TcpListener,
    config: WebsocketServerConfig,
    mut shutdown_rx: oneshot::Receiver<()>,
) -> Result<(), Box<dyn Error>> {
    let shared_config = Arc::new(config);

    loop {
        tokio::select! {
            _ = &mut shutdown_rx => {
                break;
            }
            accept_result = listener.accept() => {
                match accept_result {
                    Ok((stream, _)) => {
                        let config = Arc::clone(&shared_config);
                        async_runtime::spawn(async move {
                            if let Err(err) = handle_connection(stream, config).await {
                                log::error!("WebSocket connection error: {}", err);
                            }
                        });
                    }
                    Err(err) => {
                        log::error!("WebSocket accept error: {}", err);
                        continue;
                    }
                }
            }
        }
    }

    Ok(())
}

async fn handle_connection(
    stream: TcpStream,
    config: Arc<WebsocketServerConfig>,
) -> Result<(), Box<dyn Error>> {
    let mut ws_stream = accept_async(stream).await?;
    log::info!("WebSocket client connected");

    while let Some(message) = ws_stream.next().await {
        match message {
            Ok(Message::Text(text)) => {
                let (success, response_message) = process_message(&text, &config);
                let response = serde_json::to_string(&WebsocketResponse {
                    success,
                    message: response_message,
                })?;

                ws_stream.send(Message::Text(response)).await?;
            }
            Ok(Message::Close(_)) => {
                break;
            }
            Ok(Message::Ping(payload)) => {
                ws_stream.send(Message::Pong(payload)).await?;
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Binary(_)) => {
                let response = serde_json::to_string(&WebsocketResponse {
                    success: false,
                    message: "Binary payloads are not supported".to_string(),
                })?;
                ws_stream.send(Message::Text(response)).await?;
            }
            Ok(Message::Frame(_)) => {}
            Err(err) => {
                return Err(Box::new(err));
            }
        }
    }

    log::info!("WebSocket client disconnected");
    Ok(())
}

fn process_message(payload: &str, config: &WebsocketServerConfig) -> (bool, String) {
    let command = match serde_json::from_str::<WebsocketCommand>(payload) {
        Ok(command) => command,
        Err(err) => {
            return (
                false,
                format!("Invalid payload: {}", err),
            );
        }
    };

    if let Err(err) = verify_password(config, command.password.as_deref()) {
        return (false, err);
    }

    let action_label = command.action.as_str();
    match execute_action(&command.action) {
        Ok(_) => (true, format!("Action '{}' executed", action_label)),
        Err(err) => (
            false,
            format!("Failed to execute '{}': {}", action_label, err),
        ),
    }
}

fn verify_password(
    config: &WebsocketServerConfig,
    provided: Option<&str>,
) -> Result<(), String> {
    match (&config.password, provided) {
        (None, _) => Ok(()),
        (Some(expected), Some(actual)) if expected == actual => Ok(()),
        (Some(_), Some(_)) => Err("Invalid password".to_string()),
        (Some(_), None) => Err("Password is required".to_string()),
    }
}

fn execute_action(action: &RemoteAction) -> Result<(), Box<dyn Error>> {
    match action {
        RemoteAction::ToggleRecording => {
            Processor::process_event(Event::ActionResetRecordingShortcutTimer)?;
            Processor::process_event(Event::ActionRecording)?;
        }
        RemoteAction::ShowPersonas => {
            Processor::process_event(Event::ActionPersona)?;
        }
        RemoteAction::CloseRecordingWindow => {
            Processor::process_event(Event::ActionCloseRecordingWindow)?;
        }
        RemoteAction::PersonaCycleEnd => {
            Processor::process_event(Event::ActionPersonaCycleEnd)?;
        }
        RemoteAction::PersonaCycleNext => {
            Processor::process_event(Event::ActionPersonaCycleNext)?;
        }
        RemoteAction::TakeScreenshot => {
            Processor::process_event(Event::ActionScreenshot)?;
        }
        RemoteAction::CopyText => {
            Processor::process_event(Event::ActionCopyText)?;
        }
        RemoteAction::ToggleMinimized => {
            Processor::process_event(Event::ActionToggleRecordingWindowMinimized)?;
        }
        RemoteAction::SwitchLanguage => {
            Processor::process_event(Event::ActionSwitchToNextPreferredLanguage)?;
        }
    }

    Ok(())
}

#[derive(Deserialize)]
struct WebsocketCommand {
    action: RemoteAction,
    #[serde(default)]
    password: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum RemoteAction {
    ToggleRecording,
    #[serde(rename = "show_personas", alias = "toggle_personas", alias = "open_personas")]
    ShowPersonas,
    CloseRecordingWindow,
    PersonaCycleEnd,
    PersonaCycleNext,
    #[serde(rename = "take_screenshot", alias = "screenshot")]
    TakeScreenshot,
    CopyText,
    ToggleMinimized,
    SwitchLanguage,
}

impl RemoteAction {
    fn as_str(&self) -> &'static str {
        match self {
            RemoteAction::ToggleRecording => "toggle_recording",
            RemoteAction::ShowPersonas => "show_personas",
            RemoteAction::CloseRecordingWindow => "close_recording_window",
            RemoteAction::PersonaCycleEnd => "persona_cycle_end",
            RemoteAction::PersonaCycleNext => "persona_cycle_next",
            RemoteAction::TakeScreenshot => "take_screenshot",
            RemoteAction::CopyText => "copy_text",
            RemoteAction::ToggleMinimized => "toggle_minimized",
            RemoteAction::SwitchLanguage => "switch_language",
        }
    }
}

#[derive(Serialize)]
struct WebsocketResponse {
    success: bool,
    message: String,
}

fn report_error(message: String) {
    log::error!("{}", &message);
    let _ = AppState::update(|context| {
        context.errors.push(AppError::with_message(message));
    });
}
