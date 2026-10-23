import test from "node:test";
import assert from "node:assert/strict";
import { decisionNotice } from "../src/decision-notice.ts";
test("a new purchase never announces approval of a different historical request", () => {
  const pending = [{ id: "seed", by: "p1", target: "seed" }];
  const decisions = [{ id: "old", text: "Connector approved. 18 credits committed." }];
  assert.match(decisionNotice([], { you: "p1", pending, decisions })!, /waiting.*No credits spent/);
  assert.equal(decisionNotice(pending, { you: "p1", pending, decisions }), undefined);
  assert.equal(decisionNotice(pending, { you: "p1", pending: [], decisions: [...decisions, { id: "seed", text: "Seeds declined. No spending." }] }), "Seeds declined. No spending.");
});
