// Open-course notes as Rust's naghma-core writes them ("Do2",
// "Mi half-flat 3"), split into the parts the course editor edits.

import type { Course, Script } from "./types";

export const MAX_COURSES = 8;

const LATIN = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"] as const;
const ARABIC = ["دو", "ري", "مي", "فا", "صول", "لا", "سي"] as const;

/** Accidentals offered, in quarter-tones, with Rust's English names. */
export const ACCIDENTALS = [-2, -1, 0, 1, 2] as const;
const ENGLISH: Record<number, string> = { [-2]: "flat", [-1]: "half-flat", 1: "half-sharp", 2: "sharp" };

/** Octaves offered (Do1 to Do6 are accepted by the backend). */
export const OCTAVES = [1, 2, 3, 4, 5] as const;

export interface OpenNote {
  /** 0 = Do … 6 = Si. */
  degree: number;
  /** Quarter-tones, −2 … +2. */
  accidental: number;
  octave: number;
}

const PATTERN = /^(Do|Re|Mi|Fa|Sol|La|Si)(?: (flat|half-flat|half-sharp|sharp) )?(-?\d+)$/;

export function parseOpen(text: string): OpenNote | null {
  const m = PATTERN.exec(text.trim());
  if (!m) return null;
  const accidental = m[2] ? Number(Object.keys(ENGLISH).find((k) => ENGLISH[Number(k)] === m[2])) : 0;
  return { degree: LATIN.indexOf(m[1] as (typeof LATIN)[number]), accidental, octave: Number(m[3]) };
}

export function formatOpen(n: OpenNote): string {
  const name = LATIN[n.degree];
  return n.accidental === 0 ? `${name}${n.octave}` : `${name} ${ENGLISH[n.accidental]} ${n.octave}`;
}

export function degreeName(degree: number, script: Script): string {
  return (script === "arabic" ? ARABIC : LATIN)[degree];
}

/** A new course a fourth above the highest one (or Do3). */
export function nextCourse(courses: Course[]): Course {
  const top = courses.length ? parseOpen(courses[courses.length - 1].open) : null;
  if (!top) return { open: "Do3", strings: 2, adjustmentCents: 0 };
  // A fourth up is three letter names up: Do→Fa, Re→Sol, …
  const degree = (top.degree + 3) % 7;
  const octave = top.octave + (top.degree + 3 >= 7 ? 1 : 0);
  // Fa→Si is an augmented fourth; the perfect fourth is Si flat.
  const accidental = top.degree === 3 ? top.accidental - 2 : top.accidental;
  return {
    open: formatOpen({ degree, accidental: Math.max(-2, accidental), octave: Math.min(octave, 5) }),
    strings: 2,
    adjustmentCents: 0,
  };
}
