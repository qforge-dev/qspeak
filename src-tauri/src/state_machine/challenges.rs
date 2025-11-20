use serde::{Deserialize, Serialize};
use super::{processor::Processor, AppState, Event};
use chrono::{DateTime, Utc};
use super::{
    events::Shortcuts,
};

pub struct ChallengeProcessor {}

impl ChallengeProcessor {
    pub fn start() {
        Processor::register_event_listener("challenges", Box::new(|event, _app_handle| match event {
            Event::CloseSettings => {
                record_challenge_progress(event)?;
                check_challenge_requirements()?;
                Ok(())
            },
            Event::ActionOpenSettingsFromTray => {
                record_challenge_progress(event)?;
                check_challenge_requirements()?;
                Ok(())
            },
            Event::ActionChangePersonaByVoice => {
                record_challenge_progress(event)?;
                check_challenge_requirements()?;
                Ok(())
            },
            Event::ActionTranscriptionSuccess(text) => {
                record_challenge_progress(Event::ActionTranscriptionSuccess(text.clone()))?;
                check_challenge_requirements()?;
                Ok(())
            },
            Event::ActionPersona => {
                record_challenge_progress(Event::ActionPersona)?;
                check_challenge_requirements()?;
                Ok(())
            },
            Event::ActionChangePersona(persona) => {
                record_challenge_progress(Event::ActionChangePersona(persona.clone()))?;
                check_challenge_requirements()?;
                Ok(())
            },

            Event::ActionToggleRecordingWindowMinimized => {
                record_challenge_progress(Event::ActionToggleRecordingWindowMinimized)?;
                check_challenge_requirements()?;
                Ok(())
            },

            Event::ActionPersonaCycleNext => {
                record_challenge_progress(Event::ActionPersonaCycleNext)?;
                check_challenge_requirements()?;
                Ok(())
            },
            Event::ShortcutUpdate(shortcuts) => {
                record_challenge_progress(Event::ShortcutUpdate(shortcuts.clone()))?;
                check_challenge_requirements()?;
                Ok(())
            },

            Event::ActionChallengeCompleted(challenge_name) => {
                AppState::update(|context| {
                    for challenge in &mut context.challenge_context.challenges {
                        match &challenge.id {
                            id if *id == challenge_name => {
                                challenge.status = ChallengeStatus::Completed;
                                challenge.completed_at = Some(Utc::now());
                                break;
                            },
                            _ => continue,
                        }
                    }
                })?;

                Ok(())
            },
            _ => Ok(()),
        }));
    }
}


#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ChallengeContext {
    pub challenges: Vec<Challenge>,
}


