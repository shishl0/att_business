import { createClient } from '@supabase/supabase-js'

// You must assure that these variables are set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// We use service role key so Server Actions have full db access, bypassing RLS.
// This is safe because these server actions are never exposed to the client bundle.
export const supabase = createClient(supabaseUrl, supabaseServiceKey)
