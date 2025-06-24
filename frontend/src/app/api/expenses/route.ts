import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authorization = request.headers.get('authorization')
    
    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the Express.js backend
    const response = await fetch(`${BACKEND_URL}/api/expenses`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
      },
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Expenses GET proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the JSON data from the request
    const body = await request.json()
    
    // Get the authorization header
    const authorization = request.headers.get('authorization')
    
    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the Express.js backend
    const response = await fetch(`${BACKEND_URL}/api/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Expenses POST proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
} 