#[allow(dead_code)]
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ChallengeEvent {
    pub event_type: Event,       
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

impl Default for ChallengeContext {
    fn default() -> Self {
        Self {
            challenges: get_default_challenges(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub enum ChallengeStatus {
    Available,
    InProgress,
    Completed,
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub enum ChallengeName {
    OpenSettingsFromTray,
    MaximizeMinimizeWindow,
    ChangePersonaByVoice,
    Reach1000WordsDictated,
    Reach2000WordsDictated,
    ChangePersona,
    CustomizeShortcuts,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Challenge {
    pub id: ChallengeName,
    pub title: String,
    pub description: String,
    pub status: ChallengeStatus,
    pub requirements: Vec<ChallengeRequirement>,
    pub completed_at: Option<DateTime<Utc>>,
}



#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ChallengeRequirement {
    pub event: Event,               
    pub condition: ChallengeCondition,      
    pub current_progress: Option<f64>,    
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum ChallengeCondition {
    Occurred,       
    ProgressGoal {
        target: f64,
    }                 
}

fn record_challenge_progress(event: Event) -> Result<(), Box<dyn std::error::Error>> {
    AppState::update(|context| {
        for challenge in &mut context.challenge_context.challenges {
            if challenge.status == ChallengeStatus::Completed {
                continue;
            }

            let mut next_incomplete_index = None;
            
            for (index, req) in challenge.requirements.iter().enumerate() {
                if req.current_progress.unwrap_or(0.0) < 1.0 {
                    next_incomplete_index = Some(index);
                    break;
                }
            }
            
            if let Some(index) = next_incomplete_index {
                let requirement = &mut challenge.requirements[index];
                
                match (&requirement.event, &event, &requirement.condition) {
                    (Event::CloseSettings, Event::CloseSettings, _) |
                    (Event::ActionOpenSettingsFromTray, Event::ActionOpenSettingsFromTray, _) |
                    (Event::ActionChangePersonaByVoice, Event::ActionChangePersonaByVoice, _) |
                    (Event::ActionPersonaCycleNext, Event::ActionPersonaCycleNext, _) |
                    (Event::ShortcutUpdate(_), Event::ShortcutUpdate(_), _) => {
                        requirement.current_progress = Some(1.0);
                        requirement.completed_at = Some(Utc::now());
                    },
                    (Event::ActionPersona, Event::ActionPersona, _) => {
                        requirement.current_progress = Some(1.0);
                        requirement.completed_at = Some(Utc::now());
                    },
                    (Event::ActionToggleRecordingWindowMinimized, Event::ActionToggleRecordingWindowMinimized, _) => {
                        requirement.current_progress = Some(1.0);
                        requirement.completed_at = Some(Utc::now());
                    },
                    (Event::ActionChangePersona(_), Event::ActionChangePersona(_), _) => {
                        requirement.current_progress = Some(1.0);
                        requirement.completed_at = Some(Utc::now());
                    },
                    (Event::ActionTranscriptionSuccess(_), Event::ActionTranscriptionSuccess(text), 
                    ChallengeCondition::ProgressGoal { target }) => {
                       // Count words (simple split by whitespace)
                       let word_count = text.split_whitespace().count() as f64;
                       
                       // Calculate progress
                       let current = requirement.current_progress.unwrap_or(0.0);
                       let new_progress = current + (word_count / *target);
                       
                       // Cap progress at 1.0 (100%)
                       requirement.current_progress = Some(new_progress.min(1.0));
                       
                       // Set completion time if we've reached the target
                       if new_progress >= 1.0 && requirement.completed_at.is_none() {
                           requirement.completed_at = Some(Utc::now());
                       }
                   },
                    _ => {}
                }
            }
        }
    })
}

fn check_challenge_requirements() -> Result<(), Box<dyn std::error::Error>> {
    AppState::update(|context| {
        for challenge in &mut context.challenge_context.challenges {
            if challenge.status == ChallengeStatus::Completed {
                continue;
            }
            
            let mut all_requirements_met = true;
            
            for requirement in &mut challenge.requirements {
                if requirement.current_progress.unwrap_or(0.0) < 1.0 {
                    all_requirements_met = false;
                    break;
                }
            }
            
            if all_requirements_met {      
                Processor::process_event(Event::ActionChallengeCompleted(challenge.id.clone()))
                    .expect("Failed to process challenge completed event");
            } else if challenge.status == ChallengeStatus::Available {
                let has_progress = challenge.requirements.iter()
                    .any(|req| req.current_progress.unwrap_or(0.0) > 0.0);
                
                if has_progress {
                    challenge.status = ChallengeStatus::InProgress;
                }
            }
        }
    })
}

pub fn get_default_challenges() -> Vec<Challenge> {
    vec![
        Challenge {
            id: ChallengeName::OpenSettingsFromTray,
            title: "System Tray Access".to_string(),
            description: "Open the settings menu from the system bar.".to_string(),
            status: ChallengeStatus::Available,
            requirements: vec![
                ChallengeRequirement {
                    event: Event::ActionOpenSettingsFromTray,
                    condition: ChallengeCondition::Occurred,
                    current_progress: Some(0.0),
                    completed_at: None,
                },
            ],
            completed_at: None,
        },
        Challenge {
            id: ChallengeName::MaximizeMinimizeWindow,
            title: "Window Management".to_string(),
            description: "Learn to maximize and minimize the recording window by clicking **{{shortcuts.toggle_minimized}}** shortcut for better workspace control.".to_string(), // get shortcut from app state during runtime?
            status: ChallengeStatus::Available,
            requirements: vec![
                // remember that the requirements have to be met in order
                ChallengeRequirement {
                    event: Event::ActionToggleRecordingWindowMinimized,
                    condition: ChallengeCondition::Occurred,
                    current_progress: Some(0.0),
                    completed_at: None,
                },
                ChallengeRequirement {
                    event: Event::ActionToggleRecordingWindowMinimized,
                    condition: ChallengeCondition::Occurred,
                    current_progress: Some(0.0),
                    completed_at: None,
                },
            ],
            completed_at: None,
        },
        
        create_customize_shortcuts_challenge(),

        Challenge {
            id: ChallengeName::ChangePersona,
            title: "Personas".to_string(),
            description: "Open personas menu by clicking **{{shortcuts.personas}}** shortcut and change persona by clicking **{{shortcuts.personas}}** shortcut again.".to_string(), // get shortcut from app state during runtime?
            status: ChallengeStatus::Available,
            requirements: vec![
                // remember that the requirements have to be met in order
                ChallengeRequirement {
                    event: Event::ActionPersona,
                    condition: ChallengeCondition::Occurred,
                    current_progress: Some(0.0),
                    completed_at: None,
                },
                ChallengeRequirement {
                    event: Event::ActionPersonaCycleNext,
                    condition: ChallengeCondition::Occurred,
                    current_progress: Some(0.0),
                    completed_at: None,
                },
            ],
            completed_at: None,
        },

        Challenge {
            id: ChallengeName::ChangePersonaByVoice,
            title: "Voice Control".to_string(),
            description: "Master voice control by saying a trigger phrase to change personas. Each persona may have a unique trigger phrase defined in the personas tab.".to_string(),
            status: ChallengeStatus::Available,
            requirements: vec![
                // remember that the requirements have to be met in order
                ChallengeRequirement {
                    event: Event::ActionChangePersonaByVoice,
                    condition: ChallengeCondition::Occurred,
                    current_progress: Some(0.0),
                    completed_at: None,
                },
            ],
            completed_at: None,
        },
        Challenge {
            id: ChallengeName::Reach1000WordsDictated,
            title: "1,000 Words Milestone".to_string(),
            description: "Dictate a total of **1,000** words using the app.".to_string(),
            status: ChallengeStatus::Available,
            requirements: vec![
                // remember that the requirements have to be met in order
                ChallengeRequirement {
                    event: Event::ActionTranscriptionSuccess(String::new()),
                    condition: ChallengeCondition::ProgressGoal { target: 1000.0 },
                    current_progress: Some(0.0),
                    completed_at: None,
                },
            ],
            completed_at: None,
        },
        Challenge {
            id: ChallengeName::Reach2000WordsDictated,
            title: "3,000 Words Milestone".to_string(),
            description: "Dictate a total of **3,000** words using the app.".to_string(),
            status: ChallengeStatus::Available,
            requirements: vec![
                // remember that the requirements have to be met in order
                ChallengeRequirement {
                    event: Event::ActionTranscriptionSuccess(String::new()),
                    condition: ChallengeCondition::ProgressGoal { target: 3000.0 },
                    current_progress: Some(0.0),
                    completed_at: None,
                },
            ],
            completed_at: None,
        },
    ]
}

pub fn create_customize_shortcuts_challenge() -> Challenge {
    Challenge {
        id: ChallengeName::CustomizeShortcuts,
        title: "Keyboard Customization".to_string(),
        description: "Personalize your experience by customizing keyboard shortcuts in settings.".to_string(),
        status: ChallengeStatus::Available,
        requirements: vec![
            ChallengeRequirement {
                event: Event::ShortcutUpdate(Shortcuts::default()),
                condition: ChallengeCondition::Occurred,
                current_progress: Some(0.0),
                completed_at: None,
            },
        ],
        completed_at: None,
    }
}
