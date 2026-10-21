import { CentsMeter, NoteName, formatCents, formatHz, shallowEqual, tuningZone } from "@naghma/ui";
import type { StringKey } from "../../lib/i18n";
import { heldCents, useFrame } from "../../lib/live";
import type { InstrumentInfo, NoteLabel, NoteView, Settings, UiFrame } from "../../lib/types";
import { NoteHistory } from "./NoteHistory";

type T = (k: StringKey) => string;

interface HeroState {
  state: UiFrame["state"];
  label: NoteLabel | null;
  other: NoteLabel | null;
  holding: boolean;
}

const heroEqual = (a: HeroState, b: HeroState) =>
  a.state === b.state && a.holding === b.holding && a.label?.text === b.label?.text && a.other?.text === b.other?.text;

function useHero(): HeroState {
  return useFrame<HeroState>(
    (f) => ({
      state: f.state,
      label: f.note?.label ?? null,
      other: f.note?.otherLabel ?? null,
      holding: f.note?.holding ?? false,
    }),
    heroEqual,
  );
}

interface Readout {
  cents: number | null;
  hz: number | null;
  targetHz: number | null;
  confidence: number;
  course: number | null;
  courseCents: number | null;
}

function useReadout(): Readout {
  // Numbers update at 12 Hz: fast enough to follow, slow enough to read.
  return useFrame<Readout>(
    (f) => ({
      cents: f.note ? Math.round(f.note.cents) : null,
      hz: f.note ? Math.round(f.note.hz * 10) / 10 : null,
      targetHz: f.note ? Math.round(f.note.targetHz * 10) / 10 : null,
      confidence: Math.round(f.confidence * 20) / 20,
      course: f.note?.nearestCourse?.index ?? null,
      courseCents: f.note?.nearestCourse ? Math.round(f.note.nearestCourse.cents) : null,
    }),
    shallowEqual,
    12,
  );
}

export function TunerView({
  t,
  settings,
  instrument,
  running,
  onViewChange,
  transpositionText,
}: {
  t: T;
  settings: Settings;
  instrument: InstrumentInfo | null;
  running: boolean;
  onViewChange: (v: NoteView) => void;
  transpositionText: string;
}) {
  const hero = useHero();
  const readout = useReadout();
  const zone = readout.cents === null ? null : tuningZone(readout.cents);
  const transposed = settings.transposition.amount !== 0;
  const showOther = transposed && hero.other && hero.label && hero.other.text !== hero.label.text;

  return (
    <div className="tuner">
      <div className="tuner-badges">
        <span className="badge" title={t("transposition")}>
          {t("transposition")}: <strong className="ltr">{transpositionText}</strong>
        </span>
        <span className="badge">
          {t("tuning")}: <strong className="ltr">{settings.tuning === "edo24" ? "24-EDO" : "12-EDO"}</strong>
        </span>
        <span className="badge">
          <span className="ltr">
            La4 = <strong>{settings.referenceHz} Hz</strong>
          </span>
        </span>
        <div className="segmented" role="group" aria-label={t("defaultView")}>
          {(["player", "concert"] as const).map((v) => (
            <button
              key={v}
              className={settings.noteView === v ? "active" : ""}
              onClick={() => onViewChange(v)}
            >
              {v === "player" ? t("playerView") : t("concertView")}
            </button>
          ))}
        </div>
      </div>

      <section className={`hero zone-${zone ?? "none"}`} aria-live="polite">
        {hero.label ? (
          <>
            <NoteName label={hero.label} style={settings.accidentalStyle} className="hero-note" />
            <div className="hero-sub">
              {showOther && hero.other && (
                <span>
                  {settings.noteView === "player" ? t("sounding") : t("playerNote")}:{" "}
                  <NoteName label={hero.other} style={settings.accidentalStyle} className="inline-note" />
                </span>
              )}
              {hero.holding && <span className="muted"> · {t("holding")}</span>}
            </div>
          </>
        ) : (
          <div className="hero-placeholder">
            {!running ? "—" : hero.state === "silent" ? t("playANote") : t("notSure")}
          </div>
        )}
      </section>

      <div className="meter-wrap">
        <CentsMeter read={heldCents} flatLabel={t("flat")} sharpLabel={t("sharp")} />
        <div className={`cents-readout zone-${zone ?? "none"}`}>
          <span className="ltr">{readout.cents === null ? "–" : formatCents(readout.cents)}</span>
          <span className="unit">{t("cents")}</span>
          {zone === "inTune" && <span className="in-tune-pill">{t("inTune")}</span>}
        </div>
      </div>

      <div className="readouts">
        <div>
          <span className="readout-label">{t("frequency")}</span>
          <span className="readout-value ltr">{readout.hz === null ? "–" : `${formatHz(readout.hz)} Hz`}</span>
        </div>
        <div>
          <span className="readout-label">{t("target")}</span>
          <span className="readout-value ltr">
            {readout.targetHz === null ? "–" : `${formatHz(readout.targetHz)} Hz`}
          </span>
        </div>
        <div>
          <span className="readout-label">{t("confidence")}</span>
          <span className="confidence-bar">
            <span style={{ width: `${readout.confidence * 100}%` }} />
          </span>
        </div>
      </div>

      {instrument && (
        <section className="courses" aria-label={t("openCourses")}>
          <h3>{t("openCourses")}</h3>
          <div className="course-list">
            {instrument.courses.map((c) => {
              const active = readout.course === c.index;
              return (
                <div key={c.index} className={`course ${active ? "active" : ""}`}>
                  <NoteName label={c.label} style={settings.accidentalStyle} className="course-note" />
                  <span className="course-hz ltr">{formatHz(c.soundingHz)} Hz</span>
                  <span className="course-strings" aria-hidden="true">
                    {"│".repeat(c.strings)}
                  </span>
                  {active && readout.courseCents !== null && (
                    <span className={`course-cents ltr zone-${tuningZone(readout.courseCents)}`}>
                      {formatCents(readout.courseCents)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <NoteHistory title={t("recentNotes")} accidentalStyle={settings.accidentalStyle} />
    </div>
  );
}
