use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::async_runtime::block_on;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

#[allow(dead_code)]
pub struct KoboldModelConfig {
    pub model_param: String,
    pub mmproj: Option<String>,
}
#[allow(dead_code)]
impl KoboldModelConfig {
    pub fn new(model_param: String, mmproj: Option<String>) -> Self {
        Self {
            model_param,
            mmproj,
        }
    }
}

/// Config struct for KoboldCPP model settings
#[derive(Debug, Serialize, Deserialize)]
pub struct KoboldConfig {
    // Required fields
    pub model_param: String,

    // Optional fields
    pub mmproj: Option<String>,

    // Other fields from the config
    #[serde(default)]
    pub model: Vec<String>,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_port")]
    pub port_param: u16,
    #[serde(default)]
    pub host: String,
    #[serde(default = "default_true")]
    pub launch: bool,
    #[serde(default)]
    pub config: Option<String>,
    #[serde(default = "default_threads")]
    pub threads: u16,
    #[serde(default)]
    pub usecublas: Option<bool>,
    #[serde(default)]
    pub usevulkan: Option<Vec<u8>>,
    #[serde(default)]
    pub useclblast: Option<bool>,
    #[serde(default)]
    pub usecpu: bool,
    #[serde(default = "default_context_size")]
    pub contextsize: u32,
    #[serde(default = "default_gpu_layers")]
    pub gpulayers: i16,

    // We'll skip defining all the other fields individually
    // and catch them using the serde flatten attribute
    #[serde(flatten)]
    pub extra_fields: serde_json::Map<String, Value>,
}

// Default functions for KoboldConfig
fn default_port() -> u16 {
    5001
}

fn default_true() -> bool {
    true
}

fn default_threads() -> u16 {
    15
}

fn default_context_size() -> u32 {
    4096
}

fn default_gpu_layers() -> i16 {
    100
}

