import { createClient } from '@supabase/supabase-js'

// IMPORTANT: this file must only ever be imported from server-side code
// (API routes under app/api/**). SUPABASE_SERVICE_ROLE_KEY is NOT prefixed
// with NEXT_PUBLIC_, so Next.js keeps it out of the browser bundle. Never
// rename it to start with NEXT_PUBLIC_, and never import this file from
// a 'use client' component.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
