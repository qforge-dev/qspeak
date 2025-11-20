use std::{borrow::Cow, collections::HashMap, error::Error, process::Stdio, sync::Arc};

use rmcp::{
    RoleClient, ServiceExt,
    model::{CallToolRequestParam, CallToolResult, JsonObject, Tool},
    service::RunningService,
    transport::SseTransport,
    transport::TokioChildProcess,
};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::block_on;
use tokio::process::Command;
use uuid::Uuid;

use crate::state_machine::AppState;
use crate::state_machine::errors::AppError;

use super::{Event, processor::Processor};

pub struct MCPClient {
    client: RunningService<RoleClient, ()>,
    name: String,
}

pub struct MCPClientTool {
    pub name: String,
    pub tool: Tool,
}

#[derive(Debug)]
pub enum MCPError {
    ClientNotFound(String),
    ServerStartFailed {
        name: String,
        source: Box<dyn Error + Send + Sync>,
    },
    ServerDisableFailed {
        name: String,
        source: Box<dyn Error + Send + Sync>,
    },
    ToolCallFailed(Box<dyn Error + Send + Sync>),
}

impl std::fmt::Display for MCPError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MCPError::ClientNotFound(name) => write!(f, "Client not found: {}", name),
            MCPError::ServerStartFailed { name, source } => {
                write!(f, "Failed to start server {}: {}", name, source)
            }
            MCPError::ServerDisableFailed { name, source } => {
                write!(f, "Failed to disable server {}: {}", name, source)
            }
            MCPError::ToolCallFailed(source) => write!(f, "Tool call failed: {}", source),
        }
    }
}

impl std::error::Error for MCPError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            MCPError::ServerStartFailed { source, .. } => Some(source.as_ref()),
            MCPError::ServerDisableFailed { source, .. } => Some(source.as_ref()),
            MCPError::ToolCallFailed(source) => Some(source.as_ref()),
            _ => None,
        }
    }
}

pub struct MCPProcessor {}

impl MCPProcessor {
    pub fn start() -> Result<(), Box<dyn Error>> {
        Self::register_event_handlers();
        std::thread::spawn(|| {
            Self::start_enabled_servers().unwrap();
        });
        Ok(())
    }

    fn validate_tool_key_uniqueness_for_new_tool(tool: &MCPServerConfig) -> Result<(), Box<dyn Error>> {
        let context = AppState::get_context();
        
        let key_exists = context
            .mcp_context
            .server_configs
            .iter()
            .any(|existing| existing.key == tool.key);
        
        if key_exists {
            return Self::throw_error_if_key_exists(tool);
        }

        Ok(())
    }

    fn validate_tool_key_uniqueness_for_update(tool: &MCPServerConfig) -> Result<(), Box<dyn Error>> {
        let context = AppState::get_context();
        
        let key_exists = context
            .mcp_context
            .server_configs
            .iter()
            .any(|existing| existing.key == tool.key && existing.id != tool.id);

            if key_exists {
           return Self::throw_error_if_key_exists(tool);
        }

        Ok(())
    }

    fn throw_error_if_key_exists(tool: &MCPServerConfig) -> Result<(), Box<dyn Error>> {
        AppState::update(|context| {
            context.errors.push(AppError::with_message(format!(
                "Tool key '{}' already exists. Please choose a unique key.",
                tool.key
            )));
        })?;
        return Err("Duplicate tool key".into());
    }

