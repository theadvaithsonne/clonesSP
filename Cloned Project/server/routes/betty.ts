import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { TimeTracking } from "../models/timeTracking.model";
import { TeamforceBreakLog } from "../models/teamforce/teamforceBreakLog.model";
import { TeamforceLeaveRequest } from "../models/teamforce/teamforceLeaveRequest.model";
import { findApplicablePolicy } from "./teamforce/breakSettings";
import { TeamforceEmployeeProfile } from "../models/teamforce/teamforceEmployeeProfile.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { Notification } from "../models/notification.model";
import { User } from "../models/user.model";
import { Types } from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { emitLeaveRequestNotification } from "../services/socket";
import { getOnlineUserIds } from "../realtime/socket";
import { getOrgApiKey } from "./founderAiProviders";

const router = Router();

// Default Gemini API key (fallback when org doesn't have a custom key).
// Exported because this is the key that is actually provisioned and working —
// `process.env.GEMINI_API_KEY` holds a different, non-working key. Anything
// needing a platform Gemini fallback should import this rather than read env.
export const DEFAULT_GEMINI_KEY = "AIzaSyBaf2cDGdxE8f9omgSO_JQU6tM7DoQ0lUQ";

// Supported AI providers
type AIProvider = "google-gemini" | "openai" | "anthropic";

// Helper to get the best available AI provider for an organization
async function getAvailableProvider(orgId: string, requestedProvider?: string): Promise<{ provider: AIProvider; apiKey: string }> {
  // If a specific provider is requested, try to use it
  if (requestedProvider) {
    const providerMap: Record<string, AIProvider> = {
      "google-gemini": "google-gemini",
      "openai": "openai",
      "anthropic": "anthropic",
    };

    const provider = providerMap[requestedProvider];
    if (provider) {
      const apiKey = await getOrgApiKey(provider, orgId);
      if (apiKey) {
        return { provider, apiKey };
      }
    }
  }

  // Fallback: try providers in order of preference
  const providers: AIProvider[] = ["google-gemini", "openai", "anthropic"];
  for (const provider of providers) {
    const apiKey = await getOrgApiKey(provider, orgId);
    if (apiKey) {
      return { provider, apiKey };
    }
  }

  // Last resort: use default Gemini key
  return { provider: "google-gemini", apiKey: DEFAULT_GEMINI_KEY };
}

// Helper to get AI response using OpenAI
async function getOpenAIResponse(apiKey: string, systemPrompt: string, userMessage: string): Promise<{ text: string; functionCall?: { name: string; args: any } }> {
  const openai = new OpenAI({ apiKey });

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "create_leave_request",
        description: "Create a leave request for the user. Use this when the user wants to take time off, vacation, sick leave, or any other type of leave.",
        parameters: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Start date of the leave (YYYY-MM-DD or 'tomorrow', 'today')" },
            endDate: { type: "string", description: "End date of the leave (YYYY-MM-DD or 'tomorrow', 'today')" },
            reason: { type: "string", description: "Reason for the leave request" }
          },
          required: ["startDate", "endDate", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_time_tracking",
        description: "Get user's time tracking history and statistics",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of recent entries to retrieve (default: 10)" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_leave_requests",
        description: "Get user's leave request history",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of recent requests to retrieve (default: 10)" }
          }
        }
      }
    }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    tools,
    tool_choice: "auto"
  });

  const message = response.choices[0]?.message;
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    if (toolCall.type === 'function' && toolCall.function) {
    return {
      text: message.content || "",
      functionCall: {
        name: toolCall.function.name,
        args: JSON.parse(toolCall.function.arguments)
      }
    }
    };
  }

  return { text: message?.content || "" };
}

// Helper to get AI response using Anthropic Claude
async function getAnthropicResponse(apiKey: string, systemPrompt: string, userMessage: string): Promise<{ text: string; functionCall?: { name: string; args: any } }> {
  const anthropic = new Anthropic({ apiKey });

  const tools: Anthropic.Tool[] = [
    {
      name: "create_leave_request",
      description: "Create a leave request for the user. Use this when the user wants to take time off, vacation, sick leave, or any other type of leave.",
      input_schema: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Start date of the leave (YYYY-MM-DD or 'tomorrow', 'today')" },
          endDate: { type: "string", description: "End date of the leave (YYYY-MM-DD or 'tomorrow', 'today')" },
          reason: { type: "string", description: "Reason for the leave request" }
        },
        required: ["startDate", "endDate", "reason"]
      }
    },
    {
      name: "get_time_tracking",
      description: "Get user's time tracking history and statistics",
      input_schema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Number of recent entries to retrieve (default: 10)" }
        }
      }
    },
    {
      name: "get_leave_requests",
      description: "Get user's leave request history",
      input_schema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Number of recent requests to retrieve (default: 10)" }
        }
      }
    }
  ];

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages: [{ role: "user", content: userMessage }]
  });

  // Check for tool use
  for (const block of response.content) {
    if (block.type === "tool_use") {
      return {
        text: "",
        functionCall: {
          name: block.name,
          args: block.input as any
        }
      };
    }
  }

  // Get text response
  const textBlock = response.content.find(block => block.type === "text");
  return { text: textBlock?.type === "text" ? textBlock.text : "" };
}

// Helper to get Gemini AI instance for an organization
async function getGeminiAI(orgId: string): Promise<GoogleGenerativeAI> {
  // Try to get org's custom Google Gemini key
  const customKey = await getOrgApiKey("google-gemini", orgId);
  const apiKey = customKey || DEFAULT_GEMINI_KEY;
  return new GoogleGenerativeAI(apiKey);
}

// Function to extract leave request data from natural language
function extractLeaveRequestData(message: string) {
  const data: { startDate?: string; endDate?: string; reason?: string } = {};
  
  // Helper function to parse relative dates
  function parseRelativeDate(dateStr: string): string | null {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    switch (dateStr.toLowerCase()) {
      case 'today':
        return today.toISOString().split('T')[0];
      case 'tomorrow':
        return tomorrow.toISOString().split('T')[0];
      case 'next week':
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return nextWeek.toISOString().split('T')[0];
      case 'next month':
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        return nextMonth.toISOString().split('T')[0];
      default:
        return null;
    }
  }
  
  // Helper function to parse date strings
  function parseDateString(dateStr: string): string | null {
    // Try relative dates first
    const relativeDate = parseRelativeDate(dateStr);
    if (relativeDate) return relativeDate;
    
    // Try various date formats
    const formats = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4}-\d{1,2}-\d{1,2})/, // YYYY-MM-DD
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i,
      /\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          const parsedDate = new Date(match[1]);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return null;
  }
  
  // Extract dates using various patterns
  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // YYYY-MM-DD
    /(\d{4}-\d{1,2}-\d{1,2})/g,
    // Month DD, YYYY
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi,
    // DD Month YYYY
    /\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi,
    // Relative dates
    /(tomorrow|today|next week|next month)/gi
  ];
  
  const dates: string[] = [];
  datePatterns.forEach(pattern => {
    const matches = message.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  });
  
  if (dates.length >= 1) {
    const parsedDate = parseDateString(dates[0]);
    if (parsedDate) data.startDate = parsedDate;
  }
  if (dates.length >= 2) {
    const parsedDate = parseDateString(dates[1]);
    if (parsedDate) data.endDate = parsedDate;
  } else if (dates.length === 1) {
    // If only one date, assume it's a single day leave
    data.endDate = data.startDate;
  }
  
  // Extract reason (look for common patterns)
  const reasonPatterns = [
    /(?:because|due to|for|reason is|because of)\s+(.+?)(?:\.|$)/i,
    /(?:sick|illness|medical|doctor|appointment|family|personal|vacation|holiday|wedding|funeral)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const match = message.match(pattern);
    if (match) {
      data.reason = match[1] || match[0];
      break;
    }
  }
  
  // If no specific reason found, try to extract a general reason with more context
  if (!data.reason) {
    const commonReasons = [
      { keyword: 'sick', reason: 'Sick leave' },
      { keyword: 'illness', reason: 'Illness' },
      { keyword: 'medical', reason: 'Medical appointment' },
      { keyword: 'doctor', reason: 'Doctor appointment' },
      { keyword: 'appointment', reason: 'Appointment' },
      { keyword: 'personal', reason: 'Personal reasons' },
      { keyword: 'vacation', reason: 'Vacation' },
      { keyword: 'holiday', reason: 'Holiday' },
      { keyword: 'family', reason: 'Family matters' },
      { keyword: 'wedding', reason: 'Wedding' },
      { keyword: 'funeral', reason: 'Funeral' }
    ];
    
    const lowerMessage = message.toLowerCase();
    for (const { keyword, reason } of commonReasons) {
      if (lowerMessage.includes(keyword)) {
        data.reason = reason;
        break;
      }
    }
  }
  
  // If still no reason but user mentioned being sick or time off, use a default
  if (!data.reason && (message.toLowerCase().includes('sick') || message.toLowerCase().includes('ill'))) {
    data.reason = 'Sick leave';
  }
  
  return data;
}

