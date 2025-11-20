use tauri::{AppHandle, async_runtime::block_on};
use tauri_plugin_updater::UpdaterExt;

use super::{AppState, Event, processor::Processor, state::UpdateState};

pub struct UpdateProcessor {}

impl UpdateProcessor {
    pub fn start() -> Result<(), Box<dyn std::error::Error>> {
        Processor::register_event_listener(
            "update",
            Box::new(|event, app_handle| match event {
                Event::ActionCheckForUpdates => check_for_updates(app_handle),
                Event::ActionUpdateAndRestart => update_and_restart(app_handle),
                _ => Ok(()),
            }),
        );

        Processor::process_event(Event::ActionCheckForUpdates)?;
        Ok(())
    }
}

fn check_for_updates(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app_handle.clone();
    std::thread::spawn(move || {
        AppState::update(|context| {
            context.update_context.state = UpdateState::CheckingForUpdates;
        })
        .unwrap();
        match block_on(app_handle.updater().unwrap().check()) {
            Ok(Some(_update)) => {
                AppState::update(|context| {
                    context.update_context.state = UpdateState::UpdateAvailable;
                })
                .unwrap();
            }
            Err(e) => {
                AppState::update(|context| {
                    context.update_context.state = UpdateState::Error(e.to_string());
                })
                .unwrap();
            }
            Ok(None) => {
                AppState::update(|context| {
                    context.update_context.state = UpdateState::NoUpdateAvailable;
                })
                .unwrap();
            }
        }
    });
    Ok(())
}

fn update_and_restart(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app_handle.clone();
    std::thread::spawn(move || {
        let mut downloaded = 0;
        AppState::update(|context| {
            context.update_context.state = UpdateState::DownloadingUpdate(downloaded);
        })
        .unwrap();
        match block_on(app_handle.updater().unwrap().check()) {
            Ok(Some(update)) => {
                match block_on(update.download_and_install(
                    |chunk_length, content_length| {
                        downloaded += chunk_length as u64;
                        if let Some(content_length) = content_length {
                            AppState::update(|context| {
                                context.update_context.state = UpdateState::DownloadingUpdate(
                                    downloaded / content_length as u64,
                                );
                            })
                            .unwrap();
                        }
                    },
                    || {
                        AppState::update(|context| {
                            context.update_context.state = UpdateState::UpdateDownloaded;
                        })
                        .unwrap();
                    },
                )) {
                    Ok(_) => {
                        app_handle.restart();
                    }
                    Err(e) => {
                        AppState::update(|context| {
                            context.update_context.state = UpdateState::Error(e.to_string());
                        })
                        .unwrap();
                    }
                }
            }
            Err(e) => {
                AppState::update(|context| {
                    context.update_context.state = UpdateState::Error(e.to_string());
                })
                .unwrap();
            }
            Ok(None) => {
                AppState::update(|context| {
                    context.update_context.state = UpdateState::NoUpdateAvailable;
                })
                .unwrap();
            }
        }
    });
    Ok(())
}
