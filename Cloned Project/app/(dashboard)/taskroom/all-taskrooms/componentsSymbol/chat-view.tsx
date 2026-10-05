// components/ChatView.tsx
import type React from "react"
import { useChat, UseChatReturn } from "./hooks/use-chat";
import {
  getConversation as fetchConversation,
  getMessages as fetchMessages,
  sendMessage as sendChatMessage
} from "./services/chat-api"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Phone, Video, MoreVertical, Send, Trash, X, Menu, Users } from "lucide-react"
import { toast } from "sonner"
import Cookies from 'js-cookie'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogFooter, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface User {
  id: string
  name: string
  avatar?: string
  color: string
}

interface Message {
  _id: string
  organizationId: string
  conversationId: string
  senderId: string
  content: string
  type: string
  fileUrl: string | null
  fileName: string | null
  fileSize: number | null
  timestamp: string
  editedAt: string | null
  isEdited: boolean
  readBy: ReadBy[]
  replyTo: string | null
  sender: Sender
}

interface ReadBy {
  userId: string
  readAt: string
}

interface Sender {
  _id: string
  email: string
  name: string
}

interface ChatViewProps {
  users: User[]
  currentUser: string
  onlineUsers: User[]
  employees: Employee[]
  conversationId?: string
}

type Employee = {
  id: string
  name: string
  email?: string
  color?: string
  avatar?: string
}

const API_URL = "https://uatapi.garage.app"