    fn register_event_handlers() {
        Processor::register_event_listener(
            "mcp_processor",
            Box::new(|event, _app_handle| match event {
                Event::ActionAddTool(tool) => {
                    log::info!("Adding tool: {:?}", tool);

                    if let Err(_) = Self::validate_tool_key_uniqueness_for_new_tool(&tool) {
                        return Ok(());
                    }

                    AppState::update(|context| {
                        let mut new_tool = tool.clone();
                        // Set initial state based on enabled flag
                        new_tool.state = if tool.enabled {
                            MCPServerState::Disabled
                        } else {
                            MCPServerState::Disabled
                        };
                        context.mcp_context.server_configs.push(new_tool);
                    })?;

                    // If the new tool should be enabled, start it
                    if tool.enabled {
                        log::info!("Enabling new tool: {}", tool.key);
                        Self::handle_enable_tool(tool.key)?;
                    }

                    Ok(())
                }

                Event::ActionUpdateTool(tool) => {
                    log::info!("Updating tool: {:?}", tool);
                  
                    if let Err(_) = Self::validate_tool_key_uniqueness_for_update(&tool) {
                        return Ok(());
                    }

                    // Check if tool exists and if it's currently enabled/running
                    let context = AppState::get_context();
                    let existing_tool = context
                        .mcp_context
                        .server_configs
                        .iter()
                        .find(|existing| existing.id == tool.id);

                    match existing_tool {
                        Some(existing) if existing.enabled => {
                            log::info!("Tool {} is running, disabling before update", tool.key);

                            // Set state to Stopping before starting the disable/update/enable process
                            AppState::update(|context| {
                                if let Some(existing_tool) = context
                                    .mcp_context
                                    .server_configs
                                    .iter_mut()
                                    .find(|t| t.id == tool.id)
                                {
                                    existing_tool.state = MCPServerState::Stopping;
                                    log::info!(
                                        "Tool {} state set to Stopping for update",
                                        existing_tool.key
                                    );
                                }
                            })?;

                            // Spawn thread to disable first, then update, then re-enable if needed
                            let tool_clone = tool.clone();
                            std::thread::spawn(move || {
                                log::info!(
                                    "Started thread to disable, update, and re-enable tool: {}",
                                    tool_clone.key
                                );

                                // First disable the server using the OLD key (before update)
                                let context = AppState::get_context();
                                let old_key = context
                                    .mcp_context
                                    .server_configs
                                    .iter()
                                    .find(|t| t.id == tool_clone.id)
                                    .map(|t| t.key.clone())
                                    .unwrap_or_else(|| tool_clone.key.clone());

                                let disable_result = block_on(Self::async_disable_server(&old_key));
                                log::info!("Disable result before update: {:?}", disable_result);

                                // Update the configuration regardless of disable result
                                let _ = AppState::update(|context| {
                                    if let Some(existing_tool) = context
                                        .mcp_context
                                        .server_configs
                                        .iter_mut()
                                        .find(|t| t.id == tool_clone.id)
                                    {
                                        let mut updated_tool = tool_clone.clone();
                                        // Preserve state until we know the final result
                                        if disable_result.is_err() {
                                            updated_tool.state = MCPServerState::Error;
                                        } else if tool_clone.enabled {
                                            updated_tool.state = MCPServerState::Starting;
                                        } else {
                                            updated_tool.state = MCPServerState::Disabled;
                                        }
                                        *existing_tool = updated_tool;
                                        log::info!("Tool {} configuration updated", tool_clone.key);
                                    }
                                });

                                // If the updated tool should be enabled, start it with the NEW key
                                if tool_clone.enabled {
                                    log::info!("Re-enabling updated tool: {}", tool_clone.key);
                                    let enable_result =
                                        block_on(Self::async_enable_server(&tool_clone.key));
                                    log::info!("Enable result after update: {:?}", enable_result);

                                    let _ = AppState::update(|context| {
                                        if let Some(existing_tool) = context
                                            .mcp_context
                                            .server_configs
                                            .iter_mut()
                                            .find(|t| t.id == tool_clone.id)
                                        {
                                            match enable_result {
                                                Ok(()) => {
                                                    existing_tool.state = MCPServerState::Enabled;
                                                }
                                                Err(ref e) => {
                                                    existing_tool.state = MCPServerState::Error;
                                                    log::error!(
                                                        "Failed to re-enable tool after update: {}",
                                                        e
                                                    );
                                                }
                                            }
                                        }
                                    });

                                    if let Err(e) = enable_result {
                                        let _ = AppState::update(|context| {
                                            context.errors.push(AppError::with_message(format!(
                                                "Tool '{}' updated but failed to restart: {}",
                                                tool_clone.key, e
                                            )));
                                        });
                                    }
                                }

                                if let Err(e) = disable_result {
                                    log::error!(
                                        "Warning: Failed to cleanly disable tool before update: {}",
                                        e
                                    );
                                    let _ = AppState::update(|context| {
                                        context.errors.push(AppError::with_message(format!(
                                        "Warning: Tool '{}' updated but may not have shut down cleanly: {}",
                                        tool_clone.key, e
                                    )));
                                    });
                                }
                            });
                        }
                        Some(_) => {
                            // Tool exists but not enabled, just update it
                            log::info!("Tool {} is not running, updating directly", tool.key);
                            AppState::update(|context| {
                                if let Some(existing_tool) = context
                                    .mcp_context
                                    .server_configs
                                    .iter_mut()
                                    .find(|t| t.id == tool.id)
                                {
                                    let mut updated_tool = tool.clone();
                                    // Preserve the current state since it's not running
                                    updated_tool.state = existing_tool.state.clone();
                                    *existing_tool = updated_tool;
                                    log::info!("Tool {} configuration updated", tool.key);
                                }
                            })?;

                            // If the updated tool should be enabled, start it
                            if tool.enabled {
                                log::info!("Enabling updated tool: {}", tool.key);
                                Self::handle_enable_tool(tool.key)?;
                            }
                        }
                        None => {
                            log::info!(
                                "Tool {} not found in configuration, adding as new tool",
                                tool.key
                            );
                            AppState::update(|context| {
                                let mut new_tool = tool.clone();
                                // Set initial state based on enabled flag
                                new_tool.state = if tool.enabled {
                                    MCPServerState::Disabled // Will be changed to Starting by handle_enable_tool
                                } else {
                                    MCPServerState::Disabled
                                };
                                context.mcp_context.server_configs.push(new_tool);
                                log::info!("Tool {} added to configuration", tool.key);
                            })?;

                            // If the new tool should be enabled, start it
                            if tool.enabled {
                                log::info!("Enabling new tool: {}", tool.key);
                                Self::handle_enable_tool(tool.key)?;
                            }
                        }
                    }

                    Ok(())
                }

                Event::ActionDeleteTool(id) => {
                    log::info!("Deleting tool: {:?}", id);

                    // Check if tool is currently enabled/running
                    let context = AppState::get_context();
                    let tool_config = context
                        .mcp_context
                        .server_configs
                        .iter()
                        .find(|tool| tool.id == id);

                    match tool_config {
                        Some(tool) if tool.enabled => {
                            log::info!("Tool {} is running, disabling before deletion", tool.key);

                            // Set state to Stopping before starting the disable/delete process
                            AppState::update(|context| {
                                if let Some(tool) = context
                                    .mcp_context
                                    .server_configs
                                    .iter_mut()
                                    .find(|t| t.id == id)
                                {
                                    tool.state = MCPServerState::Stopping;
                                    log::info!(
                                        "Tool {} state set to Stopping for deletion",
                                        tool.key
                                    );
                                }
                            })?;

                            // Spawn thread to disable first, then delete
                            let id_clone = id.clone();
                            let key_clone = tool.key.clone();
                            std::thread::spawn(move || {
                                log::info!(
                                    "Started thread to disable and delete tool: {}",
                                    key_clone
                                );

                                // First disable the server using the key
                                let disable_result =
                                    block_on(Self::async_disable_server(&key_clone));
                                log::info!("Disable result before deletion: {:?}", disable_result);

                                // Then delete from config regardless of disable result using id
                                let _ = AppState::update(|context| {
                                    context
                                        .mcp_context
                                        .server_configs
                                        .retain(|tool| tool.id != id_clone);
                                    log::info!("Tool {} deleted from configuration", key_clone);
                                });

                                if let Err(e) = disable_result {
                                    log::error!(
                                        "Warning: Failed to cleanly disable tool before deletion: {}",
                                        e
                                    );
                                    let _ = AppState::update(|context| {
                                        context.errors.push(AppError::with_message(format!(
                                        "Warning: Tool '{}' deleted but may not have shut down cleanly: {}", key_clone, e
                                    )));
                                    });
                                }
                            });
                        }
                        Some(tool) => {
                            // Tool exists but not enabled, just delete it
                            log::info!("Tool {} is not running, deleting directly", tool.key);
                            AppState::update(|context| {
                                context
                                    .mcp_context
                                    .server_configs
                                    .retain(|tool| tool.id != id);
                                log::info!("Tool {} deleted from configuration", tool.key);
                            })?;
                        }
                        None => {
                            log::info!("Tool with id {} not found in configuration", id);
                        }
                    }

                    Ok(())
                }

                Event::ActionDisableTool(id) => {
                    let context = AppState::get_context();
                    let tool = context
                        .mcp_context
                        .server_configs
                        .iter()
                        .find(|tool| tool.id == id);

                    if let Some(tool) = tool {
                        log::info!("Current is_enabled: {:?}", tool.enabled);
                        log::info!("Disabling tool: {:?}", tool.key);
                        Self::handle_disable_tool(tool.key.clone())
                    } else {
                        log::info!("Tool with id {} not found", id);
                        Ok(())
                    }
                }

                Event::ActionEnableTool(id) => {
                    let context = AppState::get_context();
                    let tool = context
                        .mcp_context
                        .server_configs
                        .iter()
                        .find(|tool| tool.id == id);

                    if let Some(tool) = tool {
                        log::info!("Current is_enabled: {:?}", tool.enabled);
                        log::info!("Enabling tool: {:?}", tool.key);
                        Self::handle_enable_tool(tool.key.clone())
                    } else {
                        log::info!("Tool with id {} not found", id);
                        Ok(())
                    }
                }

                _ => Ok(()),
            }),
        );
    }

