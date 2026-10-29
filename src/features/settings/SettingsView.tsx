import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { CoursesEditor } from "./CoursesEditor";
import type { StringKey } from "../../lib/i18n";
import type { InputDevice, IntervalUnit, Settings } from "../../lib/types";

type T = (k: StringKey) => string;

const PRESETS = [0, -1, -2] as const;
const UNITS: { unit: IntervalUnit; key: StringKey }[] = [
  { unit: "semitone", key: "unitSemitone" },
  { unit: "wholeTone", key: "unitWholeTone" },
  { unit: "quarterTone", key: "unitQuarterTone" },
  { unit: "cent", key: "unitCent" },
];

function Radio<V extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsView({
  t,
  settings,
  onChange,
  status,
}: {
  t: T;
  settings: Settings;
  onChange: (s: Settings) => void;
  status: "idle" | "saved" | "error";
}) {
  const [devices, setDevices] = useState<InputDevice[] | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const tr = settings.transposition;
  const isPreset = tr.unit === "semitone" && (PRESETS as readonly number[]).includes(tr.amount);
  const [custom, setCustom] = useState(!isPreset);

  const loadDevices = () => {
    setDeviceError(null);
    api
      .listInputDevices()
      .then(setDevices)
      .catch((e) => setDeviceError(String(e?.message ?? e)));
  };
  useEffect(loadDevices, []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });

  return (
    <div className="settings">
      <h2>
        {t("settingsTitle")}
        <span className={`save-status ${status}`}>{status === "saved" ? t("saved") : status === "error" ? t("saveError") : ""}</span>
      </h2>

      <section>
        <h3>{t("secInstrument")}</h3>
        <label className="field">
          <span>{t("transposition")}</span>
          <div className="segmented">
            {PRESETS.map((p) => (
              <button
                key={p}
                className={!custom && isPreset && tr.amount === p ? "active" : ""}
                onClick={() => {
                  setCustom(false);
                  set("transposition", { amount: p, unit: "semitone" });
                }}
              >
                {p === 0 ? t("transNormal") : `${p}`.replace("-", "−")}
              </button>
            ))}
            <button className={custom || !isPreset ? "active" : ""} onClick={() => setCustom(true)}>
              {t("transCustom")}
            </button>
          </div>
        </label>
        {(custom || !isPreset) && (
          <div className="field-row">
            <label className="field">
              <span>{t("transAmount")}</span>
              <input
                type="number"
                step={tr.unit === "cent" ? 1 : 0.5}
                value={tr.amount}
                onChange={(e) => {
                  const amount = Number(e.target.value);
                  if (Number.isFinite(amount)) set("transposition", { ...tr, amount });
                }}
              />
            </label>
            <label className="field">
              <span>{t("transUnit")}</span>
              <select
                value={tr.unit}
                onChange={(e) => set("transposition", { ...tr, unit: e.target.value as IntervalUnit })}
              >
                {UNITS.map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {t(u.key)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <p className="help">{t("transHelp")}</p>

        <label className="field">
          <span>{t("reference")} (La4)</span>
          <input
            type="number"
            min={380}
            max={480}
            step={0.5}
            value={settings.referenceHz}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 380 && v <= 480) set("referenceHz", v);
            }}
          />
        </label>
        <p className="help">{t("referenceHelp")}</p>

        <CoursesEditor
          t={t}
          courses={settings.courses}
          script={settings.noteScript}
          onChange={(courses) => set("courses", courses)}
        />

        <label className="field">
          <span>{t("tuningGrid")}</span>
          <Radio
            name={t("tuningGrid")}
            value={settings.tuning}
            options={[
              { value: "edo24", label: t("edo24") },
              { value: "edo12", label: t("edo12") },
            ]}
            onChange={(v) => set("tuning", v)}
          />
        </label>
      </section>

      <section>
        <h3>{t("secNotation")}</h3>
        <label className="field">
          <span>{t("noteScript")}</span>
          <Radio
            name={t("noteScript")}
            value={settings.noteScript}
            options={[
              { value: "latin", label: t("scriptLatin") },
              { value: "arabic", label: t("scriptArabic") },
            ]}
            onChange={(v) => set("noteScript", v)}
          />
        </label>
        <label className="field">
          <span>{t("accidentals")}</span>
          <Radio
            name={t("accidentals")}
            value={settings.accidentalStyle}
            options={[
              { value: "symbol", label: t("accSymbols") },
              { value: "words", label: t("accWords") },
            ]}
            onChange={(v) => set("accidentalStyle", v)}
          />
        </label>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={settings.arabicDigits}
            onChange={(e) => set("arabicDigits", e.target.checked)}
          />
          <span>{t("arabicDigits")}</span>
        </label>
        <label className="field">
          <span>{t("defaultView")}</span>
          <Radio
            name={t("defaultView")}
            value={settings.noteView}
            options={[
              { value: "player", label: t("playerView") },
              { value: "concert", label: t("concertView") },
            ]}
            onChange={(v) => set("noteView", v)}
          />
        </label>
      </section>

      <section>
        <h3>{t("secAudio")}</h3>
        <label className="field">
          <span>{t("microphone")}</span>
          <div className="field-row">
            <select
              value={settings.inputDeviceId ?? ""}
              onChange={(e) => set("inputDeviceId", e.target.value || null)}
            >
              <option value="">{t("systemDefault")}</option>
              {devices?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isDefault ? " ★" : ""}
                </option>
              ))}
            </select>
            <button className="ghost" onClick={loadDevices}>
              {t("refreshDevices")}
            </button>
          </div>
          {deviceError && <span className="error-text">{deviceError}</span>}
        </label>
        <label className="field">
          <span>
            {t("silenceThreshold")}: {settings.sensitivity.silenceThresholdDb} dBFS
          </span>
          <input
            type="range"
            min={-80}
            max={-30}
            step={1}
            value={settings.sensitivity.silenceThresholdDb}
            onChange={(e) =>
              set("sensitivity", { ...settings.sensitivity, silenceThresholdDb: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>
            {t("minConfidence")}: {settings.sensitivity.minConfidence.toFixed(2)}
          </span>
          <input
            type="range"
            min={0.5}
            max={0.98}
            step={0.01}
            value={settings.sensitivity.minConfidence}
            onChange={(e) =>
              set("sensitivity", { ...settings.sensitivity, minConfidence: Number(e.target.value) })
            }
          />
        </label>
        <p className="help">{t("sensitivityHelp")}</p>
      </section>

      <section>
        <h3>{t("secDisplay")}</h3>
        <label className="field">
          <span>{t("visualQuality")}</span>
          <Radio
            name={t("visualQuality")}
            value={settings.visualQuality}
            options={[
              { value: "full", label: t("qualityFull") },
              { value: "reduced", label: t("qualityReduced") },
              { value: "off", label: t("qualityOff") },
            ]}
            onChange={(v) => set("visualQuality", v)}
          />
        </label>
        <label className="field checkbox">
          <input
            type="checkbox"
            checked={settings.showDiagnostics}
            onChange={(e) => set("showDiagnostics", e.target.checked)}
          />
          <span>{t("showDiagnostics")}</span>
        </label>
      </section>

      <section>
        <h3>{t("secLanguage")}</h3>
        <label className="field">
          <span>{t("language")}</span>
          <Radio
            name={t("language")}
            value={settings.language}
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
            ]}
            onChange={(v) => set("language", v)}
          />
        </label>
      </section>
    </div>
  );
}