function normalizeDateInput(dateValue: string): Date | null {
  if (!dateValue) return null;

  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lower === "today") {
    return new Date(today);
  }

  if (lower === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow;
  }

  if (lower === "next week") {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek;
  }

  if (lower === "next month") {
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    return nextMonth;
  }

  const isoDatePattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = trimmed.match(isoDatePattern);
  if (isoMatch) {
    const [, year, month, day] = isoMatch.map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  if (trimmed.includes("T")) {
    const datePart = trimmed.split("T")[0];
    if (isoDatePattern.test(datePart)) {
      const [year, month, day] = datePart.split("-").map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }

  return null;
}

// Betty AI Chat endpoint with function calling
router.post("/chat", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  const { message, provider: requestedProvider } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Get the AI provider to use
    const { provider: activeProvider, apiKey } = await getAvailableProvider(orgId, requestedProvider);
    console.log(`[Betty] Using AI provider: ${activeProvider}`);

    // Check if user is a founder
    const currentUser = await User.findById(me.userId).lean();
    const isFounder = currentUser?.organizations?.some(
      (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
    );

    // Save user message to database
    const userMessageId = `user_${Date.now()}_${Math.random()}`;
    await Notification.create({
      userId: me.userId,
      orgId: new Types.ObjectId(orgId),
      type: "betty_chat",
      title: "Chat Message",
      message: message,
      chatMessageId: userMessageId,
      senderType: "user",
      isRead: true,
      readAt: new Date()
    });

    // Get organization users if founder (excluding founders themselves)
    const orgUsers = isFounder ? (await User.find({
      "organizations.organization": new Types.ObjectId(orgId),
    }).select("name email organizations").lean()).filter((u: any) => {
      // Filter out founders - only include stakeholders/employees
      const orgMembership = u.organizations?.find(
        (org: any) => org.organization.toString() === orgId
      );
      return orgMembership && orgMembership.role !== "founder";
    }) : [];

    // Get user's recent data for context
    const timeEntries = await TimeTracking.find({ userId: me.userId, orgId })
      .sort({ clockInTime: -1 })
      .limit(5)
      .lean();
    
    const leaveRequests = await LeaveRequest.find({ userId: me.userId, orgId })
      .sort({ startDate: -1 })
      .limit(5)
      .lean();

    const founderContext = isFounder ? `\n**FOUNDER CAPABILITIES:**
As a founder, you have additional permissions to view and manage employee data.

**Founder Functions:**
- get_employee_time_tracking: Get time tracking for any employee by name/email
- get_all_employees_time_tracking: Extract clock in/out times for ALL employees
- get_employee_leave_requests: Get leave requests for any employee by name/email

**Organization Employees (non-founders only):**
${orgUsers.length > 0 ? orgUsers.map((u: any) => `- ${u.name || u.email} (${u.email})`).join('\n') : 'No employees found'}

You can ask questions like:
- "Show me John's time tracking"
- "What are Sarah's leave requests?"
- "Who has pending leave requests?"
- "Show me all employees' time tracking"
- "List all employees"` : '';

    const context = `
You are Betty, an AI assistant for workplace management.

**CRITICAL: You MUST automatically call functions when needed. DO NOT ask for permission or explain that you need to call a function. Just call it immediately.**

**User Message:** "${message}"

**Your Response Instructions:**
1. IMMEDIATELY identify what the user wants
2. IMMEDIATELY call the appropriate function without asking
3. Then provide a helpful response based on the function result

**Available Functions:**
${isFounder ? `
**FOUNDER MODE ACTIVATED - You have full access to employee data:**
- get_employee_time_tracking: Get ANY employee's time tracking data
- get_all_employees_time_tracking: Extract clock in/out times for ALL employees at once
- get_employee_leave_requests: Get ANY employee's leave requests or all pending requests
- create_leave_request: Create leave requests

**Employee List (employees only, founders excluded):**
${orgUsers.length > 0 ? orgUsers.map((u: any) => `- ${u.name || u.email}`).join('\n') : 'No employees found'}

**Example Founder Queries:**
- "list all employees" → Call get_employee_time_tracking WITHOUT employeeName to get all
- "show me Sarah's time" → Call get_employee_time_tracking with employeeName="Sarah"
- "extract all employee times" or "get all clock in/out times" → Call get_all_employees_time_tracking
- "who has leave requests?" → Call get_employee_leave_requests without filters
- "show pending leave requests" → Call get_employee_leave_requests with status="pending"
` : `
**Regular Employee Mode:**
- create_leave_request: Create leave requests when users want time off
- get_time_tracking: Get YOUR time tracking history
- get_leave_requests: Get YOUR leave request history
`}

**Leave Request Instructions:**
- If user says "I'm sick tomorrow" → IMMEDIATELY call create_leave_request
- When user says "tomorrow", pass startDate="tomorrow" and endDate="tomorrow" (do NOT convert to a date string)
- When user says "today", pass startDate="today" and endDate="today" (do NOT convert to a date string)
- "sick" = reason: "Sick leave" or "sick"
- If user only mentions one date, use the same value for both startDate and endDate
- Use context clues to infer missing information
- CRITICAL: Pass relative dates like "tomorrow", "today" as literal strings, NOT as converted dates

**User's Recent Data:**
Time Entries: ${JSON.stringify(timeEntries)}
Leave Requests: ${JSON.stringify(leaveRequests)}

**REMEMBER:** Always call functions immediately. Never say "I need to access..." or "let me get that for you" - just CALL THE FUNCTION and then respond with the results.
`;

    let finalResponse = "";
    let createdLeaveRequest = null;
    let functionCall: { name: string; args: any } | undefined;

    // Call the appropriate AI provider
    if (activeProvider === "openai") {
      const aiResponse = await getOpenAIResponse(apiKey, context, message);
      finalResponse = aiResponse.text;
      functionCall = aiResponse.functionCall;
    } else if (activeProvider === "anthropic") {
      const aiResponse = await getAnthropicResponse(apiKey, context, message);
      finalResponse = aiResponse.text;
      functionCall = aiResponse.functionCall;
    } else {
      // Default to Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        tools: [{
          functionDeclarations: [
            {
              name: "create_leave_request",
              description: "Create a leave request for the user.",
              parameters: {
                type: "object" as any,
                properties: {
                  startDate: { type: "string" as any, description: "Start date (YYYY-MM-DD or 'tomorrow', 'today')" },
                  endDate: { type: "string" as any, description: "End date (YYYY-MM-DD or 'tomorrow', 'today')" },
                  reason: { type: "string" as any, description: "Reason for the leave request" }
                },
                required: ["startDate", "endDate", "reason"]
              }
            },
            {
              name: "get_time_tracking",
              description: "Get user's time tracking history",
              parameters: { type: "object" as any, properties: { limit: { type: "number" as any } } }
            },
            {
              name: "get_leave_requests",
              description: "Get user's leave request history",
              parameters: { type: "object" as any, properties: { limit: { type: "number" as any } } }
            }
          ]
        }]
      });

      const result = await model.generateContent(context);
      const response = await result.response;
      const geminiCalls = response.functionCalls();
      if (geminiCalls && geminiCalls.length > 0) {
        functionCall = { name: geminiCalls[0].name, args: geminiCalls[0].args };
      } else {
        finalResponse = response.text();
      }
    }

    // Process function calls (unified for all providers)
    if (functionCall) {
      if (functionCall.name === "create_leave_request") {
        const args = functionCall.args as { startDate: string; endDate: string; reason: string };
          
          // Validate the leave request data (allow common short reasons like "sick", "ill")
          const validReason = args.reason && (args.reason.length >= 3 || ["sick", "ill", "pto", "off"].includes(args.reason.toLowerCase()));
          if (args.startDate && args.endDate && validReason) {
            try {
              console.log("🔍 Leave request args:", { startDate: args.startDate, endDate: args.endDate, reason: args.reason });
              
              const startDate = normalizeDateInput(args.startDate);
              const endDate = normalizeDateInput(args.endDate);

              console.log("📅 Parsed dates:", { 
                startDate: startDate?.toISOString(), 
                endDate: endDate?.toISOString(),
                startDateStr: args.startDate,
                endDateStr: args.endDate
              });

              if (!startDate || !endDate) {
                finalResponse = "❌ I couldn't understand the dates you provided. Please use a specific date like 2025-05-12 or say 'tomorrow'.";
              }

              if (startDate && endDate) {
              // Normalize dates to midnight for comparison
              const startDateNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
              const endDateNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              console.log("🔍 Date comparison:", {
                startDateNormalized: startDateNormalized.toISOString(),
                endDateNormalized: endDateNormalized.toISOString(),
                today: today.toISOString(),
                startDateValid: startDateNormalized >= today,
                endDateValid: endDateNormalized >= startDateNormalized
              });

              // Allow today or future dates (startDate >= today)
              if (startDateNormalized >= today && endDateNormalized >= startDateNormalized) {
                // Create the leave request
                const request = await LeaveRequest.create({
                  userId: me.userId,
                  orgId,
                  startDate: startDateNormalized,
                  endDate: endDateNormalized,
                  reason: args.reason,
                });

                // Notify founders
                try {
                  const founders = await User.find({
                    "organizations.organization": new Types.ObjectId(orgId),
                    "organizations.role": "founder"
                  }).lean();

                  for (const founder of founders) {
                    await Notification.create({
                      userId: (founder as any)._id,
                      orgId: new Types.ObjectId(orgId),
                      type: "leave_request",
                      title: "New Leave Request",
                      message: `A new leave request has been submitted and needs your approval.`,
                      data: {
                        leaveRequestId: request._id,
                        requesterId: me.userId,
                        startDate: request.startDate,
                        endDate: request.endDate,
                        reason: request.reason
                      }
                    });

                    emitLeaveRequestNotification((founder as any)._id.toString(), {
                      type: "leave_request",
                      title: "New Leave Request",
                      message: `A new leave request has been submitted and needs your approval.`,
                      data: {
                        leaveRequestId: request._id.toString(),
                        requesterId: me.userId,
                        status: "pending"
                      }
                    });
                  }
                } catch (error) {
                  console.error("Failed to notify founders:", error);
                }

                createdLeaveRequest = request;
                finalResponse = `✅ **Leave request created successfully!**

📅 **Start Date:** ${startDateNormalized.toLocaleDateString()}
📅 **End Date:** ${endDateNormalized.toLocaleDateString()}
📝 **Reason:** ${args.reason}

Your leave request has been submitted to the founders for approval. You'll be notified once it's reviewed.`;
              } else {
                console.log("❌ Date validation failed:", {
                  startDateNormalized: startDateNormalized.toISOString(),
                  today: today.toISOString(),
                  endDateNormalized: endDateNormalized.toISOString(),
                  startDateValid: startDateNormalized >= today,
                  endDateValid: endDateNormalized >= startDateNormalized
                });
                finalResponse = `❌ I couldn't create your leave request because the dates need to be in the future and the end date should be after the start date. 

Received dates:
- Start: ${args.startDate} (parsed as ${startDateNormalized.toLocaleDateString()})
- End: ${args.endDate} (parsed as ${endDateNormalized.toLocaleDateString()})
- Today: ${today.toLocaleDateString()}

Please provide valid dates.`;
              }
              }
            } catch (error) {
              console.error("Error creating leave request:", error);
              finalResponse = "❌ I encountered an error while creating your leave request. Please try again or use the Leave Requests tab to create it manually.";
            }
          } else {
            finalResponse = "❌ I need more information to create your leave request. Please provide a start date, end date, and reason (at least 5 characters).";
          }
        } else if (functionCall.name === "get_time_tracking") {
          const args = functionCall.args as { limit?: number };
          const limit = args?.limit || 10;
          const entries = await TimeTracking.find({ userId: me.userId, orgId })
            .sort({ clockInTime: -1 })
            .limit(limit)
            .lean();
          
          if (entries.length === 0) {
            finalResponse = "📊 You don't have any time tracking entries yet.";
          } else {
            const totalHours = entries.reduce((acc, entry) => acc + (entry.durationInSeconds || 0), 0) / 3600;
            finalResponse = `📊 **Your Recent Time Tracking:**

**Total Hours:** ${totalHours.toFixed(1)}h

**Recent Entries:**
${entries.map(entry => 
  `• ${new Date(entry.clockInTime).toLocaleDateString()} - ${entry.clockOutTime ? 
    `${((entry.durationInSeconds || 0) / 3600).toFixed(1)}h` : 
    'Still clocked in'}`
).join('\n')}`;
          }
        } else if (functionCall.name === "get_leave_requests") {
          const args = functionCall.args as { limit?: number };
          const limit = args?.limit || 10;
          const requests = await LeaveRequest.find({ userId: me.userId, orgId })
            .sort({ startDate: -1 })
            .limit(limit)
            .lean();
          
          if (requests.length === 0) {
            finalResponse = "📅 You don't have any leave requests yet.";
          } else {
            finalResponse = `📅 **Your Leave Requests:**

${requests.map(req => 
  `• ${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}
  **Reason:** ${req.reason}
  **Status:** ${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`
).join('\n\n')}`;
          }
        } else if (functionCall.name === "get_employee_time_tracking") {
          if (!isFounder) {
            finalResponse = "❌ You don't have permission to view other employees' data.";
          } else {
            const args = functionCall.args as { employeeName?: string; limit?: number };
            const limit = args?.limit || 10;
            
            // If no employeeName, show list of all employees
            if (!args?.employeeName) {
              if (orgUsers.length === 0) {
                finalResponse = `📊 **All Employees:**

No employees found in your organization.`;
              } else {
                finalResponse = `📊 **All Employees:**

${orgUsers.map((u: any) => `• ${u.name || u.email}`).join('\n')}

You can ask about specific employees, for example:
- "Show me ${orgUsers[0]?.name?.split(' ')[0] || 'Sarah'}'s time tracking"
- "What are ${orgUsers.length > 1 ? orgUsers[1]?.name?.split(' ')[0] || 'John' : orgUsers[0]?.name?.split(' ')[0] || 'John'}'s recent time entries"`;
              }
            } else {
              // Find employee by name or email
              const employee = orgUsers.find((u: any) => 
                (u.name && u.name.toLowerCase().includes(args.employeeName!.toLowerCase())) ||
                u.email.toLowerCase().includes(args.employeeName!.toLowerCase())
              );
              
              if (!employee) {
                finalResponse = `❌ Could not find an employee named "${args.employeeName}".

Available employees:
${orgUsers.map((u: any) => `• ${u.name || u.email}`).join('\n')}`;
              } else {
                const targetUserId = (employee as any)._id.toString();
                const entries = await TimeTracking.find({ userId: targetUserId, orgId })
                  .sort({ clockInTime: -1 })
                  .limit(limit)
                  .lean();
                
                if (entries.length === 0) {
                  finalResponse = `📊 **${(employee as any).name || (employee as any).email}'s Time Tracking:**

No time tracking entries found yet.`;
                } else {
                  const totalHours = entries.reduce((acc, entry) => acc + (entry.durationInSeconds || 0), 0) / 3600;
                  const completedEntries = entries.filter(e => e.clockOutTime);
                  const activeEntry = entries.find(e => !e.clockOutTime);
                  
                  finalResponse = `📊 **${(employee as any).name || (employee as any).email}'s Time Tracking:**

**Total Hours (from shown entries):** ${totalHours.toFixed(1)}h
${activeEntry ? `\n⚠️ **Currently Clocked In** since ${new Date(activeEntry.clockInTime).toLocaleString()}\n` : ''}

**Recent Entries:**
${entries.map(entry => {
  const clockIn = new Date(entry.clockInTime);
  const clockOut = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
  const duration = entry.durationInSeconds ? (entry.durationInSeconds / 3600).toFixed(1) + 'h' : 'N/A';
  
  return `• **Date:** ${clockIn.toLocaleDateString()}
  🕐 **Clock In:** ${clockIn.toLocaleTimeString()}
  ${clockOut ? `🕐 **Clock Out:** ${clockOut.toLocaleTimeString()}` : '🕐 **Clock Out:** Still clocked in'}
  ⏱️ **Duration:** ${duration}`;
}).join('\n\n')}`;
                }
              }
            }
          }
        } else if (functionCall.name === "get_all_employees_time_tracking") {
          if (!isFounder) {
            finalResponse = "❌ You don't have permission to view employee data.";
          } else {
            const args = functionCall.args as { limit?: number };
            const limit = args?.limit || 50;
            
            if (orgUsers.length === 0) {
              finalResponse = `📊 **All Employees Time Tracking:**

No employees found in your organization.`;
            } else {
              // Get time tracking for all employees
              const allEmployeesData: Array<{
                employee: any;
                entries: any[];
                totalHours: number;
                activeEntry: any;
              }> = [];
              
              for (const employee of orgUsers) {
                const targetUserId = (employee as any)._id.toString();
                const entries = await TimeTracking.find({ userId: targetUserId, orgId })
                  .sort({ clockInTime: -1 })
                  .limit(limit)
                  .lean();
                
                const totalHours = entries.reduce((acc, entry) => acc + (entry.durationInSeconds || 0), 0) / 3600;
                const activeEntry = entries.find((e: any) => !e.clockOutTime);
                
                allEmployeesData.push({
                  employee,
                  entries,
                  totalHours,
                  activeEntry
                });
              }
              
              // Format comprehensive report
              const report = allEmployeesData.map(({ employee, entries, totalHours, activeEntry }) => {
                const employeeName = (employee as any).name || (employee as any).email;
                let reportText = `\n**👤 ${employeeName}**\n`;
                
                if (entries.length === 0) {
                  reportText += `No time tracking entries found.\n`;
                } else {
                  reportText += `**Total Hours:** ${totalHours.toFixed(1)}h\n`;
                  if (activeEntry) {
                    reportText += `⚠️ **Currently Clocked In** since ${new Date(activeEntry.clockInTime).toLocaleString()}\n`;
                  }
                  reportText += `\n**Recent Entries:**\n`;
                  
                  entries.forEach(entry => {
                    const clockIn = new Date(entry.clockInTime);
                    const clockOut = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
                    const duration = entry.durationInSeconds ? (entry.durationInSeconds / 3600).toFixed(1) + 'h' : 'N/A';
                    
                    reportText += `  • ${clockIn.toLocaleDateString()} | `;
                    reportText += `🕐 In: ${clockIn.toLocaleTimeString()} | `;
                    reportText += clockOut ? `🕐 Out: ${clockOut.toLocaleTimeString()} | ` : `🕐 Out: Still clocked in | `;
                    reportText += `⏱️ ${duration}\n`;
                  });
                }
                
                return reportText;
              }).join('\n---\n');
              
              finalResponse = `📊 **All Employees Time Tracking Report**

**Total Employees:** ${orgUsers.length}
**Entries per Employee:** Up to ${limit} most recent

${report}

---
*Use "show me [employee name]'s time tracking" for more detailed view of a specific employee.*`;
            }
          }
        } else if (functionCall.name === "get_employee_leave_requests") {
          if (!isFounder) {
            finalResponse = "❌ You don't have permission to view other employees' data.";
          } else {
            const args = functionCall.args as { employeeName?: string; status?: string; limit?: number };
            const limit = args?.limit || 10;
            
            // Build query
            const query: any = { orgId };
            if (args?.status) {
              query.status = args.status;
            }
            
            // If specific employee requested, find them
            if (args?.employeeName) {
              const employee = orgUsers.find((u: any) => 
                (u.name && u.name.toLowerCase().includes(args.employeeName!.toLowerCase())) ||
                u.email.toLowerCase().includes(args.employeeName!.toLowerCase())
              );
              if (employee) {
                query.userId = (employee as any)._id.toString();
              } else {
                finalResponse = `❌ Could not find an employee named "${args.employeeName}".`;
              }
            }
            
            const requests = await LeaveRequest.find(query)
              .populate("userId", "name email")
              .sort({ startDate: -1 })
              .limit(limit)
              .lean();
            
            if (requests.length === 0) {
              const statusText = args?.status ? ` with status "${args.status}"` : "";
              const employeeText = args?.employeeName ? ` for ${args.employeeName}` : "";
              finalResponse = `📅 No leave requests found${employeeText}${statusText}.`;
            } else {
              finalResponse = `📅 **Leave Requests${args?.employeeName ? ` for ${args.employeeName}` : ""}:**

${requests.map((req: any) => {
  const userName = req.userId?.name || req.userId?.email || "Unknown";
  return `• **${userName}**
  ${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}
  **Reason:** ${req.reason}
  **Status:** ${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`;
}).join('\n\n')}`;
            }
          }
        }
      }

    // If no function was called, finalResponse was already set by the AI provider above

    // Save Betty's response to database
    const bettyMessageId = `betty_${Date.now()}_${Math.random()}`;
    await Notification.create({
      userId: me.userId,
      orgId: new Types.ObjectId(orgId),
      type: "betty_chat",
      title: "Betty Response",
      message: finalResponse,
      chatMessageId: bettyMessageId,
      senderType: "betty",
      isRead: true
    });

    res.json({ 
      success: true, 
      response: finalResponse,
      createdLeaveRequest
    });
  } catch (error) {
    console.error("AI service error:", error);
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});


