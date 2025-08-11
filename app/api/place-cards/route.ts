import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

const MEAL_ICONS: Record<string, string> = {
  'chicken': '🍗',
  'fish': '🐟',
  'beef': '🥩',
  'vegetarian': '🥬',
  'vegan': '🌱',
  'pasta': '🍝',
  'salad': '🥗'
}

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Fetch guests with table assignments
    const { data: guests, error } = await supabase
      .from('guests')
      .select('name, table_num, meal_selection')
      .eq('event_id', eventId)
      .not('table_num', 'is', null)
      .order('table_num')
      .order('name')

    if (error) {
      console.error('Error fetching guests:', error)
      return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 })
    }

    // Generate HTML for place cards
    const html = generatePlaceCardsHTML(guests)

    return NextResponse.json({ html })
  } catch (error) {
    console.error('Error generating place cards:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generatePlaceCardsHTML(guests: any[]) {
  const cardsPerRow = 3
  const rows = []
  
  for (let i = 0; i < guests.length; i += cardsPerRow) {
    const rowGuests = guests.slice(i, i + cardsPerRow)
    const row = rowGuests.map(guest => {
      const mealIcon = guest.meal_selection ? MEAL_ICONS[guest.meal_selection.toLowerCase()] || '🍽️' : ''
      return `
        <div class="place-card">
          <div class="guest-name">${guest.name}</div>
          <div class="table-info">Table ${guest.table_num}</div>
          ${mealIcon ? `<div class="meal-icon">${mealIcon}</div>` : ''}
        </div>
      `
    }).join('')
    
    rows.push(`<div class="card-row">${row}</div>`)
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Place Cards</title>
      <style>
        @media print {
          body { margin: 0; }
          .page-break { page-break-before: always; }
        }
        
        body {
          font-family: 'Georgia', serif;
          margin: 20px;
          background: white;
        }
        
        .card-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        
        .place-card {
          width: 200px;
          height: 120px;
          border: 2px solid #333;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .guest-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #333;
        }
        
        .table-info {
          font-size: 14px;
          color: #666;
          margin-bottom: 4px;
        }
        
        .meal-icon {
          font-size: 20px;
          margin-top: 4px;
        }
        
        @media print {
          .place-card {
            border: 1px solid #333;
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      ${rows.join('')}
    </body>
    </html>
  `
}
