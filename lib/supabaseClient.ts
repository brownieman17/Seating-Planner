import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      users_profile: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      guests: {
        Row: {
          id: string
          event_id: string
          name: string
          table_num: number | null
          external_id: string | null
          source: 'manual' | 'csv' | 'eventbrite' | 'webhook'
          created_at: string
          partner_id: string | null
          group_id: string | null
          meal_selection: string | null
          dietary_restrictions: string[]
          keep_apart_with: string[]
          is_vip: boolean
          is_child: boolean
          side: 'bride' | 'groom' | 'both' | null
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          table_num?: number | null
          external_id?: string | null
          source?: 'manual' | 'csv' | 'eventbrite' | 'webhook'
          created_at?: string
          partner_id?: string | null
          group_id?: string | null
          meal_selection?: string | null
          dietary_restrictions?: string[]
          keep_apart_with?: string[]
          is_vip?: boolean
          is_child?: boolean
          side?: 'bride' | 'groom' | 'both' | null
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          table_num?: number | null
          external_id?: string | null
          source?: 'manual' | 'csv' | 'eventbrite' | 'webhook'
          created_at?: string
          partner_id?: string | null
          group_id?: string | null
          meal_selection?: string | null
          dietary_restrictions?: string[]
          keep_apart_with?: string[]
          is_vip?: boolean
          is_child?: boolean
          side?: 'bride' | 'groom' | 'both' | null
        }
      }
      groups: {
        Row: {
          id: string
          event_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      layouts: {
        Row: {
          id: string
          event_id: string
          room: any
          tables: any
          fixtures: any
          updated_at: string
          layout_type: 'ceremony' | 'cocktail' | 'reception'
        }
        Insert: {
          id?: string
          event_id: string
          room: any
          tables: any
          fixtures: any
          updated_at?: string
          layout_type: 'ceremony' | 'cocktail' | 'reception'
        }
        Update: {
          id?: string
          event_id?: string
          room?: any
          tables?: any
          fixtures?: any
          updated_at?: string
          layout_type?: 'ceremony' | 'cocktail' | 'reception'
        }
      }
    }
  }
}
