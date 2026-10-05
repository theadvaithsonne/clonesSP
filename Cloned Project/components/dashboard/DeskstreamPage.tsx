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
  Grid3X3,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { kasmApi, type KasmSession } from "@/lib/kasm-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import AppIcon from "./AppIcon";
import { CATALOG } from "./Marketplace";

interface DeskstreamPageProps {
  onClose?: () => void;
}

type AppRow = { id: string; name: string; url: string };

export default function DeskstreamPage({ onClose }: DeskstreamPageProps) {
  const [garageCloudSessions, setGarageCloudSessions] = useState<KasmSession[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<KasmSession | null>(null);
  const [iframeMode, setIframeMode] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [activeTab, setActiveTab] = useState<"apps" | "sessions">("apps");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load apps
      await loadApps();
      
      // Load garage cloud sessions
      await loadGarageCloudSessions();
    } catch (err) {
      console.error("Failed to load deskstream data:", err);
      setError("Failed to load deskstream data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadApps = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{
        apps: { id: string; name: string; url: string }[];
      }>(`/apps/my?orgId=${orgId}`, {}, getToken()!);
      setApps(res.apps || []);
    } catch (error) {
      console.error("Failed to load apps:", error);
    }
  };

  const loadGarageCloudSessions = async () => {
    try {
        const response = await kasmApi.getSessions();
      
      if (response.success && response.data) {
        setGarageCloudSessions(response.data.kasms || []);
        setUsingMockData(false);
      } else {
        // Check if it's a CORS error
        if (response.error?.includes('CORS_ERROR')) {
          console.warn("CORS Error detected, using mock data");
          setUsingMockData(true);
          
          // Mock data for demonstration
          const mockSessions: KasmSession[] = [
            {
              kasm_id: "demo-session-1",
              user: { username: "demo_user" },
              image: {
                image_id: "ubuntu-image",
                name: "kasmweb/ubuntu:latest",
                friendly_name: "Ubuntu Desktop",
                image_src: "/img/ubuntu.png"
              },
              server: {
                hostname: "demo-server",
                port: 443,
                zone_name: "default",
                provider: "hardware"
              },
              start_date: new Date(Date.now() - 3600000).toISOString(),
              expiration_date: new Date(Date.now() + 3600000).toISOString(),
              memory: 2048000000,
              cores: 2,
              operational_status: "running",
              user_id: "a227e798dae54e4cafc6b2996269236d",
              hostname: "demo-server",
              port: 443,
              keepalive_date: new Date().toISOString(),
              host: "192.168.1.100",
              server_id: "demo-server-id"
            },
            {
              kasm_id: "demo-session-2",
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
              user_id: "a227e798dae54e4cafc6b2996269236d",
              hostname: "demo-server-2",
              port: 443,
              keepalive_date: new Date().toISOString(),
              host: "192.168.1.101",
              server_id: "demo-server-2-id"
            }
          ];
          setGarageCloudSessions(mockSessions);
        }
      }
    } catch (err) {
      console.error("Failed to load Garage Cloud sessions:", err);
      setError("Failed to load Garage Cloud sessions. Please try again.");
      setGarageCloudSessions([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
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
          response = await kasmApi.startSession(sessionId);
          break;
        case 'pause':
          response = await kasmApi.pauseSession(sessionId);
          break;
        case 'stop':
          response = await kasmApi.stopSession(sessionId);
          break;
        case 'restart':
          response = await kasmApi.restartSession(sessionId);
          break;
        case 'delete':
          response = await kasmApi.deleteSession(sessionId);
          break;
        default:
          return;
      }

      if (response.success) {
        await loadGarageCloudSessions(); // Refresh the list
      } else {
        console.error(`Failed to ${action} session:`, response.error);
      }
    } catch (error) {
      console.error(`Error ${action}ing session:`, error);
    }
  };

  const handleConnectSession = async (session: KasmSession) => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    try {
      // Get the session status to obtain the connection token and URL
      const response = await kasmApi.getSession(session.kasm_id, session.user_id);
      
      if (response.success && response.data) {
        // The response should contain kasm_url for connection
        if (response.data.kasm_url) {
          const fullUrl = `https://${session.hostname}${response.data.kasm_url}`;
          window.open(fullUrl, "_blank");
        } else {
          // Fallback: construct URL manually if kasm_url is not provided
          console.warn("No kasm_url in response, constructing manually");
          const manualUrl = `https://${session.hostname}/#/connect/kasm/${session.kasm_id}/${session.user_id}`;
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

  const handleIframeConnect = async (session: KasmSession) => {
    if (usingMockData) {
      alert("This is demo data. Real API calls are disabled when using mock data.");
      return;
    }
    
    try {
      // Get the session status to obtain the connection token and URL
      const response = await kasmApi.getSession(session.kasm_id, session.user_id);
      
      if (response.success && response.data) {
        // The response should contain kasm_url for connection
        if (response.data.kasm_url) {
          // For iframe embedding, we need to use a different approach
          // Instead of direct iframe, we'll use a proxy approach with user_id
          const proxyUrl = `/api/kasm-iframe/${session.kasm_id}?user_id=${session.user_id}`;
          setSelectedSession({ ...session, kasm_url: proxyUrl });
          setIframeMode(true);
        } else {
          console.error("No kasm_url in response");
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
      const response = await kasmApi.createSession({
        image_id: "72e9ef6d74864b968ef7c6be1a06c3e2", // Docker Ubuntu Jammy from your server
        user_id: "a227e798dae54e4cafc6b2996269236d", // Use the actual user ID from your curl test
        zone_name: "default"
      });
      
      if (response.success) {
        await loadGarageCloudSessions(); // Refresh the list
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Deskstream</h2>
          <p className="text-white/60 text-sm sm:text-base md:text-lg">Manage your applications and virtual desktop sessions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="h-8 sm:h-10 text-white border-white/20 hover:bg-white/10"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1 sm:mr-2", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="h-8 sm:h-10 text-white border-white/20 hover:bg-white/10"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-1 pt-2 sm:pt-4 overflow-x-auto">
        <Button
          onClick={() => setActiveTab("apps")}
          variant={activeTab === "apps" ? "default" : "ghost"}
          size="sm"
          className={cn(
            "text-xs sm:text-sm font-medium transition-colors h-8 sm:h-10",
            activeTab === "apps"
              ? "bg-green-400 hover:bg-green-500 text-white"
              : "text-white/60 hover:text-white hover:bg-white/10"
          )}
        >
          <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Applications</span>
          <span className="sm:hidden">Apps</span>
        </Button>
        <Button
          onClick={() => setActiveTab("sessions")}
          variant={activeTab === "sessions" ? "default" : "ghost"}
          size="sm"
          className={cn(
            "text-xs sm:text-sm font-medium transition-colors h-8 sm:h-10",
            activeTab === "sessions"
              ? "bg-blue-400 hover:bg-blue-500 text-white"
              : "text-white/60 hover:text-white hover:bg-white/10"
          )}
        >
          <Monitor className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Garage Cloud Sessions</span>
          <span className="sm:hidden">Sessions</span>
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm sm:text-base">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-4 border-white/20 border-t-green-400"></div>
            <p className="text-white/60 text-sm sm:text-base">Loading deskstream...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Applications Tab */}
          {activeTab === "apps" && (
            <div className="pt-4 sm:pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {apps.map((app) => (
                <Card key={app.id} className="bg-white/5 border-white/10 p-3 sm:p-4">
                  <CardHeader className="pb-2 sm:pb-3 p-0">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <AppIcon
                          name={app.name}
                          url={app.url}
                          size={16}
                          icon={
                            CATALOG.find((item) => item.appId === app.id)?.icon ||
                            ""
                          }
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm sm:text-base">{app.name}</h3>
                        <p className="text-xs sm:text-sm text-white/60">Application</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 sm:space-y-4 p-0 pt-3 sm:pt-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => window.open(app.url, "_blank")}
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 h-8 sm:h-10 text-xs sm:text-sm"
                      >
                        <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {apps.length === 0 && (
                <div className="col-span-full text-center py-8 sm:py-12">
                  <Globe className="h-10 w-10 sm:h-12 sm:w-12 text-white/40 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">No Applications Found</h3>
                  <p className="text-white/60 mb-4 text-sm sm:text-base">No applications are currently available.</p>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Garage Cloud Sessions Tab */}
          {activeTab === "sessions" && (
            <div className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-semibold text-white">Virtual Desktop Sessions</h3>
                <Button
                  onClick={handleCreateSession}
                  disabled={creatingSession}
                  variant="outline"
                  size="sm"
                  className="text-white border-white/20 hover:bg-white/10 h-8 sm:h-10 text-xs sm:text-sm w-full sm:w-auto"
                >
                  <Plus className={cn("h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2", creatingSession && "animate-spin")} />
                  {creatingSession ? "Creating..." : "New Session"}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                 {garageCloudSessions.map((session) => (
                   <Card key={session.kasm_id} className="bg-white/5 border-white/10 p-3 sm:p-4">
                    <CardHeader className="pb-2 sm:pb-3 p-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Monitor className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-white text-sm sm:text-base truncate">{session.image.friendly_name}</h3>
                            <p className="text-xs sm:text-sm text-white/60 truncate">{session.user.username}</p>
                          </div>
                        </div>
                        <Badge
                          variant={session.operational_status === 'running' ? 'default' : 'secondary'}
                          className={cn(
                            "text-xs flex-shrink-0",
                            session.operational_status === 'running' ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'
                          )}
                        >
                          {session.operational_status}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3 sm:space-y-4 p-0 pt-3 sm:pt-4">
                      {/* Session Info */}
                      <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Server:</span>
                          <span className="text-white truncate ml-2">{session.server.hostname}</span>
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
                          <span className="text-white text-xs">{formatDate(session.start_date)}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {session.operational_status === 'running' ? (
                          <>
                            <Button
                              onClick={() => handleConnectSession(session)}
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 h-8 sm:h-10 text-xs sm:text-sm"
                            >
                              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">New Tab</span>
                              <span className="sm:hidden">Tab</span>
                            </Button>
                            <Button
                              onClick={() => handleIframeConnect(session)}
                              size="sm"
                              className="flex-1 bg-purple-600 hover:bg-purple-700 h-8 sm:h-10 text-xs sm:text-sm"
                            >
                              <Monitor className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Embed
                            </Button>
                          </>
                        ) : (
                          <Button
                             onClick={() => handleSessionAction('start', session.kasm_id)}
                            disabled={session.operational_status === 'running'}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 h-8 sm:h-10 text-xs sm:text-sm"
                          >
                            <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 h-8 sm:h-10 w-8 sm:w-10 p-0">
                              <Square className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-gray-800 border-gray-700">
                            <DropdownMenuItem
                               onClick={() => handleSessionAction('pause', session.kasm_id)}
                              className="text-white hover:bg-gray-700 text-sm"
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                            <DropdownMenuItem
                               onClick={() => handleSessionAction('stop', session.kasm_id)}
                              className="text-white hover:bg-gray-700 text-sm"
                            >
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                            <DropdownMenuItem
                               onClick={() => handleSessionAction('restart', session.kasm_id)}
                              className="text-white hover:bg-gray-700 text-sm"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restart
                            </DropdownMenuItem>
                            <DropdownMenuItem
                               onClick={() => handleSessionAction('delete', session.kasm_id)}
                              className="text-red-400 hover:bg-red-500/20 text-sm"
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

              {/* Empty State for Sessions */}
              {garageCloudSessions.length === 0 && !loading && (
                <div className="text-center py-8 sm:py-12">
                  <Monitor className="h-10 w-10 sm:h-12 sm:w-12 text-white/40 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">No Sessions Found</h3>
                  <p className="text-white/60 mb-4 text-sm sm:text-base">No Garage Cloud sessions are currently running.</p>
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    className="text-white border-white/20 hover:bg-white/10 h-8 sm:h-10 text-sm"
                  >
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Iframe View */}
      {iframeMode && selectedSession && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-6 bg-gray-900 border-b border-gray-700">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <Monitor className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-semibold text-white truncate">{selectedSession.image.friendly_name}</h3>
                <p className="text-xs sm:text-sm text-white/60 truncate">{selectedSession.user.username}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIframeMode(false)}
                variant="outline"
                size="sm"
                className="text-white border-white/20 hover:bg-white/10 h-8 sm:h-10 text-xs sm:text-sm"
              >
                <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
                <span className="sm:hidden">Exit</span>
              </Button>
            </div>
          </div>
          <div className="flex-1 relative">
            <iframe
               src={selectedSession.kasm_url}
              className="w-full h-full border-0"
              allow="fullscreen; microphone; camera; clipboard-read; clipboard-write; autoplay"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
               title={`Kasm Session - ${selectedSession.image.friendly_name}`}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}
