"use client";

import React, { useEffect, useMemo, useState } from "react";

// Minimal, single-file React app that you can paste into a Next.js page (app/page.tsx) or Vite's App.tsx.
// Features: add guests, assign tables, set table count & capacity, live per-table summary, search, and localStorage persistence.
// Nice-to-have later: drag-and-drop between tables, CSV import/export, printing.

// ----------------------
// Types
// ----------------------
interface Guest {
  id: string;
  name: string;
  table: number | null;
}

// ----------------------
// Utils
// ----------------------
const uid = () => Math.random().toString(36).slice(2, 10);

const STORAGE_KEY = "seating_planner_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: unknown) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// CSV Import functions
function parseCSV(csvText: string): string[] {
  const lines = csvText.trim().split('\n');
  const guests: string[] = [];
  
  for (const line of lines) {
    // Handle quoted fields and commas within quotes
    const fields = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    if (fields.length > 0 && fields[0]) {
      // Take the first field as the guest name, remove quotes
      let name = fields[0].replace(/^"|"$/g, '').trim();
      if (name) {
        guests.push(name);
      }
    }
  }
  
  return guests;
}

function parseExcel(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as string;
        if (!data) {
          reject(new Error('No data read from file'));
          return;
        }
        const lines = data.split('\n');
        const guests: string[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            // Split by tab (Excel TSV format) or comma
            const fields = trimmed.split(/\t|,/);
            if (fields.length > 0) {
              const name = fields[0].trim();
              if (name && name !== 'Name' && name !== 'Guest Name') {
                guests.push(name);
              }
            }
          }
        }
        
        resolve(guests);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ----------------------