    fn handle_disable_tool(key: String) -> Result<(), Box<dyn Error>> {
        let context = AppState::get_context();
        let tool_config = context
            .mcp_context
            .server_configs
            .iter()
            .find(|tool| tool.key == key)
            .ok_or_else(|| format!("Tool not found: {}", key))?;

        // Only disable if currently enabled
        if !tool_config.enabled {
            log::info!("Tool {} is already disabled", key);
            return Ok(());
        }

        log::info!("Running disable operation for tool: {}", key);

        // Set state to Stopping immediately to provide user feedback
        AppState::update(|context| {
            if let Some(tool) = context
                .mcp_context
                .server_configs
                .iter_mut()
                .find(|t| t.key == key)
            {
                tool.state = MCPServerState::Stopping;
                log::info!("Tool {} state set to Stopping", key);
            }
        })?;

        // Spawn a new OS thread to run the async operation
        let key_clone = key.clone();
        std::thread::spawn(move || {
            log::info!("Started thread for disable operation: {}", key_clone);

            // Run the async operation synchronously in this thread
            let result = block_on(Self::async_disable_server(&key_clone));

            log::info!("Disable server result: {:?}", result);
            match result {
                Ok(()) => {
                    log::info!("Result OK - updating app state");
                    let _ = AppState::update(|context| {
                        if let Some(tool) = context
                            .mcp_context
                            .server_configs
                            .iter_mut()
                            .find(|t| t.key == key_clone)
                        {
                            tool.enabled = false;
                            tool.state = MCPServerState::Disabled;
                            log::info!("Tool {} disabled successfully", key_clone);
                        }
                    });
                }
                Err(e) => {
                    log::error!("Failed to disable tool {}: {}", key_clone, e);
                    let _ = AppState::update(|context| {
                        if let Some(tool) = context
                            .mcp_context
                            .server_configs
                            .iter_mut()
                            .find(|t| t.key == key_clone)
                        {
                            tool.state = MCPServerState::Error;
                        }
                        context.errors.push(AppError::with_message(format!(
                            "Failed to disable tool '{}': {}",
                            key_clone, e
                        )));
                    });
                }
            }
        });

        Ok(())
    }

