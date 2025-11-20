use std::any::{Any, TypeId};

use cpal::traits::{DeviceTrait, HostTrait};
use std::{
    fs::File,
    io::BufWriter,
    path::Path,
    process::{Child, Command, Stdio},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

use cpal::SupportedStreamConfig;
use ffmpeg_sidecar::{command::FfmpegCommand, download::auto_download, event::FfmpegEvent};
use hound::WavWriter;
use qruhear::{RUBuffers, RUHear, rucallback};

// Static variable to ensure FFmpeg is only downloaded once
static FFMPEG_DOWNLOADED: AtomicBool = AtomicBool::new(false);

/// Ensures FFmpeg binaries are available by downloading them if necessary.
/// This function is thread-safe and will only download once per application run.
fn ensure_ffmpeg_available() -> Result<(), String> {
    // Check if we've already downloaded FFmpeg
    if FFMPEG_DOWNLOADED.load(Ordering::Relaxed) {
        return Ok(());
    }

    // Try to download FFmpeg binaries
    match auto_download() {
        Ok(_) => {
            FFMPEG_DOWNLOADED.store(true, Ordering::Relaxed);
            log::info!("FFmpeg binaries are available");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to download FFmpeg binaries: {}", e);
            Err(format!("Failed to download FFmpeg binaries: {}", e))
        }
    }
}

#[allow(unused_variables)]
pub fn get_device_by_name_or_default(device_name: Option<String>) -> cpal::Device {
    let host = cpal::default_host();
    #[cfg(target_os = "macos")]
    return host
        .default_input_device()
        .expect("Failed to get default input device");
    #[cfg(not(target_os = "macos"))]
    match device_name {
        Some(device_name) => host
            .input_devices()
            .expect("Failed to get input devices")
            .find(|device| device.name().unwrap_or_default().to_string() == device_name)
            .unwrap_or_else(|| {
                host.default_input_device()
                    .expect("Failed to get default input device")
            }),
        None => host
            .default_input_device()
            .expect("Failed to get default input device"),
    }
}

pub fn get_audio_input_devices() -> Result<Vec<String>, String> {
    let devices = cpal::default_host()
        .input_devices()
        .map_err(|e| e.to_string())?;

    let device_names = devices
        .filter(|d| d.type_id() == TypeId::of::<cpal::Device>())
        .map(|d| d.name().unwrap_or_default())
        .collect::<Vec<String>>();

    Ok::<_, String>(device_names)
}

pub fn build_stream(
    device: &cpal::Device,
    wav_writer: &Arc<Mutex<WavWriter<BufWriter<File>>>>,
    on_audio_data: impl FnMut(Vec<i16>) + Send + 'static,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
) -> Result<cpal::Stream, Box<dyn std::error::Error>> {
    let config: SupportedStreamConfig = device
        .default_input_config()
        .expect("Failed to get default input config")
        .into();
    let sample_format = config.sample_format();
    let original_sample_rate = config.sample_rate().0;
    let stream_config: cpal::StreamConfig = config.into();
    let recording = Arc::new(AtomicBool::new(true));

    match sample_format {
        cpal::SampleFormat::I16 => build_i16_stream(
            &device,
            &stream_config,
            on_audio_data,
            err_fn,
            wav_writer.clone(),
            recording.clone(),
            original_sample_rate,
        ),
        cpal::SampleFormat::U16 => build_u16_stream(
            &device,
            &stream_config,
            on_audio_data,
            err_fn,
            wav_writer.clone(),
            recording.clone(),
            original_sample_rate,
        ),
        cpal::SampleFormat::F32 => build_f32_stream(
            &device,
            &stream_config,
            on_audio_data,
            err_fn,
            wav_writer.clone(),
            recording.clone(),
            original_sample_rate,
        ),
        _ => Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Unsupported sample format",
        ))),
    }
}

