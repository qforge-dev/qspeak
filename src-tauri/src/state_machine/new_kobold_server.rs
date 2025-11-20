use crate::{
    koboldcpp_server::{
        KoboldCppServer, KoboldCppServerEvent, KoboldCppServerState, KoboldModelConfig,
    },
    state_machine::AppState,
};

use super::{Event, processor::Processor, state::AppStateContext};
use lazy_static::lazy_static;
use std::{error::Error, sync::Mutex};
use tauri::{AppHandle, async_runtime::block_on};

lazy_static! {
    static ref KoboldServerProcessor: Mutex<KoboldCppServerProcessor> =
        Mutex::new(KoboldCppServerProcessor::new());
}

#[allow(dead_code)]
pub struct KoboldCppServerProcessor {
    kobold_cpp_server: Option<KoboldCppServer>,
    failed_signals_count: u32,
}

#[allow(dead_code)]
impl KoboldCppServerProcessor {
    pub fn new() -> Self {
        Self {
            kobold_cpp_server: None,
            failed_signals_count: 0,
        }
    }

    pub fn start(app_handle: AppHandle) -> Result<(), Box<dyn Error>> {
        Processor::register_event_listener(
            "kobold_server",
            Box::new(|event, _app_handle| {
                let kobold_cpp_server_state =
                    AppState::get_context().koboldcpp_server_context.state;

                match event {
                    Event::ActionChangeConversationModel(model) => {
                        AppState::update_conversation_model(model)?;
                        let context = AppState::get_context();
                        match context.koboldcpp_server_context.state {
                            KoboldCppServerState::Running(_, _) => change_kobold_model(&context),
                            _ => Ok(()),
                        }
                    }
                    Event::KoboldCppServerStateChange(new_state) => {
                        match (kobold_cpp_server_state, new_state.clone()) {
                            (KoboldCppServerState::Running(_, _), KoboldCppServerState::Idle) => {
                                println!("Restarting KoboldCPP server");
                                AppState::update_kobold_cpp_server_state(new_state)?;
                                start_kobold_server();
                                Ok(())
                            }
                            (KoboldCppServerState::Idle, KoboldCppServerState::Running(_, _)) => {
                                AppState::update_kobold_cpp_server_state(new_state)?;
                                let context = AppState::get_context();
                                change_kobold_model(&context)?;
                                Ok(())
                            }
                            _ => AppState::update_kobold_cpp_server_state(new_state),
                        }
                    }
                    _ => Ok(()),
                }
            }),
        );

        KoboldServerProcessor.lock().unwrap().kobold_cpp_server = Some(
            KoboldCppServer::new()
                .with_app_handle(app_handle)
                .with_state_listener(Box::new(|event| match event {
                    KoboldCppServerEvent::StateChange(state) => {
                        Processor::process_event(Event::KoboldCppServerStateChange(state))
                            .expect("Failed to process KoboldCPP server state change");
                        Ok(())
                    }
                })),
        );

        start_kobold_server();

        Ok(())
    }
}

#[allow(dead_code)]
fn change_kobold_model(app_context: &AppStateContext) -> Result<(), Box<dyn Error>> {
    let new_model_name = app_context.conversation_model.clone();
    println!("new_model: {:?}", new_model_name);
    let new_model = if let Some(model) = new_model_name {
        let active_model = app_context
            .models_context
            .conversation_models
            .iter()
            .find(|m| m.model == model)
            .unwrap();
        println!("active_model: {:?}", active_model);
        match active_model.get_path() {
            Some(path) => Some(KoboldModelConfig::new(
                path,
                active_model.vision.as_ref().and_then(|v| v.get_path()),
            )),
            None => None,
        }
    } else {
        None
    };
    let new_model_name_clone = app_context.conversation_model.clone();
    std::thread::spawn(move || {
        let current_model = block_on(
            KoboldServerProcessor
                .lock()
                .unwrap()
                .kobold_cpp_server
                .as_ref()
                .unwrap()
                .get_current_model(),
        )
        .unwrap();
        println!("get_current_model: {:?}", current_model);
        if (current_model.is_none() && new_model_name_clone.is_none())
            || (current_model.is_some()
                && new_model_name_clone.is_some()
                && current_model.unwrap() == new_model_name_clone.unwrap())
        {
            return Ok(());
        }
        block_on(
            KoboldServerProcessor
                .lock()
                .unwrap()
                .kobold_cpp_server
                .as_ref()
                .unwrap()
                .change_model(new_model),
        )
    });
    Ok(())
}

#[allow(dead_code)]
fn start_kobold_server() {
    std::thread::spawn(move || {
        KoboldServerProcessor
            .lock()
            .unwrap()
            .kobold_cpp_server
            .as_mut()
            .unwrap()
            .start()
            .expect("Failed to start KoboldCPP server");
    });
}
