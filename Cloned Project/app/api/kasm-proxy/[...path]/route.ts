import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Kasm server configuration
const KASM_BASE_URL = 'https://deskstream.garage.app';
const KASM_API_KEY = 'utJ1XOXALEog';
const KASM_API_SECRET = 'KR6hrWonEj7ImrK4ZItqCc6nMPTc9UOE';

// Generate authentication data for Kasm API
function getKasmAuthData(): { api_key: string; api_key_secret: string } {
  return {
    api_key: KASM_API_KEY,
    api_key_secret: KASM_API_SECRET,
  };
}

// Custom fetch function that handles self-signed certificates
async function kasmFetch(url: string, options: RequestInit): Promise<Response> {
  // For HTTPS URLs with self-signed certificates, we need to disable SSL verification
  if (url.startsWith('https://')) {
    // Set environment variable to ignore SSL certificate errors
    const originalValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    try {
      // Use the global fetch with SSL verification disabled
      const response = await fetch(url, options);
      return response;
    } finally {
      // Reset the environment variable
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalValue;
    }
  }
  
  // For HTTP URLs, use regular fetch
  return fetch(url, options);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  let kasmUrl = '';
  let requestBody = {};
  
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    
    // Kasm API uses POST requests with JSON body containing auth data
    kasmUrl = `${KASM_BASE_URL}/api/public/${path}`;
    
    // Prepare request body with authentication
    requestBody = {
      ...getKasmAuthData(),
    };
    
    console.log('Attempting to connect to Kasm server...');
    console.log('URL:', kasmUrl);
    console.log('Body:', JSON.stringify(requestBody, null, 2));
    
    const response = await kasmFetch(kasmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // Add timeout and additional options
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Kasm API error: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Add CORS headers to the response
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      },
    });
  } catch (error) {
    console.error('Kasm proxy GET error:', error);
    console.error('Request URL:', kasmUrl);
    console.error('Request body:', requestBody);
    console.error('Error type:', error instanceof Error ? error.constructor.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    
    // Check if it's a network error
    const isNetworkError = error instanceof Error && (
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('timeout')
    );
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          url: kasmUrl,
          method: 'POST',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          isNetworkError,
          troubleshooting: {
            checkServer: 'Verify Kasm server is running at https://192.168.0.185',
            checkNetwork: 'Ensure network connectivity to 192.168.0.185',
            checkAPI: 'Verify API endpoint /api/public/get_kasms exists',
            checkCredentials: 'Confirm API key and secret are correct',
            testEndpoint: 'Try visiting /api/test-kasm to test connectivity'
          }
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    
    const kasmUrl = `${KASM_BASE_URL}/api/public/${path}`;
    const requestBody = await request.json();
    
    // Merge authentication data with request body
    const kasmRequestBody = {
      ...getKasmAuthData(),
      ...requestBody,
    };
    
    const response = await kasmFetch(kasmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kasmRequestBody),
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Kasm API error: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Add CORS headers to the response
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      },
    });
  } catch (error) {
    console.error('Kasm proxy error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    
    const kasmUrl = `${KASM_BASE_URL}/api/public/${path}`;
    const requestBody = await request.json();
    
    // Merge authentication data with request body
    const kasmRequestBody = {
      ...getKasmAuthData(),
      ...requestBody,
    };
    
    const response = await kasmFetch(kasmUrl, {
      method: 'POST', // Kasm API uses POST for all operations
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kasmRequestBody),
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Kasm API error: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Add CORS headers to the response
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      },
    });
  } catch (error) {
    console.error('Kasm proxy error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    
    const kasmUrl = `${KASM_BASE_URL}/api/public/${path}`;
    const requestBody = await request.json();
    
    // Merge authentication data with request body
    const kasmRequestBody = {
      ...getKasmAuthData(),
      ...requestBody,
    };
    
    const response = await kasmFetch(kasmUrl, {
      method: 'POST', // Kasm API uses POST for all operations
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kasmRequestBody),
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Kasm API error: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Add CORS headers to the response
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      },
    });
  } catch (error) {
    console.error('Kasm proxy error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    },
  });
}