/// Build a system output audio stream using ruhear for capturing system audio output.
/// This is similar to build_stream but captures system audio (what you hear) instead of microphone input.
///
/// # Arguments
/// * `wav_writer` - A shared WAV writer for recording audio to file
/// * `on_audio_data` - Callback function that receives audio data as Vec<i16>
///
/// # Returns
/// Returns a RUHear instance that can be started with `.start()` and stopped with `.stop()`
///
/// # Example
/// ```rust
/// use qspeak_audio_recording::{build_system_output_stream, build_wav_writer};
///
/// let wav_writer = build_wav_writer("output.wav").unwrap();
/// let mut ruhear = build_system_output_stream(&wav_writer, |data| {
///     println!("Received {} audio samples", data.len());
/// }).unwrap();
///
/// ruhear.start();
/// std::thread::sleep(std::time::Duration::from_secs(5));
/// ruhear.stop();
/// ```
pub fn build_output_stream(
    wav_writer: &Arc<Mutex<WavWriter<BufWriter<File>>>>,
    on_audio_data: impl FnMut(Vec<i16>) + Send + 'static,
) -> Result<RUHear, Box<dyn std::error::Error>> {
    let writer = wav_writer.clone();
    let mut on_audio_data = on_audio_data;

    // Assume ruhear captures at 48000 Hz (48kHz - very common system audio rate)
    // If the audio is still too slow/fast after this fix, try adjusting this value:
    // - 48000.0 for 48kHz (common on most modern systems)
    // - 44100.0 for 44.1kHz (CD quality)
    // - 96000.0 for 96kHz (high-end audio systems)
    // You can determine the actual rate by checking system audio settings
    let original_sample_rate = 48000.0;
    let target_sample_rate = 16000.0;
    let ratio = original_sample_rate / target_sample_rate;

    // Create the callback for ruhear
    let callback = move |audio_buffers: RUBuffers| {
        if let Some(mut writer_guard) = writer.try_lock().ok() {
            let mut converted_samples = Vec::new();

            // First, determine the length of audio data (assume all channels have same length)
            if audio_buffers.is_empty() {
                return;
            }

            let num_channels = audio_buffers.len();
            let samples_per_channel = audio_buffers[0].len();

            // Mix all channels to mono and resample
            let mut i = 0.0;
            while i < samples_per_channel as f32 {
                let sample_index = i as usize;
                if sample_index < samples_per_channel {
                    // Mix all channels to mono by averaging
                    let mut mixed_sample = 0.0;
                    for channel_data in &audio_buffers {
                        if sample_index < channel_data.len() {
                            mixed_sample += channel_data[sample_index];
                        }
                    }
                    mixed_sample /= num_channels as f32; // Average the channels

                    // Write the resampled f32 sample to WAV
                    if let Err(e) = writer_guard.write_sample(mixed_sample) {
                        log::error!("Failed to write sample: {}", e);
                        break;
                    }

                    // Convert f32 to i16 for callback
                    let sample_i16 = (mixed_sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                    converted_samples.push(sample_i16);
                }

                i += ratio;
            }

            // Send converted data to callback
            if !converted_samples.is_empty() {
                on_audio_data(converted_samples);
            }
        }
    };

    // Create the RUHear instance using the rucallback macro and RUHear::new
    let callback = rucallback!(callback);
    let ruhear = RUHear::new(callback);

    Ok(ruhear)
}

/// New function to provide similar API to build_stream but for system output audio.
/// This is an alias for build_output_stream with a more descriptive name.
///
/// Use this function when you want to capture system audio output (speakers/headphones)
/// instead of microphone input. This uses the ruhear crate which provides cross-platform
/// system audio capture capabilities.
pub fn build_system_output_stream(
    wav_writer: &Arc<Mutex<WavWriter<BufWriter<File>>>>,
    on_audio_data: impl FnMut(Vec<i16>) + Send + 'static,
) -> Result<RUHear, Box<dyn std::error::Error>> {
    build_output_stream(wav_writer, on_audio_data)
}

/// Helper function to create a WAV writer for audio recording.
/// Creates a WAV file with 32-bit float samples at the specified sample rate (mono).
///
/// # Arguments
/// * `file_path` - Path where the WAV file should be created
/// * `sample_rate` - Sample rate for the WAV file (defaults to 16000 Hz if None)
///
/// # Returns
/// Returns an Arc<Mutex<WavWriter<BufWriter<File>>>> that can be used with build_stream
/// or build_system_output_stream functions.
///
/// # Example
/// ```rust
/// use qspeak_audio_recording::build_wav_writer_with_rate;
///
/// let wav_writer = build_wav_writer_with_rate("recording.wav", Some(44100)).unwrap();
/// // Use with build_stream or build_system_output_stream
/// ```
pub fn build_wav_writer_with_rate<P: AsRef<Path>>(
    file_path: P,
    sample_rate: Option<u32>,
) -> Result<Arc<Mutex<WavWriter<BufWriter<File>>>>, Box<dyn std::error::Error>> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: sample_rate.unwrap_or(16000),
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let writer = WavWriter::create(file_path, spec).map_err(|e| {
        log::error!("Error creating WavWriter: {}", e);
        e
    })?;
    Ok(Arc::new(Mutex::new(writer)))
}

