use serde::{Deserialize, Serialize};
use tauri::async_runtime::block_on;

use super::{Event, processor::Processor};
use crate::{
    api::accounts::{AccountsApi, AccountsApiConfig, LoginResponse, LoginVerifyResponse},
    state_machine::{AppState, errors::AppError},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginVerifyPayload {
    pub email: String,
    pub code: String,
}

pub struct AccountProcessor {}

impl AccountProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "account",
            Box::new(|event, _app_handle| match event {
                Event::ActionLogin(email) => AppState::update(|context| {
                    context.account_context.login.step = Some(LoginStep::Login);
                    context.account_context.login.state = Some(LoginStateType::Pending);

                    std::thread::spawn(move || match block_on(AccountProcessor::login(email)) {
                        Ok(message) => {
                            Processor::process_event(Event::ActionLoginSuccess(message.message))
                                .expect("Failed to process login success event")
                        }
                        Err(e) => Processor::process_event(Event::ActionLoginError(e.to_string()))
                            .expect("Failed to process login error event"),
                    });
                }),

                Event::ActionLoginSuccess(message) => AppState::update(|context| {
                    context.account_context.login.step = Some(LoginStep::Login);
                    context.account_context.login.state = Some(LoginStateType::Success);

                    log::info!("Login success: {}", message);
                }),

                Event::ActionLoginError(e) => AppState::update(|context| {
                    context.account_context.login.step = Some(LoginStep::Login);
                    context.account_context.login.state = Some(LoginStateType::Error);
                    context.errors.push(AppError::with_message(e));
                }),

                Event::ActionLoginVerify(payload) => AppState::update(|context| {
                    context.account_context.login.step = Some(LoginStep::LoginVerify);
                    context.account_context.login.state = Some(LoginStateType::Pending);

                    std::thread::spawn(move || {
                        match block_on(AccountProcessor::login_verify(payload.email, payload.code))
                        {
                            Ok(message) => {
                                Processor::process_event(Event::ActionLoginVerifySuccess(message))
                                    .expect("Failed to process login verify success event")
                            }
                            Err(e) => Processor::process_event(Event::ActionLoginVerifyError(e))
                                .expect("Failed to process login verify error event"),
                        }
                    });
                }),

                Event::ActionLoginVerifySuccess(message) => AppState::update(|context| {
                    log::info!("Login verify success: {:?}", message);
                    context.account_context.login.step = Some(LoginStep::LoginVerify);
                    context.account_context.login.state = Some(LoginStateType::Success);

                    context.account_context.account.token = Some(message.token);
                    context.account_context.account.email = Some(message.email);
                }),

                Event::ActionLoginVerifyError(e) => AppState::update(|context| {
                    log::info!("Login verify error: {}", e);
                    context.account_context.login.step = Some(LoginStep::LoginVerify);
                    context.account_context.login.state = Some(LoginStateType::Error);
                    context.errors.push(AppError::with_message(e));

                    context.account_context.account.token = None;
                    context.account_context.account.email = None;
                }),

                _ => Ok(()),
            }),
        );
    }

    pub async fn login(email: String) -> Result<LoginResponse, String> {
        let accounts_api = AccountsApi::new(AccountsApiConfig::new(None));

        return accounts_api.login(email).await;
    }

    pub async fn login_verify(email: String, code: String) -> Result<LoginVerifyResponse, String> {
        let accounts_api = AccountsApi::new(AccountsApiConfig::new(None));

        return accounts_api.login_verify(email, code).await;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub email: Option<String>,
    pub token: Option<String>,
}

impl Default for Account {
    fn default() -> Self {
        Self {
            email: None,
            token: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LoginStep {
    Login,
    LoginVerify,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LoginStateType {
    Idle,
    Pending,
    Success,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoginState {
    pub step: Option<LoginStep>,
    pub state: Option<LoginStateType>,
}

// Context data that's associated with the state machine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountContext {
    pub account: Account,
    pub login: LoginState,
}

impl Default for AccountContext {
    fn default() -> Self {
        Self {
            account: Account {
                email: None,
                token: None,
            },
            login: LoginState {
                step: None,
                state: None,
            },
        }
    }
}

// The complete state that will be propagated to the frontend
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountMachineState {
    pub context: AccountContext,
}

impl Default for AccountMachineState {
    fn default() -> Self {
        Self {
            context: AccountContext::default(),
        }
    }
}
