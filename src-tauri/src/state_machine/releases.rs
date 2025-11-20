use super::{Event, processor::Processor};
use crate::{
    api::releases::{Release, ReleasesApi, ReleasesApiConfig},
    state_machine::{AppState, errors::AppError},
};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::block_on;

pub struct ReleasesProcessor {}

impl ReleasesProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "releases",
            Box::new(|event, _app_handle| match event {
                Event::ActionGetReleases => {
                    std::thread::spawn(move || match block_on(ReleasesProcessor::get_releases()) {
                        Ok(releases) => {
                            println!("Releases: {:?}", releases);
                            Processor::process_event(Event::ActionGetReleasesSuccess(releases))
                                .expect("Failed to process get releases success event");
                        }
                        Err(e) => {
                            Processor::process_event(Event::ActionGetReleasesError(e))
                                .expect("Failed to process get releases error event");
                        }
                    });
                    Ok(())
                }
                Event::ActionGetReleasesSuccess(releases) => AppState::update(|context| {
                    context.releases_context.releases = releases;
                }),

                Event::ActionGetReleasesError(e) => AppState::update(|context| {
                    context.errors.push(AppError::with_message(e));
                }),

                _ => Ok(()),
            }),
        );
    }

    pub async fn get_releases() -> Result<Vec<Release>, String> {
        let releases_api = ReleasesApi::new(ReleasesApiConfig::new(None));

        return releases_api.get_releases().await;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleasesContext {
    pub releases: Vec<Release>,
}

impl Default for ReleasesContext {
    fn default() -> Self {
        Self { releases: vec![] }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleasesMachineState {
    pub context: ReleasesContext,
}

impl Default for ReleasesMachineState {
    fn default() -> Self {
        Self {
            context: ReleasesContext::default(),
        }
    }
}
