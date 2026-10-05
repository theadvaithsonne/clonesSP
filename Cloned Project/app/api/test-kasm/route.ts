import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Kasm server configuration
const KASM_BASE_URL = 'https://deskstream.garage.app';

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

export async function GET() {
  try {
    console.log('Testing Kasm server connectivity...');
    
    // Test basic connectivity first
    const testUrl = `${KASM_BASE_URL}`;
    console.log('Testing basic connectivity to:', testUrl);
    
    const response = await kasmFetch(testUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    return NextResponse.json({
      success: true,
      message: 'Kasm server is reachable',
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      url: testUrl,
    });
    
  } catch (error) {
    console.error('Kasm connectivity test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        url: KASM_BASE_URL,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('Testing Kasm API endpoint...');
    
    // Test the actual API endpoint
    const apiUrl = `${KASM_BASE_URL}/api/public/get_kasms`;
    const requestBody = {
      api_key: 'utJ1XOXALEog',
      api_key_secret: 'KR6hrWonEj7ImrK4ZItqCc6nMPTc9UOE',
    };
    
    console.log('Testing API endpoint:', apiUrl);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await kasmFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    console.log('API Response status:', response.status);
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()));
    
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      responseData = { error: 'Failed to parse response as JSON' };
    }
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      url: apiUrl,
    });
    
  } catch (error) {
    console.error('Kasm API test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        url: `${KASM_BASE_URL}/api/public/get_kasms`,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}