async function removeMemberFromTaskroomChat(conversationId: string, userId: string) {
  const token = localStorage.getItem("garage_tok")
  const response = await fetch(
    `${API_URL}/api/chat/conversations/${conversationId}/participants/${userId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  )
  if (!response.ok) throw new Error('Failed to remove member')
  return response.json()
}

export function ChatView({ users, currentUser, onlineUsers, employees, conversationId }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [conversationData, setConversationData] = useState<any>(null)
  const [limit, setLimit] = useState(10)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const prevMessagesLengthRef = useRef<number>(0)

  const { socket, connected, connecting, connect, disconnect, emit }: UseChatReturn = useChat()

  // Load initial chat
  const loadInitialChat = useCallback(async () => {
    if (!conversationId) return
    setIsLoadingMore(true)
    try {
      const [convData, messagesResponse] = await Promise.all([
        fetchConversation(conversationId),
        fetchMessages(conversationId, 10)
      ])
      setConversationData(convData)
      setMessages(messagesResponse.data)
      setHasMore(messagesResponse.pagination?.hasMore ?? true)
      setConversationError(null)
    } catch (err: any) {
      setConversationError("Failed to load conversation")
      toast.error("Failed to load chat")
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId)
      setLimit(10)
      setHasMore(true)
      setMessages([])
      setConversationData(null)
      setConversationError(null)
      loadInitialChat()
    } else if (!conversationId) {
      setCurrentConversationId(null)
      setMessages([])
      setConversationData(null)
      setConversationError(null)
      if (connected) disconnect()
    }
  }, [conversationId, currentConversationId, loadInitialChat, connected, disconnect])

  // Load more
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || limit <= 10) return
    setIsLoadingMore(true)
    try {
      const res = await fetchMessages(conversationId, limit)
      setMessages(res.data)
      setHasMore(res.pagination?.hasMore ?? true)
    } catch {
      toast.error("Failed to load more messages")
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversationId, limit])

  useEffect(() => { loadMoreMessages() }, [loadMoreMessages])

  // Preserve scroll
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current
    prevMessagesLengthRef.current = messages.length

    if (isLoadingMore && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      if (prevLength === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      } else if (prevScrollHeightRef.current > 0) {
        const delta = container.scrollHeight - prevScrollHeightRef.current
        container.scrollTop += delta
      }
    }
  }, [messages, isLoadingMore])

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container || isLoadingMore || !hasMore || container.scrollTop > 50) return
    prevScrollHeightRef.current = container.scrollHeight
    setLimit(prev => prev + 10)
  }, [isLoadingMore, hasMore])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  // Socket: Join + Real-time Messages + Per-Conversation Errors
  useEffect(() => {
    if (!socket || !conversationId) return

    emit('join_conversation', { conversationId })

    const handleNewMessage = (message: Message) => {
      if (message.conversationId !== conversationId) return
      const isAtBottom = messagesContainerRef.current
        ? messagesContainerRef.current.scrollHeight - messagesContainerRef.current.scrollTop <=
        messagesContainerRef.current.clientHeight + 100
        : false
      const isCurrentUser = message.sender?._id === currentUser

      setMessages(prev => [...prev, message])

      if (isAtBottom || isCurrentUser) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
      }
    }

    const handleConversationError = (data: { message: string; conversationId?: string }) => {
      if (data.conversationId === conversationId || !data.conversationId) {
        setConversationError(data.message)
        toast.error(data.message)
        setTimeout(() => setConversationError(null), 5000)
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('conversation_error', handleConversationError)
    socket.on('access_denied', handleConversationError)

    return () => {
      emit('leave_conversation', { conversationId })
      socket.off('new_message', handleNewMessage)
      socket.off('conversation_error', handleConversationError)
      socket.off('access_denied', handleConversationError)
    }
  }, [socket, conversationId, currentUser, emit])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return

    try {
      if (!connected) {
        await sendChatMessage(conversationId, newMessage)
        setNewMessage("")
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        toast.success("Message sent (offline)")
        connect()
        return
      }

      emit("send_message", { conversationId, content: newMessage, type: "text" })
      setNewMessage("")
    } catch (err) {
      toast.error("Failed to send message")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getUserById = (id: string) => employees.find(u => u.id === id)
  const getEmployeeName = (id: string) => getUserById(id)?.name || id

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

  const handleRemoveMember = async (userId: string) => {
    if (!conversationId) return
    setIsRemoving(userId)
    try {
      // await removeMemberFromTaskroomChat(conversationId, userId)
      const conv = await fetchConversation(conversationId)
      setConversationData(conv)
      toast.success("Member removed")
    } catch {
      toast.error("Failed to remove member")
    } finally {
      setIsRemoving(null)
    }
  }

  // Sidebar content component for reusability
  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-[#0e0e12]">
      <div className="p-4 border-b border-[#e5e7eb29]">
        <h3 className="font-semibold text-white">Team Members</h3>
        <p className="text-sm text-gray-400">{onlineUsers.length} online</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarFallback style={{ backgroundColor: getUserById(currentUser)?.color }}>
                {getEmployeeName(currentUser)[0]}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0e0e12] ${onlineUsers.some(u => u.id === currentUser) ? "bg-green-500" : "bg-gray-400"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{getEmployeeName(currentUser)}</span>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">You</span>
            </div>
          </div>
        </div>

        {conversationData?.participants?.filter((p: any) => p._id !== currentUser).map((user: any) => {
          const isOnline = onlineUsers.some(ou => ou.id === user._id)
          return (
            <div key={user._id} className="flex items-center gap-3 p-2 rounded-lg">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback style={{ backgroundColor: user.color || getUserById(user._id)?.color }}>
                    {user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0e0e12] ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
              </div>
              <div className="flex-1 relative pr-8">
                <div className="font-medium text-white">{user.name}</div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isRemoving === user._id} className="absolute right-0 top-0 p-0 h-6 w-6">
                      {isRemoving === user._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#0e0e12] border-[#e5e7eb29]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Remove {user.name}?</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-400">They will no longer see messages.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-transparent border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]">Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-white text-black hover:bg-gray-200 font-semibold" onClick={() => handleRemoveMember(user._id)}>
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-[#e5e7eb29] bg-[#0e0e12]">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium">#</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base md:text-lg truncate text-white">{conversationData?.name || "Chat"}</h2>
              <p className="text-xs md:text-sm text-gray-400">
                {conversationData?.participants?.length || 0} members
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            {/* Mobile: Show search toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setShowSearch(!showSearch)}
            >
              {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>

            {/* Desktop: Show search input */}
            <div className="hidden md:block relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
              />
            </div>

            {/* Action buttons - hidden on mobile, visible on tablet+ */}
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden lg:flex text-gray-400 hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>

            {/* Mobile sidebar trigger */}
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Users className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0 bg-[#0e0e12] border-l border-[#e5e7eb29]">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile search bar */}
        {showSearch && (
          <div className="p-3 border-b border-border md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 w-full bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600"
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {!conversationId && (
            <div className="flex justify-center items-center h-full text-muted-foreground text-sm md:text-base">
              Select a conversation
            </div>
          )}

          {connecting && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}

          {conversationError && (
            <div className="mx-2 md:mx-4 p-3 bg-red-100 text-red-700 rounded-lg text-xs md:text-sm text-center">
              {conversationError}
            </div>
          )}

          {isLoadingMore && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}

          {!hasMore && messages.length > 0 && (
            <div className="text-center text-xs md:text-sm text-muted-foreground">No more messages</div>
          )}

          {messages.map(msg => {
            if (msg.type === "system") {
              return (
                <div key={msg._id} className="flex justify-center">
                  <div className="bg-muted rounded-lg px-3 md:px-4 py-2 text-xs md:text-sm text-muted-foreground max-w-md text-center">
                    {msg.content}
                  </div>
                </div>
              )
            }

            const user = getUserById(msg.sender?._id)
            const isMe = msg.sender?._id === currentUser

            return (
              <div key={msg._id} className={`flex gap-2 md:gap-3 ${isMe ? "justify-end" : ""}`}>
                {!isMe && user && (
                  <Avatar className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0">
                    <AvatarFallback style={{ backgroundColor: user.color }}>
                      {user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`flex flex-col ${isMe ? "items-end" : ""} max-w-[85%] sm:max-w-[75%] md:max-w-[70%]`}>
                  {!isMe && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs md:text-sm font-medium text-white">{user?.name}</span>
                      <span className="text-[10px] md:text-xs text-gray-400">
                        {formatTime(new Date(msg.timestamp))}
                      </span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 md:px-4 py-2 break-words ${isMe ? "bg-blue-600 text-white" : "bg-[#1e1e2d] text-white border border-[#e5e7eb29]"}`}>
                    <p className="text-xs md:text-sm">{msg.content}</p>
                    {isMe && (
                      <div className="text-[10px] md:text-xs text-blue-100 mt-1 text-right">
                        {formatTime(new Date(msg.timestamp))}
                      </div>
                    )}
                  </div>
                </div>
                {isMe && (
                  <Avatar className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0">
                    <AvatarFallback style={{ backgroundColor: getUserById(currentUser)?.color }}>
                      {getEmployeeName(currentUser)[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {conversationId && (
          <div className="p-3 md:p-4 border-t border-[#e5e7eb29] bg-[#0e0e12]">
            <div className="flex items-center gap-2 relative">
              <Input
                placeholder="Type a message..."
                className="pr-12 focus:ring-0 focus-visible:ring-0 text-sm md:text-base bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={connecting}
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || connecting}
                className="absolute right-1 h-8 w-8 md:h-9 md:w-9"
              >
                <Send className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:block w-80 border-l border-[#e5e7eb29] bg-[#0e0e12]">
        <SidebarContent />
      </div>
    </div>
  )
}