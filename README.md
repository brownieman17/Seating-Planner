# Seating Planner

A comprehensive wedding and event seating planner with cloud sync, integrations, and advanced features.

## Features

### Core Functionality
- **Guest Management**: Add, edit, and organize guests with detailed information
- **Table Assignment**: Drag-and-drop guest assignment with capacity management
- **Cloud Sync**: Save your data to Supabase and access from any device
- **Multiple Events**: Manage multiple events with separate guest lists and layouts

### Advanced Guest Features
- **Couples & Groups**: Link partners and create color-coded groups
- **Meals & Dietary**: Track meal selections and dietary restrictions
- **Keep Apart**: Specify guests who should not be seated together
- **VIP & Children**: Mark special guests and children
- **Side Assignment**: Organize by bride/groom side

### Wedding Layouts
- **Three Layout Types**: Ceremony, Cocktail Hour, and Reception
- **Table Presets**: Pre-configured table sizes (Round 60"/72", Rect 6ft/8ft, etc.)
- **Wedding Fixtures**: Sweetheart table, head table, dance floor, DJ booth, bar, buffet, cake table, gift table, escort cards
- **Drag & Drop**: Visual layout editor with snap-to-grid functionality

### Integrations
- **Eventbrite**: Import attendees directly from your events
- **RSVP Webhooks**: Receive RSVPs automatically from platforms like RSVPify
- **CSV Import/Export**: Import guest lists and export escort cards
- **CSV Presets**: Pre-configured column mappings for popular platforms

### Printables & Exports
- **Place Cards**: Generate printable place cards with meal icons
- **Escort Cards**: Export CSV for escort card printing
- **Kitchen Summary**: Detailed meal counts and dietary restrictions
- **Per-Table Breakdowns**: Individual table meal and dietary summaries

## Setup

### 1. Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### 2. Installation
```bash
git clone <repository-url>
cd seating-planner
npm install
```

### 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
WEBHOOK_SECRET=your_webhook_secret
```

### 4. Database Schema

Run this SQL in your Supabase SQL editor:

```sql
-- Users profile table
create table public.users_profile (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz default now()
);

-- Events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Guests table
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  table_num int,
  external_id text,
  source text, -- 'manual' | 'csv' | 'eventbrite' | 'webhook'
  partner_id uuid references public.guests(id),
  group_id uuid references public.groups(id),
  meal_selection text,
  dietary_restrictions text[],
  keep_apart_with text[],
  is_vip boolean default false,
  is_child boolean default false,
  side text, -- 'bride' | 'groom' | 'both'
  created_at timestamptz default now()
);

-- Groups table
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

-- Layouts table
create table public.layouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  layout_type text not null, -- 'ceremony' | 'cocktail' | 'reception'
  room jsonb not null,
  tables jsonb not null,
  fixtures jsonb not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table users_profile enable row level security;
alter table events enable row level security;
alter table guests enable row level security;
alter table groups enable row level security;
alter table layouts enable row level security;

-- RLS Policies
create policy "users can read/write own events"
  on events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can read/write own guests"
  on guests for all
  using ( exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()) )
  with check ( exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()) );

create policy "users can read/write own groups"
  on groups for all
  using ( exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()) )
  with check ( exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()) );

create policy "users can read/write own layouts"
  on layouts for all
  using ( exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()) )
  with check ( exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid()) );
```

### 5. Authentication Setup

1. In Supabase, go to Authentication > Settings
2. Configure your site URL (e.g., `http://localhost:3000`)
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback` (for production)

### 6. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to start using the application.

## Usage

### Getting Started
1. Sign in with your email (magic link) or Google
2. Create your first event
3. Add guests manually or import from CSV/Eventbrite
4. Design your layout using the visual editor
5. Assign guests to tables
6. Export place cards and kitchen summaries

### Guest Management
- **Add Guests**: Use the "Add Guest" button or import from CSV
- **Edit Guests**: Click "Edit" on any guest to modify details
- **Groups**: Create color-coded groups for families, work colleagues, etc.
- **Partners**: Link couples to keep them together
- **Meals**: Select meal preferences and dietary restrictions

### Layout Design
- **Table Presets**: Choose from pre-configured table sizes
- **Wedding Fixtures**: Add special elements like sweetheart tables, dance floors, etc.
- **Snap to Grid**: Enable grid snapping for precise positioning
- **Multiple Layouts**: Design separate layouts for ceremony, cocktail hour, and reception

### Integrations
- **Eventbrite**: Enter your personal token and event ID to import attendees
- **Webhooks**: Set up RSVP webhooks for automatic guest additions
- **CSV Import**: Upload guest lists with column mapping

### Exports
- **Place Cards**: Generate printable place cards with meal icons
- **Escort Cards**: Export CSV for escort card printing
- **Kitchen Summary**: Print detailed meal and dietary information

## Development

### Project Structure
```
src/
├── app/
│   ├── (authed)/          # Authenticated pages
│   ├── integrations/      # Integrations page
│   ├── api/              # API routes
│   └── auth/             # Auth callbacks
├── components/           # React components
└── lib/                 # Utilities and configurations
```

### Key Technologies
- **Next.js 14**: React framework with App Router
- **Supabase**: Backend-as-a-Service for database and auth
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **react-rnd**: Drag and drop functionality
- **@dnd-kit**: Advanced drag and drop

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `WEBHOOK_SECRET`: Secret for webhook verification

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
