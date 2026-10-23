/** Announce the request that changed, never an unrelated historical decision. */
export function decisionNotice(previous: { id: string }[], state: {
  you: string; pending: { id: string; by: string; target: string }[];
  decisions?: { id: string; text: string }[];
}) {
  const added = state.pending.find(q => q.by === state.you && !previous.some(p => p.id === q.id));
  if (added) return `Request for ${added.target || "service payment"} is waiting for teammate approval. No credits spent.`;
  const resolved = previous.find(q => !state.pending.some(p => p.id === q.id));
  if (resolved) return state.decisions?.find(d => d.id === resolved.id)?.text || "Request resolved. Review the latest balance.";
}
