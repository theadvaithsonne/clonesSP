"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Monitor,
  Play,
  Pause,
  Square,
  RotateCcw,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  HardDrive,
  Cpu,
  Plus,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { garageCloudApi, type GarageCloudSession } from "@/lib/garage-cloud-api";

interface GarageCloudSectionProps {
  onClose?: () => void;
}

export default function GarageCloudSection({ onClose }: GarageCloudSectionProps) {
  const [sessions, setSessions] = useState<GarageCloudSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GarageCloudSession | null>(null);
  const [iframeMode, setIframeMode] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await garageCloudApi.getSessions();
      
      if (response.success && response.data) {
        setSessions(response.data.garage_cloud_sessions || []);
        setUsingMockData(false);
      } else {
        // Check if it's a CORS error
        if (response.error?.includes('CORS_ERROR')) {
          console.warn("CORS Error detected, using mock data");
          setError("CORS Error: Unable to connect to Kasm server directly. Using demo data. Please configure CORS on your Kasm server or use a proxy.");
        } else {
          console.warn("Kasm API not available, using mock data");
          setError("Unable to connect to Kasm server. Using demo data.");
        }
        
        // Fallback to mock data
        setUsingMockData(true);
        const mockSessions: KasmSession[] = [
          {
            garage_cloud_id: "demo-session-1",
            user: { username: "demo_user" },
            image: {
              image_id: "chrome-image",
              name: "kasmweb/chrome:latest",
              friendly_name: "Chrome Browser",
              image_src: "/img/chrome.png"
            },
            server: {
              hostname: "demo-server",
              port: 443,
              zone_name: "default",
              provider: "hardware"
            },
            start_date: new Date().toISOString(),
            expiration_date: new Date(Date.now() + 3600000).toISOString(),
            memory: 2048000000,
            cores: 2,
            operational_status: "running",
            user_id: "a227e798dae54e4cafc6b2996269236d", // Use the actual user ID from your curl test
            hostname: "demo-server",
            port: 443,
            keepalive_date: new Date().toISOString(),
            host: "192.168.1.100",
            server_id: "demo-server-id"
          },
          {
            garage_cloud_id: "demo-session-2",
            user: { username: "test_user" },
            image: {
              image_id: "ubuntu-image",
              name: "kasmweb/ubuntu:latest",
              friendly_name: "Ubuntu Desktop",
              image_src: "/img/ubuntu.png"
            },
            server: {
              hostname: "demo-server-2",
              port: 443,
              zone_name: "default",
              provider: "hardware"
            },
            start_date: new Date(Date.now() - 1800000).toISOString(),
            expiration_date: new Date(Date.now() + 1800000).toISOString(),
            memory: 4096000000,
            cores: 4,
            operational_status: "starting",
            user_id: "a227e798dae54e4cafc6b2996269236d", // Use the actual user ID from your curl test
            hostname: "demo-server-2",
            port: 443,
            keepalive_date: new Date().toISOString(),
            host: "192.168.1.101",
            server_id: "demo-server-2-id"
          }
        ];
        setSessions(mockSessions);
      }
    } catch (err) {
      console.error("Failed to load Garage Cloud sessions:", err);
      setError("Failed to load Garage Cloud sessions. Please try again.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleSessionAction = async (action: string, sessionId: string) => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    try {
      let response;
      switch (action) {
        case 'start':
          response = await garageCloudApi.startSession(sessionId);
          break;
        case 'pause':
          response = await garageCloudApi.pauseSession(sessionId);
          break;
        case 'stop':
          response = await garageCloudApi.stopSession(sessionId);
          break;
        case 'restart':
          response = await garageCloudApi.restartSession(sessionId);
          break;
        case 'delete':
          response = await garageCloudApi.deleteSession(sessionId);
          break;
        default:
          return;
      }

      if (response.success) {
        await loadSessions(); // Refresh the list
      } else {
        console.error(`Failed to ${action} session:`, response.error);
      }
    } catch (error) {
      console.error(`Error ${action}ing session:`, error);
    }
  };

  const handleConnectSession = async (session: GarageCloudSession) => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    try {
      // Get the session status to obtain the connection token and URL
      const response = await garageCloudApi.getSession(session.garage_cloud_id, session.user_id);
      
      if (response.success && response.data) {
        // The response should contain kasm_url for connection
        if (response.data.garage_cloud_url) {
          const fullUrl = `https://${session.hostname}${response.data.garage_cloud_url}`;
          window.open(fullUrl, "_blank");
        } else {
          // Fallback: construct URL manually if kasm_url is not provided
          console.warn("No garage_cloud_url in response, constructing manually");
          const manualUrl = `https://${session.hostname}/#/connect/garage-cloud/${session.garage_cloud_id}/${session.user_id}`;
          window.open(manualUrl, "_blank");
        }
      } else {
        console.error("Failed to get session status:", response.error);
        alert("Failed to get session connection details. Please try again.");
      }
    } catch (error) {
      console.error("Error connecting to session:", error);
      alert("Error connecting to session. Please try again.");
    }
  };

  const handleIframeConnect = async (session: GarageCloudSession) => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    try {
      // Get the session status to obtain the connection token and URL
      const response = await garageCloudApi.getSession(session.garage_cloud_id, session.user_id);
      
      if (response.success && response.data) {
        // The response should contain kasm_url for connection
        if (response.data.garage_cloud_url) {
          // For iframe embedding, we need to use a different approach
          // Instead of direct iframe, we'll use a proxy approach with user_id
          const proxyUrl = `/api/garage-cloud-iframe/${session.garage_cloud_id}?user_id=${session.user_id}`;
          setSelectedSession({ ...session, kasm_url: proxyUrl });
          setIframeMode(true);
        } else {
          console.error("No garage_cloud_url in response");
          alert("Failed to get session connection details. Please try again.");
        }
      } else {
        console.error("Failed to get session status:", response.error);
        alert("Failed to get session connection details. Please try again.");
      }
    } catch (error) {
      console.error("Error connecting to session:", error);
      alert("Error connecting to session. Please try again.");
    }
  };

  const handleIframeConnectWithFallback = async (session: GarageCloudSession) => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    try {
      // Get the session status to obtain the connection token and URL
      const response = await garageCloudApi.getSession(session.garage_cloud_id, session.user_id);
      
      if (response.success && response.data) {
        // The response should contain kasm_url for connection
        if (response.data.garage_cloud_url) {
          // Try iframe first, but provide fallback option
          const proxyUrl = `/api/garage-cloud-iframe/${session.garage_cloud_id}?user_id=${session.user_id}`;
          
          // Show a dialog asking user to choose between iframe and new tab
          const useIframe = confirm(
            "Choose connection method:\n\n" +
            "OK = Open in iframe (may have cookie issues)\n" +
            "Cancel = Open in new tab (recommended)"
          );
          
          if (useIframe) {
            setSelectedSession({ ...session, garage_cloud_url: proxyUrl });
            setIframeMode(true);
          } else {
            // Fallback to new tab
            const fullUrl = `https://${session.hostname}${response.data.garage_cloud_url}`;
            window.open(fullUrl, "_blank");
          }
        } else {
          console.error("No garage_cloud_url in response");
          alert("Failed to get session connection details. Please try again.");
        }
      } else {
        console.error("Failed to get session status:", response.error);
        alert("Failed to get session connection details. Please try again.");
      }
    } catch (error) {
      console.error("Error connecting to session:", error);
      alert("Error connecting to session. Please try again.");
    }
  };

  const handleCreateSession = async () => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    setCreatingSession(true);
    try {
      // For now, we'll create a session with a default image
      // You can modify this to show a dialog for image selection
      const response = await garageCloudApi.createSession({
        image_id: "72e9ef6d74864b968ef7c6be1a06c3e2", // Docker Ubuntu Jammy from your server
        user_id: "a227e798dae54e4cafc6b2996269236d", // Use the actual user ID from your curl test
        zone_name: "default"
      });
      
      if (response.success) {
        await loadSessions(); // Refresh the list
        alert("Session created successfully!");
      } else {
        console.error("Failed to create session:", response.error);
        alert("Failed to create session. Please try again.");
      }
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Error creating session. Please try again.");
    } finally {
      setCreatingSession(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
        return "bg-green-500 hover:bg-green-600";
      case "paused":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "stopped":
        return "bg-red-500 hover:bg-red-600";
      case "starting":
        return "bg-blue-500 hover:bg-blue-600";
      case "stopping":
        return "bg-orange-500 hover:bg-orange-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-400" />;
      case "stopped":
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case "starting":
        return <Clock className="h-4 w-4 text-blue-400" />;
      case "stopping":
        return <Clock className="h-4 w-4 text-orange-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Garage Cloud Sessions</h2>
          <p className="text-white/60">Manage your virtual desktop sessions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleCreateSession}
            disabled={creatingSession}
            variant="outline"
            size="sm"
            className="text-white border-white/20 hover:bg-white/10"
          >
            <Plus className={cn("h-4 w-4 mr-2", creatingSession && "animate-spin")} />
            {creatingSession ? "Creating..." : "New Session"}
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="text-white border-white/20 hover:bg-white/10"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="text-white border-white/20 hover:bg-white/10"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* CORS Solution Information */}
      {error && error.includes('CORS') && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-3">
            🔧 CORS Configuration Required
          </h3>
          <div className="space-y-3 text-sm text-white/80">
            <p>To connect to your Garage Cloud server, you need to configure CORS. Here are the solutions:</p>
            
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-300">Option 1: Configure Garage Cloud Server CORS</h4>
              <p>Add these headers to your Kasm server configuration:</p>
              <div className="bg-black/20 rounded p-3 font-mono text-xs">
                <div>Access-Control-Allow-Origin: http://localhost:3000</div>
                <div>Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS</div>
                <div>Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-yellow-300">Option 2: Use Next.js API Proxy</h4>
              <p>Create a proxy endpoint in your Next.js app to bypass CORS:</p>
              <div className="bg-black/20 rounded p-3 font-mono text-xs">
                <div>// pages/api/garage-cloud-proxy/[...path].ts</div>
                <div>// Forward requests to your Garage Cloud server</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-yellow-300">Option 3: Browser Extension</h4>
              <p>Use a CORS browser extension for development (not recommended for production).</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-green-400"></div>
            <p className="text-white/60">Loading Garage Cloud sessions...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Sessions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <Card key={session.garage_cloud_id} className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Monitor className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{session.image.friendly_name}</h3>
                        <p className="text-sm text-white/60">{session.user.username}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={session.operational_status === 'running' ? 'default' : 'secondary'}
                      className={cn(
                        session.operational_status === 'running' ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'
                      )}
                    >
                      {session.operational_status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Session Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Server:</span>
                      <span className="text-white">{session.server.hostname}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Zone:</span>
                      <span className="text-white">{session.server.zone_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Memory:</span>
                      <span className="text-white">{(session.memory / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Cores:</span>
                      <span className="text-white">{session.cores}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Started:</span>
                      <span className="text-white">{formatDate(session.start_date)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {session.operational_status === 'running' ? (
                      <>
                        <Button
                          onClick={() => handleConnectSession(session)}
                          size="sm"
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          New Tab
                        </Button>
                        <Button
                          onClick={() => handleIframeConnect(session)}
                          size="sm"
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                        >
                          <Monitor className="h-4 w-4 mr-1" />
                          Embed
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleSessionAction('start', session.garage_cloud_id)}
                        disabled={session.operational_status === 'running'}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                          <Square className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-gray-800 border-gray-700">
                        <DropdownMenuItem
                          onClick={() => handleSessionAction('pause', session.garage_cloud_id)}
                          className="text-white hover:bg-gray-700"
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSessionAction('stop', session.garage_cloud_id)}
                          className="text-white hover:bg-gray-700"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSessionAction('restart', session.garage_cloud_id)}
                          className="text-white hover:bg-gray-700"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restart
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSessionAction('delete', session.garage_cloud_id)}
                          className="text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {sessions.length === 0 && !loading && (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Sessions Found</h3>
              <p className="text-white/60 mb-4">No Garage Cloud sessions are currently running.</p>
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          )}
        </>
      )}

      {/* Iframe View */}
      {iframeMode && selectedSession && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <Monitor className="h-5 w-5 text-white" />
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedSession.image.friendly_name}</h3>
                <p className="text-sm text-white/60">{selectedSession.user.username}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIframeMode(false)}
                variant="outline"
                size="sm"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Minimize2 className="h-4 w-4 mr-2" />
                Exit Fullscreen
              </Button>
            </div>
          </div>
          <div className="flex-1 relative">
            <iframe
              src={selectedSession.garage_cloud_url}
              className="w-full h-full border-0"
              allow="fullscreen; microphone; camera; clipboard-read; clipboard-write; autoplay"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
              title={`Garage Cloud Session - ${selectedSession.image.friendly_name}`}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}