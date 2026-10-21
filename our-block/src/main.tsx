import React, { useState, useRef, useEffect, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  districts,
  activities,
  offers,
  upgrades,
  projects,
  items,
  pings,
} from "../shared/content.ts";
import "./style.css";
import { gardenSteps, type Guidance } from "./guidance.ts";
import { commandId } from "./ids.ts";
import { TownConnection } from "./connection.ts";
const World = lazy(() => import("./World.tsx"));
const storageKey = "our-block-seat";
function App() {
  const [state, setState] = useState<any>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(
      new URLSearchParams(location.search).get("town") || "",
    ),
    [mode, setMode] = useState("explore"),
    [guidance, setGuidance] = useState<Guidance>(
      () =>
        (["Guided", "Light", "Off"].includes(
          localStorage.getItem("our-block-guidance") || "",
        )
          ? localStorage.getItem("our-block-guidance")
          : "Guided") as Guidance,
    ),
    [remember, setRemember] = useState(!!localStorage.getItem(storageKey)),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState("garden"),
    [tab, setTab] = useState("Explore"),
    [map, setMap] = useState(false),
    [follow, setFollow] = useState(false),
    [connecting, setConnecting] = useState(false),
    [connectionStatus, setConnectionStatus] = useState(""),
    [account, setAccount] = useState("shared"),
    [sound, setSound] = useState(false);
  const transport = useRef<TownConnection | null>(null),
    current = useRef<any>(null),
    audio = useRef<AudioContext | null>(null);
  current.current = state;
  function connect(recover?: any) {
    transport.current?.stop();
    setError("");
    const client = new TownConnection({
      url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      health: async () => {
        const response = await fetch("/health", {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
        if (!response.ok) throw Error("Unavailable");
        const body = await response.json();
        if (!body.ok) throw Error("Unavailable");
      },
      socket: (url) => new WebSocket(url),
      status: (text, ready) => {
        setConnecting(!ready && !!text);
        setConnectionStatus(text);
      },
      uncertain: () =>
        setNotice(
          "Connection interrupted before an action was confirmed. Review your balance, backpack and ledger before deciding whether to try again.",
        ),
      message: (m) => {
        if (m.type === "joined") {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({ code: m.code, token: m.token }),
          );
          if (remember)
            localStorage.setItem(
              storageKey,
              JSON.stringify({ code: m.code, token: m.token }),
            );
          else localStorage.removeItem(storageKey);
          history.replaceState({}, "", `?town=${m.code}`);
        }
        if (m.type === "state") {
          setState(m.state);
          const decision = m.state.decisions
            ?.filter((d: any) => d.by === m.state.you)
            .at(-1);
          if (decision)
            setNotice((previous) =>
              previous.startsWith("A teammate must approve")
                ? decision.text
                : previous,
            );
        }
        if (m.type === "error") {
          setError(m.message);
          setConnecting(false);
        }
        if (m.type === "result") {
          if (m.message !== "Done.") setNotice(m.message);
          if (audio.current) {
            const o = audio.current.createOscillator(),
              g = audio.current.createGain();
            o.connect(g);
            g.connect(audio.current.destination);
            o.frequency.value = 440;
            g.gain.setValueAtTime(0.025, audio.current.currentTime);
            g.gain.exponentialRampToValueAtTime(
              0.001,
              audio.current.currentTime + 0.15,
            );
            o.start();
            o.stop(audio.current.currentTime + 0.15);
          }
        }
      },
    });
    transport.current = client;
    client.start(recover || { name, code, mode });
  }
  useEffect(() => {
    const saved =
      sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
    if (saved) {
      try {
        const seat = JSON.parse(saved);
        if (!code || code === seat.code) connect(seat);
      } catch {
        sessionStorage.removeItem(storageKey);
        localStorage.removeItem(storageKey);
      }
    }
    return () => transport.current?.stop();
  }, []);
  function send(type: string, extra: any = {}) {
    if (
      !current.current ||
      !transport.current?.send({
        v: 1,
        type,
        id: commandId(),
        revision: current.current.revision,
        ...extra,
      })
    ) {
      setError("Reconnect and wait for the latest town view before acting.");
      return;
    }
    setError("");
  }
  const me = state?.players.find((p: any) => p.id === state.you);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        /INPUT|SELECT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName)
      )
        return;
      const p = current.current?.players.find(
        (p: any) => p.id === current.current.you,
      );
      if (!p) return;
      const delta: Record<string, number[]> = {
        w: [0, -2],
        s: [0, 2],
        a: [-2, 0],
        d: [2, 0],
        ArrowUp: [0, -2],
        ArrowDown: [0, 2],
        ArrowLeft: [-2, 0],
        ArrowRight: [2, 0],
      };
      const v = delta[e.key];
      if (v) {
        e.preventDefault();
        send("move", {
          x: Math.max(-25, Math.min(25, p.x + v[0])),
          z: Math.max(-23, Math.min(23, p.z + v[1])),
        });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!state)
    return (
      <main className="landing">
        <div className="eyebrow">A COOPERATIVE NEIGHBORHOOD</div>
        <h1>
          Small town.
          <br />
          <em>Big possibilities.</em>
        </h1>
        <p>
          Make things work. Make your money count.
          <br />
          Build a better block, together.
        </p>
        <div className="landing-card">
          <span className="brand">
            OUR BLOCK <span>✳</span>
          </span>
          <label>
            Your nickname
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should neighbors call you?"
            />
          </label>
          <label>
            Town code <small>Leave empty to start a town</small>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A friend’s invitation code"
            />
          </label>
          <label>
            Time
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="life">Life mode · 20-minute days</option>
              <option value="explore">Untimed exploration</option>
            </select>
          </label>
          <p className="mode-help">
            Untimed towns have no day deadline. In Life mode, a day lasts 20
            active minutes and pauses when everyone leaves. Starter housing is
            secure; optional facilities can have inspectable bills.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{" "}
            Remember my seat on this device. Leave off on shared devices.
          </label>
          <button
            className="primary"
            disabled={connecting}
            onClick={() => connect()}
          >
            {connecting
              ? "Opening the gates…"
              : code
                ? "Join your neighborhood →"
                : "Start your neighborhood →"}
          </button>
          {connectionStatus && <p role="status">{connectionStatus}</p>}
          {error && <p role="alert">{error}</p>}
        </div>
        <footer>1–4 FRIENDS · SIX DISTRICTS · NO MICROPHONE NEEDED</footer>
      </main>
    );
  const district = districts.find((x) => x.id === selected)!;
  const near = Math.hypot(me.x - district.x, me.z - district.z) <= 7;
  const categoryTotal = (account: string, category: string) =>
    state.totals?.[account]?.[category] ??
    state.ledger
      .filter((x: any) => x.account === account && x.category === category)
      .reduce((n: number, x: any) => n + x.amount, 0);
  const total = (key: string) =>
    ["income", "expense", "transfer"].reduce(
      (n, c) => n + categoryTotal(key, c),
      0,
    );
  const go = (id: string) => {
    setSelected(id);
    const d = districts.find((x) => x.id === id)!;
    send("move", { x: d.x, z: d.z + 3 });
  };
  return (
    <div className="app">
      <header>
        <a className="brand" href="/">
          OUR BLOCK <span>✳</span>
        </a>
        <div className="day">
          {state.mode === "explore"
            ? "∞ Explore"
            : `DAY ${state.day} · ${Math.floor((1200 - state.seconds) / 60)}:${String(Math.floor((1200 - state.seconds) % 60)).padStart(2, "0")}`}
          <span>A little progress goes a long way.</span>
        </div>
        <div className="balance">
          <small>COOPERATIVE FUNDS</small>
          <b>◈ {state.funds}</b>
        </div>
        <button
          onClick={() => {
            const invitation = `${location.origin}${location.pathname}?town=${state.code}`;
            if (navigator.clipboard)
              void navigator.clipboard
                .writeText(invitation)
                .then(() => setNotice("Invitation link copied."))
                .catch(() => setNotice(invitation));
            else setNotice(invitation);
          }}
        >
          Invite friends ↗
        </button>
      </header>
      <nav className="topnav">
        <label className="guidance-select">
          Guidance{" "}
          <select
            aria-label="Personal guidance"
            value={guidance}
            onChange={(e) => {
              setGuidance(e.target.value as Guidance);
              localStorage.setItem("our-block-guidance", e.target.value);
            }}
          >
            {["Guided", "Light", "Off"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {["Explore", "Projects", "Backpack", "Ledger"].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
        <button
          onClick={() => {
            if (
              confirm(
                "Forget this device’s saved seat? The town remains saved. You may lose access to this seat without another private recovery copy.",
              )
            ) {
              sessionStorage.removeItem(storageKey);
              localStorage.removeItem(storageKey);
              transport.current?.stop();
              setState(null);
              setCode("");
              history.replaceState({}, "", location.pathname);
            }
          }}
        >
          Forget this device
        </button>
        <span className="residents">
          {state.players.filter((p: any) => p.online).length}/4 neighbors ·{" "}
          {state.code}
        </span>
      </nav>
      <main className="play">
        <section className="viewport">
          <div className="scene-top">
            <div className="pill">
              YOUR NEIGHBORHOOD <span>↗ LIVE</span>
            </div>
            <button onClick={() => setFollow(!follow)}>
              {follow ? "Town view" : "Follow me"}
            </button>
            <button onClick={() => setMap(!map)}>
              {map ? "3D world" : "Accessible map"}
            </button>
          </div>
          {map ? (
            <div className="mapgrid">
              {districts.map((d) => (
                <button
                  key={d.id}
                  style={{ background: d.color }}
                  onClick={() => go(d.id)}
                >
                  <strong>
                    {d.icon} {d.name}
                  </strong>
                  <small>{d.subtitle}</small>
                  <span>Walk here →</span>
                </button>
              ))}
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="loading">Planting the neighborhood…</div>
              }
            >
              <World
                state={state}
                follow={follow}
                selected={selected}
                onSelect={setSelected}
                onMove={(x, z) => send("move", { x, z })}
                onFail={() => setMap(true)}
              />
            </Suspense>
          )}
          <div className="scene-bottom">
            <span>WASD / arrows to walk · drag to rotate · scroll to zoom</span>
            <button
              onClick={() => {
                if (!sound) {
                  audio.current = new AudioContext();
                  audio.current.resume();
                } else {
                  audio.current?.close();
                  audio.current = null;
                }
                setSound(!sound);
              }}
            >
              {sound ? "♪ Sound on" : "♪ Sound off"}
            </button>
          </div>
          <div className="districts">
            {districts.map((d) => (
              <button
                className={selected === d.id ? "chosen" : ""}
                key={d.id}
                onClick={() => go(d.id)}
              >
                <span style={{ color: d.color }}>{d.icon}</span>
                {d.name}
              </button>
            ))}
          </div>
        </section>
        <aside>
          {state.availability && state.availability !== "ready" && (
            <div role="status" className="notice">
              {state.availability === "read-only"
                ? "Town preserved: storage is near its allowance, so play is paused."
                : state.availability === "limited"
                  ? "New contracts are paused while storage is near its allowance."
                  : "Storage is approaching its allowance. Your progress remains saved."}
            </div>
          )}
          {guidance !== "Off" &&
            state.contracts.garden?.status !== "complete" && (
              <article className="journey">
                <span className="eyebrow">FIRST PROJECT · OPEN THE GARDEN</span>
                <h2>Bring water back to the block</h2>
                <p>
                  The beds are dry. Investigate the fault, agree on a repair and
                  test whether it works.
                </p>
                {guidance === "Guided" && (
                  <>
                    <p>
                      Split the investigation: one neighbor can inspect the
                      garden and Workshop while another compares Market offers.
                      Meet to exchange supplies. Both investigations matter;
                      approving a purchase is only one step.
                    </p>
                    <ol>
                      {gardenSteps(state).map((step) => (
                        <li
                          key={step.label}
                          className={step.done ? "done" : ""}
                        >
                          {step.done ? "✓ " : "○ "}
                          {step.label}
                        </li>
                      ))}
                    </ol>
                    <small>
                      Tap a district to walk. Use Explore for local
                      interactions, Projects for contracts, and Backpack for
                      evidence and supplies. All guidance settings show the same
                      costs and evidence.
                    </small>
                  </>
                )}
                {!state.contracts.garden && (
                  <div className="actions">
                    <button onClick={() => go("garden")}>Walk to garden</button>
                    <button
                      disabled={Math.hypot(me.x + 15, me.z - 12) > 7}
                      onClick={() => send("accept", { target: "garden" })}
                    >
                      Agree to garden project
                    </button>
                  </div>
                )}
              </article>
            )}
          {guidance !== "Off" &&
            state.contracts.garden?.status === "complete" &&
            state.contracts.evening?.status !== "complete" && (
              <article className="journey">
                <h3>
                  {state.contracts.market?.status === "complete"
                    ? "The block is ready for an evening together"
                    : "The garden is growing. Bring it to market."}
                </h3>
                <p>
                  Review the next contract, plan supplies and compare the cost
                  with the expected reward.
                </p>
                <button
                  onClick={() => {
                    go(
                      state.contracts.market?.status === "complete"
                        ? "hall"
                        : "market",
                    );
                    setTab("Projects");
                  }}
                >
                  Plan the next project
                </button>
              </article>
            )}
          {Object.keys(state.contributions || {}).length > 0 && (
            <article>
              <h3>Our contributions</h3>
              {Object.entries(state.contributions).map(([id, text]) => (
                <p key={id}>
                  <strong>
                    {state.players.find((p: any) => p.id === id)?.name}:
                  </strong>{" "}
                  {String(text)}
                </p>
              ))}
            </article>
          )}
          {state.decisions?.slice(-2).map((d: any) => (
            <p className="notice" role="status" key={d.id}>
              {d.text}
            </p>
          ))}
          {connectionStatus && (
            <div className="notice" role="status">
              {connectionStatus}
              <button
                onClick={() =>
                  connect(
                    JSON.parse(sessionStorage.getItem(storageKey) || "{}"),
                  )
                }
              >
                Reconnect
              </button>
            </div>
          )}
          <div className="panel-heading">
            <span className="eyebrow">
              {tab === "Explore" ? "AROUND THE CORNER" : tab.toUpperCase()}
            </span>
            <h2>
              {tab === "Explore"
                ? district.name
                : tab === "Backpack"
                  ? `${me.name}’s supplies`
                  : tab === "Ledger"
                    ? "Every credit has a story"
                    : "Good things take a little teamwork"}
            </h2>
            <p>
              {tab === "Explore"
                ? district.subtitle
                : tab === "Projects"
                  ? "Take on a useful project. Find your own way to finish it."
                  : tab === "Ledger"
                    ? "Compare what came in, what went out, and what comes next."
                    : `Personal funds: ${me.money} credits. Meet friends to exchange supplies.`}
            </p>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button
                onClick={() =>
                  connect(
                    JSON.parse(sessionStorage.getItem(storageKey) || "{}"),
                  )
                }
              >
                Reconnect
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="Dismiss update" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {tab === "Ledger" && !state.totalsComplete && (
            <p className="notice">
              Historical totals cover only retained entries from the older save.
              New transactions are counted cumulatively from this upgrade.
            </p>
          )}
          {state.review && (
            <article className="review">
              <h3>A day well spent</h3>
              <p>
                Review your ledger and tomorrow’s obligations before continuing.
              </p>
              <button className="primary" onClick={() => send("next")}>
                Start day {state.day + 1}
              </button>
            </article>
          )}
          {state.pending.map((q: any) => (
            <article key={q.id}>
              <span className="eyebrow">TEAM DECISION</span>
              <h3>
                {offers.find((o) => o.id === q.target)?.name ||
                  upgrades.find((u) => u.id === q.target)?.name ||
                  "Service bill"}{" "}
                · {q.cost} credits
              </h3>
              <p>
                Requested by{" "}
                {state.players.find((p: any) => p.id === q.by)?.name}
              </p>
              <p>
                Quantity: {offers.find((o) => o.id === q.target)?.qty || 1} ·
                Total: {q.cost} credits · Shared funds after approval:{" "}
                {state.funds - q.cost}
              </p>
              <p>
                {offers.find((o) => o.id === q.target)?.detail ||
                  upgrades.find((u) => u.id === q.target)?.detail ||
                  "Pays the outstanding optional service bill."}
              </p>
              <small>
                No money moves until approval. Purchases are not automatically
                retried after a connection failure.
              </small>
              {q.by !== me.id && (
                <button onClick={() => send("decline", { target: q.id })}>
                  Decline · no spending
                </button>
              )}
              {q.by !== me.id && (
                <button
                  className="primary"
                  onClick={() => send("approve", { target: q.id })}
                >
                  Approve shared purchase
                </button>
              )}
              {q.by === me.id && (
                <button onClick={() => send("cancel", { target: q.id })}>
                  Cancel request
                </button>
              )}
            </article>
          ))}
          {selected === "garden" &&
            state.contracts.garden?.status === "active" && (
              <article className="repair">
                <h3>
                  {state.gardenRepair?.tested
                    ? "Water reaches the beds"
                    : state.gardenRepair
                      ? "Fitting installed · test required"
                      : "Dry beds · connection needs repair"}
                </h3>
                <p>
                  Choose from the parts you carry using the evidence you
                  collected. An unused incompatible purchase can be returned.
                </p>
                {!state.gardenRepair &&
                  Object.entries(me.bag)
                    .filter(
                      ([id, n]) =>
                        ["connector", "hose", "wrong"].includes(id) &&
                        Number(n) > 0,
                    )
                    .map(([id]) => (
                      <button
                        disabled={Math.hypot(me.x + 15, me.z - 12) > 7}
                        key={id}
                        onClick={() => send("fit", { item: id })}
                      >
                        Fit {items[id] || id}
                      </button>
                    ))}
                {state.gardenRepair && !state.gardenRepair.tested && (
                  <button
                    disabled={Math.hypot(me.x + 15, me.z - 12) > 7}
                    onClick={() => send("test")}
                  >
                    Test water connection
                  </button>
                )}
                {state.gardenRepair?.tested && (
                  <button
                    disabled={Math.hypot(me.x + 15, me.z - 12) > 7}
                    onClick={() => send("complete", { target: "garden" })}
                  >
                    Complete repair · reconcile reward
                  </button>
                )}
              </article>
            )}
          {tab === "Explore" && (
            <>
              {!near && (
                <button className="primary wide" onClick={() => go(selected)}>
                  Walk to {district.name} →
                </button>
              )}
              {selected === "garden" && state.crops?.length > 0 && (
                <article>
                  <h3>Your growing beds</h3>
                  {state.crops.map((c: any, i: number) => (
                    <p key={i}>
                      Bed {i + 1}:{" "}
                      {c.ready <= state.simTime
                        ? "Ready to harvest"
                        : `${Math.ceil(c.ready - state.simTime)} seconds until ready`}
                    </p>
                  ))}
                </article>
              )}
              <div className="section-title">
                Try something useful{" "}
                <span>{near ? "YOU ARE HERE" : "WALK CLOSER TO INTERACT"}</span>
              </div>
              {activities
                .filter((a) => a.district === selected)
                .map((a) => (
                  <article key={a.id}>
                    <h3>
                      {a.name}
                      {a.evidence && state.evidence.includes(a.evidence) && (
                        <span className="check"> ✓</span>
                      )}
                    </h3>
                    <p>{a.description}</p>
                    <button
                      disabled={!near}
                      onClick={() => send("activity", { target: a.id })}
                    >
                      {a.evidence ? "Inspect & try" : "Do this"} →
                    </button>
                  </article>
                ))}
              <div className="section-title">Supplies & improvements</div>
              <label>
                Pay using
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  <option value="shared">
                    Cooperative funds · teammate approval
                  </option>
                  <option value="personal">
                    My earnings · {me.money} credits
                  </option>
                </select>
              </label>
              {offers
                .filter((o) => o.district === selected)
                .map((o) => (
                  <article key={o.id}>
                    <h3>
                      {o.name}
                      <b className="price">◈ {o.price}</b>
                    </h3>
                    <p>{o.detail}</p>
                    <button
                      disabled={!near}
                      onClick={() => send("buy", { target: o.id, account })}
                    >
                      {o.id === "delivery-fee"
                        ? "Pay requested fee"
                        : "Review & buy"}{" "}
                      · {o.price}
                    </button>
                    {me.bag[o.item] >= o.qty && (
                      <button
                        disabled={!near}
                        onClick={() => send("refund", { target: o.id })}
                      >
                        {o.id === "delivery-fee"
                          ? "Dispute payment"
                          : "Return unused"}{" "}
                        · {o.price}
                      </button>
                    )}
                  </article>
                ))}
              {upgrades
                .filter((u) => u.district === selected)
                .map((u) => (
                  <article key={u.id}>
                    <h3>
                      {u.name}
                      <b className="price">
                        {state.upgrades.includes(u.id) ? "✓" : `◈ ${u.cost}`}
                      </b>
                    </h3>
                    <p>{u.detail}</p>
                    <button
                      disabled={!near || state.upgrades.includes(u.id)}
                      onClick={() => send("upgrade", { target: u.id, account })}
                    >
                      {state.upgrades.includes(u.id)
                        ? "Part of your neighborhood"
                        : "Make this improvement"}
                    </button>
                  </article>
                ))}
              {selected === "hall" && (
                <article>
                  <h3>Kitchen account · {state.bill} due</h3>
                  <p>
                    Next bill:{" "}
                    {state.upgrades.includes("kitchen")
                      ? state.upgrades.includes("insulation")
                        ? 5
                        : 8
                      : 0}{" "}
                    credits tomorrow. Service pauses while a bill is unpaid.
                  </p>
                  <button
                    disabled={!near || !state.bill}
                    onClick={() => send("bill", { account })}
                  >
                    Pay bill
                  </button>
                  <button
                    disabled={!near || !state.bill}
                    onClick={() => send("negotiate-bill")}
                  >
                    Exchange setup work for 5-credit relief
                  </button>
                  <button
                    disabled={!near || !state.upgrades.includes("kitchen")}
                    onClick={() => send("return-kitchen")}
                  >
                    Return kitchen
                  </button>
                </article>
              )}
            </>
          )}
          {tab === "Projects" &&
            projects.map((pr) => {
              const c = state.contracts[pr.id];
              return (
                <article key={pr.id}>
                  <span className="eyebrow">
                    {c?.status || "AVAILABLE"} · +{pr.reward} CREDITS
                  </span>
                  <h3>{pr.name}</h3>
                  <p>{pr.description}</p>
                  <p className="requirements">
                    {pr.requirements}
                    {pr.id === "garden" &&
                      " Then fit your chosen part and test the connection at the Garden."}
                    {c?.variant === 1 && (
                      <strong>
                        {" "}
                        This commission:{" "}
                        {pr.id === "garden"
                          ? "also bring one protective repair pad."
                          : pr.id === "market"
                            ? "deliver two packed orders."
                            : "bring two repaired stools."}
                      </strong>
                    )}
                  </p>
                  <small>
                    Due{" "}
                    {c ? `day ${c.due}` : `${pr.deadline} days after accepting`}{" "}
                    · No cancellation fee · Supplies purchased separately
                  </small>
                  <div className="actions">
                    <button onClick={() => go(pr.district)}>Walk there</button>
                    {c?.status === "active" ? (
                      <>
                        <button
                          className="primary"
                          onClick={() => send("complete", { target: pr.id })}
                        >
                          Complete together
                        </button>
                        <button
                          onClick={() => send("abandon", { target: pr.id })}
                        >
                          Cancel project
                        </button>
                      </>
                    ) : (
                      <button
                        className="primary"
                        onClick={() => send("accept", { target: pr.id })}
                      >
                        {c ? "Take a new commission" : "Accept project"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          {tab === "Backpack" && (
            <>
              <article>
                <h3>
                  Carrying{" "}
                  {
                    Object.values(me.bag).reduce(
                      (s: any, v: any) => s + v,
                      0,
                    ) as number
                  }{" "}
                  items
                </h3>
                {Object.entries(me.bag).map(([k, v]: any) => (
                  <div className="inventory-row" key={k}>
                    <b>
                      {items[k] || k} × {v}
                    </b>
                    <button
                      onClick={() =>
                        send("transfer", {
                          item: k,
                          qty: 1,
                          direction: "store",
                        })
                      }
                    >
                      Store 1 at Home
                    </button>
                    {state.players
                      .filter((p: any) => p.id !== me.id && p.online)
                      .map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            send("give", { player: p.id, item: k, qty: 1 })
                          }
                        >
                          Give 1 to {p.name}
                        </button>
                      ))}
                    {state.players.filter((p: any) => p.online).length ===
                      1 && (
                      <button onClick={() => send("companion", { item: k })}>
                        EMBER: store 1
                      </button>
                    )}
                  </div>
                ))}
                {!Object.keys(me.bag).length && (
                  <p>
                    Your backpack is empty. Gather supplies at the market or
                    refill water at Home.
                  </p>
                )}
              </article>
              <article>
                <h3>Shared clubhouse storage</h3>
                {Object.entries(state.storage).map(([k, v]: any) => (
                  <div className="inventory-row" key={k}>
                    <b>
                      {items[k] || k} × {v}
                    </b>
                    <button
                      onClick={() =>
                        send("transfer", { item: k, qty: 1, direction: "take" })
                      }
                    >
                      Take 1 at Home
                    </button>
                  </div>
                ))}
                <button onClick={() => go("home")}>Walk home</button>
                <button
                  disabled={!me.money}
                  onClick={() => send("deposit", { qty: me.money })}
                >
                  Contribute my {me.money} credits
                </button>
              </article>
              <article>
                <h3>Your notebook</h3>
                <p>Evidence is shared with your cooperative.</p>
                {state.evidence.map((e: string) => (
                  <p key={e}>
                    ✓ {activities.find((a) => a.evidence === e)?.observation}
                  </p>
                ))}
              </article>
            </>
          )}
          {tab === "Ledger" && (
            <>
              <article>
                <h3>Cooperative balance · {state.funds}</h3>
                <p>
                  Operating result:{" "}
                  {categoryTotal("shared", "income") +
                    categoryTotal("shared", "expense")}{" "}
                  · Net cash change: {total("shared")} · Your earnings balance:{" "}
                  {me.money}
                </p>
                <p>
                  Revenue: {categoryTotal("shared", "income")} · Spending:{" "}
                  {-categoryTotal("shared", "expense")}
                </p>
                <p>
                  Kitchen bill outstanding: {state.bill}. Tomorrow:{" "}
                  {state.upgrades.includes("kitchen")
                    ? state.upgrades.includes("insulation")
                      ? 5
                      : 8
                    : 0}
                  .
                </p>
              </article>
              {[...state.ledger].reverse().map((e: any, i: number) => (
                <div className="ledger-row" key={i}>
                  <small>
                    DAY {e.day} ·{" "}
                    {e.account === "shared"
                      ? "COOPERATIVE"
                      : state.players.find((p: any) => p.id === e.account)
                          ?.name}
                  </small>
                  <p>
                    {e.text}
                    <b>
                      {e.amount ? `${e.amount > 0 ? "+" : ""}${e.amount}` : "—"}
                    </b>
                  </p>
                </div>
              ))}
            </>
          )}
          <section className="radio">
            <h3>Neighborhood radio</h3>
            <p>Ask a friend about {district.name}.</p>
            <div className="ping-buttons">
              {pings.map((text) => (
                <button
                  key={text}
                  onClick={() => send("ping", { target: selected, text })}
                >
                  {text}
                </button>
              ))}
            </div>
            {[...state.radio]
              .reverse()
              .slice(0, 4)
              .map((r: any) => (
                <div className="radio-message" key={r.id}>
                  <b>{r.by}</b> · {r.text} at{" "}
                  {districts.find((d) => d.id === r.district)?.name}
                  <button onClick={() => send("ack", { target: r.id })}>
                    {r.ack ? `${r.ack}: on it ✓` : "On it"}
                  </button>
                </div>
              ))}
          </section>
        </aside>
      </main>
      <footer className="foot">
        <span>Built together. Learned by doing.</span>
        <a href="/credits.txt">Credits</a>
        <span>
          {state.players.filter((p: any) => p.online).length === 1
            ? "EMBER · solo helper available at Home"
            : "Your cooperative is here"}
        </span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
