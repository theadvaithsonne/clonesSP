"use client"

import * as React from "react"
import {
    ChevronDown,
    Search,
    Video,
    Plus,
    CheckCircle2,
    Settings,
    LayoutTemplate,
    CreditCard,
    Zap,
    Briefcase,
    LogOut,
    User,
    HelpCircle,
    Monitor,
    MicOff,
    Mic,
    Play,
    StopCircle
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useParams } from "next/navigation"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuGroup,
    DropdownMenuShortcut
} from "@/components/ui/dropdown-menu"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useUIStore } from "@/store/taskroom/uiStore";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
export function TopNav() {
    const { showAddWorkspace, setShowAddWorkspace, } = useUIStore();
    const { workspaces, fetchWorkspaces, fetchWorkspacesAndSpaceAndRooms, currentWorkspace, fetchspacesRouter, fetchWorkspaceById, setCurrentWorkspace } = useWorkspaceStore();
    const [screenSource, setScreenSource] = React.useState("Entire screen")
    const [screenMenuOpen, setScreenMenuOpen] = React.useState(false)
    const [micEnabled, setMicEnabled] = React.useState(false)
    const [micMenuOpen, setMicMenuOpen] = React.useState(false)
    const [isRecording, setIsRecording] = React.useState(false)
    const [recordingTime, setRecordingTime] = React.useState(0)
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
    const chunksRef = React.useRef<Blob[]>([])
    const router = useRouter();
    const pathname = usePathname();

    const timerRef = React.useRef<NodeJS.Timeout | null>(null)
    const searchParams = useSearchParams();
    const { workspace, space } = useParams()
    const roomId = searchParams.get('roomId');
    const workspaceId = workspace as string
    const Idspace = space as string
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    console.log("currentWorkspace", currentWorkspace)
    const handleRecordClick = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop()
            return
        }

        try {
            const displaySurfaceMap: Record<string, string> = {
                "Entire screen": "monitor",
                "Window": "window",
                "Current tab": "browser"
            }

            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: displaySurfaceMap[screenSource] || "monitor"
                },
                audio: true // System audio
            })

            let micStream: MediaStream | null = null;
            if (micEnabled) {
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: true
                    })
                } catch (micErr) {
                    console.error("Error accessing microphone:", micErr)
                    toast.error("Failed to access microphone. Recording will proceed without microphone audio.")
                }
            }

            // Create AudioContext to mix audio streams if both exist
            let audioContext: AudioContext | null = null;
            let audioDestination: MediaStreamAudioDestinationNode | null = null;

            const screenAudioTrack = screenStream.getAudioTracks()[0];
            const micAudioTrack = micStream?.getAudioTracks()[0];
            let mixedAudioTrack: MediaStreamTrack | null = null;

            if (screenAudioTrack && micAudioTrack) {
                audioContext = new AudioContext();
                audioDestination = audioContext.createMediaStreamDestination();

                const screenSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
                const micSource = audioContext.createMediaStreamSource(new MediaStream([micAudioTrack]));

                screenSource.connect(audioDestination);
                micSource.connect(audioDestination);

                mixedAudioTrack = audioDestination.stream.getAudioTracks()[0];
            } else {
                mixedAudioTrack = micAudioTrack || screenAudioTrack || null;
            }

            const tracks = [
                ...screenStream.getVideoTracks(),
                ...(mixedAudioTrack ? [mixedAudioTrack] : [])
            ]
            const combinedStream = new MediaStream(tracks)

            // Determine supported MIME type
            const mimeTypes = [
                "video/webm;codecs=vp9,opus",
                "video/webm;codecs=vp8,opus",
                "video/webm;codecs=h264,opus",
                "video/webm",
            ];
            const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || "";

            const mediaRecorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined)
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                document.body.appendChild(a)
                a.style.display = "none"
                a.href = url
                a.download = `recording-${new Date().toISOString()}.webm`
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
                setIsRecording(false)
                setRecordingTime(0)
                if (timerRef.current) {
                    clearInterval(timerRef.current)
                }

                // Stop all tracks to clear the recording icon in browser tab and mic usage
                combinedStream.getTracks().forEach(track => track.stop())
                // Ensure original streams are stopped if tracks were cloned or referenced differently (though they are same ref here)
                screenStream.getTracks().forEach(track => track.stop())
                if (micStream) micStream.getTracks().forEach(track => track.stop())

                // Close AudioContext
                if (audioContext && audioContext.state !== "closed") {
                    audioContext.close();
                }
            }

            mediaRecorder.start()
            setIsRecording(true)
            setRecordingTime(0)
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)

            // If user stops sharing via browser UI (screen stream ends)
            screenStream.getVideoTracks()[0].onended = () => {
                if (mediaRecorder.state !== "inactive") {
                    mediaRecorder.stop()
                }
            }

        } catch (err) {
            console.error("Error starting screen recording:", err)
            setIsRecording(false)
            setRecordingTime(0)
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }






    const selectedWorkspace = workspaceId
        ? currentWorkspace
        : (workspaces?.length > 0 ? workspaces[0] : null);

    const displayWorkspaceName = selectedWorkspace?.name
    const workspaceInitial = displayWorkspaceName?.charAt(0)?.toUpperCase();
    console.log("cczxcuihrwe", selectedWorkspace)
    return (
        <div className="flex h-16 items-center justify-between px-2 pt-2 top-0 w-full">
            {/* Left: Workspace dropdown */}
            <div className="flex items-center gap-2">
                <DropdownMenu >
                    <DropdownMenuTrigger asChild className="ring-0 outline-none  bg-[#111116] 
  focus:outline-none 
  focus:ring-0 
  focus:ring-offset-0  
  focus-visible:outline-none 
  focus-visible:ring-0">
                        <div className={`
  h-8 flex items-center  gap-1.5 
  pl-1.5 pr-2 
  font-semibold 
  bg-[#111116] 
  text-white 
  border border-[#e5e7eb29] 
  rounded-[8px]
  cursor-pointer
  focus:ring-0 
  focus:ring-offset-0  
  focus-visible:outline-none 
  focus-visible:ring-0
`}>
                            <span

                                style={{ backgroundColor: `${currentWorkspace?.color}` }}
                                className={`text-black rounded-[4px] w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm`}>
                                {workspaceInitial}
                            </span>
                            <span className="text-xs">{currentWorkspace?.name}</span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[280px] p-0 shadow-lg bg-[#111116] border border-[#e5e7eb29]">
                        <div className="p-4 pb-2">
                            <div className="flex items-start gap-3 mb-3">
                                <div style={{ backgroundColor: `${currentWorkspace?.color}` }} className="h-7 w-7   rounded-[8px] flex items-center justify-center text-black font-bold text-xl shadow-sm">{workspaceInitial}</div>
                                <div>
                                    <h3 className="font-semibold text-white leading-none mb-1 text-xs">{currentWorkspace?.name}</h3>
                                    <p className="text-xs text-slate-400">4 members </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer font-bold text-slate-600 bg-[#111116] border border-[#e5e7eb29] "

                                    onClick={() => router.push(`/taskroom/${workspaceId}/settings/general/${Idspace}?roomId=${roomId}`)}
                                >
                                    <Settings className="h-3 w-3 " />
                                    Settings
                                </Button>
                                <Button
                                    onClick={() => router.push(`/taskroom/${workspaceId}/settings/people/${Idspace}?roomId=${roomId}`)}
                                    variant="outline" size="sm" className="h-8 text-xs font-bold  cursor-pointer text-slate-600 bg-[#111116] border border-[#e5e7eb29] ">
                                    <User className="h-3 w-3 " />
                                    People
                                </Button>
                            </div>
                        </div>


                        <Separator className=" border bg-border-[#e5e7eb29] border-[#e5e7eb29] h-[0.5px]" />

                        <div className="px-2 py-2">
                            {
                                workspaces?.length > 0 &&
                                <>
                                    <div className="px-2 py-1.5  items-center text-[11px] font-semibold text-white  uppercase tracking-wider">Switch Workspaces</div>
                                    {workspaces?.map((workspace) => (
                                        <div key={workspace?._id} className="gap-3 py-2 px-2 flex gap-2  text-xs cursor-pointer text-slate-400 font-medium hover:bg-[#343439]"
                                            onClick={() => {
                                                setCurrentWorkspace(workspace);
                                                fetchspacesRouter(workspace?._id, router);
                                            }}
                                        >
                                            <div style={{ backgroundColor: `${workspace?.color}` }} className="h-5 w-5 rounded flex items-center justify-center text-xs text-white">
                                                {workspace?.name?.charAt(0).toUpperCase()}
                                            </div>
                                            {workspace?.name}
                                        </div>
                                    ))}
                                </>
                            }
                            <div
                                className=" flex gap-2
    flex items-center gap-3 justify-center
    py-2 px-2 cursor-pointer 
    text-slate-400 border border-[#e5e7eb29]  bg-[#111116] mt-2 hover:bg-[#343439] hover:text-white 
  "
                                onClick={() => setShowAddWorkspace(true)}
                            >
                                <div className="h-4 w-4  flex items-center justify-center shrink-0">
                                    <Plus className="h-4 w-4  text-slate-400 hover:text-white" />
                                </div>
                                <span>Create Workspace</span>
                            </div>
                        </div>

                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Middle: Call Notification */}
            <div className="relative w-64 hidden sm:flex items-center group ">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-hover:text-slate-500 transition-colors" />
                <div className="h-9 w-full rounded-full  border-[#e5e7eb29] bg-[#111116]  border  hover: transition-all pl-9 pr-3 py-2 text-xs text-slate-500 flex items-center justify-between cursor-text group-hover:shadow-sm">
                    <span>Search</span>

                </div>
            </div>

            {/* Right: Search, Video, Profile */}
            <div className="flex items-center gap-3 pr-2">

                {/* 
                <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div> */}

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative">
                        <CheckCircle2 className="h-5 w-5" />
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative">
                                <Video className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-3" align="end">
                            <div className="space-y-3">
                                <DropdownMenu open={screenMenuOpen} onOpenChange={setScreenMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <div className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <Monitor className="h-5 w-5 text-slate-500" />
                                                <span className="text-xs font-medium text-slate-700">{screenSource}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400 group-hover:text-slate-500">1536x864px</span>
                                                <ChevronDown className="h-4 w-4 text-slate-400" />
                                            </div>
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 p-1">
                                        <DropdownMenuItem
                                            className={`gap-2 ${screenSource === "Entire screen" ? "bg-slate-100" : ""}`}
                                            onClick={() => {
                                                setScreenSource("Entire screen")
                                                setScreenMenuOpen(false)
                                            }}
                                        >
                                            Entire screen
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className={`gap-2 ${screenSource === "Window" ? "bg-slate-100" : ""}`}
                                            onClick={() => {
                                                setScreenSource("Window")
                                                setScreenMenuOpen(false)
                                            }}
                                        >
                                            Window
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className={`gap-2 ${screenSource === "Current tab" ? "bg-slate-100" : ""}`}
                                            onClick={() => {
                                                setScreenSource("Current tab")
                                                setScreenMenuOpen(false)
                                            }}
                                        >
                                            Current tab
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Mic Selection */}
                                <DropdownMenu open={micMenuOpen} onOpenChange={setMicMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <div className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                            <div className="flex items-center gap-3">
                                                {micEnabled ? (
                                                    <Mic className="h-5 w-5 text-emerald-500" />
                                                ) : (
                                                    <MicOff className="h-5 w-5 text-red-500" />
                                                )}
                                                <span className="text-xs font-medium text-slate-700">{micEnabled ? "Microphone on" : "No microphone"}</span>
                                            </div>
                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 p-1">
                                        <DropdownMenuItem
                                            className={`gap-2 ${!micEnabled ? "bg-slate-100" : ""}`}
                                            onClick={() => {
                                                setMicEnabled(false)
                                                setMicMenuOpen(false)
                                            }}
                                        >
                                            <MicOff className="h-4 w-4" />
                                            No microphone
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className={`gap-2 ${micEnabled ? "bg-slate-100" : ""}`}
                                            onSelect={(e) => {
                                                e.preventDefault(); // Keep menu open for immediate feedback if needed, or manage closing manually
                                                // Actually, we probably want to close it, but let's handle the async flow first
                                            }}
                                            onClick={async (e) => {
                                                e.preventDefault(); // Prevent auto-close to handle permission request flow better
                                                setMicMenuOpen(false); // Close manually

                                                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                                                    toast.error("Microphone access is not supported in this browser or environment.");
                                                    return;
                                                }

                                                try {
                                                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                                                    stream.getTracks().forEach(track => track.stop())
                                                    setMicEnabled(true)
                                                    toast.success("Microphone enabled")
                                                } catch (err) {
                                                    console.error("Microphone permission denied:", err)
                                                    setMicEnabled(false)
                                                    toast.error("Microphone access denied. Please check your browser permissions.")
                                                }
                                            }}
                                        >
                                            <Mic className="h-4 w-4" />
                                            Microphone
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Separator className="bg-slate-100" />

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        className={`flex-1 h-10 text-white border-none shadow-sm gap-2 rounded-lg font-medium ${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-rose-400 hover:bg-rose-500"}`}
                                        onClick={handleRecordClick}
                                    >
                                        {isRecording ? (
                                            <StopCircle className="h-4 w-4" />
                                        ) : (
                                            <div className="h-4 w-4 rounded-full border-[1.5px] border-white flex items-center justify-center">
                                                <div className="h-2 w-2  rounded-full" />
                                            </div>
                                        )}
                                        <span>{isRecording ? `Stop Recording (${formatTime(recordingTime)})` : "Record Clip"}</span>
                                        {!isRecording && <span className="text-[10px] opacity-80 uppercase tracking-wide">Ctrl+Alt+S</span>}
                                    </Button>
                                    <Button variant="ghost" className="h-10 text-slate-600 hover:bg-slate-100 hover:text-slate-900 gap-2 font-medium px-2 rounded-lg">
                                        <Play className="h-4 w-4" />
                                        <span>Clips</span>
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative h-9 w-9 rounded-full p-0 ring-2 ring-transparent hover:ring-slate-200 transition-all focus-visible:ring-slate-300"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="/placeholder.svg" alt="User avatar" />
                                <AvatarFallback className="bg-slate-900 text-white text-xs font-medium">
                                    KS
                                </AvatarFallback>
                                {/* Online status dot */}
                                {/* <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" /> */}
                            </Avatar>

                            {/* Chevron indicator - placed inside the button */}
                            {/* <ChevronDown
                                className="absolute bottom-1 right-1 h-3.5 w-3.5 text-slate-500  rounded-full shadow-sm border border-slate-200 pointer-events-none"
                            /> */}
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56 mt-1">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <User className="mr-2 h-4 w-4" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
