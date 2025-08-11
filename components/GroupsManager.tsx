'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Group {
  id: string
  name: string
  color: string
  created_at: string
}

interface GroupsManagerProps {
  eventId: string
  onGroupSelect: (groupId: string | null) => void
  selectedGroupId: string | null
}

const GROUP_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#84cc16', '#f59e0b'
]

export default function GroupsManager({ eventId, onGroupSelect, selectedGroupId }: GroupsManagerProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  useEffect(() => {
    loadGroups()
  }, [eventId])

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGroups(data || [])
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          event_id: eventId,
          name: newGroupName.trim(),
          color: newGroupColor
        })
        .select()
        .single()

      if (error) throw error

      setGroups(prev => [data, ...prev])
      setNewGroupName('')
      setNewGroupColor(GROUP_COLORS[0])
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating group:', error)
      alert('Failed to create group')
    }
  }

  const handleRenameGroup = async (groupId: string) => {
    if (!editName.trim()) return

    try {
      const { error } = await supabase
        .from('groups')
        .update({ 
          name: editName.trim(),
          color: editColor
        })
        .eq('id', groupId)

      if (error) throw error

      setGroups(prev => prev.map(group => 
        group.id === groupId ? { ...group, name: editName.trim(), color: editColor } : group
      ))
      setEditingGroup(null)
      setEditName('')
      setEditColor('')
    } catch (error) {
      console.error('Error renaming group:', error)
      alert('Failed to rename group')
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This will remove the group from all guests.')) {
      return
    }

    try {
      // First, remove group_id from all guests in this group
      const { error: guestError } = await supabase
        .from('guests')
        .update({ group_id: null })
        .eq('group_id', groupId)

      if (guestError) throw guestError

      // Then delete the group
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)

      if (error) throw error

      setGroups(prev => prev.filter(group => group.id !== groupId))
      if (selectedGroupId === groupId) {
        onGroupSelect(null)
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Failed to delete group')
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading groups...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Groups</h3>
        {showCreateForm ? (
          <form onSubmit={handleCreateGroup} className="flex items-center space-x-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
              autoFocus
            />
            <select
              value={newGroupColor}
              onChange={(e) => setNewGroupColor(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
            >
              {GROUP_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
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
                setNewGroupName('')
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
            New Group
          </button>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onGroupSelect(null)}
          className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
            selectedGroupId === null
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Guests
        </button>

        {groups.map((group) => (
          <div key={group.id} className="flex items-center justify-between">
            {editingGroup === group.id ? (
              <form onSubmit={(e) => {
                e.preventDefault()
                handleRenameGroup(group.id)
              }} className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                  autoFocus
                />
                <select
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2"
                >
                  {GROUP_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white shadow-sm hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup(null)
                    setEditName('')
                    setEditColor('')
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <button
                  onClick={() => onGroupSelect(group.id)}
                  className={`flex-1 rounded-xl px-3 py-2 text-left text-sm flex items-center space-x-2 ${
                    selectedGroupId === group.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.name}</span>
                </button>
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      setEditName(group.name)
                      setEditColor(group.color)
                      setEditingGroup(group.id)
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="rounded-xl border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 shadow-sm hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
