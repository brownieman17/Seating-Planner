'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

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

interface GuestEditorProps {
  guest: Guest | null
  eventId: string
  onSave: (guest: Guest) => void
  onCancel: () => void
  allGuests: Guest[]
  groups: Group[]
}

const MEAL_OPTIONS = [
  'Chicken', 'Fish', 'Beef', 'Vegetarian', 'Vegan', 'Pasta', 'Salad'
]

const DIETARY_OPTIONS = [
  'GF', 'DF', 'NF', 'Kosher', 'Halal', 'Vegan', 'Vegetarian'
]

const SIDE_OPTIONS = [
  { value: 'bride', label: 'Bride Side' },
  { value: 'groom', label: 'Groom Side' },
  { value: 'both', label: 'Both Sides' }
]

export default function GuestEditor({ 
  guest, 
  eventId, 
  onSave, 
  onCancel, 
  allGuests, 
  groups 
}: GuestEditorProps) {
  const [formData, setFormData] = useState<Partial<Guest>>({
    name: '',
    table_num: null,
    partner_id: null,
    group_id: null,
    meal_selection: null,
    dietary_restrictions: [],
    keep_apart_with: [],
    is_vip: false,
    is_child: false,
    side: null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (guest) {
      setFormData(guest)
    } else {
      setFormData({
        name: '',
        table_num: null,
        partner_id: null,
        group_id: null,
        meal_selection: null,
        dietary_restrictions: [],
        keep_apart_with: [],
        is_vip: false,
        is_child: false,
        side: null
      })
    }
  }, [guest])

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      alert('Guest name is required')
      return
    }

    setLoading(true)
    try {
      if (guest) {
        // Update existing guest
        const { error } = await supabase
          .from('guests')
          .update(formData)
          .eq('id', guest.id)

        if (error) throw error
        onSave({ ...guest, ...formData })
      } else {
        // Create new guest
        const { data, error } = await supabase
          .from('guests')
          .insert({
            event_id: eventId,
            ...formData,
            source: 'manual'
          })
          .select()
          .single()

        if (error) throw error
        onSave(data)
      }
    } catch (error) {
      console.error('Error saving guest:', error)
      alert('Failed to save guest')
    } finally {
      setLoading(false)
    }
  }

  const toggleDietary = (dietary: string) => {
    setFormData(prev => ({
      ...prev,
      dietary_restrictions: prev.dietary_restrictions?.includes(dietary)
        ? prev.dietary_restrictions.filter(d => d !== dietary)
        : [...(prev.dietary_restrictions || []), dietary]
    }))
  }

  const toggleKeepApart = (guestId: string) => {
    setFormData(prev => ({
      ...prev,
      keep_apart_with: prev.keep_apart_with?.includes(guestId)
        ? prev.keep_apart_with.filter(id => id !== guestId)
        : [...(prev.keep_apart_with || []), guestId]
    }))
  }

  const availablePartners = allGuests.filter(g => 
    g.id !== guest?.id && !g.partner_id
  )

  const availableKeepApart = allGuests.filter(g => 
    g.id !== guest?.id
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {guest ? 'Edit Guest' : 'Add Guest'}
        </h2>

        <div className="space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
              placeholder="Guest name"
            />
          </div>

          {/* Table Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Number
            </label>
            <input
              type="number"
              value={formData.table_num || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                table_num: e.target.value ? parseInt(e.target.value) : null 
              }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
              placeholder="Table number"
            />
          </div>

          {/* Partner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Partner
            </label>
            <select
              value={formData.partner_id || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                partner_id: e.target.value || null 
              }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
            >
              <option value="">No partner</option>
              {availablePartners.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group
            </label>
            <select
              value={formData.group_id || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                group_id: e.target.value || null 
              }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
            >
              <option value="">No group</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Meal Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meal Selection
            </label>
            <select
              value={formData.meal_selection || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                meal_selection: e.target.value || null 
              }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
            >
              <option value="">No meal selected</option>
              {MEAL_OPTIONS.map(meal => (
                <option key={meal} value={meal}>{meal}</option>
              ))}
            </select>
          </div>

          {/* Dietary Restrictions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dietary Restrictions
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_OPTIONS.map(dietary => (
                <label key={dietary} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.dietary_restrictions?.includes(dietary) || false}
                    onChange={() => toggleDietary(dietary)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{dietary}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Keep Apart */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keep Apart From
            </label>
            <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-xl p-2">
              {availableKeepApart.map(g => (
                <label key={g.id} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    checked={formData.keep_apart_with?.includes(g.id) || false}
                    onChange={() => toggleKeepApart(g.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{g.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Side */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Side
            </label>
            <select
              value={formData.side || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                side: e.target.value as 'bride' | 'groom' | 'both' | null || null 
              }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2"
            >
              <option value="">No side specified</option>
              {SIDE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Flags */}
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_vip || false}
                onChange={(e) => setFormData(prev => ({ ...prev, is_vip: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">VIP</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_child || false}
                onChange={(e) => setFormData(prev => ({ ...prev, is_child: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Child</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