// Get Betty chat history
router.get("/chat-history", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
  
  try {
    const chatMessages = await Notification.find({
      userId: me.userId,
      orgId: new Types.ObjectId(orgId),
      type: "betty_chat"
    })
    .sort({ createdAt: 1 })
    .limit(50) // Limit to last 50 messages
    .lean();

    // Transform to chat format
    const messages = chatMessages.map(msg => ({
      id: msg.chatMessageId,
      type: msg.senderType,
      message: msg.message,
      timestamp: msg.createdAt
    }));

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// --- Time Tracking Endpoints ---

// Clock In
router.post("/clock-in", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  // Check for an existing active session to prevent duplicates
  const existing = await TimeTracking.findOne({ userId: me.userId, orgId, clockOutTime: null });
  if (existing) {
    return res.status(409).json({ error: "Already clocked in.", data: existing });
  }

  // Block clock-in on approved leave days
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const approvedLeave = await TeamforceLeaveRequest.findOne({
    userId: new Types.ObjectId(me.userId),
    orgId,
    status: "Approved",
    startDate: { $lte: todayEnd },
    endDate: { $gte: todayStart },
  }).lean();
  if (approvedLeave) {
    return res.status(400).json({
      error: "You have an approved leave for today. Attendance cannot be marked on approved leave days.",
    });
  }

  const record = await TimeTracking.create({
    userId: me.userId,
    orgId,
    clockInTime: new Date(),
  });
  res.status(201).json({ success: true, record });
});

// Clock Out
router.post("/clock-out", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
  
  const now = new Date();

  const record = await TimeTracking.findOne({ userId: me.userId, orgId, clockOutTime: null });
  if (!record) {
    return res.status(404).json({ error: "No active clock-in session found." });
  }

  record.clockOutTime = now;
  record.durationInSeconds = (now.getTime() - record.clockInTime.getTime()) / 1000;
  await record.save();

  // Auto-close any active break when clocking out
  const openBreak = await TeamforceBreakLog.findOne({
    userId: me.userId,
    orgId,
    breakStopTime: null,
  });
  if (openBreak) {
    openBreak.breakStopTime = now;
    openBreak.durationInSeconds =
      (now.getTime() - openBreak.breakStartTime.getTime()) / 1000;
    await openBreak.save();
  }

  res.json({ success: true, record });
});