/// Helper function to create a WAV writer for audio recording.
/// Creates a WAV file with 32-bit float samples at 16kHz sample rate (mono).
///
/// # Arguments
/// * `file_path` - Path where the WAV file should be created
///
/// # Returns
/// Returns an Arc<Mutex<WavWriter<BufWriter<File>>>> that can be used with build_stream
/// or build_system_output_stream functions.
///
/// # Example
/// ```rust
/// use qspeak_audio_recording::build_wav_writer;
///
/// let wav_writer = build_wav_writer("recording.wav").unwrap();
/// // Use with build_stream or build_system_output_stream
/// ```
pub fn build_wav_writer<P: AsRef<Path>>(
    file_path: P,
) -> Result<Arc<Mutex<WavWriter<BufWriter<File>>>>, Box<dyn std::error::Error>> {
    build_wav_writer_with_rate(file_path, None)
}

// Build an i16 audio stream - standalone function
fn build_i16_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut on_audio_data: impl FnMut(Vec<i16>) + Send + 'static,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
    writer: Arc<Mutex<WavWriter<BufWriter<File>>>>,
    recording: Arc<AtomicBool>,
    original_sample_rate: u32,
) -> Result<cpal::Stream, Box<dyn std::error::Error>> {
    let target_sample_rate = 16000;
    let num_channels = config.channels as usize;

    let stream = device
        .build_input_stream(
            config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                if recording.load(Ordering::SeqCst) {
                    let mut writer_guard = writer.lock().expect("Failed to lock writer");

                    // Simple resampling approach - skip or duplicate samples based on ratio
                    // For a production app, use a proper resampling library
                    let ratio = original_sample_rate as f32 / target_sample_rate as f32;

                    // For listeners, we'll send the original data
                    let mut resampled_data = Vec::new();

                    // Very basic resampling by selecting samples at calculated intervals
                    // If stereo, convert to mono by averaging channels
                    let mut i: f32 = 0.0;
                    while i < data.len() as f32 {
                        let sample_index = i as usize;
                        if sample_index < data.len() {
                            // For mono, just use the sample directly
                            // For stereo or more channels, average the channels
                            let sample_f32 = if num_channels > 1 {
                                let mut sum = 0.0;
                                for c in 0..num_channels {
                                    if sample_index + c < data.len() {
                                        sum += data[sample_index + c] as f32 / i16::MAX as f32;
                                    }
                                }
                                sum / num_channels as f32
                            } else {
                                data[sample_index] as f32 / i16::MAX as f32
                            };

                            writer_guard
                                .write_sample(sample_f32)
                                .expect("Failed to write sample");

                            // For listeners, keep the original format
                            if sample_index < data.len() {
                                resampled_data.push(data[sample_index]);
                            }
                        }
                        i += ratio * num_channels as f32; // Skip by number of channels
                    }

                    // Send original data to listeners
                    on_audio_data(data.to_vec());
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| e)?;

    Ok(stream)
}

// Build a u16 audio stream - standalone function
fn build_u16_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut on_audio_data: impl FnMut(Vec<i16>) + Send + 'static,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
    writer: Arc<Mutex<WavWriter<BufWriter<File>>>>,
    recording: Arc<AtomicBool>,
    original_sample_rate: u32,
) -> Result<cpal::Stream, Box<dyn std::error::Error>> {
    let target_sample_rate = 16000;
    let num_channels = config.channels as usize;

    let stream = device
        .build_input_stream(
            config,
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                if recording.load(Ordering::SeqCst) {
                    let mut writer_guard = writer.lock().expect("Failed to lock writer");
                    let mut data_vec = Vec::new();

                    // Simple resampling approach
                    let ratio = original_sample_rate as f32 / target_sample_rate as f32;

                    // Very basic resampling by selecting samples at calculated intervals
                    let mut i: f32 = 0.0;
                    while i < data.len() as f32 {
                        let sample_index = i as usize;
                        if sample_index < data.len() {
                            // For mono, just use the sample directly
                            // For stereo or more channels, average the channels
                            let sample_f32 = if num_channels > 1 {
                                let mut sum = 0.0;
                                for c in 0..num_channels {
                                    if sample_index + c < data.len() {
                                        // Convert u16 to f32 by mapping [0, 65535] to [-1.0, 1.0]
                                        sum += ((data[sample_index + c] as i32 - 32768) as f32)
                                            / 32768.0;
                                    }
                                }
                                sum / num_channels as f32
                            } else {
                                // Convert u16 to f32 by mapping [0, 65535] to [-1.0, 1.0]
                                ((data[sample_index] as i32 - 32768) as f32) / 32768.0
                            };

                            writer_guard
                                .write_sample(sample_f32)
                                .expect("Failed to write sample");

                            // Convert u16 to i16 for listeners
                            let sample_i16 = (data[sample_index] as i32 - 32768) as i16;
                            data_vec.push(sample_i16);
                        }
                        i += ratio * num_channels as f32; // Skip by number of channels
                    }

                    // Send all converted data to listeners (not just resampled)
                    let all_converted: Vec<i16> = data
                        .iter()
                        .map(|&sample| (sample as i32 - 32768) as i16)
                        .collect();

                    on_audio_data(all_converted);
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| e)?;

    Ok(stream)
}

// Build an f32 audio stream - standalone function
fn build_f32_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut on_audio_data: impl FnMut(Vec<i16>) + Send + 'static,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
    writer: Arc<Mutex<WavWriter<BufWriter<File>>>>,
    recording: Arc<AtomicBool>,
    original_sample_rate: u32,
) -> Result<cpal::Stream, Box<dyn std::error::Error>> {
    let target_sample_rate = 16000;
    let num_channels = config.channels as usize;

    let stream = device
        .build_input_stream(
            config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if recording.load(Ordering::SeqCst) {
                    let mut writer_guard = writer.lock().expect("Failed to lock writer");
                    let mut data_vec = Vec::new();

                    // Simple resampling approach
                    let ratio = original_sample_rate as f32 / target_sample_rate as f32;

                    // Very basic resampling by selecting samples at calculated intervals
                    let mut i: f32 = 0.0;
                    while i < data.len() as f32 {
                        let sample_index = i as usize;
                        if sample_index < data.len() {
                            // For mono, just use the sample directly
                            // For stereo or more channels, average the channels
                            let sample_f32 = if num_channels > 1 {
                                let mut sum = 0.0;
                                for c in 0..num_channels {
                                    if sample_index + c < data.len() {
                                        sum += data[sample_index + c];
                                    }
                                }
                                sum / num_channels as f32
                            } else {
                                data[sample_index]
                            };

                            // Write f32 sample directly
                            writer_guard
                                .write_sample(sample_f32)
                                .expect("Failed to write sample");

                            // Convert f32 to i16 for listeners
                            let sample_i16 = (data[sample_index] * i16::MAX as f32) as i16;
                            data_vec.push(sample_i16);
                        }
                        i += ratio * num_channels as f32; // Skip by number of channels
                    }

                    // Send all converted data to listeners (not just resampled)
                    let all_converted: Vec<i16> = data
                        .iter()
                        .map(|&sample| (sample * i16::MAX as f32) as i16)
                        .collect();

                    on_audio_data(all_converted);
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| e)?;

    Ok(stream)
}

// Helper function to list all devices for debugging
pub fn debug_list_all_devices() {
    let host = cpal::default_host();

    log::debug!("=== DEBUG: All Available Devices ===");

    log::debug!("Input devices:");
    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(name) = device.name() {
                log::debug!("  - {}", name);

                // Try to get device info
                if let Ok(configs) = device.supported_input_configs() {
                    for config in configs {
                        log::debug!("    Config: {:?}", config);
                    }
                }
            }
        }
    }

    log::debug!("Output devices:");
    if let Ok(devices) = host.output_devices() {
        for device in devices {
            if let Ok(name) = device.name() {
                log::debug!("  - {}", name);
            }
        }
    }

    log::debug!("=== END DEBUG ===");
}

