'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function IntegrationsPage() {
  const [eventbriteToken, setEventbriteToken] = useState('')
  const [eventId, setEventId] = useState('')
  const [importing, setImporting] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [currentEventId, setCurrentEventId] = useState<string | null>(null)
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    // Load saved token from localStorage
    const savedToken = localStorage.getItem('eventbrite_token')
    if (savedToken) {
      setEventbriteToken(savedToken)
    }

    // Generate webhook URL
    setWebhookUrl(`${window.location.origin}/api/webhooks/rsvp`)

    // Generate webhook secret if not exists
    const savedSecret = localStorage.getItem('webhook_secret')
    if (savedSecret) {
      setWebhookSecret(savedSecret)
    } else {
      const newSecret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      setWebhookSecret(newSecret)
      localStorage.setItem('webhook_secret', newSecret)
    }

    // Load events
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data || [])
      if (data && data.length > 0 && !currentEventId) {
        setCurrentEventId(data[0].id)
      }
    } catch (error) {
      console.error('Error loading events:', error)
    }
  }

  const handleEventbriteTokenChange = (token: string) => {
    setEventbriteToken(token)
    localStorage.setItem('eventbrite_token', token)
  }

  const importEventbriteAttendees = async () => {
    if (!eventbriteToken || !eventId || !currentEventId) {
      alert('Please fill in all required fields')
      return
    }

    setImporting(true)
    try {
      const response = await fetch(`/api/eventbrite/attendees?event_id=${eventId}`, {
        headers: {
          'Authorization': `Bearer ${eventbriteToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.attendees && data.attendees.length > 0) {
        // Insert attendees into database
        const { error } = await supabase
          .from('guests')
          .upsert(
            data.attendees.map((attendee: any) => ({
              event_id: currentEventId,
              name: attendee.profile.name,
              external_id: attendee.id,
              source: 'eventbrite'
            })),
            { onConflict: 'external_id,event_id' }
          )

        if (error) throw error

        alert(`Successfully imported ${data.attendees.length} attendees from Eventbrite!`)
        setEventId('')
      } else {
        alert('No attendees found for this event')
      }
    } catch (error) {
      console.error('Error importing attendees:', error)
      alert('Failed to import attendees. Please check your token and event ID.')
    } finally {
      setImporting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-2">Connect your seating planner with external platforms</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Eventbrite Integration */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-orange-600 font-bold text-sm">E</span>
              </div>
              <h2 className="text-xl font-semibold">Eventbrite</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              Import attendees directly from your Eventbrite events.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Token
                </label>
                <input
                  type="password"
                  value={eventbriteToken}
                  onChange={(e) => handleEventbriteTokenChange(e.target.value)}
                  placeholder="Enter your Eventbrite personal token"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your token from{' '}
                  <a 
                    href="https://www.eventbrite.com/platform/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Eventbrite API Keys
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event ID
                </label>
                <input
                  type="text"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  placeholder="Enter Eventbrite event ID"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Found in your event URL: eventbrite.com/e/event-name-<strong>EVENT_ID</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Import to Event
                </label>
                <select
                  value={currentEventId || ''}
                  onChange={(e) => setCurrentEventId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={importEventbriteAttendees}
                disabled={importing || !eventbriteToken || !eventId || !currentEventId}
                className="w-full rounded-xl bg-orange-600 px-4 py-2 text-white shadow hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import Attendees'}
              </button>
            </div>
          </div>

          {/* Webhook Integration */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold text-sm">W</span>
              </div>
              <h2 className="text-xl font-semibold">RSVP Webhooks</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              Receive RSVPs automatically via webhooks from platforms like RSVPify.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook URL
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    className="flex-1 rounded-l-xl border border-gray-300 px-3 py-2 shadow-sm bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="rounded-r-xl border border-gray-300 bg-white px-3 py-2 shadow-sm hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook Secret
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={webhookSecret}
                    readOnly
                    className="flex-1 rounded-l-xl border border-gray-300 px-3 py-2 shadow-sm bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookSecret)}
                    className="rounded-r-xl border border-gray-300 bg-white px-3 py-2 shadow-sm hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Include this as X-Webhook-Secret header in your webhook requests
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Setup Instructions</h3>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Copy the webhook URL and secret above</li>
                  <li>2. In your RSVP platform (RSVPify, etc.), add a webhook</li>
                  <li>3. Set the URL to the webhook URL</li>
                  <li>4. Add header: X-Webhook-Secret = [your secret]</li>
                  <li>5. Configure payload to include: name, email (optional)</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* CSV Presets */}
        <div className="mt-8 bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">CSV Import Presets</h2>
          <p className="text-gray-600 mb-4">
            Common column mappings for popular wedding and event platforms.
          </p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'The Knot', columns: ['Guest Name', 'Email', 'Table Number'] },
              { name: 'WeddingWire', columns: ['Name', 'Email Address', 'Table'] },
              { name: 'Zola', columns: ['Guest Name', 'Email', 'Table Assignment'] },
              { name: 'Joy', columns: ['Name', 'Email', 'Table'] },
              { name: 'Eventbrite Export', columns: ['Name', 'Email', 'Table'] },
              { name: 'Generic', columns: ['Name', 'Email', 'Table'] }
            ].map((preset) => (
              <div key={preset.name} className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{preset.name}</h3>
                <div className="text-sm text-gray-600">
                  {preset.columns.map((col, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{col}:</span>
                      <span className="font-mono text-xs">
                        {index === 0 ? 'name' : index === 1 ? 'email' : 'table'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