#[allow(dead_code)]
impl KoboldConfig {
    /// Creates a new KoboldConfig with minimal required settings
    #[cfg(target_os = "macos")]
    pub fn new(model_param: String, mmproj: Option<String>, port: u16) -> Self {
        Self {
            model_param,
            mmproj,
            model: Vec::new(),
            port,
            port_param: port,
            host: String::new(),
            launch: default_true(),
            config: None,
            threads: 4,
            usecublas: None,
            usevulkan: None,
            useclblast: None,
            usecpu: true,
            contextsize: default_context_size(),
            gpulayers: -1,
            extra_fields: serde_json::Map::new(),
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn new(model_param: String, mmproj: Option<String>, port: u16) -> Self {
        Self {
            model_param,
            mmproj,
            model: Vec::new(),
            port,
            port_param: port,
            host: String::new(),
            launch: default_true(),
            config: None,
            threads: default_threads(),
            usecublas: None,
            usevulkan: Some(vec![]),
            useclblast: None,
            usecpu: false,
            contextsize: default_context_size(),
            gpulayers: default_gpu_layers(),
            extra_fields: serde_json::Map::new(),
        }
    }

    pub fn from_model_config(config: &KoboldModelConfig, port: u16) -> Self {
        KoboldConfig::new(config.model_param.clone(), config.mmproj.clone(), port)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KoboldCppServerEvent {
    StateChange(KoboldCppServerState),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KoboldCppServerState {
    Idle,
    Running(Option<String>, Option<String>),
    Error(String),
}

/// Manages the KoboldCPP server which runs via the ping-guard binary
#[allow(dead_code)]
pub struct KoboldCppServer {
    app_handle: Option<AppHandle>,
    api_port: u16,
    admin_dir: Mutex<Option<PathBuf>>,
    state_listener: Option<Box<dyn Fn(KoboldCppServerEvent) -> Result<(), String> + Send + Sync>>,
    is_running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KoboldModel {
    pub result: String,
}

lazy_static::lazy_static! {
    static ref EVENT_LISTENER: Mutex<Option<Box<dyn Fn(KoboldCppServerEvent) -> Result<(), String> + Send + Sync>>> = Mutex::new(None);
}

#[allow(dead_code)]
impl KoboldCppServer {
    /// Creates a new KoboldCppServer instance
    pub fn new() -> Self {
        Self {
            app_handle: None,
            api_port: 5001, // Default KoboldCPP API port
            admin_dir: Mutex::new(None),
            state_listener: None,
            is_running: false,
        }
    }

    /// Initializes the server with the given app handle
    pub fn with_app_handle(mut self, app_handle: AppHandle) -> Self {
        self.app_handle = Some(app_handle);
        self
    }

    pub fn with_state_listener(
        self,
        state_listener: Box<dyn Fn(KoboldCppServerEvent) -> Result<(), String> + Send + Sync>,
    ) -> Self {
        EVENT_LISTENER.lock().unwrap().replace(state_listener);
        self
    }

    /// Sets the port for the KoboldCPP API server
    pub fn with_api_port(mut self, port: u16) -> Self {
        self.api_port = port;
        self
    }

    /// Starts the KoboldCPP server via ping-guard and sets up the UDP ping task
    pub fn start(&mut self) -> Result<(), String> {
        if self.app_handle.is_none() {
            return Err("App handle not set".to_string());
        }

        if self.is_running {
            return Ok(());
        }

        let is_running = block_on(KoboldCppServer::check_if_running(self.get_api_port()));

        if is_running {
            self.notify_state_listener(KoboldCppServerState::Running(None, None))?;
        } else {
            self.start_server()?;
        }

        self.setup_server_state_listener();

        self.is_running = true;

        Ok(())
    }

    fn notify_state_listener(&self, state: KoboldCppServerState) -> Result<(), String> {
        if let Some(listener) = &self.state_listener {
            listener(KoboldCppServerEvent::StateChange(state))
        } else {
            Ok(())
        }
    }

    fn get_api_port(&self) -> u16 {
        self.api_port
    }

    fn setup_server_state_listener(&self) {
        let api_port = self.get_api_port();
        let mut failed_signals_count = 0;
        std::thread::spawn(move || loop {
            let is_running = block_on(KoboldCppServer::check_if_running(api_port));
            if is_running {
                EVENT_LISTENER
                    .lock()
                    .unwrap()
                    .as_ref()
                    .expect("State listener not set")(
                    KoboldCppServerEvent::StateChange(KoboldCppServerState::Running(None, None)),
                )
                .expect("Failed to notify state listener");
            } else {
                failed_signals_count += 1;
                if failed_signals_count < 3 {
                    continue;
                }
                EVENT_LISTENER
                    .lock()
                    .unwrap()
                    .as_ref()
                    .expect("State listener not set")(
                    KoboldCppServerEvent::StateChange(KoboldCppServerState::Idle),
                )
                .expect("Failed to notify state listener");
            }
            std::thread::sleep(std::time::Duration::from_secs(3));
        });
    }

    async fn check_if_running(api_port: u16) -> bool {
        let client = Client::new();
        let url = format!("http://localhost:{}/api/v1/model", api_port);
        let response = client.get(&url).send().await;
        match response {
            Ok(response) => response.status().is_success(),
            Err(e) => {
                eprintln!("Failed to check if KoboldCPP server is running: {}", e);
                false
            }
        }
    }

    pub async fn get_current_model(&self) -> Result<Option<String>, String> {
        let client = Client::new();
        let url = format!("http://localhost:{}/api/v1/model", self.api_port);
        let response = client.get(&url).send().await;
        match response {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<KoboldModel>().await {
                        Ok(json_response) => {
                            if json_response.result == "inactive" {
                                return Ok(None);
                            } else {
                                match json_response.result.split("/").skip(1).next() {
                                    Some(model) => Ok(Some(model.to_string())),
                                    None => Err("Failed to parse model name".to_string()),
                                }
                            }
                        }
                        Err(e) => {
                            let error_msg = format!("Failed to parse response: {}", e);
                            eprintln!("[KoboldCPP] {}", error_msg);
                            Err(error_msg)
                        }
                    }
                } else {
                    Err(format!(
                        "Failed to get current model: {}",
                        response.status()
                    ))
                }
            }
            Err(e) => {
                eprintln!("Failed to get current model: {}", e);
                Err(e.to_string())
            }
        }
    }

    /// Ensures that a null.kcpps file exists in the admin directory
    pub fn ensure_null_config(&self) -> Result<(), String> {
        // Get the admin directory
        let admin_dir = match self.admin_dir.lock() {
            Ok(lock) => match &*lock {
                Some(dir) => dir.clone(),
                None => return Err("Admin directory not set".to_string()),
            },
            Err(_) => return Err("Failed to lock admin directory".to_string()),
        };

        // Check if null.kcpps exists
        let null_path = admin_dir.join("null.kcpps");
        if !null_path.exists() {
            // Create a minimal config
            let config = json!({
                "model": [],
                "model_param": "",
                "port": self.api_port,
                "port_param": self.api_port,
                "host": "",
                "launch": true,
                "nomodel": true,
                "skiplauncher": true
            });

            // Write the config to null.kcpps
            fs::write(
                &null_path,
                serde_json::to_string_pretty(&config)
                    .map_err(|e| format!("Failed to serialize null config: {}", e))?,
            )
            .map_err(|e| format!("Failed to write null config file: {}", e))?;

            println!(
                "[KoboldCPP] Created null.kcpps file at: {}",
                null_path.display()
            );
        }

        Ok(())
    }

    /// Changes the model used by the KoboldCPP server by providing a config
    pub async fn change_model(&self, config: Option<KoboldModelConfig>) -> Result<(), String> {
        // Get the admin directory
        let admin_dir = match self.admin_dir.lock() {
            Ok(lock) => match &*lock {
                Some(dir) => dir.clone(),
                None => return Err("Admin directory not set".to_string()),
            },
            Err(_) => return Err("Failed to lock admin directory".to_string()),
        };

        // Determine config filename to use
        let config_filename = match config {
            Some(cfg) => {
                let config = KoboldConfig::from_model_config(&cfg, self.api_port);

                // Generate a unique filename for this config
                let uuid = Uuid::new_v4();
                let config_path = admin_dir.join(format!("{}.kcpps", uuid));

                // Save the config to a file
                self.save_config(&config_path, &config)?;

                // Return just the filename, not the full path
                format!("{}.kcpps", uuid)
            }
            None => {
                // Ensure null.kcpps exists
                self.ensure_null_config()?;
                "null.kcpps".to_string()
            }
        };

        // Call the Kobold API to reload the config
        self.reload_config(&config_filename).await
    }

    /// Saves a config to a file
    fn save_config(&self, path: &PathBuf, config: &KoboldConfig) -> Result<(), String> {
        // Serialize the config to JSON
        let config_json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        // Write the config to a file
        fs::write(path, config_json).map_err(|e| format!("Failed to write config file: {}", e))?;

        println!("[KoboldCPP] Saved config to: {}", path.display());
        Ok(())
    }

    /// Sends a request to reload the config
    async fn reload_config(&self, config_filename: &str) -> Result<(), String> {
        let client = Client::new();
        let url = format!("http://localhost:{}/api/admin/reload_config", self.api_port);

        // Create the request payload
        let payload = json!({
            "filename": config_filename
        });

        // Send the request
        println!(
            "[KoboldCPP] Changing model using config: {}",
            config_filename
        );

        match client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<Value>().await {
                        Ok(json_response) => {
                            println!(
                                "[KoboldCPP] Model changed successfully: {:?}",
                                json_response
                            );
                            Ok(())
                        }
                        Err(e) => {
                            let error_msg = format!("Failed to parse response: {}", e);
                            eprintln!("[KoboldCPP] {}", error_msg);
                            Err(error_msg)
                        }
                    }
                } else {
                    let error_msg = format!("Server returned error status: {}", response.status());
                    eprintln!("[KoboldCPP] {}", error_msg);
                    Err(error_msg)
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to send request: {}", e);
                eprintln!("[KoboldCPP] {}", error_msg);
                Err(error_msg)
            }
        }
    }

    /// Starts the KoboldCPP server using ping-guard
    fn start_server(&self) -> Result<(), String> {
        let app_handle = self.app_handle.as_ref().unwrap();

        let sidecar_command = app_handle.shell().sidecar("koboldcpp").unwrap();

        let admin_dir = app_handle
            .path()
            .resolve("kobold-configs", tauri::path::BaseDirectory::Resource)
            .unwrap();

        // Store the admin_dir in the struct
        if let Ok(mut lock) = self.admin_dir.lock() {
            *lock = Some(admin_dir.clone());
        } else {
            return Err("Failed to lock admin directory".to_string());
        }

        // Ensure the null config exists
        self.ensure_null_config()?;

        let (mut rx, mut _tx) = sidecar_command
            .args(&[
                "--usevulkan",
                "--nomodel",
                "--skiplauncher",
                "--port",
                &self.api_port.to_string(),
                "--admin",
                "--admindir",
                admin_dir.to_string_lossy().to_string().as_str(),
            ])
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar command: {}", e))?;

        // Set up log handling
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        println!("[KoboldCPP] {}", String::from_utf8_lossy(&line))
                    }
                    CommandEvent::Stderr(line) => {
                        eprintln!("[KoboldCPP] {}", String::from_utf8_lossy(&line))
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }
}
