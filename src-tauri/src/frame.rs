//! The compact, display-ready frame sent to the UI for every analysis hop.
//!
//! All musical interpretation (naming, transposition, labels) happens here
//! in Rust via `naghma-core`; the frontend only renders. Raw audio is never
//! sent.

use naghma_audio::AnalysisFrame;
use naghma_core::events::ObservationStatus;
use naghma_core::instrument::InstrumentProfile;
use naghma_core::interpret::NoteView;
use naghma_core::notation::{LabelOptions, NoteLabel};
use naghma_core::pitch::Pitch;
use naghma_core::tracking::LiveState;
use serde::Serialize;

/// Display state of the tuner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UiState {
    Silent,
    Listening,
    Note,
}

/// The currently held note.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiNote {
    pub event_id: u64,
    /// Label in the selected view (player by default).
    pub label: NoteLabel,
    /// Label of the other identity (concert if `label` is the player's).
    pub other_label: NoteLabel,
    /// Deviation from the target, cents (+ = sharp).
    pub cents: f64,
    /// Smoothed measured frequency, Hz (sounding).
    pub hz: f64,
    /// Sounding frequency of the target, Hz.
    pub target_hz: f64,
    /// Held through a short dropout.
    pub holding: bool,
    /// Open course whose sounding pitch is within a semitone, if any, with
    /// the deviation from it in cents — for tuning open strings.
    pub nearest_course: Option<CourseMatch>,
}

/// Measured pitch relative to an open course.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseMatch {
    pub index: usize,
    pub cents: f64,
}

/// A note that just started (for history and animation).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiNoteStart {
    pub event_id: u64,
    pub label: NoteLabel,
    pub cents: f64,
    pub start_s: f64,
    /// Player pitch number (semitones; 60 = Do4), for melodic direction.
    pub pitch: f64,
}

/// Engineering diagnostics for the optional panel.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiDiagnostics {
    pub raw_hz: Option<f64>,
    pub compute_us: f64,
    pub latency_ms: Option<f64>,
    pub window_ms: f64,
}

/// One frame for the UI.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiFrame {
    /// Stream time, seconds.
    pub t: f64,
    pub state: UiState,
    pub status: ObservationStatus,
    pub level_db: f64,
    pub confidence: f64,
    pub onset: bool,
    pub note: Option<UiNote>,
    pub started: Option<UiNoteStart>,
    pub diagnostics: UiDiagnostics,
}

/// How frames are presented; updated live when settings change.
#[derive(Debug, Clone, PartialEq)]
pub struct Presentation {
    pub labels: LabelOptions,
    pub view: NoteView,
    pub instrument: InstrumentProfile,
}

impl Presentation {
    /// Map an engine frame to a UI frame.
    pub fn frame(&self, f: &AnalysisFrame) -> UiFrame {
        let (state, note) = match &f.update.state {
            LiveState::Silent => (UiState::Silent, None),
            LiveState::Listening => (UiState::Listening, None),
            LiveState::Note(n) => {
                let r = &n.reading;
                let (shown, other) = match self.view {
                    NoteView::Player => (&r.player, &r.sounding),
                    NoteView::Concert => (&r.sounding, &r.player),
                };
                let reference = self.instrument.reference;
                let target_sounding = match self.view {
                    NoteView::Player => self
                        .instrument
                        .transposition
                        .player_to_sounding(r.player.target),
                    NoteView::Concert => r.sounding.target,
                };
                (
                    UiState::Note,
                    Some(UiNote {
                        event_id: n.event_id,
                        label: shown.note.label(&self.labels),
                        other_label: other.note.label(&self.labels),
                        cents: shown.deviation_cents,
                        hz: r.frequency_hz,
                        target_hz: target_sounding.to_frequency(reference),
                        holding: n.holding,
                        nearest_course: self.nearest_course(r.sounding_pitch),
                    }),
                )
            }
        };
        let started = f.update.started.as_ref().map(|e| {
            let m = match self.view {
                NoteView::Player => &e.player,
                NoteView::Concert => &e.sounding,
            };
            UiNoteStart {
                event_id: e.id,
                label: m.note.label(&self.labels),
                cents: m.deviation_cents,
                start_s: e.start_s,
                pitch: e.player_pitch.0,
            }
        });
        UiFrame {
            t: f.observation.time_s,
            state,
            status: f.observation.status,
            level_db: f.observation.level_db,
            confidence: f.observation.confidence,
            onset: f.update.onset,
            note,
            started,
            diagnostics: UiDiagnostics {
                raw_hz: f.observation.frequency_hz,
                compute_us: f.timing.compute_us,
                latency_ms: f.timing.pipeline_latency_ms,
                window_ms: f.timing.window_ms,
            },
        }
    }

