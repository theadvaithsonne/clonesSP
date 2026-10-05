// Kasm API integration utilities
export interface KasmSession {
  kasm_id: string;
  user: {
    username: string;
  };
  image: {
    image_id: string;
    name: string;
    friendly_name: string;
    image_src: string;
  };
  server: {
    hostname: string;
    port: number;
    zone_name: string;
    provider: string;
  };
  start_date: string;
  expiration_date: string;
  memory: number;
  cores: number;
  operational_status: string;
  kasm_url?: string;
  share_id?: string;
  user_id: string;
  container_id?: string;
  hostname: string;
  port: number;
  keepalive_date: string;
  persistent_profile_mode?: string;
  host: string;
  server_id: string;
  port_map?: {
    audio?: { port: number; path: string };
    vnc?: { port: number; path: string };
    audio_input?: { port: number; path: string };
    uploads?: { port: number; path: string };
  };
  client_settings?: {
    allow_kasm_audio: boolean;
    idle_disconnect: number;
    lock_sharing_video_mode: boolean;
    allow_persistent_profile: boolean;
    allow_kasm_clipboard_down: boolean;
    allow_kasm_microphone: boolean;
    allow_kasm_downloads: boolean;
    kasm_audio_default_on: boolean;
    allow_point_of_presence: boolean;
    allow_kasm_uploads: boolean;
    allow_kasm_clipboard_up: boolean;
    enable_webp: boolean;
    allow_kasm_sharing: boolean;
    allow_kasm_clipboard_seamless: boolean;
  };
}

export interface KasmApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface KasmSessionListResponse {
  kasms: KasmSession[];
  current_time: string;
}

// Kasm API configuration
const KASM_CONFIG = {
  baseUrl: "https://deskstream.garage.app",
  apiKey: "utJ1XOXALEog",
  apiSecret: "KR6hrWonEj7ImrK4ZItqCc6nMPTc9UOE",
  // Always use proxy to avoid CORS issues
  useProxy: true,
  proxyUrl: '/api/kasm-proxy',
};

// Generate authentication headers for Kasm API
function getKasmAuthHeaders(): HeadersInit {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 15);
  
  // Create signature (simplified - in production you'd use proper HMAC)
  const signature = Buffer.from(`${KASM_CONFIG.apiKey}:${timestamp}:${nonce}:${KASM_CONFIG.apiSecret}`).toString('base64');
  
  return {
    'Authorization': `Bearer ${signature}`,
    'X-API-Key': KASM_CONFIG.apiKey,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'Content-Type': 'application/json',
  };
}

// Get Kasm authentication data for JSON body
function getKasmAuthData() {
  return {
    api_key: KASM_CONFIG.apiKey,
    api_key_secret: KASM_CONFIG.apiSecret,
  };
}

// Generic Kasm API call function
async function kasmApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<KasmApiResponse<T>> {
  // Use proxy in development to avoid CORS issues
  const url = KASM_CONFIG.useProxy
    ? `${KASM_CONFIG.proxyUrl}${endpoint}`
    : `${KASM_CONFIG.baseUrl}/api/public${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: KASM_CONFIG.useProxy
        ? { ...options.headers } // Proxy handles authentication
        : {
            ...getKasmAuthHeaders(),
            ...options.headers,
          },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        data: null as T,
        error: `Kasm API error: ${response.status} ${response.statusText} - ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Kasm API call failed:', error);
    
    // Check if it's a CORS error
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return {
        success: false,
        data: null as T,
        error: 'CORS_ERROR: Unable to connect to Kasm server. Please check CORS configuration or use a proxy.',
      };
    }
    
    return {
      success: false,
      data: null as T,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Kasm API functions
export const kasmApi = {
  // Get all sessions (Kasms)
  async getSessions(): Promise<KasmApiResponse<KasmSessionListResponse>> {
    return kasmApiCall<KasmSessionListResponse>('/get_kasms');
  },

  // Get session by ID
  async getSession(sessionId: string, userId?: string): Promise<KasmApiResponse<KasmSession>> {
    return kasmApiCall<KasmSession>('/get_kasm_status', {
      method: 'POST',
      body: JSON.stringify({ 
        kasm_id: sessionId,
        user_id: userId 
      }),
    });
  },

  // Start a session (Request Kasm)
  async startSession(sessionId: string): Promise<KasmApiResponse<{ success: boolean }>> {
    return kasmApiCall<{ success: boolean }>('/request_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
  },

  // Stop a session (Destroy Kasm)
  async stopSession(sessionId: string): Promise<KasmApiResponse<{ success: boolean }>> {
    return kasmApiCall<{ success: boolean }>('/destroy_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
  },

  // Pause a session (not directly supported, but we can stop and restart)
  async pauseSession(sessionId: string): Promise<KasmApiResponse<{ success: boolean }>> {
    return kasmApiCall<{ success: boolean }>('/destroy_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
  },

  // Resume a session (Request Kasm)
  async resumeSession(sessionId: string): Promise<KasmApiResponse<{ success: boolean }>> {
    return kasmApiCall<{ success: boolean }>('/request_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
  },

  // Restart a session (Destroy then Request)
  async restartSession(sessionId: string): Promise<KasmApiResponse<{ success: boolean }>> {
    // First destroy the session
    await kasmApiCall<{ success: boolean }>('/destroy_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
    
    // Then request a new one
    return kasmApiCall<{ success: boolean }>('/request_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
  },

  // Delete a session (Destroy Kasm)
  async deleteSession(sessionId: string): Promise<KasmApiResponse<{ success: boolean }>> {
    return kasmApiCall<{ success: boolean }>('/destroy_kasm', {
      method: 'POST',
      body: JSON.stringify({ kasm_id: sessionId }),
    });
  },

  // Create a new session (Request Kasm with image)
  async createSession(params: { image_id: string; user_id: string; zone_name?: string }): Promise<KasmApiResponse<{ success: boolean; kasm_id?: string }>> {
    return kasmApiCall<{ success: boolean; kasm_id?: string }>('/request_kasm', {
      method: 'POST',
      body: JSON.stringify({
        image_id: params.image_id,
        user_id: params.user_id,
        zone_name: params.zone_name || 'default'
      }),
    });
  },
};