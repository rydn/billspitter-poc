import { useMemo } from "react";
import type { Assignments, Bill, Person } from "../types";
import { computeTotals } from "../totals";
import { formatMoney } from "../format";

interface TotalsPanelProps {
  bill: Bill;
  people: Person[];
  assignments: Assignments;
  tipInput: string;
  onTipChange: (value: string) => void;
}

/**
 * Shows the tip control and the per-person breakdown, including any
 * unassigned remainder and a reconciliation against the bill total.
 */
export function TotalsPanel({
  bill,
  people,
  assignments,
  tipInput,
  onTipChange,
}: TotalsPanelProps) {
  const tip = Number(tipInput) || 0;
  const totals = useMemo(
    () => computeTotals(bill, people, assignments, tip),
    [bill, people, assignments, tip]
  );

  const { currency } = bill;

  function applyTipPercent(percent: number) {
    const value = (totals.assignedSubtotal * percent) / 100;
    onTipChange(value ? value.toFixed(2) : "");
  }

  return (
    <div className="totals card">
      <h2>3. Totals</h2>

      <div className="tip-control">
        <label htmlFor="tip">Tip</label>
        <input
          id="tip"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={tipInput}
          placeholder="0.00"
          onChange={(e) => onTipChange(e.target.value)}
        />
        <div className="tip-presets">
          {[10, 15, 20].map((p) => (
            <button type="button" key={p} onClick={() => applyTipPercent(p)}>
              {p}%
            </button>
          ))}
          <button type="button" onClick={() => onTipChange("")}>
            Clear
          </button>
        </div>
      </div>

      <table className="totals-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Items</th>
            <th>Tip</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {totals.perPerson.map((pt) => (
            <tr key={pt.person.id}>
              <td>{pt.person.name}</td>
              <td>{formatMoney(pt.subtotal, currency)}</td>
              <td>{formatMoney(pt.tip, currency)}</td>
              <td className="strong">{formatMoney(pt.total, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {totals.unassigned > 0 && (
            <tr className="unassigned">
              <td>Unassigned</td>
              <td>{formatMoney(totals.unassigned, currency)}</td>
              <td>—</td>
              <td className="strong">{formatMoney(totals.unassigned, currency)}</td>
            </tr>
          )}
          <tr className="grand">
            <td>Grand total</td>
            <td>{formatMoney(totals.itemsTotal, currency)}</td>
            <td>{formatMoney(totals.tip, currency)}</td>
            <td className="strong">{formatMoney(totals.grandTotal, currency)}</td>
          </tr>
        </tfoot>
      </table>

      {bill.total > 0 && (
        <p className="reconcile">
          Bill printed total: {formatMoney(bill.total, currency)} · Items total:{" "}
          {formatMoney(totals.itemsTotal, currency)}
          {Math.abs(bill.total - totals.itemsTotal) > 0.01 && (
            <span className="warn"> (mismatch — check extracted items)</span>
          )}
        </p>
      )}
    </div>
  );
}
