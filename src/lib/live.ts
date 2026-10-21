// Live frame store.
//
// Frames arrive ~90 times per second. Canvas renderers read `live.frame`
// directly inside their requestAnimationFrame loops; React components use
// `useLive(selector)` which only re-renders when the *selected* value
// changes, so a stable note does not cause any React work.

import { useEffect, useRef, useState } from "react";
import type { UiFrame, UiNoteStart } from "./types";

type Listener = (frame: UiFrame) => void;

const HISTORY_MAX = 24;

export class LiveStore {
  frame: UiFrame | null = null;
  /** Most recent note starts, newest last. */
  history: UiNoteStart[] = [];
  /** Onsets not yet consumed by the visualizer. */
  pendingOnsets = 0;
  /** Note starts not yet consumed by the visualizer. */
  pendingStarts: UiNoteStart[] = [];
  private listeners = new Set<Listener>();

  push(frame: UiFrame): void {
    this.frame = frame;
    if (frame.onset) this.pendingOnsets++;
    if (frame.started) {
      this.history.push(frame.started);
      if (this.history.length > HISTORY_MAX) this.history.shift();
      this.pendingStarts.push(frame.started);
      if (this.pendingStarts.length > 8) this.pendingStarts.shift();
    }
    for (const l of this.listeners) l(frame);
  }

  reset(): void {
    this.frame = null;
    this.history = [];
    this.pendingOnsets = 0;
    this.pendingStarts = [];
    for (const l of this.listeners) l(EMPTY_FRAME);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
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
  diagnostics: { rawHz: null, computeUs: 0, latencyMs: null, windowMs: 0 },
};

export const live = new LiveStore();

/**
 * Subscribe a component to a derived value of the live frame.
 * Re-renders only when `equal(prev, next)` is false, and at most
 * `maxHz` times per second (trailing update guaranteed).
 */
export function useLive<T>(
  selector: (f: UiFrame) => T,
  equal: (a: T, b: T) => boolean = Object.is,
  maxHz = 60,
  store: LiveStore = live,
): T {
  const sel = useRef(selector);
  sel.current = selector;
  const eq = useRef(equal);
  eq.current = equal;
  const [value, setValue] = useState<T>(() => selector(store.frame ?? EMPTY_FRAME));
  const current = useRef(value);

  useEffect(() => {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const minGap = 1000 / maxHz;
    const flush = () => {
      timer = null;
      last = performance.now();
      const next = sel.current(store.frame ?? EMPTY_FRAME);
      if (!eq.current(current.current, next)) {
        current.current = next;
        setValue(next);
      }
    };
    const unsubscribe = store.subscribe(() => {
      const now = performance.now();
      if (now - last >= minGap) flush();
      else if (timer === null) timer = setTimeout(flush, minGap - (now - last));
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [maxHz, store]);

  return value;
}

/** Shallow equality for flat objects. */
export function shallowEqual<T extends object | null>(a: T, b: T): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  return ka.every((k) => Object.is(ra[k], rb[k]));
}
