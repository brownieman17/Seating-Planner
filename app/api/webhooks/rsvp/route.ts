import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const webhookSecret = request.headers.get('x-webhook-secret')
    const expectedSecret = process.env.WEBHOOK_SECRET || 'default-secret'

    // Verify webhook secret
    if (webhookSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Extract guest information from webhook payload
    const { name, email, party, table, event_id } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!event_id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Check if event exists and get user_id
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('user_id')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Create or update guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .upsert({
        event_id,
        name: name.trim(),
        external_id: email ? `webhook_${email}` : `webhook_${Date.now()}`,
        source: 'webhook',
        table_num: table ? parseInt(table) : null,
      }, {
        onConflict: 'external_id,event_id'
      })
      .select()
      .single()

    if (guestError) {
      console.error('Error upserting guest:', guestError)
      return NextResponse.json({ error: 'Failed to save guest' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      guest: {
        id: guest.id,
        name: guest.name,
        table_num: guest.table_num
      }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
