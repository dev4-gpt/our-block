/** Local Vite-only failure fixtures: not included in the production bundle. */
import React, { Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  InvitationPanel,
  WorldBoundary,
  WorldLoading,
  ActionFeedback,
} from "../src/Overlays.tsx";
import "../src/style.css";
const Slow = React.lazy(
  () => new Promise<{ default: React.ComponentType }>(() => {}),
);
const Broken = () => {
  throw Error("Deliberate rendering failure fixture");
};
function Fixture() {
  const [mode, setMode] = useState("none"),
    [map, setMap] = useState(false);
  const fallback = () => setMap(true);
  return (
    <main>
      <h1>Local failure fixtures</h1>
      <button
        onClick={() => {
          setMode("slow");
          setMap(false);
        }}
      >
        Simulate slow 3D module
      </button>
      <button
        onClick={() => {
          setMode("broken");
          setMap(false);
        }}
      >
        Simulate failed renderer
      </button>
      {map ? (
        <section>
          <h2>Accessible map fallback active</h2>
          <button>Walk to Market</button>
        </section>
      ) : mode === "slow" ? (
        <WorldBoundary
          key={mode}
          fallback={<p>Renderer failed</p>}
          onFail={fallback}
        >
          <Suspense fallback={<WorldLoading fallback={fallback} />}>
            <Slow />
          </Suspense>
        </WorldBoundary>
      ) : mode === "broken" ? (
        <WorldBoundary
          key={mode}
          fallback={<p>Renderer failed</p>}
          onFail={fallback}
        >
          <Broken />
        </WorldBoundary>
      ) : null}
      <ActionFeedback
        code="PENDING_APPROVAL"
        message="An existing request needs a decision."
        reconnect={() => {}}
        viewRequest={() => setMode("pending")}
        dismiss={() => {}}
      />
      <InvitationPanel
        invitation="https://example.invalid/?town=FIXTURE"
        code="FIXTURE"
        close={() => {}}
        copy={() => Promise.reject(Error("Permission denied fixture"))}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
