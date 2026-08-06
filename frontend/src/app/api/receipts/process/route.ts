import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl, backendNotConfigured } from '../../backend-url'

export async function POST(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl()
    if (!backendUrl) {
      return backendNotConfigured()
    }

    // Get the form data from the request
    const formData = await request.formData()
    
    // Get the authorization header
    const authorization = request.headers.get('authorization')
    
    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward the request to the Express.js backend
    const response = await fetch(`${backendUrl}/api/receipts/process`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
      },
      body: formData,
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