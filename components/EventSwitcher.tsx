'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Event {
  id: string
  name: string
  created_at: string
}

interface EventSwitcherProps {
  currentEventId: string | null
  onEventChange: (eventId: string) => void
  onEventCreate: (eventId: string) => void
  onEventDelete: (eventId: string) => void
  onEventRename: (eventId: string, newName: string) => void
}

export default function EventSwitcher({
  currentEventId,
  onEventChange,
  onEventCreate,
  onEventDelete,
  onEventRename
}: EventSwitcherProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEventName.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .insert({
          name: newEventName.trim(),
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      setEvents(prev => [data, ...prev])
      onEventCreate(data.id)
      setNewEventName('')
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating event:', error)
      alert('Failed to create event')
    }
  }

  const handleRenameEvent = async (eventId: string) => {
    if (!editName.trim()) return

    try {
      const { error } = await supabase
        .from('events')
        .update({ name: editName.trim() })
        .eq('id', eventId)

      if (error) throw error

      setEvents(prev => prev.map(event => 
        event.id === eventId ? { ...event, name: editName.trim() } : event
      ))
      onEventRename(eventId, editName.trim())
      setEditingEvent(null)
      setEditName('')
    } catch (error) {
      console.error('Error renaming event:', error)
      alert('Failed to rename event')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error

      setEvents(prev => prev.filter(event => event.id !== eventId))
      onEventDelete(eventId)
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event')
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading events...</div>
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-gray-700">Event:</label>
        <select
          value={currentEventId || ''}
          onChange={(e) => onEventChange(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
        >
          <option value="">Select an event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center space-x-2">
        {showCreateForm ? (
          <form onSubmit={handleCreateEvent} className="flex items-center space-x-2">
            <input
              type="text"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="Event name"
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white shadow-sm hover:bg-blue-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false)
                setNewEventName('')
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-xl bg-green-600 px-3 py-2 text-sm text-white shadow-sm hover:bg-green-700"
          >
            New Event
          </button>
        )}
      </div>

      {currentEventId && (
        <div className="flex items-center space-x-2">
          {editingEvent === currentEventId ? (
            <form onSubmit={(e) => {
              e.preventDefault()
              handleRenameEvent(currentEventId)
            }} className="flex items-center space-x-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white shadow-sm hover:bg-blue-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(null)
                  setEditName('')
                }}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                onClick={() => {
                  const event = events.find(e => e.id === currentEventId)
                  setEditName(event?.name || '')
                  setEditingEvent(currentEventId)
                }}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
              >
                Rename
              </button>
              <button
                onClick={() => handleDeleteEvent(currentEventId)}
                className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-100"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
