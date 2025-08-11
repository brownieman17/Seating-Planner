"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Rnd } from 'react-rnd';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

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
  notes: string;
  tags: string[];
}

interface Table {
  id: string;
  name: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  shape: 'round' | 'rect';
  rotation: number;
  locked: boolean;
  notes?: string;
  guests: string[]; // Array of guest IDs
}

interface Fixture {
  id: string;
  type: 'door' | 'window' | 'stage' | 'dance-floor' | 'dj-booth' | 'pillar' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  label?: string;
  color?: string;
}

interface RoomSettings {
  width: number;
  height: number;
  background: string;
  gridEnabled: boolean;
  gridSize: number;
  snapToGrid: boolean;
  allowOverlap: boolean;
  scale: number; // 1ft = scale pixels
}

interface CanvasState {
  tables: Table[];
  fixtures: Fixture[];
  selectedItem: { type: 'table' | 'fixture'; id: string } | null;
  draggingGuest: string | null;
  dragOffset: { x: number; y: number };
  mode: 'layout' | 'assign';
  zoom: number;
  pan: { x: number; y: number };
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
  const sensors = useSensors(useSensor(PointerSensor));
  const [eventName, setEventName] = useState("My Event");
  const [tables, setTables] = useState(16); // number of tables
  const [capacity, setCapacity] = useState(10); // seats per table
  const [guests, setGuests] = useState<Guest[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [tableInput, setTableInput] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [importError, setImportError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [editingGuest, setEditingGuest] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    tables: [],
    fixtures: [],
    selectedItem: null,
    draggingGuest: null,
    dragOffset: { x: 0, y: 0 },
    mode: 'layout',
    zoom: 1,
    pan: { x: 0, y: 0 }
  });
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    width: 1200,
    height: 800,
    background: '#f8fafc',
    gridEnabled: true,
    gridSize: 10,
    snapToGrid: true,
    allowOverlap: false,
    scale: 20 // 1ft = 20px
  });

  // Load persisted state
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setEventName(saved.eventName ?? "My Event");
      setTables(saved.tables ?? 16);
      setCapacity(saved.capacity ?? 10);
      setGuests(saved.guests ?? []);
      setCanvasState(saved.canvasState ?? { 
        tables: [], 
        fixtures: [],
        selectedItem: null, 
        draggingGuest: null, 
        dragOffset: { x: 0, y: 0 },
        mode: 'layout',
        zoom: 1,
        pan: { x: 0, y: 0 }
      });
      setRoomSettings(saved.roomSettings ?? {
        width: 1200,
        height: 800,
        background: '#f8fafc',
        gridEnabled: true,
        gridSize: 10,
        snapToGrid: true,
        allowOverlap: false,
        scale: 20
      });
    }
  }, []);

  // Persist on changes
  useEffect(() => {
    saveState({ eventName, tables, capacity, guests, canvasState, roomSettings });
  }, [eventName, tables, capacity, guests, canvasState, roomSettings]);

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

    const newGuest: Guest = { id: uid(), name, table: intendedTable, notes: "", tags: [] };
    setGuests((prev) => [newGuest, ...prev]);
    setNameInput("");
    setTableInput("");
  }

  function assignTable(guestId: string, newTable: number | null) {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, table: newTable } : g))
    );
  }

  function updateGuestNotes(guestId: string, notes: string) {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, notes } : g))
    );
  }

  function updateGuestTags(guestId: string, tags: string[]) {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, tags } : g))
    );
  }

  function startEditing(guest: Guest) {
    setEditingGuest(guest.id);
    setEditingNotes(guest.notes);
    setEditingTags(guest.tags.join(', '));
  }

  function saveEditing() {
    if (editingGuest) {
      const tags = editingTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      updateGuestNotes(editingGuest, editingNotes);
      updateGuestTags(editingGuest, tags);
      setEditingGuest(null);
      setEditingNotes("");
      setEditingTags("");
    }
  }

  function cancelEditing() {
    setEditingGuest(null);
    setEditingNotes("");
    setEditingTags("");
  }

  // Canvas utility functions
  function createTable(x: number, y: number, shape: 'round' | 'rect' = 'round'): Table {
    const tableNumber = canvasState.tables.length + 1;
    return {
      id: uid(),
      name: `Table ${tableNumber}`,
      number: tableNumber,
      x,
      y,
      width: shape === 'round' ? 120 : 140,
      height: shape === 'round' ? 120 : 100,
      capacity: 8,
      shape,
      rotation: 0,
      locked: false,
      guests: []
    };
  }

  function addTableToCanvas(x: number, y: number, shape: 'round' | 'rect' = 'round') {
    const newTable = createTable(x, y, shape);
    setCanvasState(prev => ({
      ...prev,
      tables: [...prev.tables, newTable]
    }));
  }

  function updateTablePosition(tableId: string, x: number, y: number) {
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(table => 
        table.id === tableId ? { ...table, x, y } : table
      )
    }));
  }

  function updateTableCapacity(tableId: string, capacity: number) {
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(table => 
        table.id === tableId ? { ...table, capacity } : table
      )
    }));
  }

  function removeTableFromCanvas(tableId: string) {
    // Move guests back to unassigned
    const table = canvasState.tables.find(t => t.id === tableId);
    if (table) {
      setGuests(prev => prev.map(guest => 
        table.guests.includes(guest.id) ? { ...guest, table: null } : guest
      ));
    }
    
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.filter(t => t.id !== tableId)
    }));
  }

  function addGuestToTable(guestId: string, tableId: string) {
    const table = canvasState.tables.find(t => t.id === tableId);
    if (!table) return;

    // Check capacity
    if (table.guests.length >= table.capacity) {
      alert(`Table ${table.number} is full (${table.capacity}).`);
      return;
    }

    // Remove guest from any other table first
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(t => ({
        ...t,
        guests: t.guests.filter(g => g !== guestId)
      }))
    }));

    // Add guest to new table
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(t => 
        t.id === tableId ? { ...t, guests: [...t.guests, guestId] } : t
      )
    }));

    // Update guest's table assignment
    setGuests(prev => prev.map(g => 
      g.id === guestId ? { ...g, table: table.number } : g
    ));
  }

  function removeGuestFromTable(guestId: string) {
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(t => ({
        ...t,
        guests: t.guests.filter(g => g !== guestId)
      }))
    }));

    setGuests(prev => prev.map(g => 
      g.id === guestId ? { ...g, table: null } : g
    ));
  }

  function handleCanvasClick(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Add a round table at click position
    addTableToCanvas(x, y, 'round');
  }

  function handleTableDragStart(e: React.MouseEvent, tableId: string) {
    e.stopPropagation();
    setCanvasState(prev => ({ ...prev, selectedItem: { type: 'table', id: tableId } }));
  }

  function handleTableDrag(e: React.MouseEvent) {
    if (!canvasState.selectedItem || canvasState.selectedItem.type !== 'table') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    updateTablePosition(canvasState.selectedItem.id, x, y);
  }

  function handleTableDragEnd() {
    setCanvasState(prev => ({ ...prev, selectedItem: null }));
  }

  function handleGuestDragStart(e: React.MouseEvent, guestId: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setCanvasState(prev => ({
      ...prev,
      draggingGuest: guestId,
      dragOffset: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }));
  }

  function handleGuestDrag(e: React.MouseEvent) {
    if (!canvasState.draggingGuest) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if guest is over a table
    const tableUnder = canvasState.tables.find(table => {
      const tableCenterX = table.x + table.width / 2;
      const tableCenterY = table.y + table.height / 2;
      const distance = Math.sqrt(
        Math.pow(x - tableCenterX, 2) + Math.pow(y - tableCenterY, 2)
      );
      return distance < Math.max(table.width, table.height) / 2;
    });
    
    if (tableUnder) {
      addGuestToTable(canvasState.draggingGuest, tableUnder.id);
    }
  }

  function handleGuestDragEnd() {
    setCanvasState(prev => ({ ...prev, draggingGuest: null }));
  }

  // Enhanced room designer functions
  function snapToGrid(value: number): number {
    if (!roomSettings.snapToGrid) return value;
    return Math.round(value / roomSettings.gridSize) * roomSettings.gridSize;
  }

  function createFixture(type: Fixture['type'], x: number, y: number): Fixture {
    const defaultSizes = {
      door: { width: 40, height: 80 },
      window: { width: 60, height: 40 },
      stage: { width: 200, height: 120 },
      'dance-floor': { width: 150, height: 150 },
      'dj-booth': { width: 80, height: 60 },
      pillar: { width: 30, height: 30 },
      text: { width: 100, height: 40 }
    };

    return {
      id: uid(),
      type,
      x: snapToGrid(x),
      y: snapToGrid(y),
      width: defaultSizes[type].width,
      height: defaultSizes[type].height,
      rotation: 0,
      locked: false,
      label: type === 'text' ? 'Text Label' : undefined,
      color: type === 'text' ? '#000000' : undefined
    };
  }

  function addFixtureToCanvas(type: Fixture['type'], x: number, y: number) {
    const newFixture = createFixture(type, x, y);
    setCanvasState(prev => ({
      ...prev,
      fixtures: [...prev.fixtures, newFixture]
    }));
  }

  function updateFixturePosition(fixtureId: string, x: number, y: number) {
    setCanvasState(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(fixture => 
        fixture.id === fixtureId ? { ...fixture, x: snapToGrid(x), y: snapToGrid(y) } : fixture
      )
    }));
  }

  function updateFixtureSize(fixtureId: string, width: number, height: number) {
    setCanvasState(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(fixture => 
        fixture.id === fixtureId ? { ...fixture, width: snapToGrid(width), height: snapToGrid(height) } : fixture
      )
    }));
  }

  function updateFixtureRotation(fixtureId: string, rotation: number) {
    setCanvasState(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(fixture => 
        fixture.id === fixtureId ? { ...fixture, rotation } : fixture
      )
    }));
  }

  function removeFixtureFromCanvas(fixtureId: string) {
    setCanvasState(prev => ({
      ...prev,
      fixtures: prev.fixtures.filter(f => f.id !== fixtureId)
    }));
  }

  function toggleFixtureLock(fixtureId: string) {
    setCanvasState(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(fixture => 
        fixture.id === fixtureId ? { ...fixture, locked: !fixture.locked } : fixture
      )
    }));
  }

  function updateTableRotation(tableId: string, rotation: number) {
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(table => 
        table.id === tableId ? { ...table, rotation } : table
      )
    }));
  }

  function toggleTableLock(tableId: string) {
    setCanvasState(prev => ({
      ...prev,
      tables: prev.tables.map(table => 
        table.id === tableId ? { ...table, locked: !table.locked } : table
      )
    }));
  }

  function exportLayoutToJSON() {
    const layoutData = {
      roomSettings,
      tables: canvasState.tables,
      fixtures: canvasState.fixtures,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(layoutData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_layout.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function importLayoutFromJSON(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const layoutData = JSON.parse(e.target?.result as string);
        if (layoutData.roomSettings) setRoomSettings(layoutData.roomSettings);
        if (layoutData.tables) setCanvasState(prev => ({ ...prev, tables: layoutData.tables }));
        if (layoutData.fixtures) setCanvasState(prev => ({ ...prev, fixtures: layoutData.fixtures }));
      } catch (error) {
        alert('Error importing layout file');
      }
    };
    reader.readAsText(file);
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setCanvasState(prev => ({ ...prev, draggingGuest: active.id as string }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && over.id) {
      // Check if dropping on a table
      const table = canvasState.tables.find(t => t.id === over.id);
      if (table) {
        addGuestToTable(active.id as string, table.id);
      }
    }
    
    setCanvasState(prev => ({ ...prev, draggingGuest: null }));
  }

  function handleKeyboardNavigation(e: React.KeyboardEvent) {
    if (!canvasState.selectedItem) return;
    
    const moveAmount = e.shiftKey ? 10 : 1;
    const { selectedItem } = canvasState;
    
    if (selectedItem.type === 'table') {
      const table = canvasState.tables.find(t => t.id === selectedItem.id);
      if (!table || table.locked) return;
      
      switch (e.key) {
        case 'ArrowUp':
          updateTablePosition(selectedItem.id, table.x, table.y - moveAmount);
          break;
        case 'ArrowDown':
          updateTablePosition(selectedItem.id, table.x, table.y + moveAmount);
          break;
        case 'ArrowLeft':
          updateTablePosition(selectedItem.id, table.x - moveAmount, table.y);
          break;
        case 'ArrowRight':
          updateTablePosition(selectedItem.id, table.x + moveAmount, table.y);
          break;
        case 'Delete':
          removeTableFromCanvas(selectedItem.id);
          setCanvasState(prev => ({ ...prev, selectedItem: null }));
          break;
      }
    } else if (selectedItem.type === 'fixture') {
      const fixture = canvasState.fixtures.find(f => f.id === selectedItem.id);
      if (!fixture || fixture.locked) return;
      
      switch (e.key) {
        case 'ArrowUp':
          updateFixturePosition(selectedItem.id, fixture.x, fixture.y - moveAmount);
          break;
        case 'ArrowDown':
          updateFixturePosition(selectedItem.id, fixture.x, fixture.y + moveAmount);
          break;
        case 'ArrowLeft':
          updateFixturePosition(selectedItem.id, fixture.x - moveAmount, fixture.y);
          break;
        case 'ArrowRight':
          updateFixturePosition(selectedItem.id, fixture.x + moveAmount, fixture.y);
          break;
        case 'Delete':
          removeFixtureFromCanvas(selectedItem.id);
          setCanvasState(prev => ({ ...prev, selectedItem: null }));
          break;
      }
    }
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
            table: null,
            notes: "",
            tags: []
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
            table: null,
            notes: "",
            tags: []
          }));
          
          setGuests(prev => [...prev, ...newGuests]);
        })
        .catch(() => {
          setImportError("Error parsing file. Please ensure it's a valid CSV or Excel file.");
        });
    }
  }

  function checkForDuplicates(newNames: string[]): string[] {
    const duplicates: string[] = [];
    const existingNames = guests.map(g => g.name.toLowerCase());
    
    newNames.forEach(name => {
      const nameLower = name.toLowerCase();
      
      // Check for exact matches
      if (existingNames.includes(nameLower)) {
        duplicates.push(`${name} (exact match)`);
        return;
      }
      
      // Check for near-duplicates (similar names)
      existingNames.forEach(existing => {
        if (existing !== nameLower) {
          // Simple similarity check - you could make this more sophisticated
          const similarity = calculateSimilarity(nameLower, existing);
          if (similarity > 0.8) { // 80% similarity threshold
            duplicates.push(`${name} (similar to "${guests.find(g => g.name.toLowerCase() === existing)?.name}")`);
          }
        }
      });
    });
    
    return [...new Set(duplicates)]; // Remove duplicates
  }

  function calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  function levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  function exportToCSV() {
    const csvContent = [
      'Name,Table,Notes,Tags',
      ...guests.map(guest => {
        const tableName = guest.table ? `Table ${guest.table}` : 'Unassigned';
        const notes = guest.notes.replace(/"/g, '""'); // Escape quotes
        const tags = guest.tags.join(';');
        return `"${guest.name}","${tableName}","${notes}","${tags}"`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_seating_plan.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function handlePasteImport() {
    const pastedText = prompt("Paste your guest list (one name per line):\n\nYou can use @table shorthand: \"Sam Lee @7\" to assign to table 7");
    if (!pastedText) return;
    
    setImportError("");
    try {
      const lines = pastedText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (lines.length === 0) {
        setImportError("No valid guest names found");
        return;
      }
      
      const names = lines.map(line => {
        // Check for @table shorthand
        const tableMatch = line.match(/@(\d+)$/);
        let name = line.trim();
        let tableNumber: number | null = null;
        
        if (tableMatch) {
          name = line.replace(/@\d+$/, '').trim();
          const tableNum = parseInt(tableMatch[1]);
          if (tableNum >= 1 && tableNum <= tables) {
            tableNumber = tableNum;
          }
        }
        
        return { name, tableNumber };
      });
      
      // Check for duplicates
      const duplicates = checkForDuplicates(names.map(n => n.name));
      if (duplicates.length > 0) {
        setDuplicateWarning(duplicates);
        const proceed = confirm(`Potential duplicates found:\n\n${duplicates.join('\n')}\n\nContinue anyway?`);
        if (!proceed) return;
      }
      
      const newGuests = names.map(({ name, tableNumber }) => ({
        id: uid(),
        name: name,
        table: tableNumber,
        notes: "",
        tags: []
      }));
      
      setGuests(prev => [...prev, ...newGuests]);
      setDuplicateWarning([]);
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
              onClick={() => setShowCanvas(!showCanvas)}
              className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 shadow-sm hover:bg-blue-100"
            >
              {showCanvas ? "List View" : "Room Canvas"}
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
                <button
                  onClick={exportToCSV}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-100"
                >
                  Export CSV
                </button>
              </div>
              {importError && (
                <p className="mt-2 text-sm text-red-600">{importError}</p>
              )}
              {duplicateWarning.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-sm font-medium text-yellow-800 mb-2">⚠️ Potential duplicates detected:</p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {duplicateWarning.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
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
                    <li key={g.id} className="py-3">
                      {/* Main guest info row */}
                      <div className="flex flex-wrap items-center gap-3 mb-2">
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
                          onClick={() => startEditing(g)}
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                        >
                          {editingGuest === g.id ? "Cancel" : "Edit"}
                        </button>
                        <button
                          onClick={() => removeGuest(g.id)}
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                        >
                          Remove
                        </button>
                      </div>
                      
                      {/* Tags display */}
                      {g.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {g.tags.map((tag, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Notes display */}
                      {g.notes && (
                        <div className="text-sm text-gray-600 mb-2 italic">
                          📝 {g.notes}
                        </div>
                      )}
                      
                      {/* Edit mode */}
                      {editingGuest === g.id && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes:</label>
                            <textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Dietary restrictions, accessibility needs, etc."
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 text-sm"
                              rows={2}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated):</label>
                            <input
                              type="text"
                              value={editingTags}
                              onChange={(e) => setEditingTags(e.target.value)}
                              placeholder="family, friends, kids, VIP"
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveEditing}
                              className="rounded-xl bg-black px-3 py-2 text-white text-sm shadow hover:opacity-90"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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

        {/* Enhanced Room Designer */}
        {showCanvas && (
          <section className="mt-6">
            <div className="rounded-2xl bg-white p-4 shadow">
              {/* Toolbar */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Room Designer</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCanvasState(prev => ({ ...prev, mode: prev.mode === 'layout' ? 'assign' : 'layout' }))}
                    className={`rounded-xl px-3 py-2 text-sm shadow-sm ${
                      canvasState.mode === 'layout' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {canvasState.mode === 'layout' ? 'Layout Mode' : 'Assign Mode'}
                  </button>
                  <button
                    onClick={() => addTableToCanvas(100, 100, 'round')}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                  >
                    Add Round Table
                  </button>
                  <button
                    onClick={() => addTableToCanvas(100, 100, 'rect')}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                  >
                    Add Rect Table
                  </button>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addFixtureToCanvas(e.target.value as Fixture['type'], 100, 100);
                        e.target.value = '';
                      }
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                  >
                    <option value="">Add Fixture...</option>
                    <option value="door">Door</option>
                    <option value="window">Window</option>
                    <option value="stage">Stage</option>
                    <option value="dance-floor">Dance Floor</option>
                    <option value="dj-booth">DJ Booth</option>
                    <option value="pillar">Pillar</option>
                    <option value="text">Text Label</option>
                  </select>
                  <button
                    onClick={() => {
                      const settings = prompt(
                        `Room Settings (comma-separated):\nWidth,Height,Grid Size,Scale\nCurrent: ${roomSettings.width},${roomSettings.height},${roomSettings.gridSize},${roomSettings.scale}`
                      );
                      if (settings) {
                        const [width, height, gridSize, scale] = settings.split(',').map(s => parseInt(s.trim()));
                        if (width && height && gridSize && scale) {
                          setRoomSettings(prev => ({ ...prev, width, height, gridSize, scale }));
                        }
                      }
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                  >
                    Room Settings
                  </button>
                  <button
                    onClick={() => setRoomSettings(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
                    className={`rounded-xl px-3 py-2 text-sm shadow-sm ${
                      roomSettings.snapToGrid 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Snap: {roomSettings.snapToGrid ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setRoomSettings(prev => ({ ...prev, gridEnabled: !prev.gridEnabled }))}
                    className={`rounded-xl px-3 py-2 text-sm shadow-sm ${
                      roomSettings.gridEnabled 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Grid: {roomSettings.gridEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={exportLayoutToJSON}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                  >
                    Export Layout
                  </button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        importLayoutFromJSON(file);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                    id="layout-import"
                  />
                  <label
                    htmlFor="layout-import"
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100 cursor-pointer"
                  >
                    Import Layout
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                {/* Fixture Palette */}
                <div className="w-48 p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-semibold mb-3">Fixtures</h3>
                  <div className="space-y-2">
                    {(['door', 'window', 'stage', 'dance-floor', 'dj-booth', 'pillar', 'text'] as const).map((type) => (
                      <div
                        key={type}
                        className="p-2 bg-white border border-gray-300 rounded cursor-move hover:shadow-sm transition-shadow"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', type);
                        }}
                      >
                        <div className="text-xs font-medium capitalize">{type.replace('-', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canvas */}
                <div className="flex-1">
                  <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <div 
                      className="relative border-2 border-dashed border-gray-300 rounded-xl cursor-crosshair overflow-hidden"
                      style={{
                        width: roomSettings.width,
                        height: roomSettings.height,
                        background: roomSettings.background,
                        backgroundImage: roomSettings.gridEnabled 
                          ? `linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)`
                          : 'none',
                        backgroundSize: roomSettings.gridEnabled ? `${roomSettings.gridSize}px ${roomSettings.gridSize}px` : 'auto'
                      }}
                      onClick={handleCanvasClick}
                      onKeyDown={handleKeyboardNavigation}
                      tabIndex={0}
                    >
                      {/* Fixtures */}
                      {canvasState.fixtures.map((fixture) => (
                        <Rnd
                          key={fixture.id}
                          position={{ x: fixture.x, y: fixture.y }}
                          size={{ width: fixture.width, height: fixture.height }}
                          onDragStop={(e, d) => {
                            if (!fixture.locked) {
                              updateFixturePosition(fixture.id, d.x, d.y);
                            }
                          }}
                                                     onResizeStop={(e, direction, ref, delta, position) => {
                             if (!fixture.locked) {
                               updateFixtureSize(fixture.id, parseInt(ref.style.width), parseInt(ref.style.height));
                               updateFixturePosition(fixture.id, position.x, position.y);
                             }
                           }}
                          disableDragging={fixture.locked}
                          enableResizing={!fixture.locked}
                          bounds="parent"
                          className={`${fixture.locked ? 'opacity-50' : ''}`}
                        >
                          <div
                            className={`w-full h-full border-2 border-gray-400 bg-white flex items-center justify-center ${
                              fixture.type === 'text' ? 'text-sm' : 'text-xs'
                            }`}
                            style={{
                              transform: `rotate(${fixture.rotation}deg)`,
                              backgroundColor: fixture.color || '#ffffff'
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const action = prompt(
                                `${fixture.type} (${fixture.width}x${fixture.height})\n\n1. Lock/Unlock\n2. Remove\n3. Edit label (text only)\n\nEnter 1, 2, or 3:`
                              );
                              if (action === '1') {
                                toggleFixtureLock(fixture.id);
                              } else if (action === '2') {
                                if (confirm(`Remove ${fixture.type}?`)) {
                                  removeFixtureFromCanvas(fixture.id);
                                }
                              } else if (action === '3' && fixture.type === 'text') {
                                const label = prompt('Enter label:', fixture.label);
                                if (label !== null) {
                                  setCanvasState(prev => ({
                                    ...prev,
                                    fixtures: prev.fixtures.map(f => 
                                      f.id === fixture.id ? { ...f, label } : f
                                    )
                                  }));
                                }
                              }
                            }}
                          >
                            {fixture.type === 'text' ? (fixture.label || 'Text') : fixture.type.toUpperCase()}
                          </div>
                        </Rnd>
                      ))}

                      {/* Tables */}
                      {canvasState.tables.map((table) => (
                        <Rnd
                          key={table.id}
                          position={{ x: table.x, y: table.y }}
                          size={{ width: table.width, height: table.height }}
                          onDragStop={(e, d) => {
                            if (!table.locked) {
                              updateTablePosition(table.id, d.x, d.y);
                            }
                          }}
                          onResizeStop={(e, direction, ref, delta, position) => {
                            if (!table.locked) {
                              updateTableCapacity(table.id, Math.floor((parseInt(ref.style.width) * parseInt(ref.style.height)) / 100));
                              updateTablePosition(table.id, position.x, position.y);
                            }
                          }}
                          disableDragging={table.locked}
                          enableResizing={!table.locked}
                          bounds="parent"
                          className={`${table.locked ? 'opacity-50' : ''}`}
                          data-table-id={table.id}
                        >
                          <div
                            className={`w-full h-full border-2 border-gray-400 bg-white flex flex-col items-center justify-center ${
                              table.shape === 'round' ? 'rounded-full' : 'rounded-lg'
                            }`}
                            style={{
                              transform: `rotate(${table.rotation}deg)`
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const action = prompt(
                                `Table ${table.number} (${table.guests.length}/${table.capacity})\n\n1. Change capacity\n2. Lock/Unlock\n3. Remove table\n\nEnter 1, 2, or 3:`
                              );
                              if (action === '1') {
                                const newCapacity = prompt(`Enter new capacity (current: ${table.capacity}):`);
                                if (newCapacity) {
                                  const capacity = parseInt(newCapacity);
                                  if (!isNaN(capacity) && capacity > 0) {
                                    updateTableCapacity(table.id, capacity);
                                  }
                                }
                              } else if (action === '2') {
                                toggleTableLock(table.id);
                              } else if (action === '3') {
                                if (confirm(`Remove table ${table.number}?`)) {
                                  removeTableFromCanvas(table.id);
                                }
                              }
                            }}
                          >
                            <div className="text-sm font-bold">Table {table.number}</div>
                            <div className="text-xs text-gray-600">
                              {table.guests.length}/{table.capacity}
                            </div>
                          </div>
                        </Rnd>
                      ))}

                      <DragOverlay>
                        {canvasState.draggingGuest ? (
                          <div className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-lg shadow-lg">
                            {guests.find(g => g.id === canvasState.draggingGuest)?.name}
                          </div>
                        ) : null}
                      </DragOverlay>
                    </div>
                  </DndContext>

                  {/* Unassigned guests panel */}
                  {canvasState.mode === 'assign' && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                      <h3 className="text-sm font-semibold mb-2">Unassigned Guests</h3>
                      <div className="flex flex-wrap gap-2">
                        {guests.filter(g => !g.table).map((guest) => (
                          <div
                            key={guest.id}
                            className="px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-move shadow-sm hover:shadow-md transition-shadow"
                            draggable
                            data-guest-id={guest.id}
                            title={guest.name}
                          >
                            <div className="text-sm font-medium">{guest.name}</div>
                            {guest.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {guest.tags.slice(0, 2).map((tag, index) => (
                                  <span key={index} className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-gray-500">
          Built for quick planning. Data saves in your browser only.
        </footer>
      </div>
    </div>
  );
}