    fn handle_enable_tool(key: String) -> Result<(), Box<dyn Error>> {
        let context = AppState::get_context();
        let tool_config = context
            .mcp_context
            .server_configs
            .iter()
            .find(|tool| tool.key == key)
            .ok_or_else(|| format!("Tool not found: {}", key))?;

        // Only enable if currently disabled
        if tool_config.enabled {
            log::info!("Tool {} is already enabled", key);
            return Ok(());
        }

        log::info!("Running enable operation for tool: {}", key);

        // Set state to Starting immediately to provide user feedback
        AppState::update(|context| {
            if let Some(tool) = context
                .mcp_context
                .server_configs
                .iter_mut()
                .find(|t| t.key == key)
            {
                tool.state = MCPServerState::Starting;
                log::info!("Tool {} state set to Starting", key);
            }
        })?;

        // Spawn a new OS thread to run the async operation
        let key_clone = key.clone();
        std::thread::spawn(move || {
            log::info!("Started thread for enable operation: {}", key_clone);

            // Run the async operation synchronously in this thread
            let result = block_on(Self::async_enable_server(&key_clone));

            log::info!("Enable server result: {:?}", result);
            match result {
                Ok(()) => {
                    log::info!("Result OK - updating app state");
                    let _ = AppState::update(|context| {
                        if let Some(tool) = context
                            .mcp_context
                            .server_configs
                            .iter_mut()
                            .find(|t| t.key == key_clone)
                        {
                            tool.enabled = true;
                            tool.state = MCPServerState::Enabled;
                            log::info!("Tool {} enabled successfully", key_clone);
                        }
                    });
                }
                Err(e) => {
                    log::error!("Failed to enable tool {}: {}", key_clone, e);
                    let _ = AppState::update(|context| {
                        if let Some(tool) = context
                            .mcp_context
                            .server_configs
                            .iter_mut()
                            .find(|t| t.key == key_clone)
                        {
                            tool.state = MCPServerState::Error;
                        }
                        context.errors.push(AppError::with_message(format!(
                            "Failed to enable tool '{}': {}",
                            key_clone, e
                        )));
                    });
                }
            }
        });

        Ok(())
    }

