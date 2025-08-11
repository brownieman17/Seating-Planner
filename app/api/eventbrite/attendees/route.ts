import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('event_id')
    const authHeader = request.headers.get('authorization')

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header is required' }, { status: 401 })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Fetch attendees from Eventbrite API
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/events/${eventId}/attendees/`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: 'Failed to fetch attendees from Eventbrite', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Transform Eventbrite data to our format
    const attendees = data.attendees?.map((attendee: any) => ({
      id: attendee.id,
      profile: {
        name: attendee.profile?.name || 'Unknown Guest',
        email: attendee.profile?.email || '',
      },
      status: attendee.status,
      created: attendee.created,
    })) || []

    return NextResponse.json({ attendees })
  } catch (error) {
    console.error('Error fetching Eventbrite attendees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