    fn nearest_course(&self, sounding: Pitch) -> Option<CourseMatch> {
        (0..self.instrument.courses.len())
            .map(|i| CourseMatch {
                index: i,
                cents: self.instrument.open_sounding_pitch(i).cents_to(sounding),
            })
            .filter(|c| c.cents.abs() <= 100.0)
            .min_by(|a, b| a.cents.abs().total_cmp(&b.cents.abs()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::Settings;
    use naghma_audio::{AnalysisConfig, analyze_samples};
    use naghma_core::pitch::{IntervalUnit, Transposition};
    use naghma_core::preferences::NotationPreferences;
    use pitchforge::signals;

    fn presentation(s: &Settings) -> Presentation {
        Presentation {
            labels: s.label_options(),
            view: s.notation.note_view,
            instrument: s.instrument(),
        }
    }

    fn frames_for(hz: f64, s: &Settings) -> Vec<UiFrame> {
        let samples = signals::harmonic(hz, 48_000.0, 48_000, 0.5, &[1.0, 0.5, 0.3]);
        let p = presentation(s);
        analyze_samples(
            &samples,
            48_000.0,
            AnalysisConfig::default(),
            s.tracker_config(),
            s.pitch_context(),
        )
        .unwrap()
        .iter()
        .map(|f| p.frame(f))
        .collect()
    }

    #[test]
    fn player_view_shows_re4_for_sounding_do4_at_minus_two() {
        let s = Settings {
            notation: NotationPreferences {
                transposition: Transposition::new(-2.0, IntervalUnit::Semitone),
                ..NotationPreferences::default()
            },
            ..Settings::default()
        };
        let last = frames_for(261.63, &s).pop().unwrap();
        let note = last.note.expect("note shown");
        assert_eq!(note.label.text, "Re4");
        assert_eq!(note.other_label.text, "Do4");
        assert!((note.target_hz - 261.6256).abs() < 1e-3);
        assert!(note.cents.abs() < 1.0);
        // The top course of the example oud (Do4, sounding Si♭3 at −2) is
        // two semitones away: not "nearest".
        assert_eq!(note.nearest_course, None);
    }

    #[test]
    fn concert_view_shows_sounding_note() {
        let s = Settings {
            notation: NotationPreferences {
                transposition: Transposition::new(-2.0, IntervalUnit::Semitone),
                note_view: NoteView::Concert,
                ..NotationPreferences::default()
            },
            ..Settings::default()
        };
        let note = frames_for(261.63, &s).pop().unwrap().note.unwrap();
        assert_eq!(note.label.text, "Do4");
        assert_eq!(note.other_label.text, "Re4");
    }

    #[test]
    fn open_course_detection_for_string_tuning() {
        let s = Settings::default();
        // Re3 course (index 3) played 8 cents sharp.
        let hz = 146.832 * 2f64.powf(8.0 / 1200.0);
        let note = frames_for(hz, &s).pop().unwrap().note.unwrap();
        let c = note.nearest_course.unwrap();
        assert_eq!(c.index, 3);
        assert!((c.cents - 8.0).abs() < 1.0, "{}", c.cents);
    }

    #[test]
    fn serialized_frame_uses_camel_case_contract() {
        let f = frames_for(220.0, &Settings::default()).pop().unwrap();
        let v = serde_json::to_value(&f).unwrap();
        for key in [
            "t",
            "state",
            "status",
            "levelDb",
            "confidence",
            "onset",
            "note",
            "diagnostics",
        ] {
            assert!(v.get(key).is_some(), "missing {key}");
        }
        let note = &v["note"];
        for key in [
            "eventId",
            "label",
            "otherLabel",
            "cents",
            "hz",
            "targetHz",
            "holding",
        ] {
            assert!(note.get(key).is_some(), "missing note.{key}");
        }
        assert_eq!(note["label"]["text"], "La3");
        assert_eq!(v["state"], "note");
    }
}
