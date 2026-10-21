import React, { useEffect, useState } from "react";
/** Opt-in local rendering diagnostic. No identifiers, tracking or network requests. */
export default function DeviceCheck({
  map,
  connected,
}: {
  map: boolean;
  connected: boolean;
}) {
  const [running, setRunning] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [samples, setSamples] = useState<number[]>([]),
    [message, setMessage] = useState(
      "Keep the 3D game visible and play for ten minutes. Results stay on this device.",
    );
  useEffect(() => {
    if (!running) return;
    if (!connected) {
      setRunning(false);
      setMessage(
        "Interrupted by a reconnect. Start a fresh ten-minute run once the town is connected.",
      );
      return;
    }
    if (map) {
      setRunning(false);
      setMessage(
        "Use the 3D view to measure rendering. Accessible map remains available for play.",
      );
      return;
    }
    let frame = 0,
      start = performance.now(),
      windowStart = start,
      frames = 0,
      lastSecond = -1;
    const completed: number[] = [];
    const visibility = () => {
      if (document.hidden) {
        setMessage(
          "Interrupted when the page was hidden. Start a fresh ten-minute run.",
        );
        setRunning(false);
      }
    };
    const measure = (now: number) => {
      frames++;
      const seconds = Math.floor((now - start) / 1000);
      if (seconds !== lastSecond) {
        lastSecond = seconds;
        setElapsed(Math.min(600, seconds));
      }
      if (now - start >= (completed.length + 1) * 10000) {
        completed.push((frames * 1000) / (now - windowStart));
        frames = 0;
        windowStart = now;
        setSamples([...completed]);
      }
      if (now - start >= 600000) {
        setRunning(false);
        setMessage(
          completed.length >= 60 && Math.min(...completed) >= 30
            ? "Ten-minute frame-cadence target passed on this device. Record the phone/browser model separately."
            : "Frame-cadence target missed or incomplete on this run. Accessible map is available for play.",
        );
        return;
      }
      frame = requestAnimationFrame(measure);
    };
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [running, map, connected]);
  return (
    <article
      className="device-check"
      aria-label="Local device performance check"
    >
      <h3>Device check · local only</h3>
      <p>{message}</p>
      <p>
        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} /
        10:00 · Lowest ten-second frame rate:{" "}
        {samples.length ? Math.min(...samples).toFixed(1) : "not measured"} FPS
        · {samples.length}/60 windows
      </p>
      <button
        onClick={() => {
          if (running) {
            setRunning(false);
            setMessage(
              "Stopped early. A complete run requires ten visible minutes.",
            );
          } else {
            setSamples([]);
            setElapsed(0);
            setMessage(
              "Play normally with the 3D view visible; keep this page in the foreground.",
            );
            setRunning(true);
          }
        }}
      >
        {running ? "Stop device check" : "Start ten-minute check"}
      </button>
      <small>
        This measures browser frame cadence, not educational outcomes or server
        capacity. No result is uploaded.
      </small>
    </article>
  );
}
