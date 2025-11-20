use super::{Event, processor::Processor};
use crate::state_machine::{AppState, personas::Persona};

pub struct PersonasProcessor {}

impl PersonasProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "personas",
            Box::new(|event, _app_handle| match event {
                Event::ActionAddPersona(persona) => AppState::update(|context| {
                    context.personas_context.personas.push(Persona {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: persona.name.clone(),
                        system_prompt: persona.system_prompt.clone(),
                        description: persona.description.clone(),
                        voice_command: persona.voice_command.clone(),
                        paste_on_finish: persona.paste_on_finish,
                        icon: Some(persona.icon.clone()),
                        record_output_audio: persona.record_output_audio,
                        examples: persona.examples.clone(),
                    });
                }),
                Event::ActionUpdatePersona(persona) => AppState::update(|context| {
                    let index = context
                        .personas_context
                        .personas
                        .iter()
                        .position(|p| p.id == persona.id)
                        .expect("Failed to find persona");
                    context.personas_context.personas[index] = persona.clone();
                }),
                Event::ActionDeletePersona(id) => AppState::update(|context| {
                    let index = context
                        .personas_context
                        .personas
                        .iter()
                        .position(|p| p.id == id.to_string())
                        .expect("Failed to find persona");
                    context.personas_context.personas.remove(index);
                }),
                Event::ActionDuplicatePersona(persona) => AppState::update(|context| {
                    let new_persona = Persona {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: format!("{} (Copy)", persona.name),
                        system_prompt: persona.system_prompt.clone(),
                        description: persona.description.clone(),
                        voice_command: persona.voice_command.clone(),
                        paste_on_finish: persona.paste_on_finish,
                        icon: persona.icon.clone(),
                        record_output_audio: persona.record_output_audio,
                        examples: persona.examples.clone(),
                    };
                    context.personas_context.personas.push(new_persona);
                }),

                _ => Ok(()),
            }),
        );
    }
}
