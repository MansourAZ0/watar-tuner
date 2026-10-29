import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiagnosticsPanel } from "./features/diagnostics/DiagnosticsPanel";
import { SettingsView } from "./features/settings/SettingsView";
import { TunerView } from "./features/tuner/TunerView";
import { Visualizer } from "./features/visualizer/Visualizer";
import { api, asCommandError } from "./lib/api";
import { type StringKey, isRtl, t as translate } from "./lib/i18n";
import { live } from "./lib/live";
import type {
  CommandError,
  InstrumentInfo,
  NoteView,
  Settings,
  SourceMode,
  StreamInfo,
  Transposition,
  UiMessage,
} from "./lib/types";

type Tab = "tuner" | "settings";

type Session =
  | { status: "idle" }
  | { status: "starting"; mode: SourceMode }
  | { status: "running"; mode: SourceMode; info: StreamInfo }
  | { status: "error"; error: CommandError };

const ERROR_KEYS: Record<string, StringKey> = {
  permissionDenied: "errPermissionDenied",
  startTimeout: "errStartTimeout",
  noInputDevice: "errNoInputDevice",
  deviceNotFound: "errDeviceNotFound",
};

const UNIT_KEYS: Record<Transposition["unit"], StringKey> = {
  semitone: "unitSemitone",
  wholeTone: "unitWholeTone",
  quarterTone: "unitQuarterTone",
  cent: "unitCent",
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [instrument, setInstrument] = useState<InstrumentInfo | null>(null);
  const [tab, setTab] = useState<Tab>("tuner");
  const [session, setSession] = useState<Session>({ status: "idle" });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setNotice(asCommandError(e).message));
    api.takeSettingsWarning().then((w) => w && setNotice(w)).catch(() => {});
    api.instrumentInfo().then(setInstrument).catch(() => {});
  }, []);

  const lang = settings?.language ?? "en";
  const t = useCallback((k: StringKey) => translate(lang, k), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    document.title = `${translate(lang, "appName")} — ${translate(lang, "appTagline")}`;
  }, [lang]);

  const onMessage = useCallback((m: UiMessage) => {
    if (m.type === "frame") {
      live.push(m);
    } else {
      setSession({ status: "error", error: { code: m.error.code, message: m.message } });
    }
  }, []);

  const start = useCallback(async (mode: SourceMode) => {
    live.reset();
    setSession({ status: "starting", mode });
    try {
      const info = await api.startAudio(mode, onMessage);
      setSession({ status: "running", mode, info });
    } catch (e) {
      const error = asCommandError(e);
      // A later start or stop replaced this one; that call owns the session.
      if (error.code === "superseded") return;
      setSession({ status: "error", error });
    }
  }, [onMessage]);

  const autostarted = useRef(false);
  useEffect(() => {
    if (autostarted.current) return;
    autostarted.current = true;
    api.autostartMode().then((mode) => mode && start(mode)).catch(() => {});
  }, [start]);

  const stop = async () => {
    await api.stopAudio().catch(() => {});
    live.reset();
    setSession({ status: "idle" });
  };

  const updateSettings = (next: Settings) => {
    setSettings(next);
    setSaveStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await api.updateSettings(next);
        setSettings(saved);
        setSaveStatus("saved");
        setInstrument(await api.instrumentInfo());
      } catch (e) {
        setSaveStatus("error");
        setNotice(asCommandError(e).message);
      }
    }, 250);
  };

  const transpositionText = useMemo(() => {
    if (!settings) return "";
    const { amount, unit } = settings.transposition;
    if (amount === 0) return t("transNormal");
    const sign = amount < 0 ? "−" : "+";
    return `${sign}${Math.abs(amount)} ${t(UNIT_KEYS[unit])}`;
  }, [settings, t]);

  if (!settings) {
    return <div className="loading">…</div>;
  }

  const running = session.status === "running";
  const simulated =
    (session.status === "running" || session.status === "starting") && session.mode === "simulation";
  const errorText =
    session.status === "error"
      ? ERROR_KEYS[session.error.code]
        ? t(ERROR_KEYS[session.error.code])
        : `${t("errGeneric")}: ${session.error.message}`
      : null;

  return (
    <div className={`app ${isRtl(lang) ? "rtl" : ""}`}>
      <Visualizer quality={settings.visualQuality} />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            وتر
          </span>
          <span className="brand-text">
            <strong>{t("appName")}</strong>
            <small>{t("appTagline")}</small>
          </span>
        </div>
        <nav className="tabs">
          {(["tuner", "settings"] as const).map((k) => (
            <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
              {k === "tuner" ? t("navTuner") : t("navSettings")}
            </button>
          ))}
        </nav>
        <div className="session">
          <span className={`status-dot ${running ? (simulated ? "sim" : "on") : "off"}`} />
          <span className="status-text">
            {running
              ? simulated
                ? t("simulationShort")
                : `${t("listening")} · ${session.info.deviceName}`
              : session.status === "starting"
                ? t("starting")
                : t("stopped")}
          </span>
          {running || session.status === "starting" ? (
            <button className="primary" onClick={stop}>
              {t("stopListening")}
            </button>
          ) : (
            <button className="primary" onClick={() => start("microphone")}>
              {t("startListening")}
            </button>
          )}
        </div>
      </header>

      {simulated && <div className="sim-banner" role="status">{t("simulationBanner")}</div>}
      {notice && (
        <div className="notice" role="alert">
          {notice}
          <button className="ghost" onClick={() => setNotice(null)} aria-label="dismiss">
            ×
          </button>
        </div>
      )}

      <main className={`content ${settings.showDiagnostics ? "with-diagnostics" : ""}`}>
        <div className="primary-pane">
          {tab === "tuner" ? (
            <>
              {session.status !== "running" && (
                <div className="intro">
                  {session.status === "starting" ? (
                    <>
                      <h2>{t("starting")}</h2>
                      <p>{t("startingHint")}</p>
                    </>
                  ) : (
                    <>
                      <h2>{t("idleTitle")}</h2>
                      <p>{t("idleBody")}</p>
                      {errorText && <p className="error-text">{errorText}</p>}
                      <div className="intro-actions">
                        <button className="primary large" onClick={() => start("microphone")}>
                          {t("startListening")}
                        </button>
                        <button className="ghost" onClick={() => start("simulation")}>
                          {t("startDemo")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <TunerView
                t={t}
                settings={settings}
                instrument={instrument}
                running={running}
                transpositionText={transpositionText}
                onViewChange={(v: NoteView) => updateSettings({ ...settings, noteView: v })}
              />
            </>
          ) : (
            <SettingsView t={t} settings={settings} onChange={updateSettings} status={saveStatus} />
          )}
        </div>
        {settings.showDiagnostics && <DiagnosticsPanel t={t} />}
      </main>
    </div>
  );
}
