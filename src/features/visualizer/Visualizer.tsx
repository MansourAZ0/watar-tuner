import { useEffect, useRef } from "react";
import { live } from "../../lib/live";
import type { VisualQuality } from "../../lib/types";
import { VisualEngine } from "./VisualEngine";

/** Full-window animated background driven by the live analysis frames. */
export function Visualizer({ quality }: { quality: VisualQuality }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new VisualEngine(canvas, live, quality);
    engineRef.current = engine;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      engine.step(dt);
      raf = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === "visible") {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engineRef.current = null;
    };
    // The engine is created once; quality changes are applied below.
  }, []);

  useEffect(() => {
    engineRef.current?.setQuality(quality);
  }, [quality]);

  return <canvas ref={canvasRef} className="visualizer" aria-hidden="true" />;
}
