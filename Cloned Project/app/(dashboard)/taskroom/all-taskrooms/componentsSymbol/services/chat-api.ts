import Cookies from 'js-cookie';
const API_URL = "https://uatapi.garage.app"

function getToken() {
    if (typeof window === "undefined") return null
    return localStorage.getItem("garage_tok")
}

async function authedFetch(input: RequestInfo, init?: RequestInit) {
    const token = getToken()
    console.log("4324234234234", token)
    const headers = new Headers(init?.headers || {})
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    if (token) headers.set("Authorization", `Bearer ${token}`)

    const res = await fetch(input, { ...init, headers })
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Request failed: ${res.status} ${text}`)
    }
    return res.json()
}

export async function getConversation(conversationId: string) {
    const data = await authedFetch(`${API_URL}/api/chat/conversations/${conversationId}`)
    return data?.data
}



export interface WireMessage {
    data: MessagesResponse[]
    pagination: {
        limit: number
        hasMore: boolean
    }
    message: string
    timestamp: string
}
type MessagesResponse = {
    _id: string;
    organizationId: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    timestamp: string;
    editedAt: string | null;
    isEdited: boolean;
    readBy: ReadBy[];
    replyTo: string | null;
    sender: Sender;
}


interface ReadBy {
    userId: string;
    readAt: string;
}

interface Sender {
    _id: string;
    email: string;
    name: string;
}






// export async function getMessages(conversationId: string, limit = 10, before?: string) {
//     const params = new URLSearchParams({ limit: String(limit) })
//     if (before) params.append("before", before)
//     const data = await authedFetch(`${API_URL}/api/chat/conversations/${conversationId}/messages?${params.toString()}`)
//     return (data?.data || []) as WireMessage[]
// }

export async function sendMessage(conversationId: string, content: string, type: "text" | "file" | "image" = "text") {
    const data = await authedFetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, type }),
    })
    return data?.data as MessagesResponse
}

export async function getMessages(conversationId: string, limit = 50, before?: string) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (before) params.append("before", before)
    const response = await authedFetch(`${API_URL}/api/chat/conversations/${conversationId}/messages?${params.toString()}`)
    return response as WireMessage // Return the full response with data and pagination
}