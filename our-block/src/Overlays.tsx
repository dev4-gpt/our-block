import React, { useEffect, useRef } from "react";
export function ReviewSheet({
  review,
  funds,
  personal,
  needsApproval,
  busy,
  close,
  confirm,
}: any) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="review-sheet"
      aria-labelledby="purchase-title"
      onCancel={close}
    >
      <h2 id="purchase-title">Review {review.name}</h2>
      <p>Quantity: {review.qty || 1}</p>
      <p>{review.detail}</p>
      <dl>
        <dt>Total</dt>
        <dd>{review.price ?? review.cost} credits</dd>
        <dt>Pay using</dt>
        <dd>{personal ? "My earnings" : "Cooperative funds"}</dd>
        <dt>Balance after purchase</dt>
        <dd>{funds - (review.price ?? review.cost)} credits</dd>
      </dl>
      <p>
        {review.kind === "buy"
          ? "Unused purchased supplies can be returned to the original payer. Used units cannot be refunded."
          : "This improvement is a commitment; it cannot be returned."}
      </p>
      {needsApproval && (
        <p>
          No funds move until another resident approves. You can cancel the
          pending request.
        </p>
      )}
      {funds < (review.price ?? review.cost) && (
        <p role="alert">
          Not enough credits in this account. Free jobs remain available at
          Home, Market and Hall.
        </p>
      )}
      <button
        disabled={busy || funds < (review.price ?? review.cost)}
        onClick={confirm}
      >
        {busy
          ? "Sending…"
          : needsApproval
            ? "Request teammate approval"
            : `Buy for ${review.price ?? review.cost} credits`}
      </button>
      <button onClick={close}>Back to shop</button>
    </dialog>
  );
}
export class WorldBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function WorldLoading({ fallback }: { fallback: () => void }) {
  const [slow, setSlow] = React.useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="loading" role="status">
      Loading the neighborhood…
      {slow && (
        <>
          <p>The 3D view is taking longer than expected.</p>
          <button onClick={fallback}>Play using accessible map</button>
        </>
      )}
    </div>
  );
}

export function InvitationPanel({
  invitation,
  code,
  close,
  copy = (text: string) =>
    navigator.clipboard?.writeText(text) ||
    Promise.reject(Error("Clipboard unavailable")),
}: {
  invitation: string;
  code: string;
  close: () => void;
  copy?: (text: string) => Promise<void>;
}) {
  const [status, setStatus] = React.useState("");
  return (
    <section
      id="town-invitation"
      className="invitation"
      aria-label="Invite friends"
    >
      <h2>Join this town</h2>
      <p>
        Open this link on the other device and enter a different nickname. Or
        open the game and enter town code <strong>{code}</strong>.
      </p>
      <label>
        Invitation link
        <input
          aria-label="Invitation link"
          readOnly
          value={invitation}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <div className="invitation-actions">
        <button
          onClick={async () => {
            try {
              await copy(invitation);
              setStatus(
                "Invitation link copied. Paste it on the other device.",
              );
            } catch {
              setStatus(
                "Copy is unavailable in this browser. Press and hold the link above to copy it, or enter the town code on the other device.",
              );
            }
          }}
        >
          Copy link
        </button>
        {typeof navigator.share === "function" && (
          <button
            onClick={async () => {
              try {
                await navigator.share({
                  title: "Join my OUR BLOCK town",
                  url: invitation,
                });
                setStatus(
                  "Share sheet closed. Your friend can join using the link or town code.",
                );
              } catch (error) {
                setStatus(
                  error instanceof Error && error.name === "AbortError"
                    ? "Sharing canceled. You can still copy the link or use the town code."
                    : "Sharing is unavailable. Copy the link or use the town code instead.",
                );
              }
            }}
          >
            Share link
          </button>
        )}
        <button onClick={close}>Close invitation</button>
      </div>
      <p role="status">{status}</p>
    </section>
  );
}

export function ActionFeedback({
  code,
  message,
  reconnect,
  viewRequest,
  dismiss,
}: {
  code: string;
  message: string;
  reconnect: () => void;
  viewRequest: () => void;
  dismiss: () => void;
}) {
  return (
    <div role="alert" className="error">
      <p>{message}</p>
      {code === "CONNECTION" && <button onClick={reconnect}>Reconnect</button>}
      {code === "PENDING_APPROVAL" && (
        <button onClick={viewRequest}>View request</button>
      )}
      {code === "STALE" && (
        <p>
          The town view has been refreshed. Review the current details before
          choosing again.
        </p>
      )}
      {code === "STORAGE" && (
        <p>
          Saving could not be confirmed. Review the latest ledger and inventory
          before making another purchase.
        </p>
      )}
      <button onClick={dismiss}>Dismiss error</button>
    </div>
  );
}
