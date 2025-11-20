use std::{
    error::Error,
    sync::{
        Mutex,
        mpsc::{Receiver, Sender},
    },
};

use lazy_static::lazy_static;
use tauri::AppHandle;

use super::Event;

pub struct Processor {
    sender: Option<Sender<Event>>,
}

lazy_static! {
    static ref PROCESSOR: Mutex<Processor> = Mutex::new(Processor::new());
}

lazy_static! {
    static ref LISTENERS: Mutex<
        Vec<(
            String,
            Box<dyn Fn(Event, &AppHandle) -> Result<(), Box<dyn Error>> + Send + Sync>
        )>,
    > = Mutex::new(Vec::new());
}

lazy_static! {
    static ref AUDIO_LISTENERS: Mutex<Vec<Box<dyn Fn(Vec<i16>) -> Result<(), Box<dyn Error>> + Send + Sync>>> =
        Mutex::new(Vec::new());
}

impl Processor {
    pub fn new() -> Self {
        Self { sender: None }
    }

    pub fn start(
        app_handle: AppHandle,
        sender: Sender<Event>,
        receiver: Receiver<Event>,
    ) -> Result<(), Box<dyn Error>> {
        PROCESSOR.lock().expect("Failed to lock processor").sender = Some(sender);

        tauri::async_runtime::spawn(async move {
            log::info!("Starting processor");
            while let Ok(event) = receiver.recv() {
                let listeners = &LISTENERS.lock().expect("Failed to lock listeners");
                for (name, listener) in listeners.iter() {
                    let start = std::time::Instant::now();
                    listener(event.clone(), &app_handle)
                        .map_err(|e| {
                            log::error!("Error processing event: {:?}", e);
                        })
                        .ok();
                    let duration = start.elapsed();
                    if duration.as_millis() > 50 {
                        println!("{} took: {:?} to process event {:?}", name, duration, event);
                    }
                }
            }
        });

        Ok(())
    }

    pub fn process_event(event: Event) -> Result<(), Box<dyn Error>> {
        PROCESSOR
            .lock()
            .expect("Failed to lock processor")
            .sender
            .as_ref()
            .expect("Failed to get sender")
            .send(event)?;
        Ok(())
    }

    pub fn register_event_listener(
        name: &str,
        listener: Box<dyn Fn(Event, &AppHandle) -> Result<(), Box<dyn Error>> + Send + Sync>,
    ) {
        LISTENERS
            .lock()
            .expect("Failed to lock listeners")
            .push((name.to_string(), listener));
    }

    pub fn register_audio_listener(
        listener: Box<dyn Fn(Vec<i16>) -> Result<(), Box<dyn Error>> + Send + Sync>,
    ) {
        AUDIO_LISTENERS
            .lock()
            .expect("Failed to lock audio listeners")
            .push(listener);
    }

    pub fn process_audio_data(data: Vec<i16>) -> Result<(), Box<dyn Error>> {
        let listeners = &AUDIO_LISTENERS
            .lock()
            .expect("Failed to lock audio listeners");
        for listener in listeners.iter() {
            listener(data.clone())?;
        }
        Ok(())
    }
}