    fn start_enabled_servers() -> Result<(), Box<dyn Error>> {
        let context = AppState::get_context();
        let enabled_configs: Vec<_> = context
            .mcp_context
            .server_configs
            .iter()
            .filter(|config| config.enabled)
            .cloned()
            .collect();

        for config in enabled_configs {
            // Set state to Starting before attempting to start
            AppState::update(|context| {
                if let Some(tool) = context
                    .mcp_context
                    .server_configs
                    .iter_mut()
                    .find(|t| t.key == config.key)
                {
                    tool.state = MCPServerState::Starting;
                    log::info!("Tool {} state set to Starting", config.key);
                }
            })?;

            match block_on(Self::async_start_server(config.clone())) {
                Ok(()) => {
                    // Set state to Enabled on success
                    AppState::update(|context| {
                        if let Some(tool) = context
                            .mcp_context
                            .server_configs
                            .iter_mut()
                            .find(|t| t.key == config.key)
                        {
                            tool.state = MCPServerState::Enabled;
                            log::info!("Tool {} state set to Enabled", config.key);
                        }
                    })?;
                }
                Err(e) => {
                    log::error!("Failed to start server {}: {}", config.key, e);
                    // Set state to Error on failure
                    AppState::update(|context| {
                        if let Some(tool) = context
                            .mcp_context
                            .server_configs
                            .iter_mut()
                            .find(|t| t.key == config.key)
                        {
                            tool.state = MCPServerState::Error;
                        }
                        context.errors.push(AppError::with_message(format!(
                            "Failed to start server '{}': {}",
                            config.key, e
                        )));
                    })?;
                }
            }
        }

        Ok(())
    }

