import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionFeedback } from "../src/Overlays.tsx";
for (const code of [
  "RULE",
  "PENDING_APPROVAL",
  "STALE",
  "STORAGE",
  "DISTANCE",
  "INSUFFICIENT_FUNDS",
  "INVENTORY_FULL",
])
  test(`${code} feedback never proposes a reconnect for a gameplay failure`, () => {
    const html = renderToStaticMarkup(
      <ActionFeedback
        code={code}
        message="Decision failed"
        reconnect={() => {}}
        viewRequest={() => {}}
        dismiss={() => {}}
      />,
    );
    assert(!html.includes(">Reconnect<"));
    assert(html.includes('role="alert"'));
    if (code === "PENDING_APPROVAL") assert(html.includes("View request"));
    if (code === "STALE") assert(html.includes("Review the current details"));
  });
test("connection failure offers reconnect", () =>
  assert(
    renderToStaticMarkup(
      <ActionFeedback
        code="CONNECTION"
        message="Offline"
        reconnect={() => {}}
        viewRequest={() => {}}
        dismiss={() => {}}
      />,
    ).includes(">Reconnect<"),
  ));