// App
// ----------------------
export default function SeatingPlanner() {
  const [eventName, setEventName] = useState("My Event");
  const [tables, setTables] = useState(16); // number of tables
  const [capacity, setCapacity] = useState(10); // seats per table
  const [guests, setGuests] = useState<Guest[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [tableInput, setTableInput] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [importError, setImportError] = useState("");

  // Load persisted state
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setEventName(saved.eventName ?? "My Event");
      setTables(saved.tables ?? 16);
      setCapacity(saved.capacity ?? 10);
      setGuests(saved.guests ?? []);
    }
  }, []);

  // Persist on changes
  useEffect(() => {
    saveState({ eventName, tables, capacity, guests });
  }, [eventName, tables, capacity, guests]);

  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => g.name.toLowerCase().includes(q));
  }, [guests, search]);

  // Build table map
  const tableMap = useMemo(() => {
    const map = new Map<number, Guest[]>();
    for (let i = 1; i <= tables; i++) map.set(i, []);
    guests.forEach((g) => {
      if (typeof g.table === "number") {
        if (!map.has(g.table)) map.set(g.table, []);
        map.get(g.table)!.push(g);
      }
    });
    return map;
  }, [guests, tables]);

  const totalSeatsTaken = useMemo(() => guests.filter((g) => g.table !== null).length, [guests]);
  const totalSeats = tables * capacity;

  function addGuest(e?: React.FormEvent) {
    e?.preventDefault();
    const name = nameInput.trim();
    if (!name) return;

    let intendedTable: number | null = null;
    if (tableInput !== "") {
      const num = Number(tableInput);
      if (!Number.isNaN(num) && num >= 1 && num <= tables) intendedTable = num;
    }

    // Capacity check
    if (intendedTable) {
      const current = tableMap.get(intendedTable) ?? [];
      if (current.length >= capacity) {
        alert(`Table ${intendedTable} is full (${capacity}). Guest added without a table.`);
        intendedTable = null;
      }
    }

    const newGuest: Guest = { id: uid(), name, table: intendedTable };
    setGuests((prev) => [newGuest, ...prev]);
    setNameInput("");
    setTableInput("");
  }

  function assignTable(guestId: string, newTable: number | null) {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, table: newTable } : g))
    );
  }

  function removeGuest(id: string) {
    setGuests((prev) => prev.filter((g) => g.id !== id));
  }

  function clearAll() {
    if (confirm("Clear all guests and settings? This cannot be undone.")) {
      setGuests([]);
      // Keep event/tables/capacity—comment the next two lines to also reset
      // setTables(16);
      // setCapacity(10);
    }
  }

  function resetAssignments() {
    if (confirm("Remove all table assignments but keep the guest list?")) {
      setGuests((prev) => prev.map((g) => ({ ...g, table: null })));
    }
  }

  function handleFileImport(file: File) {
    setImportError("");
    
    if (file.type === "text/csv" || file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvText = e.target?.result as string;
          if (!csvText) {
            setImportError("Could not read CSV file");
            return;
          }
          const guestNames = parseCSV(csvText);
          if (guestNames.length === 0) {
            setImportError("No valid guest names found in CSV");
            return;
          }
          
          const newGuests = guestNames.map(name => ({
            id: uid(),
            name: name.trim(),
            table: null
          }));
          
          setGuests(prev => [...prev, ...newGuests]);
        } catch (error) {
          setImportError("Error parsing CSV file");
        }
      };
      reader.readAsText(file);
    } else {
      // Handle Excel/TSV files
      parseExcel(file)
        .then(guestNames => {
          if (guestNames.length === 0) {
            setImportError("No valid guest names found in file");
            return;
          }
          
          const newGuests = guestNames.map(name => ({
            id: uid(),
            name: name.trim(),
            table: null
          }));
          
          setGuests(prev => [...prev, ...newGuests]);
        })
        .catch(() => {
          setImportError("Error parsing file. Please ensure it's a valid CSV or Excel file.");
        });
    }
  }

  function handlePasteImport() {
    const pastedText = prompt("Paste your guest list (one name per line):");
    if (!pastedText) return;
    
    setImportError("");
    try {
      const guestNames = pastedText.split('\n')
        .map(line => line.trim())
        .filter(name => name.length > 0);
      
      if (guestNames.length === 0) {
        setImportError("No valid guest names found");
        return;
      }
      
      const newGuests = guestNames.map(name => ({
        id: uid(),
        name: name.trim(),
        table: null
      }));
      
      setGuests(prev => [...prev, ...newGuests]);
    } catch (error) {
      setImportError("Error processing pasted text");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Seating Planner</h1>
            <input
              className="mt-2 w-full max-w-sm rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Event name"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm">Tables</label>
              <input
                type="number"
                min={1}
                max={200}
                className="w-20 rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                value={tables}
                onChange={(e) => setTables(Math.max(1, Number(e.target.value) || 1))}
                title="Number of tables"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Capacity</label>
              <input
                type="number"
                min={1}
                max={50}
                className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
                title="Seats per table"
              />
            </div>
            <button
              onClick={resetAssignments}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
            >
              Clear assignments
            </button>
            <button
              onClick={clearAll}
              className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-100"
            >
              Reset all
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left: add + list */}
          <div className="lg:col-span-2">
            <form onSubmit={addGuest} className="rounded-2xl bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold">Add guest</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Guest name"
                  className="flex-1 min-w-[220px] rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                />
                <select
                  className="w-44 rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                  value={tableInput}
                  onChange={(e) =>
                    setTableInput(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">No table yet</option>
                  {Array.from({ length: tables }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Table {n}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-xl bg-black px-4 py-2 text-white shadow hover:opacity-90"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Import Section */}
            <div className="mt-4 rounded-2xl bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold">Import Guests</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileImport(file);
                      e.target.value = ''; // Reset input
                    }
                  }}
                  className="flex-1 min-w-[200px] rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                />
                <button
                  onClick={handlePasteImport}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-100"
                >
                  Paste List
                </button>
              </div>
              {importError && (
                <p className="mt-2 text-sm text-red-600">{importError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Supported formats: CSV, Excel (.xlsx, .xls), or plain text. First column should contain guest names.
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 shadow">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">Guest list ({guests.length})</h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search guests…"
                  className="w-full max-w-xs rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                />
              </div>

              {filteredGuests.length === 0 ? (
                <p className="text-sm text-gray-500">No guests yet.</p>
              ) : (
                <ul className="divide-y">
                  {filteredGuests.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="flex-1 min-w-[180px] font-medium">{g.name}</span>
                      <select
                        className="w-40 rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                        value={g.table ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") return assignTable(g.id, null);
                          const newTable = Number(val);
                          const current = tableMap.get(newTable) ?? [];
                          if (current.length >= capacity) {
                            alert(`Table ${newTable} is full (${capacity}).`);
                            return;
                          }
                          assignTable(g.id, newTable);
                        }}
                      >
                        <option value="">No table</option>
                        {Array.from({ length: tables }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            Table {n} ({(tableMap.get(n) ?? []).length}/{capacity})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeGuest(g.id)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: summary */}
          <aside className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-semibold">Summary</h2>
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-gray-100 p-3">
                <div className="text-gray-600">Total seats</div>
                <div className="text-xl font-bold">{totalSeats}</div>
              </div>
              <div className="rounded-xl bg-gray-100 p-3">
                <div className="text-gray-600">Seats taken</div>
                <div className="text-xl font-bold">{totalSeatsTaken}</div>
              </div>
              <div className="rounded-xl bg-gray-100 p-3">
                <div className="text-gray-600">Unassigned</div>
                <div className="text-xl font-bold">{guests.length - totalSeatsTaken}</div>
              </div>
              <div className="rounded-xl bg-gray-100 p-3">
                <div className="text-gray-600">Guests</div>
                <div className="text-xl font-bold">{guests.length}</div>
              </div>
            </div>
            <div className="max-h-[50vh] overflow-auto pr-1">
              <ul className="space-y-2">
                {Array.from({ length: tables }, (_, i) => i + 1).map((n) => {
                  const list = tableMap.get(n) ?? [];
                  const full = list.length >= capacity;
                  return (
                    <li key={n} className="rounded-xl border border-gray-200 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="font-semibold">Table {n}</div>
                        <div className={`text-sm ${full ? "text-red-600" : "text-gray-600"}`}>
                          {list.length}/{capacity} {full ? "(Full)" : ""}
                        </div>
                      </div>
                      {list.length === 0 ? (
                        <div className="text-sm text-gray-500">—</div>
                      ) : (
                        <div className="text-sm text-gray-800">
                          {list.map((g) => g.name).join(", ")}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </section>

        <footer className="mt-8 text-center text-xs text-gray-500">
          Built for quick planning. Data saves in your browser only.
        </footer>
      </div>
    </div>
  );
}
