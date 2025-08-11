'use client'

import { useState, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { supabase } from '@/lib/supabaseClient'

interface Table {
  id: string
  name: string
  number: number
  x: number
  y: number
  width: number
  height: number
  capacity: number
  shape: 'round' | 'rect'
  rotation: number
  locked: boolean
  notes?: string
  guests: string[]
}

interface Fixture {
  id: string
  type: 'door' | 'window' | 'stage' | 'dance-floor' | 'dj-booth' | 'pillar' | 'text' | 'sweetheart-table' | 'head-table' | 'bar' | 'buffet' | 'cake-table' | 'gift-table' | 'escort-card-table'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked: boolean
  label?: string
  color?: string
}

interface WeddingLayoutProps {
  eventId: string
  currentLayoutType: 'ceremony' | 'cocktail' | 'reception'
}

const TABLE_PRESETS = [
  { name: 'Round 60"', shape: 'round' as const, width: 120, height: 120, capacity: 8 },
  { name: 'Round 72"', shape: 'round' as const, width: 144, height: 144, capacity: 10 },
  { name: 'Rect 6ft', shape: 'rect' as const, width: 180, height: 120, capacity: 8 },
  { name: 'Rect 8ft', shape: 'rect' as const, width: 240, height: 120, capacity: 10 },
  { name: 'Cocktail', shape: 'round' as const, width: 80, height: 80, capacity: 4 },
  { name: 'Head Table', shape: 'rect' as const, width: 300, height: 100, capacity: 12 },
  { name: 'Sweetheart', shape: 'round' as const, width: 100, height: 100, capacity: 2 }
]

const WEDDING_FIXTURES = [
  { type: 'sweetheart-table', label: 'Sweetheart Table', icon: '💕' },
  { type: 'head-table', label: 'Head Table', icon: '👑' },
  { type: 'dance-floor', label: 'Dance Floor', icon: '💃' },
  { type: 'dj-booth', label: 'DJ Booth', icon: '🎵' },
  { type: 'bar', label: 'Bar', icon: '🍸' },
  { type: 'buffet', label: 'Buffet', icon: '🍽️' },
  { type: 'cake-table', label: 'Cake Table', icon: '🎂' },
  { type: 'gift-table', label: 'Gift Table', icon: '🎁' },
  { type: 'escort-card-table', label: 'Escort Cards', icon: '📋' },
  { type: 'stage', label: 'Stage', icon: '🎭' },
  { type: 'door', label: 'Door', icon: '🚪' },
  { type: 'window', label: 'Window', icon: '🪟' },
  { type: 'pillar', label: 'Pillar', icon: '🏛️' }
]

export default function WeddingLayout({ eventId, currentLayoutType }: WeddingLayoutProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedItem, setSelectedItem] = useState<{ type: 'table' | 'fixture'; id: string } | null>(null)
  const [roomSettings, setRoomSettings] = useState({
    width: 1200,
    height: 800,
    background: '#f8fafc',
    gridEnabled: true,
    gridSize: 20,
    snapToGrid: true,
    allowOverlap: false,
    scale: 20
  })
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadLayout()
  }, [eventId, currentLayoutType])

  const loadLayout = async () => {
    try {
      const { data, error } = await supabase
        .from('layouts')
        .select('*')
        .eq('event_id', eventId)
        .eq('layout_type', currentLayoutType)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      if (data) {
        setTables(data.tables || [])
        setFixtures(data.fixtures || [])
        setRoomSettings(data.room || roomSettings)
      } else {
        // Create default layout
        await saveLayout()
      }
    } catch (error) {
      console.error('Error loading layout:', error)
    }
  }

  const saveLayout = async () => {
    try {
      const { error } = await supabase
        .from('layouts')
        .upsert({
          event_id: eventId,
          layout_type: currentLayoutType,
          room: roomSettings,
          tables,
          fixtures,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
    } catch (error) {
      console.error('Error saving layout:', error)
    }
  }

  const addTable = (preset: typeof TABLE_PRESETS[0]) => {
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: preset.name,
      number: tables.length + 1,
      x: 100,
      y: 100,
      width: preset.width,
      height: preset.height,
      capacity: preset.capacity,
      shape: preset.shape,
      rotation: 0,
      locked: false,
      guests: []
    }
    setTables(prev => [...prev, newTable])
  }

  const addFixture = (fixtureType: Fixture['type']) => {
    const fixture = WEDDING_FIXTURES.find(f => f.type === fixtureType)
    const newFixture: Fixture = {
      id: `fixture_${Date.now()}`,
      type: fixtureType,
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      rotation: 0,
      locked: false,
      label: fixture?.label
    }
    setFixtures(prev => [...prev, newFixture])
  }

  const updateTablePosition = (id: string, x: number, y: number) => {
    setTables(prev => prev.map(table => 
      table.id === id ? { ...table, x, y } : table
    ))
  }

  const updateTableSize = (id: string, width: number, height: number) => {
    setTables(prev => prev.map(table => 
      table.id === id ? { ...table, width, height } : table
    ))
  }

  const updateFixturePosition = (id: string, x: number, y: number) => {
    setFixtures(prev => prev.map(fixture => 
      fixture.id === id ? { ...fixture, x, y } : fixture
    ))
  }

  const updateFixtureSize = (id: string, width: number, height: number) => {
    setFixtures(prev => prev.map(fixture => 
      fixture.id === id ? { ...fixture, width, height } : fixture
    ))
  }

  const deleteItem = (type: 'table' | 'fixture', id: string) => {
    if (type === 'table') {
      setTables(prev => prev.filter(table => table.id !== id))
    } else {
      setFixtures(prev => prev.filter(fixture => fixture.id !== id))
    }
    setSelectedItem(null)
  }

  const snapToGrid = (value: number) => {
    if (!roomSettings.snapToGrid) return value
    return Math.round(value / roomSettings.gridSize) * roomSettings.gridSize
  }

  useEffect(() => {
    saveLayout()
  }, [tables, fixtures, roomSettings])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold capitalize">{currentLayoutType} Layout</h2>
            
            {/* Table Presets */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const preset = TABLE_PRESETS.find(p => p.name === e.target.value)
                  if (preset) addTable(preset)
                  e.target.value = ''
                }
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
            >
              <option value="">Add Table...</option>
              {TABLE_PRESETS.map(preset => (
                <option key={preset.name} value={preset.name}>
                  {preset.name} ({preset.capacity})
                </option>
              ))}
            </select>

            {/* Wedding Fixtures */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addFixture(e.target.value as Fixture['type'])
                  e.target.value = ''
                }
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
            >
              <option value="">Add Fixture...</option>
              {WEDDING_FIXTURES.map(fixture => (
                <option key={fixture.type} value={fixture.type}>
                  {fixture.icon} {fixture.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
            >
              Settings
            </button>
            <button
              onClick={() => {
                if (selectedItem) {
                  deleteItem(selectedItem.type, selectedItem.id)
                }
              }}
              disabled={!selectedItem}
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
            >
              Delete Selected
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Width</label>
                <input
                  type="number"
                  value={roomSettings.width}
                  onChange={(e) => setRoomSettings(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Height</label>
                <input
                  type="number"
                  value={roomSettings.height}
                  onChange={(e) => setRoomSettings(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grid Size</label>
                <input
                  type="number"
                  value={roomSettings.gridSize}
                  onChange={(e) => setRoomSettings(prev => ({ ...prev, gridSize: parseInt(e.target.value) }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={roomSettings.snapToGrid}
                    onChange={(e) => setRoomSettings(prev => ({ ...prev, snapToGrid: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Snap to Grid</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="w-full h-full relative"
          style={{
            background: roomSettings.background,
            backgroundImage: roomSettings.gridEnabled 
              ? `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`
              : 'none',
            backgroundSize: `${roomSettings.gridSize}px ${roomSettings.gridSize}px`
          }}
        >
          {/* Tables */}
          {tables.map((table) => (
            <Rnd
              key={table.id}
              position={{ x: table.x, y: table.y }}
              size={{ width: table.width, height: table.height }}
              onDragStop={(e, d) => {
                const x = snapToGrid(d.x)
                const y = snapToGrid(d.y)
                updateTablePosition(table.id, x, y)
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                const width = snapToGrid(parseInt(ref.style.width))
                const height = snapToGrid(parseInt(ref.style.height))
                const x = snapToGrid(position.x)
                const y = snapToGrid(position.y)
                updateTablePosition(table.id, x, y)
                updateTableSize(table.id, width, height)
              }}
              onClick={() => setSelectedItem({ type: 'table', id: table.id })}
              style={{
                border: selectedItem?.id === table.id ? '3px solid #3b82f6' : '2px solid #374151',
                borderRadius: table.shape === 'round' ? '50%' : '8px',
                background: '#ffffff',
                cursor: 'move',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              <div className="text-center">
                <div>{table.name}</div>
                <div className="text-xs text-gray-600">{table.capacity}</div>
              </div>
            </Rnd>
          ))}

          {/* Fixtures */}
          {fixtures.map((fixture) => {
            const fixtureInfo = WEDDING_FIXTURES.find(f => f.type === fixture.type)
            return (
              <Rnd
                key={fixture.id}
                position={{ x: fixture.x, y: fixture.y }}
                size={{ width: fixture.width, height: fixture.height }}
                onDragStop={(e, d) => {
                  const x = snapToGrid(d.x)
                  const y = snapToGrid(d.y)
                  updateFixturePosition(fixture.id, x, y)
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const width = snapToGrid(parseInt(ref.style.width))
                  const height = snapToGrid(parseInt(ref.style.height))
                  const x = snapToGrid(position.x)
                  const y = snapToGrid(position.y)
                  updateFixturePosition(fixture.id, x, y)
                  updateFixtureSize(fixture.id, width, height)
                }}
                onClick={() => setSelectedItem({ type: 'fixture', id: fixture.id })}
                style={{
                  border: selectedItem?.id === fixture.id ? '3px solid #3b82f6' : '2px solid #374151',
                  borderRadius: '8px',
                  background: '#f3f4f6',
                  cursor: 'move',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                <div className="text-center">
                  <div>{fixtureInfo?.icon}</div>
                  <div className="text-xs">{fixtureInfo?.label}</div>
                </div>
              </Rnd>
            )
          })}
        </div>
      </div>
    </div>
  )
}
