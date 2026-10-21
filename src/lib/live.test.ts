import { describe, expect, it } from "vitest";
import { EMPTY_FRAME, WatarStore } from "./live";
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

describe("WatarStore", () => {
  it("counts onsets and keeps bounded note history", () => {
    const s = new WatarStore();
    for (let i = 0; i < 30; i++) {
      const f: UiFrame = { ...EMPTY_FRAME, t: i, onset: i % 10 === 0, started: start(i) };
      s.push(f);
    }
    expect(s.frame?.t).toBe(29);
    expect(s.pendingOnsets).toBe(3);
    expect(s.history).toHaveLength(24);
    expect(s.history[23].eventId).toBe(29);
    expect(s.pendingStarts.length).toBeLessThanOrEqual(8);
    s.reset();
    expect(s.frame).toBeNull();
    expect(s.history).toHaveLength(0);
    expect(s.pendingOnsets).toBe(0);
  });
});
