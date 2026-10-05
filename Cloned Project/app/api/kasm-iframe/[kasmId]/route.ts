import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Kasm server configuration
const KASM_BASE_URL = 'https://deskstream.garage.app';
const KASM_API_KEY = 'utJ1XOXALEog';
const KASM_API_SECRET = 'KR6hrWonEj7ImrK4ZItqCc6nMPTc9UOE';

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

// Get Kasm authentication data
function getKasmAuthData() {
  return {
    api_key: KASM_API_KEY,
    api_key_secret: KASM_API_SECRET,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { kasmId: string } }
) {
  try {
    const kasmId = params.kasmId;
    
    // Get user_id from query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    if (!userId) {
      throw new Error('user_id parameter is required');
    }
    
    console.log(`Kasm iframe request - kasmId: ${kasmId}, userId: ${userId}`);
    
    // First, get the session status to get the connection URL
    const sessionResponse = await kasmFetch(`${KASM_BASE_URL}/api/public/get_kasm_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...getKasmAuthData(),
        kasm_id: kasmId,
        user_id: userId, // Use the actual user ID from query params
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      throw new Error(`Failed to get session status: ${sessionResponse.status} - ${errorText}`);
    }

    const sessionData = await sessionResponse.json();
    
    if (!sessionData.kasm_url) {
      throw new Error('No kasm_url in session response');
    }

    // Construct the full Kasm URL
    const kasmUrl = `${KASM_BASE_URL}${sessionData.kasm_url}`;
    
    // Return an HTML page that embeds the Kasm session
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kasm Session</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #000;
        }
        #kasm-container {
            width: 100vw;
            height: 100vh;
            position: relative;
        }
        #kasm-iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: #000;
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-family: Arial, sans-serif;
        }
        .error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff6b6b;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div id="kasm-container">
        <div class="loading" id="loading">
            Loading Kasm session...
        </div>
        <iframe 
            id="kasm-iframe"
            src="${kasmUrl}"
            allow="fullscreen; microphone; camera; clipboard-read; clipboard-write; autoplay; cookies"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads allow-storage-access-by-user-activation"
            style="display: none;"
            onload="handleIframeLoad()"
            onerror="handleIframeError()"
        ></iframe>
    </div>

    <script>
        function handleIframeLoad() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('kasm-iframe').style.display = 'block';
        }
        
        function handleIframeError() {
            document.getElementById('loading').innerHTML = 
                '<div class="error">Failed to load Kasm session. This may be due to cookie restrictions. Please try opening in a new tab.</div>';
        }
        
        // Handle iframe communication
        window.addEventListener('message', function(event) {
            // Handle messages from the iframe if needed
            console.log('Message from iframe:', event.data);
            
            // Check for authentication errors
            if (event.data && typeof event.data === 'string' && event.data.includes('Unauthorized')) {
                document.getElementById('loading').innerHTML = 
                    '<div class="error">Authentication failed. Please check cookie settings and try again.</div>';
            }
        });
        
        // Auto-resize iframe if needed
        window.addEventListener('resize', function() {
            const iframe = document.getElementById('kasm-iframe');
            iframe.style.width = '100vw';
            iframe.style.height = '100vh';
        });
        
        // Try to enable storage access for cookies
        if ('requestStorageAccess' in document) {
            document.requestStorageAccess().then(() => {
                console.log('Storage access granted');
            }).catch((error) => {
                console.warn('Storage access denied:', error);
            });
        }
        
        // Monitor for cookie-related errors
        setTimeout(() => {
            const iframe = document.getElementById('kasm-iframe');
            if (iframe && iframe.contentDocument) {
                try {
                    // Check if iframe loaded successfully
                    const iframeDoc = iframe.contentDocument;
                    if (iframeDoc.body && iframeDoc.body.textContent.includes('Unauthorized')) {
                        handleIframeError();
                    }
                } catch (e) {
                    // Cross-origin access denied - this is expected
                    console.log('Cross-origin iframe access blocked (expected)');
                }
            }
        }, 5000);
    </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
        'Set-Cookie': 'kasm-session-proxy=true; SameSite=None; Secure; Path=/',
        'Access-Control-Allow-Credentials': 'true',
      },
    });

  } catch (error) {
    console.error('Kasm iframe proxy error:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.message.includes('user_id parameter is required')) {
        errorMessage = 'Missing user_id parameter. Please ensure the session is accessed with proper authentication.';
      } else if (error.message.includes('Failed to get session status')) {
        errorMessage = 'Failed to authenticate with Kasm session. This may be due to incorrect user_id or session permissions.';
      } else if (error.message.includes('No kasm_url')) {
        errorMessage = 'Session is not ready or accessible. Please try again later.';
      } else {
        errorMessage = error.message;
      }
    }
    
    const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kasm Session Error</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }
        .error-container {
            text-align: center;
            padding: 40px;
            border: 1px solid #ff6b6b;
            border-radius: 8px;
            background: rgba(255, 107, 107, 0.1);
        }
        .error-title {
            color: #ff6b6b;
            font-size: 24px;
            margin-bottom: 16px;
        }
        .error-message {
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .retry-button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        .retry-button:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-title">Session Error</div>
        <div class="error-message">
            ${errorMessage}<br>
            Please try opening the session in a new tab instead.
        </div>
        <button class="retry-button" onclick="window.location.reload()">
            Retry
        </button>
    </div>
</body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
}
