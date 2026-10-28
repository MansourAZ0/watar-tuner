// Watar's live frame store: the shared LiveStore plus note history and
// event queues consumed by the visualizer.

import { LiveStore, useLive } from "@naghma/ui";
import type { UiFrame, UiNoteStart } from "./types";

const HISTORY_MAX = 24;

export class WatarStore extends LiveStore<UiFrame> {
  /** Most recent note starts, newest last. */
  history: UiNoteStart[] = [];
  /** Onsets not yet consumed by the visualizer. */
  pendingOnsets = 0;
  /** Note starts not yet consumed by the visualizer. */
  pendingStarts: UiNoteStart[] = [];

  protected onPush(frame: UiFrame): void {
    if (frame.onset) this.pendingOnsets++;
    if (frame.started) {
      this.history.push(frame.started);
      if (this.history.length > HISTORY_MAX) this.history.shift();
      this.pendingStarts.push(frame.started);
      if (this.pendingStarts.length > 8) this.pendingStarts.shift();
    }
    const revised = frame.revised;
    if (revised) {
      const replace = (list: UiNoteStart[]) => {
        const i = list.findIndex((s) => s.eventId === revised.eventId);
        if (i >= 0) list[i] = revised;
      };
      replace(this.history);
      replace(this.pendingStarts);
    }
  }

  protected onReset(): void {
    this.history = [];
    this.pendingOnsets = 0;
    this.pendingStarts = [];
  }
}

export const EMPTY_FRAME: UiFrame = {
  t: 0,
  state: "silent",
  status: "silence",
  levelDb: -120,
  confidence: 0,
  onset: false,
  note: null,
  started: null,
  revised: null,
  diagnostics: { rawHz: null, computeUs: 0, latencyMs: null, windowMs: 0 },
};

export const live = new WatarStore();

/** `useLive` bound to Watar's store, with an empty frame when idle. */
export function useFrame<T>(
  selector: (f: UiFrame) => T,
  equal?: (a: T, b: T) => boolean,
  maxHz?: number,
): T {
  return useLive(live, (f) => selector(f ?? EMPTY_FRAME), equal, maxHz);
}

/** Cents of the held note, for the meter; `null` when no note. */
export function heldCents(): number | null {
  const f = live.frame;
  return f?.state === "note" && f.note ? f.note.cents : null;
}