// --- Break Tracking Endpoints ---

// Start Break (requires active clock-in session)
router.post("/break-start", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  // Must be clocked in to start a break
  const activeSession = await TimeTracking.findOne({
    userId: me.userId,
    orgId,
    clockOutTime: null,
  });
  if (!activeSession) {
    return res.status(400).json({ error: "You must be clocked in to start a break" });
  }

  // Break policy gating — hard stops only; budget overrun is soft (payroll).
  const policy = await findApplicablePolicy(me.userId, orgId);
  if (!policy) {
    return res
      .status(403)
      .json({
        error:
          "No active break policy applies to you. Ask your admin to activate one that includes your department or designation.",
      });
  }

  // Prevent duplicate active breaks
  const existingBreak = await TeamforceBreakLog.findOne({
    userId: me.userId,
    orgId,
    breakStopTime: null,
  });
  if (existingBreak) {
    return res.status(409).json({ error: "Break already in progress", data: existingBreak });
  }

  const record = await TeamforceBreakLog.create({
    userId: me.userId,
    orgId,
    timeTrackingId: activeSession._id,
    breakStartTime: new Date(),
  });
  res.status(201).json({ success: true, record });
});

// Stop Break
router.post("/break-stop", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  const now = new Date();
  const record = await TeamforceBreakLog.findOne({
    userId: me.userId,
    orgId,
    breakStopTime: null,
  });
  if (!record) {
    return res.status(404).json({ error: "No active break found" });
  }

  record.breakStopTime = now;
  const duration = (now.getTime() - record.breakStartTime.getTime()) / 1000;
  record.durationInSeconds = duration;

  // Compute breach split against today's accumulated budget. Use the policy
  // that currently applies to this user (may be null if admin deactivated
  // everything after they started the break — treat as no budget).
  const policy = await findApplicablePolicy(me.userId, orgId);
  const budgetSeconds = (policy?.breakMinutesPerDay ?? 0) * 60;

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  // Sum of CLOSED prior breaks today (exclude this record — it was open until now).
  const prior = await TeamforceBreakLog.aggregate([
    {
      $match: {
        _id: { $ne: record._id },
        userId: new Types.ObjectId(me.userId),
        orgId: new Types.ObjectId(orgId),
        breakStartTime: { $gte: startOfDay },
        breakStopTime: { $ne: null },
      },
    },
    { $group: { _id: null, total: { $sum: "$durationInSeconds" } } },
  ]);
  const priorUsed = prior[0]?.total || 0;
  const totalAfter = priorUsed + duration;

  let withinBudgetSeconds = duration;
  let overBudgetSeconds = 0;
  if (budgetSeconds <= 0) {
    // No budget configured → treat everything as within budget.
    withinBudgetSeconds = duration;
    overBudgetSeconds = 0;
  } else if (priorUsed >= budgetSeconds) {
    withinBudgetSeconds = 0;
    overBudgetSeconds = duration;
  } else if (totalAfter > budgetSeconds) {
    withinBudgetSeconds = budgetSeconds - priorUsed;
    overBudgetSeconds = totalAfter - budgetSeconds;
  }

  record.withinBudgetSeconds = withinBudgetSeconds;
  record.overBudgetSeconds = overBudgetSeconds;
  record.isBreach = overBudgetSeconds > 0;
  // First breach of the day is the log where prior was within budget but this
  // pushed it over. Subsequent breach logs same day don't re-trigger.
  record.triggeredBreach =
    budgetSeconds > 0 && priorUsed < budgetSeconds && totalAfter > budgetSeconds;

  await record.save();

  res.json({ success: true, record });
});

