import type { AccidentalStyle, NoteLabel } from "../lib/types";
import { AccidentalGlyph } from "./AccidentalGlyph";

const ARABIC = /[؀-ۿ]/;

/**
 * Renders a solfège label from Rust. With symbol style the accidental is
 * drawn as an SVG glyph; with word style the words from Rust are shown.
 */
export function NoteName({
  label,
  style,
  className = "",
}: {
  label: NoteLabel;
  style: AccidentalStyle;
  className?: string;
}) {
  const rtl = ARABIC.test(label.name);
  const q = label.accidentalQuarterTones;
  return (
    <span className={`note-name ${className}`} dir={rtl ? "rtl" : "ltr"} aria-label={label.text}>
      <span className="note-degree">{label.name}</span>
      {q !== 0 &&
        (style === "symbol" ? (
          <span className="note-accidental">
            <AccidentalGlyph steps={q} />
          </span>
        ) : (
          <span className="note-accidental-words">{label.accidental}</span>
        ))}
      {label.octave && <span className="note-octave">{label.octave}</span>}
    </span>
  );
}
