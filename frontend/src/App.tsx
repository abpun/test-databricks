import { useState, useEffect } from "react";
import "./App.css";
import FileUpload from "./FileUpload";

interface RowRecord {
  [key: string]: string | number | boolean | null;
}

interface TableResponse {
  rows: RowRecord[];
  schema: Array<{ name: string; type: string }>;
}

function App() {
  const [balanceRows, setBalanceRows] = useState<RowRecord[]>([]);
  const [transactionRows, setTransactionRows] = useState<RowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getRowsFromResponse = (response: any): RowRecord[] => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.rows)) return response.rows;
    return [];
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/databricks/balance?limit=20").then((res) => res.json()),
      fetch("/api/databricks/transactions?limit=20").then((res) => res.json()),
    ])
      .then(([balanceResponse, transactionResponse]) => {
        setBalanceRows(getRowsFromResponse(balanceResponse));
        setTransactionRows(getRowsFromResponse(transactionResponse));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching Databricks data:", err);
        setError("Unable to load Databricks data.");
        setLoading(false);
      });
  }, []);

  const columnsFromRows = (rows: RowRecord[]) => {
    const keys = new Set<string>();

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });

    return Array.from(keys);
  };

  const formatCell = (value: string | number | boolean | null) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime()) && value.includes("T")) {
        return date.toISOString().split("T")[0];
      }
      return value;
    }
    return value;
  };

  const renderTable = (title: string, rows: RowRecord[]) => {
    const columns = columnsFromRows(rows);

    return (
      <section className="table-card">
        <h2>{title}</h2>

        {rows.length === 0 ? (
          <p>No rows returned.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${title}-${rowIndex}`}>
                    {columns.map((column) => (
                      <td key={`${title}-${rowIndex}-${column}`}>
                        {formatCell(
                          row[column] as string | number | boolean | null,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Databricks SQL Data</h1>

        {loading ? (
          <p>Loading table data...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="content">
            <FileUpload />
            {renderTable("vw_bsar_cumulative_balance", balanceRows)}
            {renderTable("vw_bsar_acdoca_transactional", transactionRows)}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