// Get Break Logs (current user)
router.get("/break-logs", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  const logs = await TeamforceBreakLog.find({ userId: me.userId, orgId })
    .sort({ breakStartTime: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, logs });
});

// Create a backdated Time Tracking entry for self (founders + whitelist).
// Always recorded against the requesting user — body cannot target someone else.
router.post("/time-tracking", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  const { clockInTime, clockOutTime } = z
    .object({
      clockInTime: z.string(),
      clockOutTime: z.string().optional(),
    })
    .parse(req.body);

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  const user = await User.findById(me.userId).lean();
  const isFounder = user?.organizations?.some(
    (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
  );
  const SELF_EDIT_WHITELIST = new Set<string>(["chiranjeeb@garage.app"]);
  const isSelfEditWhitelisted = !!user?.email && SELF_EDIT_WHITELIST.has(user.email);

  if (!isFounder && !isSelfEditWhitelisted) {
    return res.status(403).json({ error: "Only founders can add time entries" });
  }

  const parsedIn = new Date(clockInTime);
  if (Number.isNaN(parsedIn.getTime())) {
    return res.status(400).json({ error: "Invalid clock-in time" });
  }
  let parsedOut: Date | undefined;
  if (clockOutTime) {
    parsedOut = new Date(clockOutTime);
    if (Number.isNaN(parsedOut.getTime())) {
      return res.status(400).json({ error: "Invalid clock-out time" });
    }
    if (parsedOut <= parsedIn) {
      return res.status(400).json({ error: "Clock-out time must be after clock-in time" });
    }
  }

  const record = await TimeTracking.create({
    userId: me.userId,
    orgId,
    clockInTime: parsedIn,
    clockOutTime: parsedOut,
    durationInSeconds: parsedOut
      ? (parsedOut.getTime() - parsedIn.getTime()) / 1000
      : undefined,
  });

  res.status(201).json({ success: true, record });
});

// Edit Time Tracking Entry (founders only)
router.patch("/time-tracking/:id", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { id } = req.params;
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  const { clockInTime, clockOutTime } = z
    .object({
      clockInTime: z.string().optional(),
      clockOutTime: z.string().optional(),
    })
    .parse(req.body);

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  // Check if user is a founder
  const user = await User.findById(me.userId).lean();
  const isFounder = user?.organizations?.some(
    (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
  );

  // Self-edit whitelist: specific users may edit their OWN entries even
  // when not a founder. Kept narrow on purpose — any future broadening
  // should land as a proper role/permission rather than more emails.
  const SELF_EDIT_WHITELIST = new Set<string>(["chiranjeeb@garage.app"]);
  const isSelfEditWhitelisted = !!user?.email && SELF_EDIT_WHITELIST.has(user.email);

  if (!isFounder && !isSelfEditWhitelisted) {
    return res.status(403).json({ error: "Only founders can edit time entries" });
  }

  // Find the time tracking entry
  const entry = await TimeTracking.findOne({ _id: id, orgId });
  if (!entry) {
    return res.status(404).json({ error: "Time tracking entry not found" });
  }

  // Whitelisted self-editors can only modify their own entries — founders
  // retain the existing org-wide edit rights.
  if (!isFounder && isSelfEditWhitelisted && entry.userId.toString() !== me.userId) {
    return res.status(403).json({ error: "You can only edit your own time entries" });
  }

  // Parse and validate dates
  if (clockInTime) {
    const parsedClockIn = new Date(clockInTime);
    if (isNaN(parsedClockIn.getTime())) {
      return res.status(400).json({ error: "Invalid clock-in time" });
    }
    entry.clockInTime = parsedClockIn;
  }

  if (clockOutTime) {
    const parsedClockOut = new Date(clockOutTime);
    if (isNaN(parsedClockOut.getTime())) {
      return res.status(400).json({ error: "Invalid clock-out time" });
    }
    entry.clockOutTime = parsedClockOut;
  }

  // Validate that clock-out is after clock-in
  if (entry.clockOutTime && entry.clockInTime > entry.clockOutTime) {
    return res.status(400).json({ error: "Clock-out time must be after clock-in time" });
  }

  // Recalculate duration if both times are present
  if (entry.clockInTime && entry.clockOutTime) {
    entry.durationInSeconds = (entry.clockOutTime.getTime() - entry.clockInTime.getTime()) / 1000;
  }

  await entry.save();

  res.json({ success: true, record: entry });
});

