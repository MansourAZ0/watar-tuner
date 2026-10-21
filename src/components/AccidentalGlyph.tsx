// Accidental glyphs drawn as SVG from the quarter-tone step count, so they
// render identically everywhere without depending on a music font.
//
// Conventions (Arabic notation):
//   −1 half-flat:  flat with a stroke through the stem
//   +1 half-sharp: sharp with a single vertical
//   −3 / +3:       flat + half-flat / sharp + half-sharp
//   ±4:            double flat / double sharp

import type { ReactNode } from "react";

const STROKE = 7;

function Flat({ x = 0, slashed = false }: { x?: number; slashed?: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <line x1="10" y1="4" x2="10" y2="94" strokeWidth={STROKE} strokeLinecap="round" />
      <path d="M10 92 C 44 72, 42 44, 10 60" fill="none" strokeWidth={STROKE} strokeLinecap="round" />
      {slashed && <line x1="0" y1="36" x2="22" y2="22" strokeWidth={STROKE - 1} strokeLinecap="round" />}
    </g>
  );
}

function Sharp({ x = 0, half = false }: { x?: number; half?: boolean }) {
  const verticals = half ? [20] : [13, 29];
  return (
    <g transform={`translate(${x} 0)`}>
      {verticals.map((vx, i) => (
        <line key={vx} x1={vx} y1={i === 0 ? 12 : 4} x2={vx} y2={i === 0 ? 96 : 88} strokeWidth={STROKE - 2} strokeLinecap="round" />
      ))}
      <line x1="3" y1="40" x2="39" y2="30" strokeWidth={STROKE + 2} strokeLinecap="round" />
      <line x1="3" y1="70" x2="39" y2="60" strokeWidth={STROKE + 2} strokeLinecap="round" />
    </g>
  );
}

function DoubleSharp() {
  return (
    <g>
      <line x1="6" y1="34" x2="36" y2="64" strokeWidth={STROKE + 1} strokeLinecap="round" />
      <line x1="36" y1="34" x2="6" y2="64" strokeWidth={STROKE + 1} strokeLinecap="round" />
    </g>
  );
}

const WIDTH: Record<number, number> = { [-4]: 80, [-3]: 80, [-2]: 42, [-1]: 42, 1: 42, 2: 42, 3: 84, 4: 42 };

export function AccidentalGlyph({ steps, title }: { steps: number; title?: string }) {
  if (steps === 0) return null;
  const w = WIDTH[steps] ?? 42;
  let body: ReactNode;
  switch (steps) {
    case -4:
      body = (<><Flat /><Flat x={38} /></>);
      break;
    case -3:
      body = (<><Flat /><Flat x={38} slashed /></>);
      break;
    case -2:
      body = <Flat />;
      break;
    case -1:
      body = <Flat slashed />;
      break;
    case 1:
      body = <Sharp half />;
      break;
    case 2:
      body = <Sharp />;
      break;
    case 3:
      body = (<><Sharp /><Sharp x={42} half /></>);
      break;
    case 4:
      body = <DoubleSharp />;
      break;
    default:
      return null;
  }
  return (
    <svg
      className="accidental-glyph"
      viewBox={`0 0 ${w} 100`}
      style={{ width: `${(w / 100) * 1}em`, height: "1em" }}
      stroke="currentColor"
      role="img"
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
