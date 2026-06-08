import type { Assignments, Bill, Person } from "./types";

export interface PersonTotal {
  person: Person;
  /** Sum of this person's share of assigned items (tax already included). */
  subtotal: number;
  /** Proportional share of the tip. */
  tip: number;
  /** subtotal + tip. */
  total: number;
}

export interface BillTotals {
  perPerson: PersonTotal[];
  /** Value of items that have no assignee (the remainder). */
  unassigned: number;
  /** Sum of all assigned item shares (before tip). */
  assignedSubtotal: number;
  tip: number;
  /** assignedSubtotal + unassigned (items total). */
  itemsTotal: number;
  /** assignedSubtotal + tip + unassigned. */
  grandTotal: number;
}

/**
 * Compute per-person totals.
 *
 * - Each assigned item is split evenly across its assignees.
 * - Tax is already included in item prices.
 * - The tip is distributed proportionally to each person's subtotal.
 * - Items with no assignee accumulate into `unassigned`.
 */
export function computeTotals(
  bill: Bill,
  people: Person[],
  assignments: Assignments,
  tip: number
): BillTotals {
  const subtotals = new Map<string, number>();
  people.forEach((p) => subtotals.set(p.id, 0));

  let unassigned = 0;
  let assignedSubtotal = 0;

  for (const item of bill.items) {
    const assignees = assignments[item.id] ?? [];
    if (assignees.length === 0) {
      unassigned += item.totalPrice;
      continue;
    }
    const share = item.totalPrice / assignees.length;
    for (const personId of assignees) {
      subtotals.set(personId, (subtotals.get(personId) ?? 0) + share);
      assignedSubtotal += share;
    }
  }

  const safeTip = Number.isFinite(tip) && tip > 0 ? tip : 0;

  const perPerson: PersonTotal[] = people.map((person) => {
    const subtotal = subtotals.get(person.id) ?? 0;
    const tipShare =
      assignedSubtotal > 0 ? (subtotal / assignedSubtotal) * safeTip : 0;
    return {
      person,
      subtotal,
      tip: tipShare,
      total: subtotal + tipShare,
    };
  });

  return {
    perPerson,
    unassigned,
    assignedSubtotal,
    tip: safeTip,
    itemsTotal: assignedSubtotal + unassigned,
    grandTotal: assignedSubtotal + safeTip + unassigned,
  };
}