    async fn async_start_server(client_config: MCPServerConfig) -> Result<(), MCPError> {
        log::info!("🚀 Starting server: {}", client_config.key);

        match &client_config.kind {
            MCPServerKind::Local { command, env_vars } => {
                let client_service =
                    Self::create_local_client(command, env_vars)
                        .await
                        .map_err(|e| MCPError::ServerStartFailed {
                            name: client_config.key.clone(),
                            source: e,
                        })?;

                GLOBAL_MCP_REGISTRY.lock().await.add_client(MCPClient {
                    client: client_service,
                    name: client_config.key.clone(),
                });
                log::info!("✅ Local server {} started successfully", client_config.key);
            }
            MCPServerKind::External { url } => {
                let client_service = Self::create_external_client(url).await.map_err(|e| {
                    MCPError::ServerStartFailed {
                        name: client_config.key.clone(),
                        source: e,
                    }
                })?;

                GLOBAL_MCP_REGISTRY.lock().await.add_client(MCPClient {
                    client: client_service,
                    name: client_config.key.clone(),
                });
                log::info!(
                    "ℹ️ External server {} configured with URL: {}. Connection logic pending.",
                    client_config.key,
                    url
                );
                // For now, we consider it "started" at the AppState level by returning Ok.
                // No client is added to GLOBAL_MCP_REGISTRY for external servers yet.
            }
        }
        Ok(())
    }

    async fn create_local_client(
        command_str: &str,
        env_vars_map: &HashMap<String, String>,
    ) -> Result<RunningService<RoleClient, ()>, Box<dyn Error + Send + Sync>> {
        let args: Vec<&str> = command_str.split(' ').collect();
        if args.is_empty() {
            return Err("Empty command".into());
        }

        let mut cmd = Command::new(args[0]);
        for arg in &args[1..] {
            cmd.arg(arg);
        }

        cmd.stderr(Stdio::inherit())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());

        for (key, value) in env_vars_map {
            cmd.env(key, value);
        }