// Get Time Tracking History
router.get("/time-tracking", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
    
    const history = await TimeTracking.find({ userId: me.userId, orgId })
        .sort({ clockInTime: -1 })
        .limit(100) // Limit to the last 100 entries for performance
        .lean();
    res.json({ success: true, history });
});

// Organization-wide time tracking overview (founders only)
router.get("/org-time-tracking", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId, start, end } = z
        .object({
            orgId: z.string(),
            start: z.string().optional(),
            end: z.string().optional(),
        })
        .parse(req.query);

    if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
    }

    const user = await User.findById(me.userId).lean();
    const isFounder = user?.organizations?.some(
        (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
    );

    if (!isFounder) {
        return res.status(403).json({ error: "Only founders can view organization attendance" });
    }

    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setHours(23, 59, 59, 999);
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const parseDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    };

    const requestedStart = parseDate(start);
    const requestedEnd = parseDate(end);

    if (start && !requestedStart) {
        return res.status(400).json({ error: "Invalid start date" });
    }

    if (end && !requestedEnd) {
        return res.status(400).json({ error: "Invalid end date" });
    }

    const rangeStart = requestedStart ? new Date(requestedStart) : defaultStart;
    const rangeEnd = requestedEnd ? new Date(requestedEnd) : defaultEnd;

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    if (rangeStart > rangeEnd) {
        return res.status(400).json({ error: "Start date must be before end date" });
    }

    const entries = await TimeTracking.find({
        orgId,
        clockInTime: { $gte: rangeStart, $lte: rangeEnd },
    })
        .populate("userId", "name email")
        .sort({ clockInTime: -1 })
        .lean();

    const employeesMap = new Map<
        string,
        {
            userId: string;
            name: string;
            email: string | null;
            totalDurationInSeconds: number;
            activeEntry: {
                id: string;
                clockInTime: string;
                clockOutTime: string | null;
                durationInSeconds: number;
            } | null;
            entries: Array<{
                id: string;
                clockInTime: string;
                clockOutTime: string | null;
                durationInSeconds: number;
            }>;
            dailyTotals: Record<string, number>;
        }
    >();

    const daysMap = new Map<
        string,
        {
            date: string;
            totalDurationInSeconds: number;
            employees: Map<
                string,
                { userId: string; name: string; email: string | null; durationInSeconds: number }
            >;
        }
    >();

    const ensureDayEntry = (dayKey: string) => {
        if (!daysMap.has(dayKey)) {
            daysMap.set(dayKey, {
                date: dayKey,
                totalDurationInSeconds: 0,
                employees: new Map(),
            });
        }
        return daysMap.get(dayKey)!;
    };

    for (const entry of entries) {
        const entryUser: any = entry.userId;
        const userId =
            typeof entry.userId === "string"
                ? entry.userId
                : entryUser?._id?.toString?.() ?? null;

        if (!userId) {
            continue;
        }

        const name = entryUser?.name || entryUser?.email || "Unknown";
        const email = entryUser?.email || null;

        if (!employeesMap.has(userId)) {
            employeesMap.set(userId, {
                userId,
                name,
                email,
                totalDurationInSeconds: 0,
                activeEntry: null,
                entries: [],
                dailyTotals: {},
            });
        }

        const employeeRecord = employeesMap.get(userId)!;
        const clockInTime = new Date(entry.clockInTime);
        const clockOutTime = entry.clockOutTime ? new Date(entry.clockOutTime) : null;
        let durationSeconds =
            typeof entry.durationInSeconds === "number"
                ? entry.durationInSeconds
                : clockOutTime
                ? (clockOutTime.getTime() - clockInTime.getTime()) / 1000
                : (Date.now() - clockInTime.getTime()) / 1000;

        if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
            durationSeconds = 0;
        }

        const roundedDuration = Math.round(durationSeconds);
        const recordId =
            entry._id?.toString?.() ??
            `${userId}-${clockInTime.getTime()}`;
        const record = {
            id: recordId,
            clockInTime: clockInTime.toISOString(),
            clockOutTime: clockOutTime ? clockOutTime.toISOString() : null,
            durationInSeconds: roundedDuration,
        };

        employeeRecord.entries.push(record);
        employeeRecord.totalDurationInSeconds += roundedDuration;

        if (!clockOutTime && !employeeRecord.activeEntry) {
            employeeRecord.activeEntry = record;
        }

        const dayKey = clockInTime.toISOString().split("T")[0];
        employeeRecord.dailyTotals[dayKey] =
            (employeeRecord.dailyTotals[dayKey] || 0) + roundedDuration;

        const dayRecord = ensureDayEntry(dayKey);
        dayRecord.totalDurationInSeconds += roundedDuration;

        if (!dayRecord.employees.has(userId)) {
            dayRecord.employees.set(userId, {
                userId,
                name,
                email,
                durationInSeconds: 0,
            });
        }

        const dayEmployeeRecord = dayRecord.employees.get(userId)!;
        dayEmployeeRecord.durationInSeconds += roundedDuration;
    }

    const employees = Array.from(employeesMap.values()).map((employee) => ({
        ...employee,
        entries: employee.entries.sort(
            (a, b) =>
                new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime()
        ),
    }));

    employees.sort(
        (a, b) => b.totalDurationInSeconds - a.totalDurationInSeconds
    );

    const days = Array.from(daysMap.values())
        .map((day) => ({
            date: day.date,
            totalDurationInSeconds: Math.round(day.totalDurationInSeconds),
            employees: Array.from(day.employees.values()).sort(
                (a, b) => b.durationInSeconds - a.durationInSeconds
            ),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
        success: true,
        data: {
            range: {
                start: rangeStart.toISOString(),
                end: rangeEnd.toISOString(),
            },
            employees,
            days,
            generatedAt: new Date().toISOString(),
        },
    });
});


// --- Leave Request Endpoints ---

// Get all leave requests for the organization
router.get("/leave-requests", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
    
    const requests = await LeaveRequest.find({ orgId })
        .populate("userId", "name email") // Populate user info
        .sort({ startDate: -1 })
        .lean();
    res.json({ success: true, requests });
});

// Get user's own leave requests
router.get("/my-leave-requests", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
    
    const requests = await LeaveRequest.find({ userId: me.userId, orgId })
        .sort({ startDate: -1 })
        .lean();
    res.json({ success: true, requests });
});

