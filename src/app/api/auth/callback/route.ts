import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') ?? '/'
  
  // Get the base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      `${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(error_description || '')}`
    )
  }

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
            } catch (error) {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!exchangeError) {
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
    
    console.error('Code exchange error:', exchangeError)
    return NextResponse.redirect(
      `${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // No code provided
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error?error=no_code`)
}
