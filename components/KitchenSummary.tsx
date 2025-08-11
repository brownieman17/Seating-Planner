'use client'

import { useMemo } from 'react'

interface Guest {
  id: string
  name: string
  table_num: number | null
  meal_selection: string | null
  dietary_restrictions: string[]
}

interface KitchenSummaryProps {
  guests: Guest[]
  tables: Array<{ number: number; capacity: number }>
}

const MEAL_ICONS: Record<string, string> = {
  'chicken': '🍗',
  'fish': '🐟',
  'beef': '🥩',
  'vegetarian': '🥬',
  'vegan': '🌱',
  'pasta': '🍝',
  'salad': '🥗'
}

const DIETARY_ICONS: Record<string, string> = {
  'GF': '🌾',
  'DF': '🥛',
  'NF': '🥜',
  'Kosher': '✡️',
  'Halal': '☪️',
  'Vegan': '🌱',
  'Vegetarian': '🥬'
}

export default function KitchenSummary({ guests, tables }: KitchenSummaryProps) {
  const mealCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    guests.forEach(guest => {
      if (guest.meal_selection) {
        counts[guest.meal_selection] = (counts[guest.meal_selection] || 0) + 1
      }
    })
    return counts
  }, [guests])

  const dietaryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    guests.forEach(guest => {
      guest.dietary_restrictions.forEach(dietary => {
        counts[dietary] = (counts[dietary] || 0) + 1
      })
    })
    return counts
  }, [guests])

  const tableMeals = useMemo(() => {
    const tableData: Record<number, { meals: Record<string, number>; dietary: string[] }> = {}
    
    tables.forEach(table => {
      tableData[table.number] = { meals: {}, dietary: [] }
    })

    guests.forEach(guest => {
      if (guest.table_num && tableData[guest.table_num]) {
        if (guest.meal_selection) {
          tableData[guest.table_num].meals[guest.meal_selection] = 
            (tableData[guest.table_num].meals[guest.meal_selection] || 0) + 1
        }
        guest.dietary_restrictions.forEach(dietary => {
          if (!tableData[guest.table_num].dietary.includes(dietary)) {
            tableData[guest.table_num].dietary.push(dietary)
          }
        })
      }
    })

    return tableData
  }, [guests, tables])

  const totalGuests = guests.length
  const assignedGuests = guests.filter(g => g.table_num !== null).length
  const unassignedGuests = totalGuests - assignedGuests

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Event Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalGuests}</div>
            <div className="text-sm text-gray-600">Total Guests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{assignedGuests}</div>
            <div className="text-sm text-gray-600">Assigned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{unassignedGuests}</div>
            <div className="text-sm text-gray-600">Unassigned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{tables.length}</div>
            <div className="text-sm text-gray-600">Tables</div>
          </div>
        </div>
      </div>

      {/* Meal Counts */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Meal Counts</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(mealCounts).map(([meal, count]) => (
            <div key={meal} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl">
              <span className="text-xl">{MEAL_ICONS[meal.toLowerCase()] || '🍽️'}</span>
              <div>
                <div className="font-semibold">{count}</div>
                <div className="text-sm text-gray-600 capitalize">{meal}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dietary Restrictions */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Dietary Restrictions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(dietaryCounts).map(([dietary, count]) => (
            <div key={dietary} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl">
              <span className="text-xl">{DIETARY_ICONS[dietary] || '⚠️'}</span>
              <div>
                <div className="font-semibold">{count}</div>
                <div className="text-sm text-gray-600">{dietary}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Table Breakdown */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Per-Table Breakdown</h3>
        <div className="space-y-4">
          {Object.entries(tableMeals).map(([tableNum, data]) => {
            const table = tables.find(t => t.number === parseInt(tableNum))
            const mealEntries = Object.entries(data.meals)
            const hasDietary = data.dietary.length > 0

            return (
              <div key={tableNum} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Table {tableNum}</h4>
                  <span className="text-sm text-gray-600">
                    {mealEntries.reduce((sum, [_, count]) => sum + count, 0)}/{table?.capacity || 0} guests
                  </span>
                </div>
                
                {mealEntries.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {mealEntries.map(([meal, count]) => (
                      <span key={meal} className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm">
                        <span>{MEAL_ICONS[meal.toLowerCase()] || '🍽️'}</span>
                        <span>{count} {meal}</span>
                      </span>
                    ))}
                  </div>
                )}

                {hasDietary && (
                  <div className="flex flex-wrap gap-1">
                    {data.dietary.map(dietary => (
                      <span key={dietary} className="inline-flex items-center space-x-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs">
                        <span>{DIETARY_ICONS[dietary] || '⚠️'}</span>
                        <span>{dietary}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Print Button */}
      <div className="flex justify-center">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-blue-600 px-6 py-3 text-white shadow hover:bg-blue-700"
        >
          Print Kitchen Summary
        </button>
      </div>
    </div>
  )
}
