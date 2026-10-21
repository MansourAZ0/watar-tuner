//! Watar's audio glue: builds engine configurations from settings and maps
//! engine events to UI messages. Engine ownership, live reconfiguration and
//! restarts are handled by `naghma_audio::EngineSession`.

use crate::frame::{Presentation, UiFrame};
use crate::settings::Settings;
use naghma_audio::simulation::SimulationSpec;
use naghma_audio::{
    EngineConfig, EngineError, EngineEvent, EngineSession, EngineStats, SourceConfig, StreamInfo,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, RwLock};
use tauri::ipc::Channel;

/// Which source the user asked for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceMode {
    Microphone,
    /// Synthetic notes for development; always labelled in the UI.
    Simulation,
}

/// Messages on the UI channel.
// Frames are nearly every message; boxing them would allocate per hop.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum UiMessage {
    Frame(UiFrame),
    Error { error: EngineError, message: String },
}

/// Thread-safe audio state for the Tauri app.
#[derive(Default)]
pub struct AudioController {
    session: EngineSession,
    mode: Mutex<Option<SourceMode>>,
    presentation: Arc<RwLock<Option<Presentation>>>,
}

fn engine_config(mode: SourceMode, settings: &Settings) -> EngineConfig {
    EngineConfig {
        source: match mode {
            SourceMode::Microphone => SourceConfig::Microphone {
                device_id: settings.input_device_id.clone(),
            },
            SourceMode::Simulation => SourceConfig::Simulation(SimulationSpec::default()),
        },
        analysis: settings.analysis_config(),
        tracker: settings.tracker_config(),
        context: settings.pitch_context(),
    }
}

impl AudioController {
    /// Start (or restart) with `settings`, sending messages to `channel`.
    /// Blocks while the OS opens the device — call off the async runtime.
    pub fn start(
        &self,
        mode: SourceMode,
        settings: &Settings,
        channel: Channel<UiMessage>,
    ) -> Result<StreamInfo, EngineError> {
        self.set_presentation(settings);
        let presentation = self.presentation.clone();
        let info = self
            .session
            .start(engine_config(mode, settings), move |event| match event {
                EngineEvent::Frame(f) => {
                    let frame = presentation
                        .read()
                        .ok()
                        .and_then(|p| p.as_ref().map(|p| p.frame(&f)));
                    if let Some(frame) = frame {
                        let _ = channel.send(UiMessage::Frame(frame));
                    }
                }
                EngineEvent::NoteEnded(_) => {}
                EngineEvent::Error { error } => {
                    let message = error.to_string();
                    let _ = channel.send(UiMessage::Error { error, message });
                }
            })?;
        *self.mode.lock().expect("mode lock") = Some(mode);
        Ok(info)
    }

    /// Stop if running.
    pub fn stop(&self) {
        self.session.stop();
        *self.mode.lock().expect("mode lock") = None;
    }

    /// Apply new settings to a running stream (live or by restarting).
    pub fn apply(&self, settings: &Settings) -> Result<(), EngineError> {
        self.set_presentation(settings);
        let mode = *self.mode.lock().expect("mode lock");
        if let Some(mode) = mode {
            self.session.reconfigure(engine_config(mode, settings))?;
        }
        Ok(())
    }

    /// Stream facts, counters and mode while running.
    pub fn status(&self) -> Option<(StreamInfo, EngineStats, SourceMode)> {
        let mode = (*self.mode.lock().expect("mode lock"))?;
        self.session.status().map(|(i, s)| (i, s, mode))
    }

    fn set_presentation(&self, settings: &Settings) {
        *self.presentation.write().expect("presentation lock") = Some(Presentation {
            labels: settings.label_options(),
            view: settings.notation.note_view,
            instrument: settings.instrument(),
        });
    }
}
