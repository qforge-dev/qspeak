use std::sync::Mutex;

use arboard::Clipboard;
use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use lazy_static::lazy_static;

lazy_static! {
    static ref CLIPBOARD: Mutex<Clipboard> = Mutex::new(Clipboard::new().unwrap());
}

pub fn set_text_in_clipboard(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    match CLIPBOARD.lock() {
        Ok(mut clipboard) => {
            if let Err(e) = clipboard.set_text(text) {
                Err(Box::new(e))
            } else {
                Ok(())
            }
        }
        Err(e) => Err(Box::new(e)),
    }
}

pub enum KeyboardError {
    MissingAccessibilityPermissionsError,
    FailedToInstantiateKeyboardError,
    FailedToSetTextInClipboardError,
}

pub fn set_text_in_clipboard_and_paste(text: &str) -> Result<(), KeyboardError> {
    set_text_in_clipboard(text)
        .map_err(|_| KeyboardError::FailedToSetTextInClipboardError)
        .and_then(|_| {
            Enigo::new(&Settings::default())
                .map_err(|_| KeyboardError::FailedToInstantiateKeyboardError)
        })
        .and_then(|mut enigo| {
            #[cfg(target_os = "macos")]
            {
                enigo
                    .key(Key::Meta, Press)
                    .map_err(|_| KeyboardError::MissingAccessibilityPermissionsError)?;
                enigo
                    .key(Key::Unicode('v'), Click)
                    .map_err(|_| KeyboardError::MissingAccessibilityPermissionsError)?;
                enigo
                    .key(Key::Meta, Release)
                    .map_err(|_| KeyboardError::MissingAccessibilityPermissionsError)?;
            }
            #[cfg(not(target_os = "macos"))]
            {
                enigo
                    .key(Key::Control, Press)
                    .map_err(|_| KeyboardError::MissingAccessibilityPermissionsError)?;
                enigo
                    .key(Key::Unicode('v'), Click)
                    .map_err(|_| KeyboardError::MissingAccessibilityPermissionsError)?;
                enigo
                    .key(Key::Control, Release)
                    .map_err(|_| KeyboardError::MissingAccessibilityPermissionsError)?;
            }

            Ok(())
        })
}
