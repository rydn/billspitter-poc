import { useState } from "react";
import type { Assignments, Bill } from "./types";
import { PEOPLE } from "./people";
import { analyzeBill } from "./api";
import { BillUpload } from "./components/BillUpload";
import { BillView } from "./components/BillView";
import { TotalsPanel } from "./components/TotalsPanel";
import "./App.css";

function App() {
  const [bill, setBill] = useState<Bill | null>(null);
  const [source, setSource] = useState<{ provider: string; model: string } | null>(
    null
  );
  const [assignments, setAssignments] = useState<Assignments>({});
  const [tipInput, setTipInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(file: File) {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeBill(file);
      setBill(result.bill);
      setSource({ provider: result.provider, model: result.model });
      setAssignments({});
      setTipInput("");
      if (result.bill.items.length === 0) {
        setError("No line items were detected. Try a clearer photo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBill(null);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleAssignment(itemId: string, personId: string) {
    setAssignments((prev) => {
      const current = prev[itemId] ?? [];
      const next = current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId];
      return { ...prev, [itemId]: next };
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bill Splitter</h1>
        <p>Photograph a bill, assign items to people, split the total.</p>
      </header>

      <BillUpload loading={loading} onAnalyze={handleAnalyze} />

      {error && <div className="error card">{error}</div>}

      {bill && bill.items.length > 0 && (
        <>
          {source && (
            <p className="source-badge">
              Read by{" "}
              <strong>
                {source.provider === "local" ? "local model" : "Gemini"}
              </strong>{" "}
              <code>{source.model}</code>
            </p>
          )}
          <BillView
            bill={bill}
            people={PEOPLE}
            assignments={assignments}
            onToggle={toggleAssignment}
          />
          <TotalsPanel
            bill={bill}
            people={PEOPLE}
            assignments={assignments}
            tipInput={tipInput}
            onTipChange={setTipInput}
          />
        </>
      )}
    </div>
  );
}

export default App;
