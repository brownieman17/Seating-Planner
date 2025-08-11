'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AuthGate from '@/components/AuthGate'
import EventSwitcher from '@/components/EventSwitcher'
import GroupsManager from '@/components/GroupsManager'
import KitchenSummary from '@/components/KitchenSummary'
import GuestEditor from '@/components/GuestEditor'
import WeddingLayout from '@/components/WeddingLayout'
import Link from 'next/link'

interface Guest {
  id: string
  name: string
  table_num: number | null
  partner_id: string | null
  group_id: string | null
  meal_selection: string | null
  dietary_restrictions: string[]
  keep_apart_with: string[]
  is_vip: boolean
  is_child: boolean
  side: 'bride' | 'groom' | 'both' | null
}

interface Group {
  id: string
  name: string
  color: string
}

interface Table {
  number: number
  capacity: number
}

export default function SeatingPlannerPage() {
  const [currentEventId, setCurrentEventId] = useState<string | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [showKitchenSummary, setShowKitchenSummary] = useState(false)
  const [currentLayoutType, setCurrentLayoutType] = useState<'ceremony' | 'cocktail' | 'reception'>('reception')
  const [activeTab, setActiveTab] = useState<'guests' | 'layout' | 'kitchen'>('guests')
  const [filterSide, setFilterSide] = useState<'all' | 'bride' | 'groom'>('all')
  const [filterType, setFilterType] = useState<'all' | 'unassigned' | 'vip' | 'children'>('all')
  const [seatPartnersTogether, setSeatPartnersTogether] = useState(true)

  useEffect(() => {
    if (currentEventId) {
      loadGuests()
      loadGroups()
      loadTables()
    }
  }, [currentEventId])

  const loadGuests = async () => {
    if (!currentEventId) return

    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', currentEventId)
        .order('name')

      if (error) throw error
      setGuests(data || [])
    } catch (error) {
      console.error('Error loading guests:', error)
    }
  }

  const loadGroups = async () => {
    if (!currentEventId) return

    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('event_id', currentEventId)
        .order('name')

      if (error) throw error
      setGroups(data || [])
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  const loadTables = async () => {
    if (!currentEventId) return

    try {
      const { data, error } = await supabase
        .from('layouts')
        .select('tables')
        .eq('event_id', currentEventId)
        .eq('layout_type', 'reception')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data?.tables) {
        setTables(data.tables.map((table: any) => ({
          number: table.number,
          capacity: table.capacity
        })))
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  const handleEventChange = (eventId: string) => {
    setCurrentEventId(eventId)
    setSelectedGroupId(null)
    setEditingGuest(null)
    setShowKitchenSummary(false)
  }

  const handleEventCreate = (eventId: string) => {
    setCurrentEventId(eventId)
  }

  const handleEventDelete = (eventId: string) => {
    if (currentEventId === eventId) {
      setCurrentEventId(null)
      setGuests([])
      setGroups([])
      setTables([])
    }
  }

  const handleEventRename = (eventId: string, newName: string) => {
    // Event renamed, no action needed here as EventSwitcher handles it
  }

  const handleGuestSave = (guest: Guest) => {
    setGuests(prev => {
      const existingIndex = prev.findIndex(g => g.id === guest.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = guest
        return updated
      } else {
        return [...prev, guest]
      }
    })
    setEditingGuest(null)
  }

  const handleImportLocalData = async () => {
    const localData = localStorage.getItem('seating_planner_v1')
    if (!localData || !currentEventId) return

    try {
      const data = JSON.parse(localData)
      
      // Create event if needed
      if (!currentEventId) {
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            name: 'Imported Event',
            user_id: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single()

        if (eventError) throw eventError
        setCurrentEventId(event.id)
      }

      // Import guests
      if (data.guests && data.guests.length > 0) {
        const { error: guestsError } = await supabase
          .from('guests')
          .insert(
            data.guests.map((guest: any) => ({
              event_id: currentEventId,
              name: guest.name,
              table_num: guest.table,
              source: 'csv'
            }))
          )

        if (guestsError) throw guestsError
      }

      // Import layout
      if (data.tables || data.fixtures) {
        const { error: layoutError } = await supabase
          .from('layouts')
          .upsert({
            event_id: currentEventId,
            layout_type: 'reception',
            room: data.roomSettings || {},
            tables: data.tables || [],
            fixtures: data.fixtures || [],
            updated_at: new Date().toISOString()
          })

        if (layoutError) throw layoutError
      }

      // Reload data
      loadGuests()
      loadGroups()
      loadTables()

      alert('Local data imported successfully!')
    } catch (error) {
      console.error('Error importing local data:', error)
      alert('Failed to import local data')
    }
  }

  const filteredGuests = guests.filter(guest => {
    // Group filter
    if (selectedGroupId && guest.group_id !== selectedGroupId) return false
    
    // Side filter
    if (filterSide !== 'all' && guest.side !== filterSide) return false
    
    // Type filter
    if (filterType === 'unassigned' && guest.table_num !== null) return false
    if (filterType === 'vip' && !guest.is_vip) return false
    if (filterType === 'children' && !guest.is_child) return false
    
    return true
  })

  const generatePlaceCards = async () => {
    try {
      const response = await fetch('/api/place-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: currentEventId })
      })

      if (!response.ok) throw new Error('Failed to generate place cards')

      const { html } = await response.json()
      
      // Open in new window for printing
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.write(html)
        newWindow.document.close()
      }
    } catch (error) {
      console.error('Error generating place cards:', error)
      alert('Failed to generate place cards')
    }
  }

  const exportEscortCards = () => {
    const assignedGuests = guests.filter(g => g.table_num !== null)
    const csvContent = [
      'Name,Table',
      ...assignedGuests.map(guest => `"${guest.name}",${guest.table_num}`)
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'escort_cards.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (!currentEventId) {
    return (
      <AuthGate onImportLocalData={handleImportLocalData}>
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow p-6">
              <h1 className="text-2xl font-bold mb-4">Welcome to Seating Planner</h1>
              <p className="text-gray-600 mb-6">
                Create an event to get started with your seating arrangements.
              </p>
              <EventSwitcher
                currentEventId={currentEventId}
                onEventChange={handleEventChange}
                onEventCreate={handleEventCreate}
                onEventDelete={handleEventDelete}
                onEventRename={handleEventRename}
              />
            </div>
          </div>
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate onImportLocalData={handleImportLocalData}>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <EventSwitcher
                currentEventId={currentEventId}
                onEventChange={handleEventChange}
                onEventCreate={handleEventCreate}
                onEventDelete={handleEventDelete}
                onEventRename={handleEventRename}
              />
              <div className="flex items-center space-x-2">
                <Link
                  href="/integrations"
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                >
                  Integrations
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('guests')}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  activeTab === 'guests'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Guests ({guests.length})
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  activeTab === 'layout'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Layout
              </button>
              <button
                onClick={() => setActiveTab('kitchen')}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  activeTab === 'kitchen'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Kitchen Summary
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'guests' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                {/* Groups */}
                <div className="bg-white rounded-2xl shadow p-6">
                  <GroupsManager
                    eventId={currentEventId}
                    onGroupSelect={setSelectedGroupId}
                    selectedGroupId={selectedGroupId}
                  />
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Filters</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Side</label>
                      <select
                        value={filterSide}
                        onChange={(e) => setFilterSide(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                      >
                        <option value="all">All Sides</option>
                        <option value="bride">Bride Side</option>
                        <option value="groom">Groom Side</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                      >
                        <option value="all">All Guests</option>
                        <option value="unassigned">Unassigned Only</option>
                        <option value="vip">VIP Only</option>
                        <option value="children">Children Only</option>
                      </select>
                    </div>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={seatPartnersTogether}
                        onChange={(e) => setSeatPartnersTogether(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Seat partners together by default</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-2xl shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Actions</h3>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setEditingGuest({} as Guest)}
                      className="w-full rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700"
                    >
                      Add Guest
                    </button>
                    <button
                      onClick={exportEscortCards}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      Export Escort Cards
                    </button>
                    <button
                      onClick={generatePlaceCards}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      Generate Place Cards
                    </button>
                  </div>
                </div>
              </div>

              {/* Guest List */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold">Guest List</h2>
                    <p className="text-gray-600 mt-1">
                      {filteredGuests.length} of {guests.length} guests
                    </p>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {filteredGuests.map((guest) => {
                      const partner = guest.partner_id ? guests.find(g => g.id === guest.partner_id) : null
                      const group = guest.group_id ? groups.find(g => g.id === guest.group_id) : null
                      
                      return (
                        <div key={guest.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{guest.name}</span>
                                  {guest.is_vip && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">VIP</span>}
                                  {guest.is_child && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Child</span>}
                                  {group && (
                                    <span 
                                      className="text-xs px-2 py-1 rounded text-white"
                                      style={{ backgroundColor: group.color }}
                                    >
                                      {group.name}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="text-sm text-gray-600 mt-1">
                                  {guest.table_num ? `Table ${guest.table_num}` : 'Unassigned'}
                                  {partner && ` • Partner: ${partner.name}`}
                                  {guest.meal_selection && ` • ${guest.meal_selection}`}
                                  {guest.dietary_restrictions.length > 0 && ` • ${guest.dietary_restrictions.join(', ')}`}
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => setEditingGuest(guest)}
                              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'layout' && (
            <div className="bg-white rounded-2xl shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Wedding Layout</h2>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setCurrentLayoutType('ceremony')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium ${
                        currentLayoutType === 'ceremony'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Ceremony
                    </button>
                    <button
                      onClick={() => setCurrentLayoutType('cocktail')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium ${
                        currentLayoutType === 'cocktail'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Cocktail
                    </button>
                    <button
                      onClick={() => setCurrentLayoutType('reception')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium ${
                        currentLayoutType === 'reception'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Reception
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="h-96">
                <WeddingLayout
                  eventId={currentEventId}
                  currentLayoutType={currentLayoutType}
                />
              </div>
            </div>
          )}

          {activeTab === 'kitchen' && (
            <div className="bg-white rounded-2xl shadow p-6">
              <KitchenSummary guests={guests} tables={tables} />
            </div>
          )}
        </div>

        {/* Guest Editor Modal */}
        {editingGuest !== null && (
          <GuestEditor
            guest={editingGuest}
            eventId={currentEventId}
            onSave={handleGuestSave}
            onCancel={() => setEditingGuest(null)}
            allGuests={guests}
            groups={groups}
          />
        )}
      </div>
    </AuthGate>
  )
}