// Create a leave request
router.post("/leave-requests", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
    
    const schema = z.object({
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().min(5, "Reason must be at least 5 characters long.").max(500),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    }
    const { startDate, endDate, reason } = parsed.data;

    const normalizedStartDate = normalizeDateInput(startDate);
    const normalizedEndDate = normalizeDateInput(endDate);

    if (!normalizedStartDate || !normalizedEndDate) {
        return res.status(400).json({ error: "Invalid dates. Please provide valid start and end dates (e.g., 2025-05-12)." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalizedStartDate < today) {
        return res.status(400).json({ error: "Start date must be today or in the future." });
    }

    if (normalizedEndDate < normalizedStartDate) {
        return res.status(400).json({ error: "End date must be the same as or later than the start date." });
    }

    const request = await LeaveRequest.create({
        userId: me.userId,
        orgId,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        reason,
    });

    // Notify founders about the new leave request
    try {
        const { User } = await import("../models/user.model");
        const founders = await User.find({
            "organizations.organization": new Types.ObjectId(orgId),
            "organizations.role": "founder"
        }).lean();

        for (const founder of founders) {
            await Notification.create({
                userId: founder._id,
                orgId: new Types.ObjectId(orgId),
                type: "leave_request",
                title: "New Leave Request",
                message: `A new leave request has been submitted and needs your approval.`,
                data: {
                    leaveRequestId: request._id,
                    requesterId: me.userId,
                    startDate: request.startDate,
                    endDate: request.endDate,
                    reason: request.reason
                }
            });

            // Emit real-time notification
            emitLeaveRequestNotification(founder._id.toString(), {
                type: "leave_request",
                title: "New Leave Request",
                message: `A new leave request has been submitted and needs your approval.`,
                data: {
                    leaveRequestId: request._id.toString(),
                    requesterId: me.userId,
                    status: "pending"
                }
            });
        }
    } catch (error) {
        console.error("Failed to notify founders:", error);
        // Don't fail the request if notification fails
    }

    res.status(201).json({ success: true, request });
});

// Approve/Reject leave request (for founders)
router.patch("/leave-requests/:id", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    const { id } = req.params;
    
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

    const schema = z.object({
        status: z.enum(["approved", "rejected"])
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        // Check if user is a founder
        const { User } = await import("../models/user.model");
        const user = await User.findById(me.userId).lean();
        const isFounder = user?.organizations?.some(
            (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
        );

        if (!isFounder) {
            return res.status(403).json({ error: "Only founders can approve/reject leave requests" });
        }

        const request = await LeaveRequest.findByIdAndUpdate(
            id,
            { 
                status: parsed.data.status,
                approverId: me.userId
            },
            { new: true }
        ).populate("userId", "name email");

        if (!request) {
            return res.status(404).json({ error: "Leave request not found" });
        }

        // Notify the requester about the decision
        await Notification.create({
            userId: (request.userId as any)._id,
            orgId: new Types.ObjectId(orgId),
            type: "leave_request",
            title: `Leave Request ${parsed.data.status === "approved" ? "Approved" : "Rejected"}`,
            message: `Your leave request from ${request.startDate.toDateString()} to ${request.endDate.toDateString()} has been ${parsed.data.status}.`,
            data: {
                leaveRequestId: request._id,
                status: parsed.data.status,
                approverId: me.userId
            }
        });

        // Emit real-time notification
        emitLeaveRequestNotification((request.userId as any)._id.toString(), {
            type: "leave_request",
            title: `Leave Request ${parsed.data.status === "approved" ? "Approved" : "Rejected"}`,
            message: `Your leave request from ${request.startDate.toDateString()} to ${request.endDate.toDateString()} has been ${parsed.data.status}.`,
            data: {
                leaveRequestId: request._id.toString(),
                status: parsed.data.status,
                approverId: me.userId
            }
        });

        res.json({ success: true, request });
    } catch (error) {
        console.error("Error updating leave request:", error);
        res.status(500).json({ error: "Failed to update leave request" });
    }
});

// Get all pending leave requests (for founders)
router.get("/pending-leave-requests", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

    try {
        // Check if user is a founder
        const { User } = await import("../models/user.model");
        const user = await User.findById(me.userId).lean();
        const isFounder = user?.organizations?.some(
            (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
        );

        if (!isFounder) {
            return res.status(403).json({ error: "Only founders can view pending leave requests" });
        }

        const requests = await LeaveRequest.find({
            orgId: new Types.ObjectId(orgId),
            status: "pending"
        })
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .lean();

        res.json({ success: true, requests });
    } catch (error) {
        console.error("Error fetching pending leave requests:", error);
        res.status(500).json({ error: "Failed to fetch pending leave requests" });
    }
});

// --- Online/Offline Activity Tracking (for founders) ---

// Get online/offline activity for all stakeholders
router.get("/online-activity", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId, start, end } = z
        .object({
            orgId: z.string(),
            start: z.string().optional(),
            end: z.string().optional(),
        })
        .parse(req.query);

    if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
    }

    // Check if user is a founder
    const user = await User.findById(me.userId).lean();
    const isFounder = user?.organizations?.some(
        (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
    );

    if (!isFounder) {
        return res.status(403).json({ error: "Only founders can view online activity" });
    }

    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setHours(23, 59, 59, 999);
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const parseDate = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    };

    const requestedStart = parseDate(start);
    const requestedEnd = parseDate(end);

    if (start && !requestedStart) {
        return res.status(400).json({ error: "Invalid start date" });
    }

    if (end && !requestedEnd) {
        return res.status(400).json({ error: "Invalid end date" });
    }

    const rangeStart = requestedStart ? new Date(requestedStart) : defaultStart;
    const rangeEnd = requestedEnd ? new Date(requestedEnd) : defaultEnd;

    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    if (rangeStart > rangeEnd) {
        return res.status(400).json({ error: "Start date must be before end date" });
    }

    try {
        // Import UserActivity model
        const { UserActivity } = await import("../models/userActivity.model");

        // Get all online/offline activities for the organization in the date range
        const activities = await UserActivity.find({
            orgId: new Types.ObjectId(orgId),
            type: { $in: ["online", "offline"] },
            createdAt: { $gte: rangeStart, $lte: rangeEnd },
        })
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .lean();

        // Get all stakeholders (non-founders) in the organization
        const stakeholders = await User.find({
            "organizations.organization": new Types.ObjectId(orgId),
        })
            .select("_id name email organizations")
            .lean();

        const stakeholdersList = stakeholders.filter((u: any) => {
            const orgMembership = u.organizations?.find(
                (org: any) => org.organization.toString() === orgId
            );
            return orgMembership && orgMembership.role !== "founder";
        });

        // Group activities by user and calculate sessions
        const userActivityMap = new Map<
            string,
            {
                userId: string;
                name: string;
                email: string | null;
                sessions: Array<{
                    id: string;
                    onlineAt: string;
                    offlineAt: string | null;
                    durationInSeconds: number;
                }>;
                totalOnlineSeconds: number;
                dailyTotals: Record<string, number>;
                lastOnline: string | null;
                isCurrentlyOnline: boolean;
            }
        >();

        // Initialize all stakeholders
        for (const stakeholder of stakeholdersList) {
            const sId = (stakeholder as any)._id.toString();
            userActivityMap.set(sId, {
                userId: sId,
                name: (stakeholder as any).name || (stakeholder as any).email || "Unknown",
                email: (stakeholder as any).email || null,
                sessions: [],
                totalOnlineSeconds: 0,
                dailyTotals: {},
                lastOnline: null,
                isCurrentlyOnline: false,
            });
        }

        // Track pending "online" events (online without matching offline)
        const pendingOnlineEvents = new Map<string, any>();

        // Sort activities by createdAt ascending for proper pairing
        const sortedActivities = [...activities].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const activity of sortedActivities) {
            const activityUser: any = activity.userId;
            const uId =
                typeof activity.userId === "string"
                    ? activity.userId
                    : activityUser?._id?.toString?.() ?? null;

            if (!uId || !userActivityMap.has(uId)) {
                continue;
            }

            const userRecord = userActivityMap.get(uId)!;

            if (activity.type === "online") {
                // Store as pending online event
                pendingOnlineEvents.set(uId, activity);
                userRecord.lastOnline = new Date(activity.createdAt).toISOString();
            } else if (activity.type === "offline") {
                // Find matching online event
                const onlineEvent = pendingOnlineEvents.get(uId);

                if (onlineEvent) {
                    const onlineTime = new Date(onlineEvent.createdAt);
                    const offlineTime = new Date(activity.createdAt);
                    const durationSeconds = Math.round(
                        (offlineTime.getTime() - onlineTime.getTime()) / 1000
                    );

                    if (durationSeconds > 0) {
                        const session = {
                            id: `${onlineEvent._id}-${activity._id}`,
                            onlineAt: onlineTime.toISOString(),
                            offlineAt: offlineTime.toISOString(),
                            durationInSeconds: durationSeconds,
                        };

                        userRecord.sessions.push(session);
                        userRecord.totalOnlineSeconds += durationSeconds;

                        // Update daily totals
                        const dayKey = onlineTime.toISOString().split("T")[0];
                        userRecord.dailyTotals[dayKey] =
                            (userRecord.dailyTotals[dayKey] || 0) + durationSeconds;
                    }

                    pendingOnlineEvents.delete(uId);
                }
            }
        }

        // Handle users who are currently online (have pending online event)
        for (const [uId, onlineEvent] of pendingOnlineEvents.entries()) {
            const userRecord = userActivityMap.get(uId);
            if (userRecord) {
                const onlineTime = new Date(onlineEvent.createdAt);
                const durationSeconds = Math.round(
                    (now.getTime() - onlineTime.getTime()) / 1000
                );

                const session = {
                    id: `${onlineEvent._id}-active`,
                    onlineAt: onlineTime.toISOString(),
                    offlineAt: null,
                    durationInSeconds: durationSeconds,
                };

                userRecord.sessions.push(session);
                userRecord.totalOnlineSeconds += durationSeconds;
                userRecord.isCurrentlyOnline = true;

                // Update daily totals
                const dayKey = onlineTime.toISOString().split("T")[0];
                userRecord.dailyTotals[dayKey] =
                    (userRecord.dailyTotals[dayKey] || 0) + durationSeconds;
            }
        }

        // Sort sessions by onlineAt descending for each user
        for (const userRecord of userActivityMap.values()) {
            userRecord.sessions.sort(
                (a, b) =>
                    new Date(b.onlineAt).getTime() - new Date(a.onlineAt).getTime()
            );
        }

        // Get real-time online status from socket connections
        const currentlyOnlineIds = getOnlineUserIds();

        // Update isCurrentlyOnline based on actual socket connections
        for (const userRecord of userActivityMap.values()) {
            userRecord.isCurrentlyOnline = currentlyOnlineIds.has(userRecord.userId);
        }

        const stakeholdersData = Array.from(userActivityMap.values()).sort(
            (a, b) => b.totalOnlineSeconds - a.totalOnlineSeconds
        );

        // Calculate daily aggregates
        const daysMap = new Map<
            string,
            {
                date: string;
                totalOnlineSeconds: number;
                activeUsers: number;
            }
        >();

        for (const stakeholder of stakeholdersData) {
            for (const [dayKey, seconds] of Object.entries(stakeholder.dailyTotals)) {
                if (!daysMap.has(dayKey)) {
                    daysMap.set(dayKey, {
                        date: dayKey,
                        totalOnlineSeconds: 0,
                        activeUsers: 0,
                    });
                }
                const dayRecord = daysMap.get(dayKey)!;
                dayRecord.totalOnlineSeconds += seconds;
                dayRecord.activeUsers += 1;
            }
        }

        const days = Array.from(daysMap.values()).sort(
            (a, b) => b.date.localeCompare(a.date)
        );

        return res.json({
            success: true,
            data: {
                range: {
                    start: rangeStart.toISOString(),
                    end: rangeEnd.toISOString(),
                },
                stakeholders: stakeholdersData,
                days,
                currentlyOnline: stakeholdersData.filter((s) => s.isCurrentlyOnline).length,
                totalStakeholders: stakeholdersData.length,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Error fetching online activity:", error);
        res.status(500).json({ error: "Failed to fetch online activity" });
    }
});

// Admin/Founder org-wide attendance: raw time entries + break logs for all
// employees in the given org + date range. Frontend aggregates this into the
// per-row attendance view.
router.get("/admin-org-attendance", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId, start, end } = z
    .object({
      orgId: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .parse(req.query);

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  const user = await User.findById(me.userId).lean();
  const isFounder = user?.organizations?.some(
    (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
  );

  let allowed = !!isFounder;
  if (!allowed) {
    const profile = await TeamforceEmployeeProfile.findOne({
      userId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId),
    })
      .select("teamforceRole")
      .lean();
    allowed = profile?.teamforceRole === "admin";
  }

  if (!allowed) {
    return res
      .status(403)
      .json({ error: "Founder or Teamforce Admin access required" });
  }

  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setHours(23, 59, 59, 999);
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const requestedStart = parseDate(start);
  const requestedEnd = parseDate(end);
  if (start && !requestedStart) {
    return res.status(400).json({ error: "Invalid start date" });
  }
  if (end && !requestedEnd) {
    return res.status(400).json({ error: "Invalid end date" });
  }

  const rangeStart = requestedStart ? new Date(requestedStart) : defaultStart;
  const rangeEnd = requestedEnd ? new Date(requestedEnd) : defaultEnd;
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  if (rangeStart > rangeEnd) {
    return res.status(400).json({ error: "Start date must be before end date" });
  }

  const [entries, breakLogs] = await Promise.all([
    TimeTracking.find({
      orgId,
      clockInTime: { $gte: rangeStart, $lte: rangeEnd },
    })
      .populate("userId", "name email")
      .sort({ clockInTime: -1 })
      .lean(),
    TeamforceBreakLog.find({
      orgId,
      breakStartTime: { $gte: rangeStart, $lte: rangeEnd },
    })
      .populate("userId", "name email")
      .sort({ breakStartTime: -1 })
      .lean(),
  ]);

  return res.json({
    success: true,
    range: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
    entries,
    breakLogs,
  });
});

// Manager team attendance — returns entries + breakLogs for direct reports only
router.get("/manager-team-attendance", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId, start, end } = z
    .object({
      orgId: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .parse(req.query);

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  // Verify the user manages a team
  const myProfile = await TeamforceEmployeeProfile.findOne({
    userId: new Types.ObjectId(me.userId),
    orgId: new Types.ObjectId(orgId),
  })
    .select("managesTeam")
    .lean();

  if (!myProfile?.managesTeam) {
    return res.status(403).json({ error: "Manager access required" });
  }

  // Find direct reports
  const teamProfiles = await TeamforceEmployeeProfile.find({
    orgId: new Types.ObjectId(orgId),
    reportingManagerId: new Types.ObjectId(me.userId),
  })
    .select("userId")
    .lean();

  const teamUserIds = teamProfiles.map((p) => p.userId);
  if (teamUserIds.length === 0) {
    return res.json({
      success: true,
      range: { start: new Date().toISOString(), end: new Date().toISOString() },
      entries: [],
      breakLogs: [],
      teamUserIds: [],
    });
  }

  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setHours(23, 59, 59, 999);
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const requestedStart = parseDate(start);
  const requestedEnd = parseDate(end);
  const rangeStart = requestedStart || defaultStart;
  const rangeEnd = requestedEnd || defaultEnd;
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);

  const [entries, breakLogs] = await Promise.all([
    TimeTracking.find({
      orgId,
      userId: { $in: teamUserIds },
      clockInTime: { $gte: rangeStart, $lte: rangeEnd },
    })
      .populate("userId", "name email")
      .sort({ clockInTime: -1 })
      .lean(),
    TeamforceBreakLog.find({
      orgId,
      userId: { $in: teamUserIds },
      breakStartTime: { $gte: rangeStart, $lte: rangeEnd },
    })
      .populate("userId", "name email")
      .sort({ breakStartTime: -1 })
      .lean(),
  ]);

  return res.json({
    success: true,
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    entries,
    breakLogs,
    teamUserIds: teamUserIds.map((id) => id.toString()),
  });
});

export default router;
