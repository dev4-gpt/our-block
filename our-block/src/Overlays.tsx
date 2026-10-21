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
