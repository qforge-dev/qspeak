use core::{error, fmt};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AppError {
    pub id: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

impl AppError {
    pub fn with_message(message: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            message,
            timestamp: Utc::now(),
        }
    }
}

#[allow(dead_code)]
#[derive(Debug)]
pub enum ConversationError {
    TranscriptionModelNotFoundError,
    TransformationModelNotFoundError,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionModelNotFoundError {}

impl error::Error for TranscriptionModelNotFoundError {}

impl fmt::Display for TranscriptionModelNotFoundError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Transcription model not found")
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformationModelNotFoundError {}

impl error::Error for TransformationModelNotFoundError {}

impl fmt::Display for TransformationModelNotFoundError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Transformation model not found")
    }
}
