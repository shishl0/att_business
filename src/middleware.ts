import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect Admin route
  if (pathname.startsWith('/admin')) {
    const authHeader = request.headers.get('authorization')
    const adminPassword = process.env.ADMIN_PASSWORD
    
    // We can use Basic Auth for simplicity
    if (authHeader) {
      const authValue = authHeader.split(' ')[1]
      if (authValue) {
        // Use atob since Buffer is not available in Edge Runtime
        try {
          const decoded = atob(authValue)
          const separatorIdx = decoded.indexOf(':')
          if (separatorIdx !== -1) {
             const pwd = decoded.substring(separatorIdx + 1)
             if (pwd === adminPassword) {
               return NextResponse.next()
             }
          }
        } catch (e) {
          // Ignore decode errors
        }
      }
    }

    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    })
  }

  // IP restriction for root page
  if (pathname === '/') {
    const forwardedFor = request.headers.get('x-forwarded-for')
    let clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // For local development, allow all requests to ease testing
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next()
    }

    const allowedIp = process.env.NEXT_PUBLIC_ALLOWED_IP || '5.76.128.48'

    if (clientIp !== allowedIp) {
      return new NextResponse('Вы должны быть подключены к сети Doner Centr 5G', {
        status: 403,
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*'],
}
