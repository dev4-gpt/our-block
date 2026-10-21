import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BRANCHES,
  VARIANTS,
  LOCATIONS,
  SHELTER,
  route,
  type View,
  type Branch,
  type Point,
} from "../shared/game";
const City = lazy(() => import("./City").then((m) => ({ default: m.City })));
import "./style.css";
const storageKey = "last-light-seat";
function App() {
  const [view, setView] = useState<View | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(
      new URLSearchParams(location.search).get("room") || "",
    ),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [pending, setPending] = useState(false),
    [calm, setCalm] = useState(false),
    [preview, setPreview] = useState<Branch | null>(null),
    [van, setVan] = useState("01"),
    [target, setTarget] = useState(""),
    [flat, setFlat] = useState(false),
    [sound, setSound] = useState(false),
    [copied, setCopied] = useState(false),
    [replay, setReplay] = useState(-1),
    [now, setNow] = useState(Date.now());
  const receivedAt = useRef(Date.now());
  const ws = useRef<WebSocket | null>(null),
    session = useRef<any>(null),
    lastRescued = useRef(0),
    soundRef = useRef(false);
  soundRef.current = sound;
  useEffect(() => {
    try {
      session.current = JSON.parse(
        sessionStorage.getItem(storageKey) || "null",
      );
    } catch {}
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const socket = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/socket`,
      );
      ws.current = socket;
      socket.onopen = () => {
        setConnected(true);
        if (session.current) {
          setPending(true);
          socket.send(JSON.stringify({ type: "join", ...session.current }));
        }
      };
      socket.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === "state") {
          receivedAt.current = Date.now();
          setView(m.state);
          setPending(false);
        }
        if (m.type === "joined") {
          session.current = { code: m.code, token: m.token, name: m.name };
          sessionStorage.setItem(storageKey, JSON.stringify(session.current));
          setCode(m.code);
          history.replaceState(null, "", `?room=${m.code}`);
        }
        if (m.type === "error") {
          setError(m.message);
          setPending(false);
        }
      };
      socket.onclose = (e) => {
        setConnected(false);
        if (!disposed && e.code !== 4001) timer = setTimeout(connect, 1500);
        if (e.code === 4001) setError("This seat was opened in another tab.");
      };
    };
    connect();
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(interval);
      ws.current?.close();
    };
  }, []);
  useEffect(() => {
    if (view && view.rescued > lastRescued.current && soundRef.current) {
      try {
        const a = new AudioContext();
        [261.6, 329.6, 392].forEach((f, i) => {
          const o = a.createOscillator(),
            g = a.createGain();
          o.frequency.value = f;
          o.connect(g);
          g.connect(a.destination);
          g.gain.setValueAtTime(0.04, a.currentTime + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.6);
          o.start(a.currentTime + i * 0.08);
          o.stop(a.currentTime + 0.65);
        });
        setTimeout(() => a.close(), 1000);
      } catch {}
    }
    lastRescued.current = view?.rescued || 0;
  }, [view?.rescued]);
  useEffect(() => {
    if (replay < 0 || !view) return;
    const timer = setTimeout(
      () => setReplay((i) => (i >= view.events.length - 1 ? -1 : i + 1)),
      1100,
    );
    return () => clearTimeout(timer);
  }, [replay, view?.events.length]);
  useEffect(() => {
    const v = view?.vans.find((v) => v.id === van);
    if (v?.loaded) setTarget("shelter");
    else if (target === "shelter") setTarget("");
  }, [view?.vans.find((v) => v.id === van)?.loaded, van]);
  const send = (m: object) => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      setError("Reconnecting to the city…");
      return;
    }
    setError("");
    ws.current.send(JSON.stringify(m));
  };
  const action = (type: string, rest: object = {}) =>
    view &&
    send({
      type: "action",
      action: {
        id: crypto.randomUUID(),
        phase: view.phase,
        mission: view.mission,
        type,
        ...rest,
      },
    });
  const join = (create: boolean) => {
    if (!name.trim()) {
      setError("Give your teammate a name to call you.");
      return;
    }
    setPending(true);
    send({ type: "join", name, code, create });
  };
  const leave = () => {
    sessionStorage.removeItem(storageKey);
    location.href = "/";
  };
  const invite = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${view!.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Invite link: ${location.origin}/?room=${view!.code}`);
    }
  };
  if (!view)
    return (
      <div className="landing">
        <div className="landing-glow" />
        <header className="site-header">
          <a className="wordmark" href="/">
            ◈ LAST LIGHT
          </a>
          <span className="eyebrow">A COOPERATIVE RESCUE</span>
        </header>
        <main className="landing-grid">
          <section>
            <div className="eyebrow amber">TWO SCREENS. ONE CITY.</div>
            <h1>
              Bring back
              <br />
              the <em>light.</em>
            </h1>
            <p className="lead">
              The city has gone dark.
              <br />
              You have each other.
            </p>
            <p className="intro">
              One of you controls the power. The other guides the rescue.
              Neither can save the city alone.
            </p>
            <div className="landing-art">
              <div className="orbital" />
              <span className="beacon">⌂</span>
              {Array.from({ length: 17 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${8 + i * 5}%`,
                    height: 35 + ((i * 37) % 80),
                    bottom: 20 + (i % 3) * 7,
                  }}
                />
              ))}
              <div className="art-label">BEACON ISLAND · SIGNAL LOST</div>
            </div>
            <div className="features">
              <span>02 PLAYERS</span>
              <span>05 MINUTES</span>
              <span>NO DOWNLOADS</span>
            </div>
          </section>
          <section className="entry card">
            <div className="eyebrow">YOUR SHIFT STARTS HERE</div>
            <h2>Find your other half.</h2>
            <p>Open on two devices, or bring EMBER along for a solo mission.</p>
            <label htmlFor="name">YOUR CALL SIGN</label>
            <input
              id="name"
              maxLength={20}
              placeholder="e.g. Night Owl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
            <button
              className="primary"
              disabled={!connected || pending}
              onClick={() => join(true)}
            >
              {pending ? "Connecting…" : "Create a rescue room"} <span>↗</span>
            </button>
            <div className="divider">OR JOIN YOUR TEAMMATE</div>
            <label htmlFor="code">ROOM CODE</label>
            <div className="join-row">
              <input
                id="code"
                maxLength={4}
                placeholder="ABCD"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
                }
              />
              <button
                disabled={code.length !== 4 || !connected || pending}
                onClick={() => join(false)}
              >
                Join →
              </button>
            </div>
            <p className="connection">
              <i className={connected ? "online" : ""} />
              {connected ? "RADIO CONNECTED" : "CONNECTING TO RADIO…"}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {session.current && (
              <button className="text-button" onClick={leave}>
                Clear saved seat
              </button>
            )}
          </section>
        </main>
        <footer>
          Built for the moments when teamwork matters.{" "}
          <a href="/credits.txt" target="_blank" rel="noreferrer">
            Open-source credits ↗
          </a>
        </footer>
      </div>
    );
  const elapsed = Math.max(0, now - receivedAt.current),
    remaining = view.calm
      ? Math.max(0, 300000 - view.remaining) +
        (view.phase === "active" ? elapsed : 0)
      : Math.max(0, view.remaining - (view.phase === "active" ? elapsed : 0)),
    seconds = Math.ceil(remaining / 1000),
    clock = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const chosen = view.vans.find((v) => v.id === van),
    group = view.groups?.find((g) => g.id === target),
    path =
      chosen && target
        ? route(
            chosen.pos,
            target === "shelter" ? SHELTER : group?.pos || chosen.pos,
            view.power,
          )
        : [];
  const selectedBranch = BRANCHES.find((b) => b.id === preview),
    cooldown = Math.max(
      0,
      Math.ceil((view.cooldown - view.serverNow - elapsed) / 1000),
    );
  const event = replay >= 0 ? view.events[replay] : null;
  const display = event
    ? {
        ...view,
        power: event.power,
        vans: view.vans.map((v) => ({
          ...v,
          pos: event.vans.find((e) => e.id === v.id)?.pos || v.pos,
        })),
        rescued: event.rescued,
      }
    : view;
  return (
    <div className="game">
      <header className="game-header">
        <a href="/" className="wordmark">
          ◈ LAST LIGHT
        </a>
        <div className="room-code">
          <span className="eyebrow">ROOM</span>
          <b>{view.code}</b>
          <button onClick={invite} aria-label="Copy invite link">
            {copied ? "Copied!" : "Invite ↗"}
          </button>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            onClick={() => setSound(!sound)}
            aria-label={sound ? "Mute sound" : "Enable sound"}
          >
            {sound ? "♪ ON" : "♪ OFF"}
          </button>
          <button className="icon-button" onClick={() => setFlat(!flat)}>
            {flat ? "3D CITY" : "2D MAP"}
          </button>
          <button className="icon-button" onClick={leave}>
            Leave
          </button>
        </div>
      </header>
      <main className="game-layout">
        <section className="city-panel">
          <div className="mission-heading">
            <div>
              <span className="eyebrow amber">
                {view.phase === "lobby"
                  ? "AWAITING CREW"
                  : view.phase === "over"
                    ? "SHIFT COMPLETE"
                    : "RESCUE IN PROGRESS"}
              </span>
              <h2>{VARIANTS[view.variant]}</h2>
            </div>
            <div className="clock">
              <span className="eyebrow">
                {view.calm ? "CALM · ELAPSED" : "BATTERY REMAINING"}
              </span>
              <strong className={seconds < 30 && !view.calm ? "danger" : ""}>
                {clock}
              </strong>
            </div>
          </div>
          <div className="map-wrap">
            <Suspense
              fallback={
                <div className="city-loading">Establishing city signal…</div>
              }
            >
              <City
                view={display}
                flat={flat}
                route={path}
                onPick={(p: Point) => {
                  if (view.role === "gridkeeper") {
                    const b = BRANCHES.find(
                      (b) => Math.abs(b.x - p.x) + Math.abs(b.y - p.y) <= 1,
                    );
                    if (b) setPreview(b.id);
                  } else {
                    const g = view.groups?.find(
                      (g) =>
                        g.status === "waiting" &&
                        Math.abs(g.pos.x - p.x) + Math.abs(g.pos.y - p.y) <= 1,
                    );
                    if (g) setTarget(g.id);
                    else if (
                      Math.abs(SHELTER.x - p.x) + Math.abs(SHELTER.y - p.y) <=
                      1
                    )
                      setTarget("shelter");
                  }
                }}
              />
            </Suspense>
            <div className="map-badge">
              <i className="online" /> BEACON ISLAND <span>16 × 16</span>
            </div>
            <div className="map-legend">
              <span>◆ VAN</span>
              <span>⌂ SHELTER</span>
              <span>◉ CROSSING</span>
            </div>
            {view.phase === "lobby" && (
              <div className="lobby-overlay">
                <div className="eyebrow amber">A CITY WORTH SAVING</div>
                <h2>
                  Every light is
                  <br />
                  someone waiting.
                </h2>
                <p>
                  Assemble your crew.
                  <br />
                  Then bring them home.
                </p>
              </div>
            )}
          </div>
          <div className="rescue-strip">
            <div>
              <strong>
                {display.rescued}
                <small> / 6</small>
              </strong>
              <span>GROUPS HOME</span>
            </div>
            <div className="rescue-dots">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={i < display.rescued ? "saved" : ""}>
                  ⌂
                </span>
              ))}
            </div>
            <div className="chapter">
              <span className="eyebrow">
                {view.rescued < 1
                  ? "01 · FIRST CONTACT"
                  : view.rescued < 4
                    ? "02 · ACROSS THE WATER"
                    : "03 · THE LAST LIGHT"}
              </span>
              <p>
                {view.rescued < 1
                  ? "Restore a crossing. Make your first rescue."
                  : view.rescued < 4
                    ? "Two vans. Two power slots. Find your rhythm."
                    : "Keep the shelter lit. Bring everyone home."}
              </p>
            </div>
          </div>
          <div className="event-log" aria-live="polite">
            <span className="eyebrow">{event ? "REPLAY" : "CITY SIGNAL"}</span>
            <p>
              {event?.text ||
                view.events.at(-1)?.text ||
                "A quiet city. Six groups waiting for your signal."}
            </p>
          </div>
        </section>
        <aside className="control-panel">
          <div className="role-card">
            <span className="eyebrow">YOU ARE THE</span>
            <h2>
              {view.role === "gridkeeper" ? "Gridkeeper" : "Pathfinder"}{" "}
              <span>{view.role === "gridkeeper" ? "ϟ" : "⌖"}</span>
            </h2>
            <p>
              {view.role === "gridkeeper"
                ? "You bring the power. Your teammate knows who needs it."
                : "You bring them home. Your teammate opens the way."}
            </p>
            <div className="crew">
              {view.seats.map((s) => (
                <div key={s.role}>
                  <i className={s.connected ? "online" : ""} />
                  <span>{s.name}</span>
                  <small>
                    {s.role === view.role ? "YOU" : s.bot ? "BOT" : "TEAMMATE"}
                  </small>
                </div>
              ))}
            </div>
          </div>
          {view.phase === "lobby" ? (
            <section className="control-section">
              <h3>Your rescue briefing</h3>
              <ol className="rules">
                <li>You see different information. Share what you know.</li>
                <li>Power crossings and guide vans to stranded groups.</li>
                <li>Bring all six groups to the powered shelter.</li>
              </ol>
              {view.host ? (
                <>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={calm}
                      onChange={(e) => setCalm(e.target.checked)}
                    />{" "}
                    Calm mode <small>No time limit</small>
                  </label>
                  {(view.seats.length < 2 ||
                    view.seats.some((s) => !s.connected)) && (
                    <button
                      className="wide"
                      onClick={() => send({ type: "bot" })}
                    >
                      + Add EMBER · bot teammate
                    </button>
                  )}
                  <button
                    className="primary wide"
                    disabled={view.seats.length < 2}
                    onClick={() => action("start", { calm })}
                  >
                    Begin rescue <span>→</span>
                  </button>
                </>
              ) : (
                <p>Waiting for your teammate to begin the rescue.</p>
              )}
              <p className="hint">
                Share the invite link to play together on separate devices. No
                voice chat needed.
              </p>
            </section>
          ) : view.phase === "over" ? (
            <section className="control-section">
              <span className="eyebrow amber">
                {view.rescued === 6
                  ? "ALL SIGNALS RESTORED"
                  : "THANK YOU FOR SHOWING UP"}
              </span>
              <h2>
                {view.rescued === 6
                  ? "Everyone home."
                  : `${view.rescued} groups safe.`}
              </h2>
              <p>{view.reason}</p>
              {view.rescued === 6 && (
                <p className="result-time">
                  Completed in {Math.floor((300000 - view.remaining) / 60000)}m{" "}
                  {Math.floor((300000 - view.remaining) / 1000) % 60}s ·{" "}
                  {view.calm ? "Calm mode" : "Standard mission"}
                </p>
              )}
              <button
                className="wide"
                onClick={() => setReplay(replay < 0 ? 0 : -1)}
              >
                {replay < 0 ? "↺ Watch your rescue replay" : "Stop replay"}
              </button>
              {view.host && (
                <>
                  <button
                    className="primary wide"
                    onClick={() => {
                      setReplay(-1);
                      action("retry", { calm: view.calm });
                    }}
                  >
                    Retry this mission →
                  </button>
                  <button
                    className="wide"
                    onClick={() => {
                      setReplay(-1);
                      action("new", { calm: view.calm });
                    }}
                  >
                    New mission ↗
                  </button>
                </>
              )}
            </section>
          ) : view.phase === "paused" ? (
            <section className="control-section">
              <h2>Hold the signal.</h2>
              <p>
                Your teammate disconnected. The city and battery are paused.
              </p>
              <p>
                Reconnect grace:{" "}
                {Math.max(
                  0,
                  60 -
                    Math.floor(
                      (view.serverNow + elapsed - view.pauseAt) / 1000,
                    ),
                )}
                s
              </p>
              <button
                className="primary wide"
                disabled={view.serverNow + elapsed - view.pauseAt < 60000}
                onClick={() => send({ type: "bot" })}
              >
                Continue with EMBER
              </button>
              <button
                className="wide"
                disabled={view.serverNow + elapsed - view.pauseAt < 60000}
                onClick={() => action("end")}
              >
                End mission
              </button>
            </section>
          ) : (
            <>
              {view.role === "gridkeeper" ? (
                <section className="control-section">
                  <div className="section-title">
                    <h3>Power distribution</h3>
                    <span>{view.power.length} / 2 ACTIVE</span>
                  </div>
                  <p className="hint">
                    Only two branches can run. Tap a circuit to preview its
                    effect.
                  </p>
                  {view.rescued === 0 && (
                    <p className="tutorial-note">
                      <b>FIRST SIGNAL</b> Power Harbor Bridge. Keep Beacon
                      Shelter on so your teammate can unload.
                    </p>
                  )}
                  <div className="circuits">
                    {BRANCHES.map((b) => (
                      <button
                        key={b.id}
                        className={`circuit ${view.power.includes(b.id) ? "powered" : ""} ${preview === b.id ? "selected" : ""}`}
                        onClick={() => setPreview(b.id)}
                      >
                        <span className="circuit-symbol">{b.symbol}</span>
                        <span>
                          {b.name}
                          <small>
                            {view.power.includes(b.id) ? "POWERED" : "OFFLINE"}
                          </small>
                        </span>
                        <b>{view.power.includes(b.id) ? "●" : "○"}</b>
                      </button>
                    ))}
                  </div>
                  {selectedBranch && (
                    <div className="preview">
                      <b>{selectedBranch.name}</b>
                      <p>
                        {view.power.includes(selectedBranch.id)
                          ? "Release this branch. Its infrastructure will stop serving new routes."
                          : selectedBranch.description}
                      </p>
                      <button
                        className="primary wide"
                        disabled={cooldown > 0}
                        onClick={() => action("power", { branch: preview })}
                      >
                        {cooldown
                          ? `Relay cooling · ${cooldown}s`
                          : view.power.includes(selectedBranch.id)
                            ? "Confirm release"
                            : "Confirm power"}
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <section className="control-section">
                  <h3>Rescue dispatch</h3>
                  {view.rescued === 0 && (
                    <p className="tutorial-note">
                      <b>FIRST RESCUE</b>{" "}
                      {chosen?.loaded
                        ? "Passengers aboard. Dispatch to Beacon Shelter to bring them home."
                        : "Choose Van 01 → Clocktower. Ask for bridge power if the route is blocked."}
                    </p>
                  )}
                  <div className="van-tabs">
                    {view.vans.map((v) => (
                      <button
                        className={v.id === van ? "selected" : ""}
                        key={v.id}
                        onClick={() => {
                          setVan(v.id);
                          setTarget(v.loaded ? "shelter" : "");
                        }}
                      >
                        ◆ VAN {v.id}
                        <small>
                          {v.moving
                            ? "En route"
                            : v.loaded
                              ? "Passengers aboard"
                              : "Ready"}
                        </small>
                      </button>
                    ))}
                  </div>
                  <label htmlFor="destination">DESTINATION</label>
                  <select
                    id="destination"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">Choose a rescue destination</option>
                    {chosen?.loaded ? (
                      <option value="shelter">
                        ⌂ Beacon Shelter · deliver passengers
                      </option>
                    ) : (
                      view.groups
                        ?.filter((g) => g.status === "waiting")
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))
                    )}
                  </select>
                  {target && (
                    <div className="preview">
                      <p>
                        {path.length
                          ? `${path.length - 1} road tiles · ${Math.ceil((path.length - 1) * 0.23)} seconds`
                          : "Route blocked. Request power for a crossing below."}
                      </p>
                      <button
                        className="primary wide"
                        disabled={!path.length || chosen?.moving}
                        onClick={() => action("dispatch", { van, target })}
                      >
                        Dispatch van {van} →
                      </button>
                    </div>
                  )}
                  <div className="groups">
                    {view.groups?.map((g) => (
                      <div key={g.id}>
                        <span>{g.name}</span>
                        <small>
                          {g.status === "safe"
                            ? "✓ HOME"
                            : g.status === "aboard"
                              ? "◆ ABOARD"
                              : "○ WAITING"}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="control-section radio">
                <div className="section-title">
                  <h3>Team radio</h3>
                  <span>NO MIC NEEDED</span>
                </div>
                <div className="ping-buttons">
                  {BRANCHES.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => action("ping", { branch: b.id })}
                    >
                      {b.symbol}{" "}
                      {b.id === "shelter"
                        ? "Power shelter"
                        : b.id === "pump"
                          ? "Open canal"
                          : `Power ${b.id === "north" ? "north gate" : "bridge"}`}
                    </button>
                  ))}
                </div>
                <div aria-live="polite">
                  {view.pings
                    .slice(-3)
                    .reverse()
                    .map((p) => (
                      <div className="ping" key={p.id}>
                        <b>
                          {p.from === view.role ? "YOU" : "TEAMMATE"} →{" "}
                          {BRANCHES.find((b) => b.id === p.branch)?.name}
                        </b>
                        <p>
                          {p.request} <small>· {p.status}</small>
                        </p>
                        {p.from !== view.role &&
                          !["completed", "declined"].includes(p.status) && (
                            <div>
                              {(
                                [
                                  "acknowledged",
                                  "completed",
                                  "declined",
                                ] as const
                              ).map((s) => (
                                <button
                                  key={s}
                                  onClick={() =>
                                    action("pingStatus", {
                                      pingId: p.id,
                                      status: s,
                                    })
                                  }
                                >
                                  {s === "acknowledged"
                                    ? "On it"
                                    : s === "completed"
                                      ? "Done"
                                      : "Cannot yet"}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!connected && (
            <p className="error" role="status">
              Signal interrupted. Reconnecting automatically…
            </p>
          )}
        </aside>
      </main>
      <footer>
        <span>◈ TWO SCREENS. ONE CITY.</span>
        <a href="/credits.txt" target="_blank" rel="noreferrer">
          Built with Autopolis · Credits ↗
        </a>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
