//! Persistent user settings and their translation into engine/naming
//! configuration.
//!
//! Settings are stored as JSON in the app's config directory. Every field
//! has a default, so files written by older versions (missing fields) still
//! load, and unknown fields from newer versions are ignored.

use naghma_audio::AnalysisConfig;
use naghma_core::instrument::InstrumentProfile;
use naghma_core::interpret::PitchContext;
use naghma_core::notation::LabelOptions;
use naghma_core::preferences::NotationPreferences;
use naghma_core::tracking::TrackerConfig;
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
    /// Shared notation preferences, stored flat for compatibility with
    /// settings written before they were factored out.
    #[serde(flatten)]
    pub notation: NotationPreferences,
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
            notation: NotationPreferences::default(),
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
        self.notation
            .validate()
            .map_err(|e| InvalidSettings(e.to_string()))?;
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
        self.notation.pitch_context()
    }

    /// Label rendering options.
    pub fn label_options(&self) -> LabelOptions {
        self.notation.label_options()
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
        p.reference = self.notation.reference();
        p.transposition = self.notation.transposition;
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
    use naghma_core::notation::Script;
    use naghma_core::pitch::{IntervalUnit, Transposition};
    use naghma_core::preferences::TuningChoice;

    #[test]
    fn json_stays_flat_for_compatibility() {
        let v = serde_json::to_value(Settings::default()).unwrap();
        for key in [
            "referenceHz",
            "transposition",
            "tuning",
            "noteScript",
            "noteView",
        ] {
            assert!(v.get(key).is_some(), "{key}");
        }
        assert!(v.get("notation").is_none());
    }

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
            s.notation.transposition,
            Transposition::new(-2.0, IntervalUnit::Semitone)
        );
        assert_eq!(s.notation.reference_hz, 440.0);
        assert_eq!(s.notation.tuning, TuningChoice::Edo24);
    }

    #[test]
    fn validation_rejects_nonsense() {
        let s = Settings {
            notation: NotationPreferences {
                reference_hz: 1000.0,
                ..NotationPreferences::default()
            },
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
            notation: NotationPreferences {
                transposition: Transposition::new(-30.0, IntervalUnit::Semitone),
                ..NotationPreferences::default()
            },
            ..Settings::default()
        };
        assert!(s.validate().is_err());
    }

    #[test]
    fn context_reflects_transposition_and_reference() {
        let s = Settings {
            notation: NotationPreferences {
                transposition: Transposition::new(-2.0, IntervalUnit::Semitone),
                reference_hz: 442.0,
                ..NotationPreferences::default()
            },
            ..Settings::default()
        };
        let ctx = s.pitch_context();
        assert_eq!(ctx.reference.la4_hz, 442.0);
        let r = ctx.read(442.0 * 2f64.powf(-9.0 / 12.0)).unwrap(); // Do4 at 442
        assert_eq!(r.player.note.to_string(), "Re4");
        assert_eq!(s.instrument().transposition, s.notation.transposition);
    }

    #[test]
    fn save_and_load_atomically() {
        let dir = std::env::temp_dir().join(format!("watar-settings-{}", std::process::id()));
        let path = dir.join("settings.json");
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(Settings::load(&path).unwrap(), Settings::default());
        let s = Settings {
            language: Language::Ar,
            notation: NotationPreferences {
                note_script: Script::Arabic,
                ..NotationPreferences::default()
            },
            ..Settings::default()
        };
        s.save(&path).unwrap();
        assert_eq!(Settings::load(&path).unwrap(), s);
        fs::write(&path, "{ not json").unwrap();
        assert!(Settings::load(&path).is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
