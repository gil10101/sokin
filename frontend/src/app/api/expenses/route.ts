import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl, backendNotConfigured } from '../backend-url'

export async function GET(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl()
    if (!backendUrl) {
      return backendNotConfigured()
    }

    // Get the authorization header
    const authorization = request.headers.get('authorization')

    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the Express.js backend
    const response = await fetch(`${backendUrl}/api/expenses`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
      },
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl()
    if (!backendUrl) {
      return backendNotConfigured()
    }

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
    const response = await fetch(`${backendUrl}/api/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    )
  }
} 