//! Owns the running analysis engine and forwards frames to the UI.

use crate::frame::{Presentation, UiFrame};
use crate::settings::Settings;
use naghma_audio::simulation::SimulationSpec;
use naghma_audio::{
    Engine, EngineConfig, EngineError, EngineEvent, EngineStats, SourceConfig, StreamInfo,
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

/// Messages on the UI channel besides frames.
// Frames are nearly every message; boxing them would allocate per hop.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum UiMessage {
    Frame(UiFrame),
    Error { error: EngineError, message: String },
}

struct Running {
    engine: Engine,
    mode: SourceMode,
    channel: Channel<UiMessage>,
}

/// Thread-safe holder for the engine.
#[derive(Default)]
pub struct AudioController {
    running: Mutex<Option<Running>>,
    presentation: Arc<RwLock<Option<Presentation>>>,
}

impl AudioController {
    /// Start (or restart) the engine with `settings`, sending frames to
    /// `channel`. Blocks while the OS opens the device (possibly showing a
    /// permission prompt) — call from a blocking-capable thread.
    pub fn start(
        &self,
        mode: SourceMode,
        settings: &Settings,
        channel: Channel<UiMessage>,
    ) -> Result<StreamInfo, EngineError> {
        self.stop();
        self.set_presentation(settings);
        let source = match mode {
            SourceMode::Microphone => SourceConfig::Microphone {
                device_id: settings.input_device_id.clone(),
            },
            SourceMode::Simulation => SourceConfig::Simulation(SimulationSpec::default()),
        };
        let config = EngineConfig {
            source,
            analysis: settings.analysis_config(),
            tracker: settings.tracker_config(),
            context: settings.pitch_context(),
        };
        let presentation = self.presentation.clone();
        let tx = channel.clone();
        let engine = Engine::start(config, move |event| match event {
            EngineEvent::Frame(f) => {
                let frame = presentation
                    .read()
                    .ok()
                    .and_then(|p| p.as_ref().map(|p| p.frame(&f)));
                if let Some(frame) = frame {
                    let _ = tx.send(UiMessage::Frame(frame));
                }
            }
            EngineEvent::NoteEnded(_) => {}
            EngineEvent::Error { error } => {
                let message = error.to_string();
                let _ = tx.send(UiMessage::Error { error, message });
            }
        })?;
        let info = engine.info().clone();
        *self.running.lock().expect("audio lock") = Some(Running {
            engine,
            mode,
            channel,
        });
        Ok(info)
    }

    /// Stop the engine if running.
    pub fn stop(&self) {
        let running = self.running.lock().expect("audio lock").take();
        if let Some(r) = running {
            r.engine.stop();
        }
    }

    /// Apply new settings to a running engine. Returns `true` if the stream
    /// had to be restarted (device or analysis parameters changed).
    pub fn apply(&self, old: &Settings, new: &Settings) -> Result<bool, EngineError> {
        self.set_presentation(new);
        if old.needs_restart(new) {
            let restart = self
                .running
                .lock()
                .expect("audio lock")
                .as_ref()
                .map(|r| (r.mode, r.channel.clone()));
            if let Some((mode, channel)) = restart {
                self.start(mode, new, channel)?;
                return Ok(true);
            }
            return Ok(false);
        }
        if let Some(r) = self.running.lock().expect("audio lock").as_ref() {
            r.engine.set_context(new.pitch_context());
            r.engine.set_tracker_config(new.tracker_config());
        }
        Ok(false)
    }

    /// Stream facts and counters, if running.
    pub fn status(&self) -> Option<(StreamInfo, EngineStats, SourceMode)> {
        self.running
            .lock()
            .expect("audio lock")
            .as_ref()
            .map(|r| (r.engine.info().clone(), r.engine.stats(), r.mode))
    }

    fn set_presentation(&self, settings: &Settings) {
        *self.presentation.write().expect("presentation lock") = Some(Presentation {
            labels: settings.label_options(),
            view: settings.note_view,
            instrument: settings.instrument(),
        });
    }
}
