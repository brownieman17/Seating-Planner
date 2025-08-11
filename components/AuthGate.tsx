'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'

interface AuthGateProps {
  children: React.ReactNode
  onImportLocalData?: () => void
}

export default function AuthGate({ children, onImportLocalData }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [showImportPrompt, setShowImportPrompt] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      
      // Check for local data when user signs in
      if (session?.user) {
        const localData = localStorage.getItem('seating_planner_v1')
        if (localData) {
          setShowImportPrompt(true)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Check your email for the login link!')
    }
  }

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      alert(error.message)
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      alert(error.message)
    }
  }

  const handleImportLocalData = () => {
    setShowImportPrompt(false)
    onImportLocalData?.()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center mb-8">Seating Planner</h1>
          
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Sign in with Magic Link
            </button>
          </form>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Sign in with Google
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500 text-center">
            Sign in to save your seating plans to the cloud and access them from any device.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Seating Planner</h1>
            <div className="text-sm text-gray-600">
              Signed in as {user.email}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Import Local Data Prompt */}
      {showImportPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Import Local Data?</h3>
            <p className="text-gray-600 mb-6">
              We found local data on your device. Would you like to import it into your cloud account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleImportLocalData}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
              >
                Import to Cloud
              </button>
              <button
                onClick={() => setShowImportPrompt(false)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-50"
              >
                Keep Local Only
              </button>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  )
}
