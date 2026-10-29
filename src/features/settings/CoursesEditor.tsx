import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  ACCIDENTALS,
  MAX_COURSES,
  OCTAVES,
  degreeName,
  formatOpen,
  nextCourse,
  parseOpen,
  type OpenNote,
} from "../../lib/courses";
import type { StringKey } from "../../lib/i18n";
import type { Course, Script } from "../../lib/types";

const ACCIDENTAL_KEYS: Record<number, StringKey> = {
  [-2]: "accFlat",
  [-1]: "accHalfFlat",
  0: "accNatural",
  1: "accHalfSharp",
  2: "accSharp",
};

/** Edits the open courses; an empty list means the example tuning. */
export function CoursesEditor({
  t,
  courses,
  script,
  onChange,
}: {
  t: (k: StringKey) => string;
  courses: Course[];
  script: Script;
  onChange: (courses: Course[]) => void;
}) {
  const [example, setExample] = useState<Course[]>([]);
  useEffect(() => {
    api.exampleCourses().then(setExample).catch(() => {});
  }, []);
  const custom = courses.length > 0;
  const shown = custom ? courses : example;

  const update = (i: number, change: Partial<Course>) =>
    onChange(shown.map((c, k) => (k === i ? { ...c, ...change } : c)));
  const setNote = (i: number, note: OpenNote) => update(i, { open: formatOpen(note) });

  return (
    <div className="courses">
      <div className="field">
        <span>
          {t("courses")} · {custom ? t("coursesCustom") : t("coursesExample")}
        </span>
      </div>
      <ol className="course-list">
        {shown.map((c, i) => {
          const note = parseOpen(c.open) ?? { degree: 0, accidental: 0, octave: 3 };
          return (
            <li key={i} className="course-row">
              <span className="course-index" aria-hidden="true">
                {i + 1}
              </span>
              <select
                aria-label={`${t("courseNumber")} ${i + 1}`}
                value={note.degree}
                onChange={(e) => setNote(i, { ...note, degree: Number(e.target.value) })}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {degreeName(d, script)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("accidentals")}
                value={note.accidental}
                onChange={(e) => setNote(i, { ...note, accidental: Number(e.target.value) })}
              >
                {ACCIDENTALS.map((a) => (
                  <option key={a} value={a}>
                    {t(ACCIDENTAL_KEYS[a])}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("courseOctave")}
                value={note.octave}
                onChange={(e) => setNote(i, { ...note, octave: Number(e.target.value) })}
              >
                {OCTAVES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <label className="course-small">
                <span>{t("courseStrings")}</span>
                <select value={c.strings} onChange={(e) => update(i, { strings: Number(e.target.value) })}>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="course-small">
                <span>{t("courseCents")}</span>
                <input
                  type="number"
                  min={-50}
                  max={50}
                  step={1}
                  value={c.adjustmentCents}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && Math.abs(v) <= 50) update(i, { adjustmentCents: v });
                  }}
                />
              </label>
              <button
                className="course-remove"
                disabled={shown.length <= 1}
                onClick={() => onChange(shown.filter((_, k) => k !== i))}
              >
                {t("courseRemove")}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="field-row">
        <button disabled={shown.length >= MAX_COURSES} onClick={() => onChange([...shown, nextCourse(shown)])}>
          {t("courseAdd")}
        </button>
        {custom && <button onClick={() => onChange([])}>{t("coursesReset")}</button>}
      </div>
      <p className="help">{t("coursesHelp")}</p>
    </div>
  );
}