// Function to find the best monitor device using system commands
pub fn find_monitor_device_for_output() -> Result<String, String> {
    // Try to get PulseAudio/PipeWire sources using pactl
    let output = Command::new("pactl")
        .args(&["list", "short", "sources"])
        .output()
        .map_err(|e| format!("Failed to run pactl: {}", e))?;

    let sources = String::from_utf8_lossy(&output.stdout);
    log::debug!("=== Available PulseAudio/PipeWire Sources ===");
    log::debug!("{}", sources);

    let mut candidates = Vec::new();

    // Look for monitor devices and collect them with their status
    for line in sources.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let device_name = parts[1];
            let device_name_lower = device_name.to_lowercase();

            // Check if device is running - look for "RUNNING" anywhere in the line
            let is_running = line.contains("RUNNING");

            if device_name_lower.contains("monitor") {
                log::debug!("Checking monitor device: {}", device_name);
                log::debug!("  Device name lower: {}", device_name_lower);
                log::debug!("  Full line: {}", line);
                log::debug!("  Is running: {}", is_running);

                candidates.push((device_name.to_string(), is_running)); // true = matched
            }
        }
    }

    log::debug!("=== Candidates found: {} ===", candidates.len());
    for (name, is_running) in &candidates {
        log::debug!("  - {} (running: {})", name, is_running);
    }

    // Sort candidates: prefer matched over fallback, and RUNNING over SUSPENDED
    candidates.sort_by(|a, b| {
        // First sort by whether it's a match (true) or fallback (false)
        b.1.cmp(&a.1)
    });

    if let Some((device_name, is_running)) = candidates.first() {
        let status = if *is_running { "RUNNING" } else { "SUSPENDED" };
        log::debug!("Selected {} monitor device ({})", status, device_name);
        return Ok(device_name.clone());
    }

    Err("No monitor device found for output".to_string())
}

