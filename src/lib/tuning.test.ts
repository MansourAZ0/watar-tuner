import { describe, expect, it } from "vitest";
import {
  clampCents,
  direction,
  formatCents,
  levelIntensity,
  needleAngle,
  pitchHue,
  springStep,
  tuningZone,
} from "./tuning";

describe("tuning zones", () => {
  it("classifies deviations", () => {
    expect(tuningZone(0)).toBe("inTune");
    expect(tuningZone(-5)).toBe("inTune");
    expect(tuningZone(9)).toBe("close");
    expect(tuningZone(-30)).toBe("off");
  });
});

describe("meter geometry", () => {
  it("maps cents to a symmetric needle angle and clamps", () => {
    expect(needleAngle(0)).toBe(0);
    expect(needleAngle(25)).toBeCloseTo(-needleAngle(-25));
    expect(needleAngle(500)).toBe(needleAngle(50));
    expect(clampCents(Number.NaN)).toBe(0);
  });
});

describe("springStep", () => {
  it("converges to the target without overshoot", () => {
    let x = 0;
    let v = 0;
    let max = 0;
    for (let i = 0; i < 120; i++) {
      [x, v] = springStep(x, v, 10, 1 / 60);
      max = Math.max(max, x);
    }
    expect(x).toBeCloseTo(10, 3);
    expect(max).toBeLessThanOrEqual(10 + 1e-9);
  });

  it("is frame-rate independent", () => {
    let a: [number, number] = [0, 0];
    for (let i = 0; i < 60; i++) a = springStep(a[0], a[1], 1, 1 / 60);
    let b: [number, number] = [0, 0];
    for (let i = 0; i < 144; i++) b = springStep(b[0], b[1], 1, 1 / 144);
    expect(a[0]).toBeCloseTo(b[0], 6);
  });

  it("ignores non-positive dt", () => {
    expect(springStep(3, 1, 0, 0)).toEqual([3, 1]);
  });
});

describe("formatting and mapping", () => {
  it("formats cents with a true minus sign", () => {
    expect(formatCents(0.4)).toBe("0");
    expect(formatCents(3.6)).toBe("+4");
    expect(formatCents(-12.2)).toBe("−12");
  });

  it("gives quarter-tones distinct hues within an octave", () => {
    expect(pitchHue(60)).toBe(0);
    expect(pitchHue(72)).toBe(0);
    expect(pitchHue(63.5)).not.toBe(pitchHue(64));
    expect(pitchHue(-1)).toBeCloseTo(330);
  });

  it("maps level to 0..1", () => {
    expect(levelIntensity(-100)).toBe(0);
    expect(levelIntensity(0)).toBe(1);
    expect(levelIntensity(-33)).toBeCloseTo(0.5);
  });

  it("detects melodic direction with a dead zone", () => {
    expect(direction(null, 60)).toBe(0);
    expect(direction(60, 60.1)).toBe(0);
    expect(direction(60, 60.5)).toBe(1);
    expect(direction(62, 60)).toBe(-1);
  });
});
