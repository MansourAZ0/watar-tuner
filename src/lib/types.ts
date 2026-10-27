// TypeScript mirrors of the Rust types crossing the Tauri IPC boundary.
// Field names follow the Rust `#[serde(rename_all = "camelCase")]` output;
// `src-tauri/src/frame.rs` has a test pinning the frame contract.

import type { AccidentalStyle, NoteLabel, NoteView, Script, Transposition } from "@naghma/ui";

export type { AccidentalStyle, Degree, IntervalUnit, NoteLabel, NoteView, Script, Transposition } from "@naghma/ui";

export type UiState = "silent" | "listening" | "note";
export type ObservationStatus = "voiced" | "silence" | "aperiodic" | "outOfRange" | "invalidInput";

export interface CourseMatch {
  index: number;
  cents: number;
}

export interface UiNote {
  eventId: number;
  label: NoteLabel;
  otherLabel: NoteLabel;
  cents: number;
  hz: number;
  targetHz: number;
  holding: boolean;
  nearestCourse: CourseMatch | null;
}

export interface UiNoteStart {
  eventId: number;
  label: NoteLabel;
  cents: number;
  startS: number;
  pitch: number;
}

export interface UiDiagnostics {
  rawHz: number | null;
  computeUs: number;
  latencyMs: number | null;
  windowMs: number;
}

export interface UiFrame {
  t: number;
  state: UiState;
  status: ObservationStatus;
  levelDb: number;
  confidence: number;
  onset: boolean;
  note: UiNote | null;
  started: UiNoteStart | null;
  diagnostics: UiDiagnostics;
}

export interface EngineErrorPayload {
  code: string;
  detail?: string;
}

export type UiMessage =
  | ({ type: "frame" } & UiFrame)
  | { type: "error"; error: EngineErrorPayload; message: string };

export type SourceMode = "microphone" | "simulation";
export type SourceKind = "microphone" | "simulation";

export interface StreamInfo {
  source: SourceKind;
  deviceName: string;
  sampleRate: number;
  channels: number;
  window: number;
  hop: number;
}

export interface EngineStats {
  receivedSamples: number;
  droppedSamples: number;
  analysedSamples: number;
  bufferedSamples: number;
  bufferCapacity: number;
}

export interface AudioStatus {
  info: StreamInfo;
  stats: EngineStats;
  mode: SourceMode;
}

export interface InputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface CourseInfo {
  index: number;
  strings: number;
  label: NoteLabel;
  otherLabel: NoteLabel;
  soundingHz: number;
}

export interface InstrumentInfo {
  name: string;
  description: string | null;
  courses: CourseInfo[];
}

export type Language = "en" | "ar";
export type TuningChoice = "edo24" | "edo12";
export type VisualQuality = "full" | "reduced" | "off";

export interface Settings {
  version: number;
  language: Language;
  noteScript: Script;
  accidentalStyle: AccidentalStyle;
  arabicDigits: boolean;
  noteView: NoteView;
  referenceHz: number;
  transposition: Transposition;
  tuning: TuningChoice;
  inputDeviceId: string | null;
  sensitivity: { silenceThresholdDb: number; minConfidence: number };
  visualQuality: VisualQuality;
  showDiagnostics: boolean;
}

export interface CommandError {
  code: string;
  message: string;
}
