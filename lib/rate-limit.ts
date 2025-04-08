import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimitMiddleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             '127.0.0.1'
  const now = Date.now()
  const windowMs = Number(process.env.NEXT_PUBLIC_RATE_LIMIT_WINDOW_MS) || 900000 // 15 minutes
  const maxRequests = Number(process.env.NEXT_PUBLIC_MAX_REQUESTS_PER_WINDOW) || 100

  const rateLimitInfo = rateLimitMap.get(ip)

  if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return NextResponse.next()
  }

  if (rateLimitInfo.count >= maxRequests) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  rateLimitInfo.count++
  return NextResponse.next()
}

export function clearRateLimit(ip: string) {
  rateLimitMap.delete(ip)
} 