// Function to start recording from a monitor device using parecord
pub fn start_system_audio_recording<P: AsRef<Path>>(
    monitor_device: &str,
    output_file: P,
) -> Result<Child, String> {
    log::debug!(
        "Starting system audio recording from {} to {:?}",
        monitor_device,
        output_file.as_ref()
    );

    // Check if parecord is available
    match Command::new("parecord").arg("--help").output() {
        Ok(_) => log::debug!("parecord is available"),
        Err(e) => return Err(format!("parecord is not available: {}", e)),
    }

    log::debug!(
        "Executing command: parecord --device={} --file-format=wav --channels={} --rate={} --format={} {:?}",
        monitor_device,
        2,
        48000,
        "s16le",
        output_file.as_ref()
    );

    let mut child = Command::new("parecord")
        .args(&[
            &format!("--device={}", monitor_device),
            "--file-format=wav",
            "--channels=2",
            "--rate=48000",
            "--format=s16le",
            output_file.as_ref().to_str().unwrap(),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start parecord: {}", e))?;

    // Give the process a moment to start and check if it's still running
    std::thread::sleep(std::time::Duration::from_millis(100));

    match child.try_wait() {
        Ok(Some(status)) => {
            // Process already exited - something went wrong
            let mut stderr = String::new();
            if let Some(stderr_handle) = child.stderr.take() {
                use std::io::Read;
                let _ = std::io::BufReader::new(stderr_handle).read_to_string(&mut stderr);
            }
            return Err(format!(
                "parecord exited immediately with status: {} - stderr: {}",
                status, stderr
            ));
        }
        Ok(None) => {
            // Process is still running - good!
            log::debug!("parecord process started successfully");
        }
        Err(e) => {
            return Err(format!("Failed to check parecord process status: {}", e));
        }
    }

    Ok(child)
}

/// Echo cancellation strategies
#[derive(Debug, Clone, Copy)]
pub enum EchoCancellationMode {
    /// No echo cancellation applied
    None,
    /// Simple noise reduction and gating
    Simple,
    /// Advanced echo cancellation with adaptive filtering
    Advanced,
}

/// Apply echo cancellation with configurable strategy
pub fn combine_audio_files_with_echo_cancellation<P: AsRef<Path>>(
    input_file: P,
    output_file: P,
    combined_file: P,
    echo_mode: EchoCancellationMode,
) -> Result<(), String> {
    let input_path = input_file.as_ref();
    let output_path = output_file.as_ref();
    let combined_path = combined_file.as_ref();

    log::debug!("Combining audio files with echo cancellation mode: {:?}", echo_mode);
    log::debug!("  Input (mic): {:?}", input_path);
    log::debug!("  Output (system): {:?}", output_path);
    log::debug!("  Combined: {:?}", combined_path);

    // Check if both input files exist
    if !input_path.exists() {
        return Err(format!("Input file does not exist: {:?}", input_path));
    }
    if !output_path.exists() {
        return Err(format!("Output file does not exist: {:?}", output_path));
    }

    // Ensure FFmpeg binaries are available
    ensure_ffmpeg_available()?;

    match echo_mode {
        EchoCancellationMode::None => {
            // Use original behavior without echo cancellation
            let ffmpeg = FfmpegCommand::new()
                .input(input_path.to_str().unwrap())
                .input(output_path.to_str().unwrap())
                .args([
                    "-filter_complex",
                    "[0:a]volume=0.5,compand=attacks=0.1:decays=0.8:points=-90/-90|-60/-60|-40/-25|-25/-15|-10/-10[norm0];[1:a]volume=0.5,compand=attacks=0.1:decays=0.8:points=-90/-90|-60/-60|-40/-25|-25/-15|-10/-10[norm1];[norm0][norm1]amix=inputs=2:duration=longest:dropout_transition=0.5",
                    "-ac", "1",
                    "-ar", "16000",
                    "-acodec", "pcm_f32le",
                    "-y",
                ])
                .output(combined_path.to_str().unwrap())
                .spawn()
                .map_err(|e| format!("Failed to spawn ffmpeg process: {}", e))?;

            process_ffmpeg_output(ffmpeg, "Audio combination")?;
        }
        EchoCancellationMode::Simple => {
            // Apply simple echo cancellation
            let temp_dir = std::env::temp_dir();
            let temp_mic_file = temp_dir.join("temp_mic_simple_cleaned.wav");
            
            apply_simple_echo_cancellation(input_path, &temp_mic_file)?;
            
            let ffmpeg = FfmpegCommand::new()
                .input(temp_mic_file.to_str().unwrap())
                .input(output_path.to_str().unwrap())
                .args([
                    "-filter_complex",
                    "[0:a]volume=0.6,compand=attacks=0.1:decays=0.8:points=-90/-90|-60/-60|-40/-25|-25/-15|-10/-10[norm0];[1:a]volume=0.4,compand=attacks=0.1:decays=0.8:points=-90/-90|-60/-60|-40/-25|-25/-15|-10/-10[norm1];[norm0][norm1]amix=inputs=2:duration=longest:dropout_transition=0.5",
                    "-ac", "1",
                    "-ar", "16000",
                    "-acodec", "pcm_f32le",
                    "-y",
                ])
                .output(combined_path.to_str().unwrap())
                .spawn()
                .map_err(|e| format!("Failed to spawn ffmpeg process: {}", e))?;

            process_ffmpeg_output(ffmpeg, "Audio combination with simple echo cancellation")?;
            let _ = std::fs::remove_file(&temp_mic_file);
        }
        EchoCancellationMode::Advanced => {
            // Apply advanced echo cancellation
            let temp_dir = std::env::temp_dir();
            let temp_mic_file = temp_dir.join("temp_mic_advanced_cleaned.wav");
            
            apply_echo_cancellation(input_path, output_path, &temp_mic_file)?;
            
            let ffmpeg = FfmpegCommand::new()
                .input(temp_mic_file.to_str().unwrap())
                .input(output_path.to_str().unwrap())
                .args([
                    "-filter_complex",
                    "[0:a]volume=0.7,compand=attacks=0.1:decays=0.8:points=-90/-90|-60/-60|-40/-25|-25/-15|-10/-10[norm0];[1:a]volume=0.3,compand=attacks=0.1:decays=0.8:points=-90/-90|-60/-60|-40/-25|-25/-15|-10/-10[norm1];[norm0][norm1]amix=inputs=2:duration=longest:dropout_transition=0.5",
                    "-ac", "1",
                    "-ar", "16000",
                    "-acodec", "pcm_f32le",
                    "-y",
                ])
                .output(combined_path.to_str().unwrap())
                .spawn()
                .map_err(|e| format!("Failed to spawn ffmpeg process: {}", e))?;

            process_ffmpeg_output(ffmpeg, "Audio combination with advanced echo cancellation")?;
            let _ = std::fs::remove_file(&temp_mic_file);
        }
    }

    // Check if the output file was created successfully
    if combined_path.exists() {
        log::debug!(
            "Successfully combined audio files into: {:?}",
            combined_path
        );
        Ok(())
    } else {
        Err("FFmpeg completed but output file was not created".to_string())
    }
}

/// Helper function to process FFmpeg output consistently
fn process_ffmpeg_output(
    mut ffmpeg: ffmpeg_sidecar::child::FfmpegChild,
    operation_name: &str,
) -> Result<(), String> {
    let mut errors = Vec::new();

    for event in ffmpeg
        .iter()
        .map_err(|e| format!("Failed to iterate over ffmpeg events: {}", e))?
    {
        match event {
            FfmpegEvent::Log(log_level, message) => match log_level {
                ffmpeg_sidecar::event::LogLevel::Error => {
                    println!("{} FFmpeg error: {}", operation_name, message);
                    log::error!("{} FFmpeg error: {}", operation_name, message);
                    errors.push(message);
                }
                ffmpeg_sidecar::event::LogLevel::Warning => {
                    println!("{} FFmpeg warning: {}", operation_name, message);
                    log::warn!("{} FFmpeg warning: {}", operation_name, message);
                }
                ffmpeg_sidecar::event::LogLevel::Info => {
                    println!("{} FFmpeg info: {}", operation_name, message);
                    log::debug!("{} FFmpeg info: {}", operation_name, message);
                }
                _ => {
                    println!("{} FFmpeg: {}", operation_name, message);
                    log::trace!("{} FFmpeg: {}", operation_name, message);
                }
            },
            FfmpegEvent::Progress(progress) => {
                println!("{} FFmpeg progress: {:?}", operation_name, progress);
                log::debug!("{} FFmpeg progress: {:?}", operation_name, progress);
            }
            FfmpegEvent::Done => {
                println!("{} FFmpeg process completed successfully", operation_name);
                log::debug!("{} FFmpeg process completed successfully", operation_name);
                break;
            }
            _ => {}
        }
    }

    if !errors.is_empty() {
        return Err(format!("{} errors occurred: {}", operation_name, errors.join("; ")));
    }

    Ok(())
}

/// Synchronize two audio files and detect delay offset between them
fn sync_audio_files<P: AsRef<Path>>(
    mic_file: P,
    speaker_file: P,
    synced_mic_file: P,
    synced_speaker_file: P,
) -> Result<(), String> {
    let mic_path = mic_file.as_ref();
    let speaker_path = speaker_file.as_ref();
    let synced_mic_path = synced_mic_file.as_ref();
    let synced_speaker_path = synced_speaker_file.as_ref();

    log::debug!("Synchronizing audio files:");
    log::debug!("  Original mic: {:?}", mic_path);
    log::debug!("  Original speaker: {:?}", speaker_path);
    log::debug!("  Synced mic: {:?}", synced_mic_path);
    log::debug!("  Synced speaker: {:?}", synced_speaker_path);

    // Preprocess both audio files with consistent format and filtering
    // This ensures both files have the same sample rate, format, and basic filtering
    
    // Process microphone file
    let mic_ffmpeg = FfmpegCommand::new()
        .input(mic_path.to_str().unwrap())
        .args([
            "-af", "volume=1.0,highpass=f=80,lowpass=f=8000",
            "-ac", "1",
            "-ar", "16000", 
            "-acodec", "pcm_f32le",
            "-y",
        ])
        .output(synced_mic_path.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to spawn mic preprocessing: {}", e))?;

    process_ffmpeg_output(mic_ffmpeg, "Microphone preprocessing")?;

    // Process speaker file  
    let spk_ffmpeg = FfmpegCommand::new()
        .input(speaker_path.to_str().unwrap())
        .args([
            "-af", "volume=1.0,highpass=f=80,lowpass=f=8000",
            "-ac", "1", 
            "-ar", "16000",
            "-acodec", "pcm_f32le",
            "-y",
        ])
        .output(synced_speaker_path.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to spawn speaker preprocessing: {}", e))?;

    process_ffmpeg_output(spk_ffmpeg, "Speaker preprocessing")?;

    if synced_mic_path.exists() && synced_speaker_path.exists() {
        log::debug!("Successfully synchronized audio files");
        Ok(())
    } else {
        Err("Audio synchronization completed but output files were not created".to_string())
    }
}

/// Apply acoustic echo cancellation to remove system audio from microphone input
/// This uses FFmpeg's adaptive filtering capabilities to reduce echo/feedback
fn apply_echo_cancellation<P: AsRef<Path>>(
    mic_file: P,
    speaker_file: P,
    output_file: P,
) -> Result<(), String> {
    let mic_path = mic_file.as_ref();
    let speaker_path = speaker_file.as_ref();
    let output_path = output_file.as_ref();

    log::debug!("Applying echo cancellation:");
    log::debug!("  Microphone: {:?}", mic_path);
    log::debug!("  Speaker ref: {:?}", speaker_path);
    log::debug!("  Cleaned output: {:?}", output_path);

    // First, synchronize the audio files
    let temp_dir = std::env::temp_dir();
    let synced_mic_file = temp_dir.join("synced_mic.wav");
    let synced_speaker_file = temp_dir.join("synced_speaker.wav");

    sync_audio_files(mic_path, speaker_path, &synced_mic_file, &synced_speaker_file)?;

    // Step 1: Clean the microphone audio (noise reduction only)
    let temp_dir = std::env::temp_dir();
    let clean_mic_file = temp_dir.join("clean_mic.wav");
    
    let mic_clean_ffmpeg = FfmpegCommand::new()
        .input(synced_mic_file.to_str().unwrap())
        .args([
            "-af", "afftdn=nr=10:nf=-40,agate=threshold=0.015:ratio=6",
            "-ac", "1",
            "-ar", "16000",
            "-acodec", "pcm_f32le",
            "-y",
        ])
        .output(clean_mic_file.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to spawn mic cleaning: {}", e))?;

    process_ffmpeg_output(mic_clean_ffmpeg, "Microphone cleaning")?;

    // Step 2: Subtract microphone from system audio to remove echo
    let clean_system_file = temp_dir.join("clean_system.wav");
    
    let subtract_ffmpeg = FfmpegCommand::new()
        .input(synced_speaker_file.to_str().unwrap())  // System audio (has echo)
        .input(clean_mic_file.to_str().unwrap())       // Clean mic (to subtract)
        .args([
            "-filter_complex",
            // Multi-stage echo cancellation with different delays and strengths
            "[0:a]volume=1.0[sys];\
            [1:a]asplit=3[mic1][mic2][mic3];\
            [mic1]volume=-0.5,adelay=delays=3[inv1];\
            [mic2]volume=-0.3,adelay=delays=8[inv2];\
            [mic3]volume=-0.2,adelay=delays=15[inv3];\
            [sys][inv1]amix=inputs=2:duration=longest[sub1];\
            [sub1][inv2]amix=inputs=2:duration=longest[sub2];\
            [sub2][inv3]amix=inputs=2:duration=longest[subtracted];\
            [subtracted]afftdn=nr=12:nf=-50,agate=threshold=0.008:ratio=6[final]",
            "-map", "[final]",
            "-ac", "1",
            "-ar", "16000", 
            "-acodec", "pcm_f32le",
            "-y",
        ])
        .output(clean_system_file.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to spawn echo subtraction: {}", e))?;

    process_ffmpeg_output(subtract_ffmpeg, "Echo subtraction")?;

    // Step 3: Combine cleaned microphone with cleaned system audio
    let combine_ffmpeg = FfmpegCommand::new()
        .input(clean_mic_file.to_str().unwrap())
        .input(clean_system_file.to_str().unwrap())
        .args([
            "-filter_complex",
            "[0:a]volume=0.7[clean_mic];[1:a]volume=0.6[clean_sys];\
            [clean_mic][clean_sys]amix=inputs=2:duration=longest:weights=0.7 0.6",
            "-ac", "1",
            "-ar", "16000",
            "-acodec", "pcm_f32le",
            "-y",
        ])
        .output(output_path.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to spawn final combination: {}", e))?;

    process_ffmpeg_output(combine_ffmpeg, "Final audio combination")?;

    // Clean up temporary files
    let _ = std::fs::remove_file(&clean_mic_file);
    let _ = std::fs::remove_file(&clean_system_file);

    // Clean up temporary files
    let _ = std::fs::remove_file(&synced_mic_file);
    let _ = std::fs::remove_file(&synced_speaker_file);

    if output_path.exists() {
        log::debug!("Successfully applied echo cancellation");
        Ok(())
    } else {
        Err("Echo cancellation completed but output file was not created".to_string())
    }
}

/// Alternative simpler echo cancellation using only noise reduction and gating
/// Use this if the main echo cancellation is too aggressive
pub fn apply_simple_echo_cancellation<P: AsRef<Path>>(
    mic_file: P,
    output_file: P,
) -> Result<(), String> {
    let mic_path = mic_file.as_ref();
    let output_path = output_file.as_ref();

    log::debug!("Applying simple echo cancellation to: {:?}", mic_path);

    // Ensure FFmpeg binaries are available
    ensure_ffmpeg_available()?;

    let ffmpeg = FfmpegCommand::new()
        .input(mic_path.to_str().unwrap())
        .args([
            "-filter_complex",
            // Apply aggressive noise reduction and gating
            "[0:a]afftdn=nr=20:nf=-35:tn=1[nr];\
            [nr]agate=threshold=0.02:ratio=8:attack=3:release=25[gated];\
            [gated]highpass=f=80[hp];\
            [hp]lowpass=f=8000[final]",
            "-map", "[final]",
            "-ac", "1",      // Mono output
            "-ar", "16000",  // 16kHz sample rate
            "-acodec", "pcm_f32le", // 32-bit float little-endian format
            "-y",            // Overwrite output file
        ])
        .output(output_path.to_str().unwrap())
        .spawn()
        .map_err(|e| format!("Failed to spawn simple echo cancellation ffmpeg process: {}", e))?;

    process_ffmpeg_output(ffmpeg, "Simple echo cancellation")?;

    if output_path.exists() {
        log::debug!("Successfully applied simple echo cancellation");
        Ok(())
    } else {
        Err("Simple echo cancellation completed but output file was not created".to_string())
    }
}
