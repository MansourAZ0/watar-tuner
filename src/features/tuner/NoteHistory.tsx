import { NoteName, direction } from "@naghma/ui";
import { live, useFrame } from "../../lib/live";
import type { AccidentalStyle } from "../../lib/types";

const SHOWN = 12;

/** Trail of recently started notes with melodic direction. */
export function NoteHistory({ title, accidentalStyle }: { title: string; accidentalStyle: AccidentalStyle }) {
  // Re-render only when a new note starts.
  useFrame((f) => f.started?.eventId ?? null, (a, b) => b === null || a === b, 30);
  const items = live.history.slice(-SHOWN);
  if (items.length === 0) return null;
  return (
    <section className="history" aria-label={title}>
      <h3>{title}</h3>
      <ol className="history-list">
        {items.map((s, i) => {
          const prev = i > 0 ? items[i - 1].pitch : null;
          const d = direction(prev, s.pitch);
          return (
            <li key={s.eventId} className={`history-item dir-${d}`} style={{ opacity: 0.35 + (0.65 * (i + 1)) / items.length }}>
              <span className="history-arrow" aria-hidden="true">
                {d === 1 ? "↗" : d === -1 ? "↘" : "·"}
              </span>
              <NoteName label={s.label} style={accidentalStyle} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
