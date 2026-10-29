import { describe, expect, it } from "vitest";
import { degreeName, formatOpen, nextCourse, parseOpen } from "./courses";

describe("open-course notes", () => {
  it("round-trips the backend's spellings", () => {
    for (const text of ["Do2", "Mi half-flat 3", "Si flat 2", "Fa sharp 4", "Re half-sharp 3"]) {
      const n = parseOpen(text);
      expect(n, text).not.toBeNull();
      expect(formatOpen(n!)).toBe(text);
    }
    expect(parseOpen("Mi half-flat 3")).toEqual({ degree: 2, accidental: -1, octave: 3 });
    expect(parseOpen("C4")).toBeNull();
  });

  it("names degrees in the chosen script", () => {
    expect(degreeName(4, "latin")).toBe("Sol");
    expect(degreeName(4, "arabic")).toBe("صول");
  });

  it("suggests the next course a fourth higher", () => {
    const course = (open: string) => ({ open, strings: 2, adjustmentCents: 0 });
    expect(nextCourse([course("Re3")]).open).toBe("Sol3");
    expect(nextCourse([course("Sol3")]).open).toBe("Do4");
    expect(nextCourse([course("Fa2")]).open).toBe("Si flat 2");
    expect(nextCourse([]).open).toBe("Do3");
  });
});
