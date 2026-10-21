import { describe, expect, it } from "vitest";
import { EMPTY_FRAME, LiveStore, shallowEqual } from "./live";
import type { UiFrame } from "./types";

const start = (id: number) => ({
  eventId: id,
  label: {
    text: "Re4",
    name: "Re",
    accidental: "",
    octave: "4",
    degree: "re" as const,
    accidentalQuarterTones: 0,
    octaveNumber: 4,
  },
  cents: 0,
  startS: id,
  pitch: 62,
});

describe("LiveStore", () => {
  it("keeps the latest frame, counts onsets and bounds history", () => {
    const s = new LiveStore();
    const seen: number[] = [];
    s.subscribe((f) => seen.push(f.t));
    for (let i = 0; i < 30; i++) {
      const f: UiFrame = { ...EMPTY_FRAME, t: i, onset: i % 10 === 0, started: start(i) };
      s.push(f);
    }
    expect(s.frame?.t).toBe(29);
    expect(seen).toHaveLength(30);
    expect(s.pendingOnsets).toBe(3);
    expect(s.history).toHaveLength(24);
    expect(s.history[23].eventId).toBe(29);
    expect(s.pendingStarts.length).toBeLessThanOrEqual(8);
    s.reset();
    expect(s.frame).toBeNull();
    expect(s.history).toHaveLength(0);
  });
});

describe("shallowEqual", () => {
  it("compares flat objects", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual({ a: 1 }, null)).toBe(false);
  });
});
