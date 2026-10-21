//! Watar — a standalone oud tuner.
//!
//! The Rust side owns audio capture, pitch detection and all musical
//! interpretation (via `naghma-audio` / `naghma-core`); the webview renders
//! the display-ready frames it receives over a channel.

mod audio;
mod frame;
mod settings;

use audio::{AudioController, SourceMode, UiMessage};
use naghma_audio::{EngineError, EngineStats, StreamInfo};
use naghma_core::notation::NoteLabel;
use serde::Serialize;
use settings::Settings;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{Manager, State};

struct AppState {
    audio: AudioController,
    settings: Mutex<Settings>,
    settings_path: PathBuf,
    /// Set when the stored settings file could not be read; shown once.
    settings_warning: Mutex<Option<String>>,
}

/// Error returned to the UI: a stable code plus a readable message.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandError {
    code: String,
    message: String,
}

impl From<EngineError> for CommandError {
    fn from(e: EngineError) -> Self {
        let code = serde_json::to_value(&e)
            .ok()
            .and_then(|v| v.get("code").and_then(|c| c.as_str()).map(str::to_string))
            .unwrap_or_else(|| "backend".into());
        Self {
            code,
            message: e.to_string(),
        }
    }
}

impl CommandError {
    fn new(code: &str, message: impl ToString) -> Self {
        Self {
            code: code.into(),
            message: message.to_string(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AudioStatus {
    info: StreamInfo,
    stats: EngineStats,
    mode: SourceMode,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CourseInfo {
    index: usize,
    strings: u8,
    label: NoteLabel,
    other_label: NoteLabel,
    sounding_hz: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstrumentInfo {
    name: String,
    description: Option<String>,
    courses: Vec<CourseInfo>,
}

/// Development aid: `WATAR_AUTOSTART=simulation|microphone` starts audio on
/// launch (used for automated screenshots and manual testing).
#[tauri::command]
fn autostart_mode() -> Option<SourceMode> {
    match std::env::var("WATAR_AUTOSTART").ok()?.as_str() {
        "simulation" => Some(SourceMode::Simulation),
        "microphone" => Some(SourceMode::Microphone),
        _ => None,
    }
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().expect("settings lock").clone()
}

#[tauri::command]
fn take_settings_warning(state: State<'_, AppState>) -> Option<String> {
    state.settings_warning.lock().expect("warning lock").take()
}

#[tauri::command]
async fn update_settings(
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, CommandError> {
    settings
        .validate()
        .map_err(|e| CommandError::new("invalidSettings", e))?;
    settings
        .save(&state.settings_path)
        .map_err(|e| CommandError::new("io", e))?;
    *state.settings.lock().expect("settings lock") = settings.clone();
    state.audio.apply(&settings)?;
    Ok(settings)
}

#[tauri::command]
fn list_input_devices() -> Result<Vec<naghma_audio::capture::InputDevice>, CommandError> {
    Ok(naghma_audio::capture::list_input_devices()?)
}

#[tauri::command]
async fn start_audio(
    app: tauri::AppHandle,
    mode: SourceMode,
    on_message: Channel<UiMessage>,
) -> Result<StreamInfo, CommandError> {
    // Opening a device can block (e.g. while macOS shows the microphone
    // permission prompt), so do it off the async runtime.
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let settings = state.settings.lock().expect("settings lock").clone();
        state.audio.start(mode, &settings, on_message)
    })
    .await
    .map_err(|e| CommandError::new("backend", e))?
    .map_err(CommandError::from)
}

#[tauri::command]
async fn stop_audio(app: tauri::AppHandle) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || app.state::<AppState>().audio.stop())
        .await
        .map_err(|e| CommandError::new("backend", e))
}

#[tauri::command]
fn audio_status(state: State<'_, AppState>) -> Option<AudioStatus> {
    state
        .audio
        .status()
        .map(|(info, stats, mode)| AudioStatus { info, stats, mode })
}

#[tauri::command]
fn instrument_info(state: State<'_, AppState>) -> InstrumentInfo {
    let s = state.settings.lock().expect("settings lock").clone();
    let profile = s.instrument();
    let labels = s.label_options();
    let ctx = s.pitch_context();
    let courses = profile
        .courses
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let sounding = profile.open_sounding_pitch(i);
            let sounding_name = ctx
                .read(sounding.to_frequency(profile.reference))
                .map_or(c.open, |r| r.sounding.note);
            let (label, other) = match s.notation.note_view {
                naghma_core::interpret::NoteView::Player => (c.open, sounding_name),
                naghma_core::interpret::NoteView::Concert => (sounding_name, c.open),
            };
            CourseInfo {
                index: i,
                strings: c.strings,
                label: label.label(&labels),
                other_label: other.label(&labels),
                sounding_hz: profile.open_frequency(i),
            }
        })
        .collect();
    InstrumentInfo {
        name: profile.name,
        description: profile.description,
        courses,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_config_dir()?;
            let settings_path = dir.join("settings.json");
            let (settings, warning) = match Settings::load(&settings_path) {
                Ok(s) => (s, None),
                Err(e) => (
                    Settings::default(),
                    Some(format!(
                        "Your saved settings could not be read ({e}); defaults are in use."
                    )),
                ),
            };
            app.manage(AppState {
                audio: AudioController::default(),
                settings: Mutex::new(settings),
                settings_path,
                settings_warning: Mutex::new(warning),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            autostart_mode,
            get_settings,
            take_settings_warning,
            update_settings,
            list_input_devices,
            start_audio,
            stop_audio,
            audio_status,
            instrument_info,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                window.app_handle().state::<AppState>().audio.stop();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
