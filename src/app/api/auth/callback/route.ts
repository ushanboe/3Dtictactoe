import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Use the app URL for redirect, not the API origin
      const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || origin
      return NextResponse.redirect(`${redirectUrl}${next}`)
    }
    
    console.error('Auth callback error:', error)
  }

  // Return the user to an error page with instructions
  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || origin
  return NextResponse.redirect(`${redirectUrl}/auth/auth-code-error`)
}