        let transport = TokioChildProcess::new(&mut cmd)?;
        let client = ().serve(transport).await?;
        Ok(client)
    }

    async fn create_external_client(
        url: &str,
    ) -> Result<RunningService<RoleClient, ()>, Box<dyn Error + Send + Sync>> {
        let transport = SseTransport::start(url).await?;
        let client = ().serve(transport).await?;
        Ok(client)
    }

    async fn async_disable_server(key: &str) -> Result<(), MCPError> {
        log::info!("Disabling server: {}", key);

        // Extract clients to cancel while holding the lock, then drop it
        let clients_to_cancel = {
            let mut registry = GLOBAL_MCP_REGISTRY.lock().await;
            let indices_to_remove: Vec<usize> = registry
                .clients
                .iter()
                .enumerate()
                .filter(|(_, client)| client.name == key)
                .map(|(i, _)| i)
                .collect();

            if indices_to_remove.is_empty() {
                log::error!("Warning: Server {} not found for disabling", key);
                return Ok(());
            }

            // Remove clients and collect them
            indices_to_remove
                .into_iter()
                .rev()
                .map(|i| registry.clients.remove(i))
                .collect::<Vec<_>>()
        }; // Lock is dropped here

        // Now cancel them without holding the lock
        for client in clients_to_cancel {
            if let Err(e) = client.client.cancel().await {
                log::error!("Failed to cancel client {}: {}", key, e);
                return Err(MCPError::ServerDisableFailed {
                    name: key.to_string(),
                    source: e.into(),
                });
            }
        }

        log::info!("✅ Server {} disabled successfully", key);
        Ok(())
    }

    async fn async_enable_server(key: &str) -> Result<(), MCPError> {
        let context = AppState::get_context();
        let client_config = context
            .mcp_context
            .server_configs
            .iter()
            .find(|config| config.key == key)
            .ok_or_else(|| MCPError::ClientNotFound(key.to_string()))?
            .clone();

        Self::async_start_server(client_config).await
    }

    pub async fn list_all_tools() -> Result<Vec<MCPClientTool>, MCPError> {
        // Extract client references while holding the lock, then drop it
        let client_refs = {
            let registry = GLOBAL_MCP_REGISTRY.lock().await;
            registry
                .clients
                .iter()
                .map(|client| (client.name.clone(), client.client.clone()))
                .collect::<Vec<_>>()
        }; // Lock is dropped here

        let mut all_tools = Vec::new();

        for (client_name, client) in client_refs {
            match client.list_all_tools().await {
                Ok(tools) => {
                    all_tools.extend(tools.into_iter().map(|tool| MCPClientTool {
                        name: client_name.clone(),
                        tool,
                    }));
                }
                Err(e) => {
                    log::error!("Failed to list tools for client {}: {}", client_name, e);
                    // Continue with other clients instead of failing completely
                }
            }
        }

        log::info!("🔧 Found {} tools across all clients", all_tools.len());
        Ok(all_tools)
    }

    pub async fn call_tool(
        client_name: String,
        tool_name: String,
        arguments: Option<JsonObject>,
    ) -> Result<CallToolResult, MCPError> {
        // Clone the client while holding the lock, then drop it
        let client = {
            let registry = GLOBAL_MCP_REGISTRY.lock().await;
            registry
                .clients
                .iter()
                .find(|c| c.name == client_name)
                .map(|c| c.client.clone())
        }
        .ok_or_else(|| MCPError::ClientNotFound(client_name.clone()))?; // Lock is dropped here

        let result = client
            .call_tool(CallToolRequestParam {
                name: Cow::Owned(tool_name),
                arguments,
            })
            .await
            .map_err(|e| MCPError::ToolCallFailed(e.into()))?;

        Ok(result)
    }
}

// Global registry to manage MCP clients since we can't store them in AppState
struct MCPClientRegistry {
    clients: Vec<MCPClient>,
}

impl MCPClientRegistry {
    fn new() -> Self {
        Self {
            clients: Vec::new(),
        }
    }

    fn add_client(&mut self, client: MCPClient) {
        self.clients.push(client);
    }
}

static GLOBAL_MCP_REGISTRY: std::sync::LazyLock<Arc<tokio::sync::Mutex<MCPClientRegistry>>> =
    std::sync::LazyLock::new(|| Arc::new(tokio::sync::Mutex::new(MCPClientRegistry::new())));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MCPServerKind {
    Local {
        command: String,
        env_vars: HashMap<String, String>,
    },
    External {
        url: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MCPServerState {
    Disabled,
    Starting,
    Enabled,
    Stopping,
    Error,
}

impl Default for MCPServerState {
    fn default() -> Self {
        MCPServerState::Disabled
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    #[serde(default = "default_id")]
    pub id: String,
    pub name: String,
    pub key: String,
    pub description: String,
    pub kind: MCPServerKind,
    pub enabled: bool,
    #[serde(default)]
    pub state: MCPServerState,
}

fn default_id() -> String {
    Uuid::new_v4().to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPContext {
    pub server_configs: Vec<MCPServerConfig>,
}

impl Default for MCPContext {
    fn default() -> Self {
        Self {
            server_configs: vec![],
        }
    }
}
