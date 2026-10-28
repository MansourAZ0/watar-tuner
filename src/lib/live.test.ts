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

  it("renames a recent start when its pluck settles", () => {
    const s = new WatarStore();
    s.push({ ...EMPTY_FRAME, t: 0, started: start(1) });
    s.push({ ...EMPTY_FRAME, t: 1, started: start(2) });
    const renamed = { ...start(1), label: { ...start(1).label, text: "Mi4" }, pitch: 64 };
    s.push({ ...EMPTY_FRAME, t: 2, revised: renamed });
    expect(s.history.map((h) => h.label.text)).toEqual(["Mi4", "Re4"]);
    expect(s.history[0].pitch).toBe(64);
    expect(s.history).toHaveLength(2);
    expect(s.pendingStarts[0].label.text).toBe("Mi4");
    // An unknown id changes nothing.
    s.push({ ...EMPTY_FRAME, t: 3, revised: start(99) });
    expect(s.history).toHaveLength(2);
  });
});
