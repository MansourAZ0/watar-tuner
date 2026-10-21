// Typed wrappers around the Tauri commands in src-tauri/src/lib.rs.

import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AudioStatus,
  CommandError,
  InputDevice,
  InstrumentInfo,
  Settings,
  SourceMode,
  StreamInfo,
  UiMessage,
} from "./types";

export const api = {
  autostartMode: () => invoke<SourceMode | null>("autostart_mode"),
  getSettings: () => invoke<Settings>("get_settings"),
  takeSettingsWarning: () => invoke<string | null>("take_settings_warning"),
  updateSettings: (settings: Settings) => invoke<Settings>("update_settings", { settings }),
  listInputDevices: () => invoke<InputDevice[]>("list_input_devices"),
  audioStatus: () => invoke<AudioStatus | null>("audio_status"),
  instrumentInfo: () => invoke<InstrumentInfo>("instrument_info"),
  stopAudio: () => invoke<void>("stop_audio"),
  startAudio: (mode: SourceMode, onMessage: (m: UiMessage) => void) => {
    const channel = new Channel<UiMessage>();
    channel.onmessage = onMessage;
    return invoke<StreamInfo>("start_audio", { mode, onMessage: channel });
  },
};

/** Normalise anything thrown by `invoke` into a CommandError. */
export function asCommandError(e: unknown): CommandError {
  if (e && typeof e === "object" && "code" in e && "message" in e) {
    return e as CommandError;
  }
  return { code: "unknown", message: String(e) };
}
