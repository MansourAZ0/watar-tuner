import { describe, expect, it } from "vitest";
import { strings } from "./i18n";

describe("i18n", () => {
  it("has every key translated in Arabic", () => {
    for (const key of Object.keys(strings.en)) {
      const value = strings.ar[key as keyof typeof strings.ar];
      expect(value, key).toBeTruthy();
    }
  });

  it("never uses Western letter note names as labels", () => {
    // Note names come from Rust; interface strings must not introduce
    // C/D/E/F/G/A/B note labels such as "A4" or "C#".
    const pattern = /\b[A-G][#b♭♯]?[0-9]\b/;
    for (const lang of ["en", "ar"] as const) {
      for (const [key, value] of Object.entries(strings[lang])) {
        expect(pattern.test(value), `${lang}.${key}: ${value}`).toBe(false);
      }
    }
  });
});
