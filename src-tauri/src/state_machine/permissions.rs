use super::{AppState, Event, processor::Processor};
use serde::{Deserialize, Serialize};

#[cfg(target_os = "macos")]
use {
    macos_accessibility_client::accessibility::{
        application_is_trusted, application_is_trusted_with_prompt,
    },
    objc2::{class, msg_send},
    objc2_foundation::NSString,
};
// #[cfg(target_os = "windows")]
// use windows::{
//     core::w,
//     Devices::Enumeration::{DeviceAccessInformation, DeviceAccessStatus, DeviceClass},
//     Win32::UI::Shell::{ShellExecuteW, SW_SHOW},
// };

pub struct PermissionsProcessor {}

impl PermissionsProcessor {
    pub fn start() {
        Processor::register_event_listener(
            "permissions",
            Box::new(|event, _app_handle| match event {
                Event::ActionCheckAccessibilityPermission => {
                    tauri::async_runtime::spawn(async move {
                        let authorized = check_accessibility_permission().await;
                        let _ = AppState::update(|context| {
                            context.permissions_context.accessibility = authorized;
                        });
                    });

                    Ok(())
                }
                Event::ActionRequestAccessibilityPermission => {
                    log::info!("requesting accessibility permission");
                    tauri::async_runtime::spawn(async move {
                        let _ = request_accessibility_permission().await;
                    });
                    Ok(())
                }
                Event::ActionCheckAndRequestAccessibilityPermission => {
                    tauri::async_runtime::spawn(async move {
                        let authorized = check_accessibility_permission().await;
                        if !authorized {
                            let _ = request_accessibility_permission().await;
                        }
                    });
                    Ok(())
                }
                Event::ActionCheckMicrophonePermission => {
                    tauri::async_runtime::spawn(async move {
                        let authorized = check_microphone_permission().await;
                        let _ = AppState::update(|context| {
                            context.permissions_context.microphone = authorized;
                        });
                    });
                    Ok(())
                }
                Event::ActionRequestMicrophonePermission => {
                    log::info!("requesting microphone permission");
                    tauri::async_runtime::spawn(async move {
                        let _ = request_microphone_permission().await;
                    });
                    Ok(())
                }
                Event::ActionCheckAndRequestMicrophonePermission => {
                    tauri::async_runtime::spawn(async move {
                        let authorized = check_microphone_permission().await;
                        if !authorized {
                            let _ = request_microphone_permission().await;
                        }
                    });
                    Ok(())
                }
                _ => Ok(()),
            }),
        );
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsContext {
    pub accessibility: bool,
    pub microphone: bool,
}

impl Default for PermissionsContext {
    fn default() -> Self {
        Self {
            accessibility: false,
            microphone: false,
        }
    }
}

async fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        application_is_trusted()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

async fn request_accessibility_permission() -> () {
    #[cfg(target_os = "macos")]
    {
        application_is_trusted_with_prompt();
    }
    #[cfg(not(target_os = "macos"))]
    {
        ()
    }
}

async fn check_microphone_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            let av_media_type = NSString::from_str("soun");

            let status: i64 = msg_send![
                class!(AVCaptureDevice),
                authorizationStatusForMediaType: &*av_media_type
            ];

            status == 3
        }
    }
    #[cfg(target_os = "windows")]
    {
        // windows::initialize_mta().ok();
        // match DeviceAccessInformation::CreateFromDeviceClass(DeviceClass::AudioCapture) {
        //     Ok(info) => matches!(
        //         info.CurrentStatus().unwrap_or(DeviceAccessStatus::DeniedByUser),
        //         DeviceAccessStatus::Allowed
        //     ),
        //     Err(_) => true,
        // }
        true
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        true
    }
}

async fn request_microphone_permission() -> () {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .status();

        ()
    }
    #[cfg(target_os = "windows")]
    {
        // unsafe {
        //     ShellExecuteW(
        //         None,
        //         w!("open"),
        //         w!("ms-settings:privacy-microphone"),
        //         None,
        //         None,
        //         SW_SHOW,
        //     );
        // }
        ()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        ()
    }
}
