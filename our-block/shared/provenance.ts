/** Server-only refundable lots. Inventory counts remain the gameplay source of truth. */
export type Lot = {
  id: string;
  offer: string;
  item: string;
  qty: number;
  unitPaid: number;
  payer: string;
  location: string;
  purchasedRevision?: number;
};
type InventoryTown = {
  lots: Lot[];
  players: { id: string; bag: Record<string, number> }[];
  storage: Record<string, number>;
};
export const inventoryAt = (t: InventoryTown, location: string) =>
  location === "storage"
    ? t.storage
    : t.players.find((p) => p.id === location)!.bag;
// Existing schema-3 IDs contain the original purchase revision, retained across split moves.
const purchaseOrder = (l: Lot) =>
  l.purchasedRevision ?? Number(/^lot-(\d+)-/.exec(l.id)?.[1] || 0);
/** Free/legacy units are consumed first, then refundable units oldest first. Moves preserve payer. */
export function debitLots(
  t: InventoryTown,
  location: string,
  item: string,
  qty: number,
  destination?: string,
) {
  const lots = t.lots
    .filter((l) => l.location === location && l.item === item && l.qty > 0)
    .sort((a, b) => purchaseOrder(a) - purchaseOrder(b));
  let paid = Math.max(
    0,
    qty -
      Math.max(
        0,
        (inventoryAt(t, location)[item] || 0) -
          lots.reduce((n, l) => n + l.qty, 0),
      ),
  );
  for (const lot of lots) {
    const n = Math.min(paid, lot.qty);
    if (!n) continue;
    lot.qty -= n;
    paid -= n;
    if (destination)
      t.lots.push({
        ...lot,
        id: `${lot.id}/m${t.lots.length}`,
        qty: n,
        location: destination,
      });
  }
  t.lots = t.lots.filter((l) => l.qty > 0);
}
export function refundPlan(
  t: InventoryTown,
  location: string,
  offer: string,
  qty: number,
) {
  let left = qty;
  const result: { lot: Lot; qty: number; amount: number }[] = [];
  for (const lot of t.lots
    .filter((l) => l.location === location && l.offer === offer && l.qty > 0)
    .sort((a, b) => purchaseOrder(a) - purchaseOrder(b))) {
    const n = Math.min(left, lot.qty);
    if (n) result.push({ lot, qty: n, amount: n * lot.unitPaid });
    left -= n;
    if (!left) return result;
  }
  return null;
}
