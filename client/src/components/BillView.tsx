import type { Assignments, Bill, Person } from "../types";
import { formatMoney } from "../format";

interface BillViewProps {
  bill: Bill;
  people: Person[];
  assignments: Assignments;
  onToggle: (itemId: string, personId: string) => void;
}

/**
 * Renders each line item with a row of toggleable person chips. Selecting
 * multiple people splits that item evenly between them.
 */
export function BillView({ bill, people, assignments, onToggle }: BillViewProps) {
  return (
    <div className="bill card">
      <h2>2. Assign items</h2>
      {bill.merchant && <p className="merchant">{bill.merchant}</p>}

      <ul className="items">
        {bill.items.map((item) => {
          const assignedTo = assignments[item.id] ?? [];
          const splitNote =
            assignedTo.length > 1
              ? ` · ${formatMoney(item.totalPrice / assignedTo.length, bill.currency)} each`
              : "";
          return (
            <li key={item.id} className="item">
              <div className="item-header">
                <span className="item-name">
                  {item.quantity > 1 && (
                    <span className="qty">{item.quantity}× </span>
                  )}
                  {item.name}
                </span>
                <span className="item-price">
                  {formatMoney(item.totalPrice, bill.currency)}
                  <small>{splitNote}</small>
                </span>
              </div>
              <div className="chips">
                {people.map((person) => {
                  const active = assignedTo.includes(person.id);
                  return (
                    <button
                      type="button"
                      key={person.id}
                      className={`chip${active ? " chip--active" : ""}`}
                      aria-pressed={active}
                      onClick={() => onToggle(item.id, person.id)}
                    >
                      {person.name}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
