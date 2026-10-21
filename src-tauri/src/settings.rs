//! Persistent user settings and their translation into engine/naming
//! configuration.
//!
//! Settings are stored as JSON in the app's config directory. Every field
//! has a default, so files written by older versions (missing fields) still
//! load, and unknown fields from newer versions are ignored.

use naghma_audio::AnalysisConfig;
use naghma_core::instrument::InstrumentProfile;
use naghma_core::interpret::{NoteView, PitchContext, Tuning};
use naghma_core::notation::{AccidentalStyle, Digits, LabelOptions, Script};
use naghma_core::pitch::{ReferencePitch, Transposition};
use naghma_core::tracking::TrackerConfig;
use naghma_core::tuning::EqualTemperament;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::Path;

/// Current settings schema version.
pub const SETTINGS_VERSION: u32 = 1;

/// Interface language (independent of note naming).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Language {
    #[default]
    En,
    Ar,
}

/// Tuning grid offered in the tuner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TuningChoice {
    /// 24 equal divisions (quarter-tones).
    #[default]
    Edo24,
    /// 12 equal divisions (semitones).
    Edo12,
}

/// Rendering detail for the animated background.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisualQuality {
    #[default]
    Full,
    Reduced,
    Off,
}

/// Detection sensitivity.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Sensitivity {
    /// RMS level below which input counts as silence, dBFS.
    pub silence_threshold_db: f64,
    /// Minimum detector confidence for a note to be shown.
    pub min_confidence: f64,
}

impl Default for Sensitivity {
    fn default() -> Self {
        Self {
            silence_threshold_db: -60.0,
            min_confidence: 0.8,
        }
    }
}

/// All persisted settings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    pub language: Language,
    pub note_script: Script,
    pub accidental_style: AccidentalStyle,
    pub arabic_digits: bool,
    pub note_view: NoteView,
    pub reference_hz: f64,
    pub transposition: Transposition,
    pub tuning: TuningChoice,
    pub input_device_id: Option<String>,
    pub sensitivity: Sensitivity,
    pub visual_quality: VisualQuality,
    pub show_diagnostics: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            language: Language::En,
            note_script: Script::Latin,
            accidental_style: AccidentalStyle::Symbol,
            arabic_digits: false,
            note_view: NoteView::Player,
            reference_hz: 440.0,
            transposition: Transposition::NONE,
            tuning: TuningChoice::Edo24,
            input_device_id: None,
            sensitivity: Sensitivity::default(),
            visual_quality: VisualQuality::Full,
            show_diagnostics: false,
        }
    }
}

/// A settings value that cannot be used.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidSettings(pub String);

impl std::fmt::Display for InvalidSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl Settings {
    /// Reject values that would break analysis or naming.
    pub fn validate(&self) -> Result<(), InvalidSettings> {
        let bad = |m: &str| Err(InvalidSettings(m.to_string()));
        if !(self.reference_hz.is_finite() && (380.0..=480.0).contains(&self.reference_hz)) {
            return bad("reference pitch must be between 380 and 480 Hz");
        }
        let t = self.transposition.interval().cents();
        if !(t.is_finite() && t.abs() <= 2400.0) {
            return bad("transposition must be within two octaves");
        }
        let s = self.sensitivity;
        if !(s.silence_threshold_db.is_finite()
            && (-90.0..=-20.0).contains(&s.silence_threshold_db))
        {
            return bad("silence threshold must be between -90 and -20 dBFS");
        }
        if !(s.min_confidence.is_finite() && (0.5..=0.99).contains(&s.min_confidence)) {
            return bad("minimum confidence must be between 0.5 and 0.99");
        }
        Ok(())
    }

    /// Naming context for the analysis engine.
    pub fn pitch_context(&self) -> PitchContext {
        PitchContext {
            reference: ReferencePitch::new(self.reference_hz).unwrap_or_default(),
            transposition: self.transposition,
            tuning: Tuning::Equal(match self.tuning {
                TuningChoice::Edo24 => EqualTemperament::edo24(),
                TuningChoice::Edo12 => EqualTemperament::edo12(),
            }),
        }
    }

    /// Label rendering options.
    pub fn label_options(&self) -> LabelOptions {
        LabelOptions {
            script: self.note_script,
            accidentals: self.accidental_style,
            show_octave: true,
            digits: if self.arabic_digits {
                Digits::ArabicIndic
            } else {
                Digits::Western
            },
        }
    }

