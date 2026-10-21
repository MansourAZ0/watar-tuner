// Pure helpers for tuning display. No DOM, no React — unit tested.

/** Cents range shown by the meter on each side of the target. */
export const METER_RANGE_CENTS = 50;

/** Accuracy zones, in absolute cents. */
export const IN_TUNE_CENTS = 5;
export const CLOSE_CENTS = 15;

export type TuningZone = "inTune" | "close" | "off";

export function tuningZone(cents: number): TuningZone {
  const a = Math.abs(cents);
  if (a <= IN_TUNE_CENTS) return "inTune";
  if (a <= CLOSE_CENTS) return "close";
  return "off";
}

/** Clamp cents into the meter's range. */
export function clampCents(cents: number, range = METER_RANGE_CENTS): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.max(-range, Math.min(range, cents));
}

/**
 * Needle angle in radians for a semicircular meter: 0 at the top (in
 * tune), ±maxAngle at ±range cents.
 */
export function needleAngle(cents: number, maxAngle = (Math.PI * 5) / 12, range = METER_RANGE_CENTS): number {
  return (clampCents(cents, range) / range) * maxAngle;
}

/**
 * Critically damped spring towards a target: smooth, no overshoot, and
 * frame-rate independent. `omega` is the stiffness (rad/s); larger is
 * snappier. Returns the new [value, velocity].
 */
export function springStep(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  omega = 18,
): [number, number] {
  if (dt <= 0) return [value, velocity];
  // Exact solution of x'' = -2ωx' - ω²(x - target) over dt.
  const x0 = value - target;
  const exp = Math.exp(-omega * dt);
  const c = velocity + omega * x0;
  const x = (x0 + c * dt) * exp;
  const v = (velocity - omega * c * dt) * exp;
  return [target + x, v];
}

/** Hue (degrees) for a pitch: one turn per octave so every quarter-tone gets its own colour. */
export function pitchHue(pitch: number): number {
  const pc = ((pitch % 12) + 12) % 12;
  return (pc / 12) * 360;
}

/** Linear 0..1 intensity from a dBFS level. */
export function levelIntensity(levelDb: number, floorDb = -60, ceilDb = -6): number {
  if (!Number.isFinite(levelDb)) return 0;
  return Math.max(0, Math.min(1, (levelDb - floorDb) / (ceilDb - floorDb)));
}

/** Format a cents deviation with sign, e.g. "+3", "−12", "0". */
export function formatCents(cents: number): string {
  const r = Math.round(cents);
  if (r === 0) return "0";
  return r > 0 ? `+${r}` : `−${-r}`;
}

/** Format a frequency with sensible precision. */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return "–";
  return hz < 100 ? hz.toFixed(2) : hz.toFixed(1);
}

/** Direction of melodic movement between two pitches. */
export function direction(prev: number | null, next: number): -1 | 0 | 1 {
  if (prev === null) return 0;
  const d = next - prev;
  if (Math.abs(d) < 0.25) return 0;
  return d > 0 ? 1 : -1;
}
