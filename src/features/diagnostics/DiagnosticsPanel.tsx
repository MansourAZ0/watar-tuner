import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { StringKey } from "../../lib/i18n";
import { shallowEqual, useLive } from "../../lib/live";
import type { AudioStatus } from "../../lib/types";

type T = (k: StringKey) => string;

/** Engineering diagnostics; hidden unless enabled in settings. */
export function DiagnosticsPanel({ t }: { t: T }) {
  const [status, setStatus] = useState<AudioStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .audioStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus(null));
    poll();
    const id = setInterval(poll, 500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const d = useLive(
    (f) => ({
      rawHz: f.diagnostics.rawHz,
      computeUs: f.diagnostics.computeUs,
      latencyMs: f.diagnostics.latencyMs,
      windowMs: f.diagnostics.windowMs,
      status: f.status,
      levelDb: f.levelDb,
      confidence: f.confidence,
    }),
    shallowEqual,
    8,
  );

  const rows: [StringKey, string][] = [
    [
      "diagSource",
      status ? (status.info.source === "simulation" ? "SIMULATION" : "Microphone") : "–",
    ],
    ["diagDevice", status?.info.deviceName ?? "–"],
    [
      "diagSampleRate",
      status ? `${status.info.sampleRate} Hz · ${status.info.channels} ch → mono` : "–",
    ],
    ["diagWindow", status ? `${status.info.window} / ${status.info.hop}` : "–"],
    ["diagWindowLatency", d.windowMs ? `${d.windowMs.toFixed(1)} ms` : "–"],
    ["diagCompute", `${d.computeUs.toFixed(0)} µs`],
    ["diagLatency", d.latencyMs === null ? "–" : `${d.latencyMs.toFixed(1)} ms`],
    [
      "diagBuffer",
      status ? `${status.stats.bufferedSamples} / ${status.stats.bufferCapacity}` : "–",
    ],
    ["diagDropped", status ? String(status.stats.droppedSamples) : "–"],
    ["diagStatus", d.status],
    ["diagRawHz", d.rawHz === null ? "–" : `${d.rawHz.toFixed(2)} Hz`],
    ["confidence", d.confidence.toFixed(3)],
    ["diagLevel", `${d.levelDb.toFixed(1)} dBFS`],
  ];

  return (
    <aside className="diagnostics" aria-label={t("navDiagnostics")}>
      <h3>{t("navDiagnostics")}</h3>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd className="ltr">{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