    /// Analysis parameters (changing these requires restarting the stream).
    pub fn analysis_config(&self) -> AnalysisConfig {
        AnalysisConfig {
            silence_threshold_db: self.sensitivity.silence_threshold_db,
            ..AnalysisConfig::default()
        }
    }

    /// Note-tracker parameters.
    pub fn tracker_config(&self) -> TrackerConfig {
        TrackerConfig {
            min_confidence: self.sensitivity.min_confidence,
            ..TrackerConfig::default()
        }
    }

    /// The instrument with this reference and transposition applied.
    pub fn instrument(&self) -> InstrumentProfile {
        let mut p = InstrumentProfile::oud_6_course_example();
        p.reference = ReferencePitch::new(self.reference_hz).unwrap_or_default();
        p.transposition = self.transposition;
        p
    }

    /// Load from `path`; a missing file gives defaults. A corrupt file is
    /// reported so it is not silently overwritten.
    pub fn load(path: &Path) -> io::Result<Settings> {
        match fs::read_to_string(path) {
            Ok(text) => {
                let mut s: Settings = serde_json::from_str(&text)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                s.version = SETTINGS_VERSION;
                if s.validate().is_err() {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "settings file contains invalid values",
                    ));
                }
                Ok(s)
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Settings::default()),
            Err(e) => Err(e),
        }
    }

    /// Write atomically (temp file + rename).
    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let tmp = path.with_extension("json.tmp");
        fs::write(
            &tmp,
            serde_json::to_vec_pretty(self).map_err(io::Error::other)?,
        )?;
        fs::rename(tmp, path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use naghma_core::pitch::IntervalUnit;

    #[test]
    fn defaults_are_valid_and_round_trip() {
        let s = Settings::default();
        s.validate().unwrap();
        let json = serde_json::to_string(&s).unwrap();
        assert_eq!(serde_json::from_str::<Settings>(&json).unwrap(), s);
    }

    #[test]
    fn old_files_with_missing_fields_still_load() {
        let s: Settings = serde_json::from_str(
            r#"{"version":1,"transposition":{"amount":-2,"unit":"semitone"},"futureField":true}"#,
        )
        .unwrap();
        assert_eq!(
            s.transposition,
            Transposition::new(-2.0, IntervalUnit::Semitone)
        );
        assert_eq!(s.reference_hz, 440.0);
        assert_eq!(s.tuning, TuningChoice::Edo24);
    }

    #[test]
    fn validation_rejects_nonsense() {
        let s = Settings {
            reference_hz: 1000.0,
            ..Settings::default()
        };
        assert!(s.validate().is_err());
        let s = Settings {
            sensitivity: Sensitivity {
                min_confidence: 0.1,
                ..Sensitivity::default()
            },
            ..Settings::default()
        };
        assert!(s.validate().is_err());
        let s = Settings {
            transposition: Transposition::new(-30.0, IntervalUnit::Semitone),
            ..Settings::default()
        };
        assert!(s.validate().is_err());
    }

    #[test]
    fn context_reflects_transposition_and_reference() {
        let s = Settings {
            transposition: Transposition::new(-2.0, IntervalUnit::Semitone),
            reference_hz: 442.0,
            ..Settings::default()
        };
        let ctx = s.pitch_context();
        assert_eq!(ctx.reference.la4_hz, 442.0);
        let r = ctx.read(442.0 * 2f64.powf(-9.0 / 12.0)).unwrap(); // Do4 at 442
        assert_eq!(r.player.note.to_string(), "Re4");
        assert_eq!(s.instrument().transposition, s.transposition);
    }

    #[test]
    fn save_and_load_atomically() {
        let dir = std::env::temp_dir().join(format!("watar-settings-{}", std::process::id()));
        let path = dir.join("settings.json");
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(Settings::load(&path).unwrap(), Settings::default());
        let s = Settings {
            language: Language::Ar,
            note_script: Script::Arabic,
            ..Settings::default()
        };
        s.save(&path).unwrap();
        assert_eq!(Settings::load(&path).unwrap(), s);
        fs::write(&path, "{ not json").unwrap();
        assert!(Settings::load(&path).is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
