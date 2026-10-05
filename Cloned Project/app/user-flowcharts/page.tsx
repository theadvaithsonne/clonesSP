"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Flow chart data - Garage App
const garageFlowcharts = [
  {
    id: "onboarding",
    title: "User Onboarding",
    icon: "🚀",
    category: "Getting Started",
    description: "How new users join Garage 2.0",
    nodes: [
      { id: 1, label: "Visit Site", type: "start" },
      { id: 2, label: "Click Sign Up", type: "action" },
      { id: 3, label: "Enter Email", type: "action" },
      { id: 4, label: "Receive OTP", type: "process" },
      { id: 5, label: "Enter OTP", type: "action" },
      { id: 6, label: "Email Verified", type: "success" },
      { id: 7, label: "New or Existing?", type: "decision" },
      { id: 8, label: "Complete Profile", type: "action" },
      { id: 9, label: "Select Org", type: "action" },
      { id: 10, label: "Enter Workspace", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8, label: "New", direction: "left" },
      { from: 7, to: 9, label: "Existing", direction: "right" },
      { from: 8, to: 10 },
      { from: 9, to: 10 },
    ],
  },
  {
    id: "org-setup",
    title: "Organization Setup",
    icon: "🏢",
    category: "Getting Started",
    description: "Setting up your virtual office",
    nodes: [
      { id: 1, label: "Create New Org", type: "start" },
      { id: 2, label: "Enter Company Info", type: "action" },
      { id: 3, label: "Upload Branding", type: "action" },
      { id: 4, label: "Design Floor Plan", type: "action" },
      { id: 5, label: "Add Floors", type: "process" },
      { id: 6, label: "Add Departments", type: "process" },
      { id: 7, label: "Invite Team", type: "action" },
      { id: 8, label: "Assign Roles", type: "action" },
      { id: 9, label: "Organization Ready", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5, label: "Step 1", direction: "left" },
      { from: 4, to: 6, label: "Step 2", direction: "right" },
      { from: 5, to: 7 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
  {
    id: "workspace",
    title: "Workspace Navigation",
    icon: "🗺️",
    category: "Workspace",
    description: "Moving around the virtual office",
    nodes: [
      { id: 1, label: "Enter Workspace", type: "start" },
      { id: 2, label: "Land in Lobby", type: "action" },
      { id: 3, label: "Choose Destination", type: "decision" },
      { id: 4, label: "Go to Floor", type: "action" },
      { id: 5, label: "Go to Department", type: "action" },
      { id: 6, label: "Go to Meeting Room", type: "action" },
      { id: 7, label: "View Members", type: "process" },
      { id: 8, label: "Join Team", type: "process" },
      { id: 9, label: "Join Group Call", type: "process" },
      { id: 10, label: "Set Status", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, label: "Floor", direction: "left" },
      { from: 3, to: 5, label: "Dept" },
      { from: 3, to: 6, label: "Room", direction: "right" },
      { from: 4, to: 7 },
      { from: 5, to: 8 },
      { from: 6, to: 9 },
      { from: 7, to: 10 },
      { from: 8, to: 10 },
      { from: 9, to: 10 },
    ],
  },
  {
    id: "knock",
    title: "Knock Video Call",
    icon: "🔔",
    category: "Communication",
    description: "One-on-one video calling flow",
    nodes: [
      { id: 1, label: "Find Colleague", type: "start" },
      { id: 2, label: "Click Knock", type: "action" },
      { id: 3, label: "Wait for Response", type: "process" },
      { id: 4, label: "Accept or Decline?", type: "decision" },
      { id: 5, label: "Call Starts", type: "success" },
      { id: 6, label: "Declined", type: "process" },
      { id: 7, label: "Video Controls", type: "action" },
      { id: 8, label: "End Call", type: "action" },
      { id: 9, label: "Return to Workspace", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5, label: "Accept", direction: "left" },
      { from: 4, to: 6, label: "Decline", direction: "right" },
      { from: 5, to: 7 },
      { from: 6, to: 9 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
  {
    id: "screen-share",
    title: "Screen Sharing",
    icon: "🖥️",
    category: "Communication",
    description: "Share your screen in calls",
    nodes: [
      { id: 1, label: "In Active Call", type: "start" },
      { id: 2, label: "Click Share Screen", type: "action" },
      { id: 3, label: "Permission Dialog", type: "process" },
      { id: 4, label: "Select Source", type: "decision" },
      { id: 5, label: "Entire Screen", type: "action" },
      { id: 6, label: "Window", type: "action" },
      { id: 7, label: "Browser Tab", type: "action" },
      { id: 8, label: "Screen Share Active", type: "success" },
      { id: 9, label: "Stop Sharing", type: "action" },
      { id: 10, label: "Camera Restored", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5, label: "Screen", direction: "left" },
      { from: 4, to: 6, label: "Window" },
      { from: 4, to: 7, label: "Tab", direction: "right" },
      { from: 5, to: 8 },
      { from: 6, to: 8 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
    ],
  },
  {
    id: "recording",
    title: "Meeting Recording",
    icon: "⏺️",
    category: "Communication",
    description: "Record and analyze meetings",
    nodes: [
      { id: 1, label: "In Active Call", type: "start" },
      { id: 2, label: "Click Record", type: "action" },
      { id: 3, label: "Grant Permissions", type: "process" },
      { id: 4, label: "Recording Active", type: "success" },
      { id: 5, label: "Stop Recording", type: "action" },
      { id: 6, label: "Processing", type: "process" },
      { id: 7, label: "Upload to Cabinet", type: "action" },
      { id: 8, label: "AI Analysis", type: "process" },
      { id: 9, label: "Summary Ready", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
  {
    id: "messaging",
    title: "Messaging",
    icon: "💬",
    category: "Communication",
    description: "Direct and group messaging",
    nodes: [
      { id: 1, label: "Find Team Member", type: "start" },
      { id: 2, label: "Click on Name", type: "action" },
      { id: 3, label: "Chat Opens", type: "action" },
      { id: 4, label: "Type Message", type: "action" },
      { id: 5, label: "Attach File?", type: "decision" },
      { id: 6, label: "Add Attachment", type: "action" },
      { id: 7, label: "Press Send", type: "action" },
      { id: 8, label: "Message Delivered", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6, label: "Yes", direction: "left" },
      { from: 5, to: 7, label: "No", direction: "right" },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ],
  },
  {
    id: "tasks",
    title: "Task Management",
    icon: "✅",
    category: "Productivity",
    description: "Create and track tasks",
    nodes: [
      { id: 1, label: "Go to Tasks", type: "start" },
      { id: 2, label: "Click Create", type: "action" },
      { id: 3, label: "Enter Title", type: "action" },
      { id: 4, label: "Set Due Date", type: "action" },
      { id: 5, label: "Assign Member", type: "action" },
      { id: 6, label: "Task Created", type: "success" },
      { id: 7, label: "Notification Sent", type: "process" },
      { id: 8, label: "Work on Task", type: "action" },
      { id: 9, label: "Mark Complete", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
  {
    id: "calendar",
    title: "Calendar & Scheduling",
    icon: "📅",
    category: "Productivity",
    description: "Schedule and manage events",
    nodes: [
      { id: 1, label: "Open Calendar", type: "start" },
      { id: 2, label: "Click Date/Time", type: "action" },
      { id: 3, label: "Enter Event Title", type: "action" },
      { id: 4, label: "Set Date & Time", type: "action" },
      { id: 5, label: "Add Attendees", type: "action" },
      { id: 6, label: "Save Event", type: "action" },
      { id: 7, label: "Event Created", type: "success" },
      { id: 8, label: "Attendees Notified", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ],
  },
  {
    id: "cabinet",
    title: "File Management",
    icon: "📁",
    category: "Productivity",
    description: "Store and share files",
    nodes: [
      { id: 1, label: "Go to Cabinet", type: "start" },
      { id: 2, label: "Navigate to Folder", type: "action" },
      { id: 3, label: "Upload Method?", type: "decision" },
      { id: 4, label: "Click Upload", type: "action" },
      { id: 5, label: "Drag & Drop", type: "action" },
      { id: 6, label: "Select Files", type: "action" },
      { id: 7, label: "Files Uploaded", type: "success" },
      { id: 8, label: "Share with Team", type: "action" },
      { id: 9, label: "Set Permissions", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, label: "Button", direction: "left" },
      { from: 3, to: 5, label: "Drag", direction: "right" },
      { from: 4, to: 6 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
  {
    id: "ask-cabinet",
    title: "Ask Cabinet AI",
    icon: "🤖",
    category: "AI Features",
    description: "AI-powered document analysis",
    nodes: [
      { id: 1, label: "Open Ask Cabinet", type: "start" },
      { id: 2, label: "Choose Source", type: "decision" },
      { id: 3, label: "Upload New File", type: "action" },
      { id: 4, label: "Select Recording", type: "action" },
      { id: 5, label: "AI Processes", type: "process" },
      { id: 6, label: "Ask Questions", type: "action" },
      { id: 7, label: "AI Responds", type: "success" },
      { id: 8, label: "Get Insights", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3, label: "Upload", direction: "left" },
      { from: 2, to: 4, label: "Existing", direction: "right" },
      { from: 3, to: 5 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ],
  },
  {
    id: "workshop",
    title: "Workshop Enrollment",
    icon: "🎓",
    category: "Revenue Network",
    description: "Join webinars and workshops",
    nodes: [
      { id: 1, label: "Browse Workshops", type: "start" },
      { id: 2, label: "View Details", type: "action" },
      { id: 3, label: "Free or Paid?", type: "decision" },
      { id: 4, label: "Click Enroll", type: "action" },
      { id: 5, label: "Payment Gateway", type: "process" },
      { id: 6, label: "Complete Payment", type: "action" },
      { id: 7, label: "Enrolled!", type: "success" },
      { id: 8, label: "Access Meeting", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, label: "Free", direction: "left" },
      { from: 3, to: 5, label: "Paid", direction: "right" },
      { from: 4, to: 7 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ],
  },
  {
    id: "affiliate",
    title: "Affiliate Program",
    icon: "🔗",
    category: "Revenue Network",
    description: "Earn through referrals",
    nodes: [
      { id: 1, label: "Open NetworkChain", type: "start" },
      { id: 2, label: "View Dashboard", type: "action" },
      { id: 3, label: "Generate Link", type: "action" },
      { id: 4, label: "Share Link", type: "action" },
      { id: 5, label: "Referral Clicks", type: "process" },
      { id: 6, label: "Referral Signs Up", type: "success" },
      { id: 7, label: "Commission Earned", type: "success" },
      { id: 8, label: "View Earnings", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ],
  },
  {
    id: "complete-journey",
    title: "Complete User Journey",
    icon: "🗺️",
    category: "Overview",
    description: "Full user journey from sign up to all features",
    nodes: [
      { id: 1, label: "New User", type: "start" },
      { id: 2, label: "Sign Up & Verify", type: "action" },
      { id: 3, label: "Create or Join?", type: "decision" },
      { id: 4, label: "Create Org (Admin)", type: "action" },
      { id: 5, label: "Join Org (Member)", type: "action" },
      { id: 6, label: "Enter Workspace", type: "success" },
      { id: 7, label: "Video Calls", type: "process" },
      { id: 8, label: "Messaging", type: "process" },
      { id: 9, label: "Tasks", type: "process" },
      { id: 10, label: "Cabinet (Files)", type: "process" },
      { id: 11, label: "Revenue Network", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, label: "Create", direction: "left" },
      { from: 3, to: 5, label: "Join", direction: "right" },
      { from: 4, to: 6 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
      { from: 10, to: 11 },
    ],
  },
];

// Flow chart data - Backoffice Apps (Thoughts)
const thoughtsFlowcharts = [
  {
    id: "thoughts-notes-management",
    title: "Notes Management",
    icon: "📝",
    category: "Core Features",
    description: "Create, edit, and save notes with rich text",
    nodes: [
      { id: 1, label: "Open Thoughts", type: "start" },
      { id: 2, label: "Click New Note", type: "action" },
      { id: 3, label: "Note Drawer Opens", type: "process" },
      { id: 4, label: "Type in Editor", type: "action" },
      { id: 5, label: "Add Media?", type: "decision" },
      { id: 6, label: "Upload via Uploadthing", type: "action" },
      { id: 7, label: "Continue Editing", type: "action" },
      { id: 8, label: "Click Save", type: "action" },
      { id: 9, label: "API: PUT /notes", type: "process" },
      { id: 10, label: "Version Created", type: "success" },
      { id: 11, label: "Note in Grid", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6, label: "Yes", direction: "left" },
      { from: 5, to: 7, label: "No", direction: "right" },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
      { from: 10, to: 11 },
    ],
  },
  {
    id: "thoughts-search-filter",
    title: "Search & Filter",
    icon: "🔍",
    category: "Core Features",
    description: "Find notes with search and filters",
    nodes: [
      { id: 1, label: "View All Notes", type: "start" },
      { id: 2, label: "Type in Search", type: "action" },
      { id: 3, label: "Debounce 700ms", type: "process" },
      { id: 4, label: "API: GET /notes", type: "process" },
      { id: 5, label: "Apply Filters?", type: "decision" },
      { id: 6, label: "Select Tag Filter", type: "action" },
      { id: 7, label: "Toggle Star/Archive", type: "action" },
      { id: 8, label: "Results Filtered", type: "success" },
      { id: 9, label: "Display Notes", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6, label: "Tags", direction: "left" },
      { from: 5, to: 7, label: "Status", direction: "right" },
      { from: 6, to: 8 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
  {
    id: "thoughts-organization",
    title: "Note Organization",
    icon: "🗂️",
    category: "Core Features",
    description: "Star, archive, color-code, and tag notes",
    nodes: [
      { id: 1, label: "Select Note", type: "start" },
      { id: 2, label: "Open Menu", type: "action" },
      { id: 3, label: "Choose Action", type: "decision" },
      { id: 4, label: "Toggle Star", type: "action" },
      { id: 5, label: "Change Color", type: "action" },
      { id: 6, label: "Add/Remove Tags", type: "action" },
      { id: 7, label: "Archive Note", type: "action" },
      { id: 8, label: "API: PUT /notes", type: "process" },
      { id: 9, label: "Note Updated", type: "success" },
      { id: 10, label: "UI Refreshed", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, label: "Star", direction: "left" },
      { from: 3, to: 5, label: "Color" },
      { from: 3, to: 6, label: "Tags" },
      { from: 3, to: 7, label: "Archive", direction: "right" },
      { from: 4, to: 8 },
      { from: 5, to: 8 },
      { from: 6, to: 8 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
    ],
  },
  {
    id: "thoughts-version-history",
    title: "Version History",
    icon: "🕐",
    category: "Advanced",
    description: "View and restore previous note versions",
    nodes: [
      { id: 1, label: "Open Note", type: "start" },
      { id: 2, label: "Click History", type: "action" },
      { id: 3, label: "API: GET /versions", type: "process" },
      { id: 4, label: "Version List Shown", type: "success" },
      { id: 5, label: "Select Version", type: "action" },
      { id: 6, label: "Preview Content", type: "process" },
      { id: 7, label: "Restore?", type: "decision" },
      { id: 8, label: "Create Backup", type: "process" },
      { id: 9, label: "API: PUT /restore", type: "process" },
      { id: 10, label: "Note Restored", type: "success" },
      { id: 11, label: "Continue Editing", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8, label: "Yes", direction: "left" },
      { from: 7, to: 11, label: "No", direction: "right" },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
      { from: 10, to: 11 },
    ],
  },
  {
    id: "thoughts-templates",
    title: "Template Usage",
    icon: "📋",
    category: "Core Features",
    description: "Create notes from pre-built templates",
    nodes: [
      { id: 1, label: "Go to Templates", type: "start" },
      { id: 2, label: "Browse Gallery", type: "action" },
      { id: 3, label: "Select Template", type: "action" },
      { id: 4, label: "Template Type?", type: "decision" },
      { id: 5, label: "Meeting Notes", type: "process" },
      { id: 6, label: "Project Plan", type: "process" },
      { id: 7, label: "Journal/Todo", type: "process" },
      { id: 8, label: "API: POST /notes", type: "process" },
      { id: 9, label: "Note Created", type: "success" },
      { id: 10, label: "Customize Content", type: "action" },
      { id: 11, label: "Save Note", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5, label: "Meeting", direction: "left" },
      { from: 4, to: 6, label: "Project" },
      { from: 4, to: 7, label: "Personal", direction: "right" },
      { from: 5, to: 8 },
      { from: 6, to: 8 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
      { from: 10, to: 11 },
    ],
  },
  {
    id: "thoughts-auth",
    title: "Authentication",
    icon: "🔐",
    category: "Getting Started",
    description: "Login and signup flow",
    nodes: [
      { id: 1, label: "Visit Thoughts", type: "start" },
      { id: 2, label: "New or Existing?", type: "decision" },
      { id: 3, label: "Enter Email/Pass", type: "action" },
      { id: 4, label: "Multi-step Signup", type: "action" },
      { id: 5, label: "Verify OTP", type: "action" },
      { id: 6, label: "Set Password", type: "action" },
      { id: 7, label: "API: POST /login", type: "process" },
      { id: 8, label: "JWT Token Set", type: "success" },
      { id: 9, label: "Cookies Stored", type: "process" },
      { id: 10, label: "Enter Dashboard", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3, label: "Existing", direction: "left" },
      { from: 2, to: 4, label: "New", direction: "right" },
      { from: 3, to: 7 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
    ],
  },
  {
    id: "thoughts-trash-recovery",
    title: "Trash & Recovery",
    icon: "🗑️",
    category: "Advanced",
    description: "Delete and recover notes",
    nodes: [
      { id: 1, label: "Select Note", type: "start" },
      { id: 2, label: "Click Delete", type: "action" },
      { id: 3, label: "Soft Delete", type: "process" },
      { id: 4, label: "Note in Trash", type: "success" },
      { id: 5, label: "Go to Trash", type: "action" },
      { id: 6, label: "Recover or Delete?", type: "decision" },
      { id: 7, label: "Click Restore", type: "action" },
      { id: 8, label: "Permanent Delete", type: "action" },
      { id: 9, label: "Note Restored", type: "success" },
      { id: 10, label: "Note Removed", type: "process" },
      { id: 11, label: "Back to Notes", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7, label: "Restore", direction: "left" },
      { from: 6, to: 8, label: "Delete", direction: "right" },
      { from: 7, to: 9 },
      { from: 8, to: 10 },
      { from: 9, to: 11 },
      { from: 10, to: 11 },
    ],
  },
  {
    id: "thoughts-complete-journey",
    title: "Complete User Journey",
    icon: "🗺️",
    category: "Overview",
    description: "Full note-taking workflow",
    nodes: [
      { id: 1, label: "User Logs In", type: "start" },
      { id: 2, label: "View Notes Grid", type: "action" },
      { id: 3, label: "What to do?", type: "decision" },
      { id: 4, label: "Create New Note", type: "action" },
      { id: 5, label: "Edit Existing", type: "action" },
      { id: 6, label: "Search Notes", type: "action" },
      { id: 7, label: "Use Template", type: "action" },
      { id: 8, label: "Edit in Drawer", type: "process" },
      { id: 9, label: "Organize Note", type: "action" },
      { id: 10, label: "Save Changes", type: "success" },
      { id: 11, label: "Continue Working", type: "end" },
    ],
    connections: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, label: "New", direction: "left" },
      { from: 3, to: 5, label: "Edit" },
      { from: 3, to: 6, label: "Find" },
      { from: 3, to: 7, label: "Template", direction: "right" },
      { from: 4, to: 8 },
      { from: 5, to: 8 },
      { from: 6, to: 5 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
      { from: 10, to: 11 },
    ],
  },
];

// Categories for each app type
const garageCategories = [
  "All",
  "Overview",
  "Getting Started",
  "Workspace",
  "Communication",
  "Productivity",
  "AI Features",
  "Revenue Network",
];

const thoughtsCategories = [
  "All",
  "Overview",
  "Getting Started",
  "Core Features",
  "Advanced",
];

const legendItems = [
  { type: "Start", color: "bg-emerald-500", borderColor: "border-emerald-400" },
  { type: "Action", color: "bg-[#343439]", borderColor: "border-slate-500" },
  { type: "Process", color: "bg-cyan-500", borderColor: "border-cyan-400" },
  { type: "Decision", color: "bg-amber-500", borderColor: "border-amber-400" },
  { type: "Success", color: "bg-[#FBD10D]", borderColor: "border-[#FBD10D]" },
  { type: "End", color: "bg-violet-500", borderColor: "border-violet-400" },
];

// Vertical Flow Node Component
const VerticalFlowNode = ({
  node,
  isActive,
  onClick,
}: {
  node: { id: number; label: string; type: string };
  isActive: boolean;
  onClick: () => void;
}) => {
  const getNodeStyle = () => {
    const baseStyles = "transition-all duration-300 cursor-pointer border-2 shadow-lg";
    const activeRing = isActive ? "ring-4 ring-white/30 ring-offset-2 ring-offset-[#0c0c0e]" : "";

    switch (node.type) {
      case "start":
        return `${baseStyles} ${activeRing} bg-emerald-500 border-emerald-400 hover:bg-emerald-400`;
      case "end":
        return `${baseStyles} ${activeRing} bg-violet-500 border-violet-400 hover:bg-violet-400`;
      case "decision":
        return `${baseStyles} ${activeRing} bg-amber-500 border-amber-400 hover:bg-amber-400`;
      case "success":
        return `${baseStyles} ${activeRing} bg-[#FBD10D] border-[#FBD10D] hover:bg-[#fbd10d]/90`;
      case "process":
        return `${baseStyles} ${activeRing} bg-cyan-500 border-cyan-400 hover:bg-cyan-400`;
      case "action":
      default:
        return `${baseStyles} ${activeRing} bg-[#343439] border-slate-500 hover:bg-slate-500`;
    }
  };

  const getShape = () => {
    if (node.type === "start" || node.type === "end") {
      return "rounded-full px-6 py-3 min-w-[140px]";
    }
    if (node.type === "decision") {
      return "rotate-45 w-24 h-24 md:w-28 md:h-28";
    }
    return "rounded-lg px-5 py-3 min-w-[160px]";
  };

  if (node.type === "decision") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: isActive ? 1.05 : 1 }}
        transition={{ duration: 0.3 }}
        onClick={onClick}
        className={`${getNodeStyle()} ${getShape()} flex items-center justify-center`}
      >
        <span className="-rotate-45 text-white text-xs md:text-sm font-semibold text-center leading-tight">
          {node.label}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: isActive ? 1.05 : 1 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`${getNodeStyle()} ${getShape()} flex items-center justify-center`}
    >
      <span className={`text-white text-sm md:text-base font-semibold text-center ${node.type === "success" ? "text-[#0c0c0e]" : ""}`}>
        {node.label}
      </span>
    </motion.div>
  );
};

// Node position calculator for canvas layout
const calculateNodePositions = (
  nodes: { id: number; label: string; type: string }[],
  connections: { from: number; to: number; label?: string; direction?: string }[]
) => {
  const positions: Map<number, { x: number; y: number }> = new Map();
  const nodeWidth = 160;
  const nodeHeight = 50;
  const horizontalGap = 200;
  const verticalGap = 100;

  // Find branch points
  const branchPoints = new Map<number, { left: number; right: number }>();
  const outgoingCount = new Map<number, number>();

  connections.forEach(conn => {
    outgoingCount.set(conn.from, (outgoingCount.get(conn.from) || 0) + 1);
  });

  nodes.forEach(node => {
    const outgoing = connections.filter(c => c.from === node.id);
    if (outgoing.length >= 2) {
      const leftConn = outgoing.find(c => c.direction === "left") || outgoing[0];
      const rightConn = outgoing.find(c => c.direction === "right") || outgoing[1];
      branchPoints.set(node.id, { left: leftConn.to, right: rightConn.to });
    }
  });

  // Find merge points
  const incomingCount = new Map<number, number>();
  connections.forEach(conn => {
    incomingCount.set(conn.to, (incomingCount.get(conn.to) || 0) + 1);
  });

  const mergePoints = new Set<number>();
  nodes.forEach(node => {
    if ((incomingCount.get(node.id) || 0) >= 2) {
      mergePoints.add(node.id);
    }
  });

  // Position nodes
  const visited = new Set<number>();
  const centerX = 400;
  let currentY = 60;

  const positionNode = (nodeId: number, x: number, y: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    positions.set(nodeId, { x, y });

    // Check if this is a branch point
    if (branchPoints.has(nodeId)) {
      const branch = branchPoints.get(nodeId)!;
      const branchY = y + verticalGap;

      // Position left and right branches
      positionNode(branch.left, x - horizontalGap, branchY);
      positionNode(branch.right, x + horizontalGap, branchY);

      // Find and position merge point
      const nextFromLeft = connections.find(c => c.from === branch.left)?.to;
      if (nextFromLeft && mergePoints.has(nextFromLeft)) {
        const leftPos = positions.get(branch.left);
        const rightPos = positions.get(branch.right);
        if (leftPos && rightPos) {
          const mergeY = Math.max(leftPos.y, rightPos.y) + verticalGap;
          positionNode(nextFromLeft, x, mergeY);
        }
      }
    } else {
      // Regular node - find next
      const nextConn = connections.find(c => c.from === nodeId);
      if (nextConn && !visited.has(nextConn.to)) {
        positionNode(nextConn.to, x, y + verticalGap);
      }
    }
  };

  positionNode(1, centerX, currentY);

  return positions;
};

// Branch connector for decision nodes
const BranchConnector = ({
  leftLabel,
  rightLabel,
  leftNodes,
  rightNodes,
  activeNode,
  onNodeClick,
  allNodes,
}: {
  leftLabel?: string;
  rightLabel?: string;
  leftNodes: number[];
  rightNodes: number[];
  activeNode: number;
  onNodeClick: (id: number) => void;
  allNodes: { id: number; label: string; type: string }[];
}) => {
  const leftActive = leftNodes.some(id => id <= activeNode);
  const rightActive = rightNodes.some(id => id <= activeNode);

  return (
    <div className="flex items-start justify-center gap-8 md:gap-16 mt-4">
      {/* Left branch */}
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <div className={`w-16 md:w-24 h-px ${leftActive ? "bg-white/20" : "bg-white/10"}`} style={{ borderTop: leftActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
          <div className={`w-px h-6 ${leftActive ? "bg-white/20" : "bg-white/10"}`} style={{ borderLeft: leftActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
        </div>
        {leftLabel && (
          <span className={`text-[10px] font-normal mb-2 px-2 py-0.5 rounded-full border ${leftActive ? "border-white/10 bg-[#1a1a24] text-white/50" : "border-white/5 bg-[#1a1a24] text-white/30"}`}>
            {leftLabel}
          </span>
        )}
        {leftNodes.map((nodeId) => {
          const node = allNodes.find(n => n.id === nodeId);
          if (!node) return null;
          return (
            <div key={nodeId} className="flex flex-col items-center">
              <VerticalFlowNode
                node={node}
                isActive={activeNode === nodeId}
                onClick={() => onNodeClick(nodeId)}
              />
            </div>
          );
        })}
      </div>

      {/* Right branch */}
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <div className={`w-px h-6 ${rightActive ? "bg-white/20" : "bg-white/10"}`} style={{ borderLeft: rightActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
          <div className={`w-16 md:w-24 h-px ${rightActive ? "bg-white/20" : "bg-white/10"}`} style={{ borderTop: rightActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
        </div>
        {rightLabel && (
          <span className={`text-[10px] font-normal mb-2 px-2 py-0.5 rounded-full border ${rightActive ? "border-white/10 bg-[#1a1a24] text-white/50" : "border-white/5 bg-[#1a1a24] text-white/30"}`}>
            {rightLabel}
          </span>
        )}
        {rightNodes.map((nodeId) => {
          const node = allNodes.find(n => n.id === nodeId);
          if (!node) return null;
          return (
            <div key={nodeId} className="flex flex-col items-center">
              <VerticalFlowNode
                node={node}
                isActive={activeNode === nodeId}
                onClick={() => onNodeClick(nodeId)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Merge connector
const MergeConnector = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="flex items-center justify-center mt-4">
      <div className="flex items-end">
        <div className="w-16 md:w-24 h-px" style={{ borderTop: isActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
        <div className="w-px h-3" style={{ borderLeft: isActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
      </div>
      <div className="w-px h-3" style={{ borderLeft: isActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
      <div className="flex items-end">
        <div className="w-px h-3" style={{ borderLeft: isActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
        <div className="w-16 md:w-24 h-px" style={{ borderTop: isActive ? "1px dashed rgba(251,209,13,0.3)" : "1px dashed rgba(255,255,255,0.15)" }} />
      </div>
    </div>
  );
};

// Canvas-based Miro/FigJam style flowchart board with draggable nodes
const CanvasFlowChart = ({
  chart,
  activeNode,
  onActiveNodeChange,
}: {
  chart: (typeof garageFlowcharts)[0];
  activeNode: number;
  onActiveNodeChange: (node: number) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Draggable node positions
  const [nodePositions, setNodePositions] = useState<Map<number, { x: number; y: number }>>(new Map());
  const [draggingNode, setDraggingNode] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Node dimensions
  const nodeWidth = 160;
  const nodeHeight = 50;
  const diamondSize = 100; // Larger diamond for text

  // Calculate initial positions for all nodes
  const initialPositions = useMemo(() => {
    const pos: Map<number, { x: number; y: number }> = new Map();
    const verticalGap = 110;
    const horizontalGap = 200;
    const centerX = 450;

    // Find branch and merge points
    const outgoing = new Map<number, typeof chart.connections>();
    chart.connections.forEach(conn => {
      if (!outgoing.has(conn.from)) outgoing.set(conn.from, []);
      outgoing.get(conn.from)!.push(conn);
    });

    const incoming = new Map<number, number>();
    chart.connections.forEach(conn => {
      incoming.set(conn.to, (incoming.get(conn.to) || 0) + 1);
    });

    const branchPoints = new Map<number, { left: number; right: number }>();
    const mergePoints = new Set<number>();

    chart.nodes.forEach(node => {
      const conns = outgoing.get(node.id) || [];
      if (conns.length >= 2) {
        const left = conns.find(c => c.direction === "left") || conns[0];
        const right = conns.find(c => c.direction === "right") || conns[1];
        branchPoints.set(node.id, { left: left.to, right: right.to });
      }
      if ((incoming.get(node.id) || 0) >= 2) {
        mergePoints.add(node.id);
      }
    });

    // Position nodes recursively
    const visited = new Set<number>();
    const positionNode = (nodeId: number, x: number, y: number): number => {
      if (visited.has(nodeId)) return y;
      visited.add(nodeId);
      pos.set(nodeId, { x, y });

      if (branchPoints.has(nodeId)) {
        const branch = branchPoints.get(nodeId)!;
        const branchY = y + verticalGap;

        const leftMaxY = positionNode(branch.left, x - horizontalGap, branchY);
        const rightMaxY = positionNode(branch.right, x + horizontalGap, branchY);

        const leftNext = chart.connections.find(c => c.from === branch.left)?.to;
        if (leftNext && mergePoints.has(leftNext)) {
          const mergeY = Math.max(leftMaxY, rightMaxY) + verticalGap;
          return positionNode(leftNext, x, mergeY);
        }
        return Math.max(leftMaxY, rightMaxY);
      } else {
        const next = chart.connections.find(c => c.from === nodeId);
        if (next && !visited.has(next.to)) {
          return positionNode(next.to, x, y + verticalGap);
        }
      }
      return y;
    };

    positionNode(1, centerX, 60);
    return pos;
  }, [chart]);

  // Initialize node positions from calculated positions
  useEffect(() => {
    setNodePositions(new Map(initialPositions));
  }, [initialPositions]);

  // Get current position (user-dragged or initial)
  const getNodePos = useCallback((nodeId: number) => {
    return nodePositions.get(nodeId) || initialPositions.get(nodeId) || { x: 450, y: 60 };
  }, [nodePositions, initialPositions]);

  // Get node style based on type
  const getNodeStyle = (type: string, isActive: boolean) => {
    const base = {
      filter: isActive ? "drop-shadow(0 0 10px rgba(251, 209, 13, 0.4))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
      transition: draggingNode ? "none" : "all 0.3s ease",
    };

    switch (type) {
      case "start":
        return { ...base, fill: "#10B981", stroke: "#34D399" };
      case "end":
        return { ...base, fill: "#8B5CF6", stroke: "#A78BFA" };
      case "decision":
        return { ...base, fill: "#F59E0B", stroke: "#FBBF24" };
      case "success":
        return { ...base, fill: "#FBD10D", stroke: "#FDE047" };
      case "process":
        return { ...base, fill: "#06B6D4", stroke: "#22D3EE" };
      default:
        return { ...base, fill: "#475569", stroke: "#64748B" };
    }
  };

  // Calculate canvas size dynamically
  const canvasWidth = 900;
  const canvasHeight = useMemo(() => {
    const positions = Array.from(nodePositions.size > 0 ? nodePositions.values() : initialPositions.values());
    return Math.max(...positions.map(p => p.y), 400) + 150;
  }, [nodePositions, initialPositions]);

  // Convert screen coords to SVG coords
  const screenToSvg = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: screenX, y: screenY };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !draggingNode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode !== null) {
      const svgPos = screenToSvg(e.clientX, e.clientY);
      setNodePositions(prev => {
        const next = new Map(prev);
        next.set(draggingNode, {
          x: svgPos.x - dragOffset.x,
          y: svgPos.y - dragOffset.y,
        });
        return next;
      });
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
  };

  // Node drag handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    const svgPos = screenToSvg(e.clientX, e.clientY);
    const nodePos = getNodePos(nodeId);
    setDragOffset({
      x: svgPos.x - nodePos.x,
      y: svgPos.y - nodePos.y,
    });
    setDraggingNode(nodeId);
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions(new Map(initialPositions));
  };

  // Draw smooth arrow path between two nodes
  const drawArrowPath = useCallback((
    fromId: number,
    toId: number,
    fromType: string,
    toType: string
  ) => {
    const from = getNodePos(fromId);
    const to = getNodePos(toId);

    // Calculate connection points based on node types
    const fromBottom = fromType === "decision"
      ? { x: from.x, y: from.y + diamondSize / 2 }
      : { x: from.x, y: from.y + nodeHeight / 2 };

    const toTop = toType === "decision"
      ? { x: to.x, y: to.y - diamondSize / 2 }
      : toType === "start" || toType === "end"
        ? { x: to.x, y: to.y - nodeHeight / 2 }
        : { x: to.x, y: to.y - nodeHeight / 2 };

    const dx = to.x - from.x;
    const dy = toTop.y - fromBottom.y;
    const radius = 16;

    // Straight down
    if (Math.abs(dx) < 20) {
      return `M ${fromBottom.x} ${fromBottom.y} L ${toTop.x} ${toTop.y - 4}`;
    }

    // Branching path with smooth curves
    const midY = fromBottom.y + Math.min(40, dy * 0.4);
    const goingRight = dx > 0;

    if (goingRight) {
      return `M ${fromBottom.x} ${fromBottom.y}
              L ${fromBottom.x} ${midY - radius}
              Q ${fromBottom.x} ${midY} ${fromBottom.x + radius} ${midY}
              L ${toTop.x - radius} ${midY}
              Q ${toTop.x} ${midY} ${toTop.x} ${midY + radius}
              L ${toTop.x} ${toTop.y - 4}`;
    } else {
      return `M ${fromBottom.x} ${fromBottom.y}
              L ${fromBottom.x} ${midY - radius}
              Q ${fromBottom.x} ${midY} ${fromBottom.x - radius} ${midY}
              L ${toTop.x + radius} ${midY}
              Q ${toTop.x} ${midY} ${toTop.x} ${midY + radius}
              L ${toTop.x} ${toTop.y - 4}`;
    }
  }, [getNodePos, nodeHeight, diamondSize]);

  // Get label position on path - centered on the horizontal segment
  const getLabelPosition = useCallback((fromId: number, toId: number, fromType: string) => {
    const from = getNodePos(fromId);
    const to = getNodePos(toId);
    const dx = to.x - from.x;

    // Straight vertical path - position in middle
    if (Math.abs(dx) < 20) {
      return { x: from.x, y: (from.y + to.y) / 2 };
    }

    // Branching path - position on the horizontal segment
    const fromBottom = fromType === "decision"
      ? from.y + diamondSize / 2
      : from.y + nodeHeight / 2;
    const midY = fromBottom + 40; // This is where the horizontal segment is

    // Position label closer to the source node on the horizontal line
    const labelX = from.x + (to.x - from.x) * 0.3;

    return { x: labelX, y: midY };
  }, [getNodePos, nodeHeight, diamondSize]);

  return (
    <div className="relative w-full h-full bg-[#0a0a0c] rounded-xl overflow-hidden border border-white/10">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-lg bg-[#1a1a24] border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-lg bg-[#1a1a24] border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h12" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="w-10 h-10 rounded-lg bg-[#1a1a24] border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <div className="text-center text-xs text-white/40 mt-1">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Pan instructions */}
      <div className="absolute bottom-4 left-4 z-20 text-xs text-white/30">
        Drag to pan • Scroll to zoom
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-hidden ${draggingNode ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
        }}
      >
        <svg
          ref={svgRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: (isPanning || draggingNode) ? "none" : "transform 0.1s ease-out",
          }}
        >
          {/* Arrow marker definition - subtle small arrows */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0.5 L5,3 L0,5.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0.5 L5,3 L0,5.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
            </marker>
          </defs>

          {/* Draw connections */}
          {chart.connections.map((conn, idx) => {
            const fromNode = chart.nodes.find(n => n.id === conn.from);
            const toNode = chart.nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            const isActive = activeNode >= conn.from;
            const path = drawArrowPath(conn.from, conn.to, fromNode.type, toNode.type);
            const labelPos = getLabelPosition(conn.from, conn.to, fromNode.type);

            return (
              <g key={`conn-${idx}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={1}
                  markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                  style={{ transition: draggingNode ? "none" : "stroke 0.3s ease" }}
                />
                {/* Connection label - subtle pill on the path */}
                {conn.label && (() => {
                  const pillWidth = Math.max(conn.label.length * 7 + 16, 50);
                  return (
                    <g>
                      <rect
                        x={labelPos.x - pillWidth / 2}
                        y={labelPos.y - 10}
                        width={pillWidth}
                        height={20}
                        rx={10}
                        fill="#0c0c0e"
                        stroke={isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}
                        strokeWidth={1}
                      />
                      <text
                        x={labelPos.x}
                        y={labelPos.y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)"}
                        fontSize="10"
                        fontWeight="500"
                      >
                        {conn.label}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Draw nodes */}
          {chart.nodes.map((node) => {
            const pos = getNodePos(node.id);
            const isActive = activeNode === node.id;
            const isDragging = draggingNode === node.id;
            const style = getNodeStyle(node.type, isActive);

            if (node.type === "decision") {
              // Diamond shape for decision
              const size = diamondSize;
              // Split label into lines that fit inside diamond
              const words = node.label.split(" ");
              const lines: string[] = [];
              let currentLine = "";
              words.forEach(word => {
                if (currentLine.length + word.length > 10) {
                  if (currentLine) lines.push(currentLine.trim());
                  currentLine = word + " ";
                } else {
                  currentLine += word + " ";
                }
              });
              if (currentLine.trim()) lines.push(currentLine.trim());

              const lineHeight = 12;
              const totalTextHeight = lines.length * lineHeight;
              const startY = pos.y - totalTextHeight / 2 + lineHeight / 2;

              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={() => !isDragging && onActiveNodeChange(node.id)}
                  style={{ cursor: isDragging ? "grabbing" : "grab" }}
                >
                  <polygon
                    points={`${pos.x},${pos.y - size/2} ${pos.x + size/2},${pos.y} ${pos.x},${pos.y + size/2} ${pos.x - size/2},${pos.y}`}
                    fill={style.fill}
                    stroke={isActive ? "#FBD10D" : style.stroke}
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ filter: style.filter, transition: style.transition }}
                  />
                  <text
                    x={pos.x}
                    y={startY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="600"
                    style={{ pointerEvents: "none" }}
                  >
                    {lines.map((line, i) => (
                      <tspan key={i} x={pos.x} dy={i === 0 ? 0 : lineHeight}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            }

            if (node.type === "start" || node.type === "end") {
              // Rounded rectangle (pill shape)
              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={() => !isDragging && onActiveNodeChange(node.id)}
                  style={{ cursor: isDragging ? "grabbing" : "grab" }}
                >
                  <rect
                    x={pos.x - nodeWidth / 2}
                    y={pos.y - nodeHeight / 2}
                    width={nodeWidth}
                    height={nodeHeight}
                    rx={nodeHeight / 2}
                    fill={style.fill}
                    stroke={isActive ? "#FBD10D" : style.stroke}
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ filter: style.filter, transition: style.transition }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="13"
                    fontWeight="600"
                    style={{ pointerEvents: "none" }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            }

            // Regular rectangle for other nodes
            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={() => !isDragging && onActiveNodeChange(node.id)}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
              >
                <rect
                  x={pos.x - nodeWidth / 2}
                  y={pos.y - nodeHeight / 2}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={8}
                  fill={style.fill}
                  stroke={isActive ? "#FBD10D" : style.stroke}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ filter: style.filter, transition: style.transition }}
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={node.type === "success" ? "#0c0c0e" : "white"}
                  fontSize="12"
                  fontWeight="600"
                  style={{ pointerEvents: "none" }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Drag hint */}
      <div className="absolute bottom-4 right-4 z-20 text-xs text-white/30 bg-[#1a1a24]/80 px-2 py-1 rounded">
        Drag nodes to reposition
      </div>
    </div>
  );
};

// Flow chart card component for grid view
const FlowChartCard = ({
  chart,
  index,
  onClick,
}: {
  chart: (typeof garageFlowcharts)[0];
  index: number;
  onClick: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
      onClick={onClick}
      className="
        relative overflow-hidden cursor-pointer
        bg-gradient-to-br from-[#1a1a24] to-[#12121a]
        border border-white/10
        rounded-2xl
        transition-all duration-300
        hover:border-[#FBD10D]/40 hover:shadow-xl hover:shadow-[#FBD10D]/10
        hover:scale-[1.02]
        group
      "
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FBD10D]/10 to-transparent" />
      </div>

      <div className="relative p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FBD10D]/20 to-[#FBA70A]/10 flex items-center justify-center text-2xl border border-[#FBD10D]/20 group-hover:scale-110 transition-transform">
            {chart.icon}
          </div>
          <div className="flex-1">
            <span className="text-xs text-[#FBD10D] uppercase tracking-wider font-medium">
              {chart.category}
            </span>
            <h3 className="text-xl font-bold text-white mt-1 group-hover:text-[#FBD10D] transition-colors">
              {chart.title}
            </h3>
            <p className="text-white/50 text-sm mt-1">{chart.description}</p>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:bg-[#FBD10D] group-hover:text-[#0c0c0e] group-hover:border-[#FBD10D] transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 overflow-hidden">
          {chart.nodes.slice(0, 7).map((node, i) => (
            <React.Fragment key={node.id}>
              <div
                className={`
                  w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125
                  ${node.type === "start" ? "bg-emerald-500" : ""}
                  ${node.type === "end" ? "bg-violet-500" : ""}
                  ${node.type === "decision" ? "bg-amber-500" : ""}
                  ${node.type === "success" ? "bg-[#FBD10D]" : ""}
                  ${node.type === "process" ? "bg-cyan-500" : ""}
                  ${node.type === "action" ? "bg-slate-500" : ""}
                `}
              />
              {i < Math.min(6, chart.nodes.length - 1) && (
                <div className="w-4 h-px bg-white/20 group-hover:bg-[#FBD10D]/40 transition-colors" />
              )}
            </React.Fragment>
          ))}
          {chart.nodes.length > 7 && (
            <span className="text-white/30 text-xs ml-1">+{chart.nodes.length - 7}</span>
          )}
        </div>

        <div className="absolute top-4 right-4 px-2 py-1 rounded-full bg-white/5 text-white/40 text-xs">
          {chart.nodes.length} steps
        </div>
      </div>
    </motion.div>
  );
};

// Dropdown component
const FlowDropdown = ({
  charts,
  selectedChart,
  onSelect,
}: {
  charts: typeof garageFlowcharts;
  selectedChart: (typeof garageFlowcharts)[0];
  onSelect: (chart: (typeof garageFlowcharts)[0]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl hover:border-[#FBD10D]/40 transition-colors"
      >
        <span className="text-xl">{selectedChart.icon}</span>
        <div className="text-left">
          <p className="text-white font-semibold text-sm">{selectedChart.title}</p>
          <p className="text-white/50 text-xs">{selectedChart.category}</p>
        </div>
        <svg
          className={`w-5 h-5 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-72 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="max-h-96 overflow-y-auto scrollbar-hide">
              {charts.map((chart) => (
                <button
                  key={chart.id}
                  onClick={() => {
                    onSelect(chart);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                    ${selectedChart.id === chart.id ? "bg-[#FBD10D]/10 border-l-2 border-[#FBD10D]" : "hover:bg-white/5 border-l-2 border-transparent"}
                  `}
                >
                  <span className="text-lg">{chart.icon}</span>
                  <div>
                    <p className={`font-medium text-sm ${selectedChart.id === chart.id ? "text-[#FBD10D]" : "text-white"}`}>
                      {chart.title}
                    </p>
                    <p className="text-white/40 text-xs">{chart.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Legend popup
const LegendPopup = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popupRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="absolute top-full right-0 mt-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl p-4 z-50 w-64"
        >
          <h3 className="text-white font-semibold text-sm mb-3">Node Types</h3>
          <div className="space-y-2">
            {legendItems.map((item) => (
              <div key={item.type} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-md ${item.color} border ${item.borderColor}`} />
                <span className="text-white/70 text-sm">{item.type}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Compact card for sidebar
const SidebarCard = ({
  chart,
  isSelected,
  onClick,
}: {
  chart: (typeof garageFlowcharts)[0];
  isSelected: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-xl transition-all duration-200
        ${isSelected
          ? "bg-[#FBD10D]/10 border border-[#FBD10D]/40"
          : "bg-[#1a1a24]/50 border border-transparent hover:bg-[#1a1a24] hover:border-white/10"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isSelected ? "bg-[#FBD10D]/20" : "bg-white/5"}`}>
          {chart.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm truncate ${isSelected ? "text-[#FBD10D]" : "text-white"}`}>
            {chart.title}
          </p>
          <p className="text-xs text-white/40 truncate">{chart.category}</p>
        </div>
        <span className="text-xs text-white/30">{chart.nodes.length}</span>
      </div>
    </button>
  );
};

// App tabs configuration
const appTabs = [
  { id: "garage", label: "Garage App", icon: "🏢", description: "Virtual office platform" },
  { id: "backoffice", label: "Backoffice Apps", icon: "📱", description: "Productivity tools" },
] as const;

type AppTabId = typeof appTabs[number]["id"];

// Backoffice sub-apps
const backofficeApps = [
  { id: "thoughts", label: "Notes", icon: "📝", flowcharts: thoughtsFlowcharts, categories: thoughtsCategories },
] as const;

// Main page component - Two column layout
export default function FlowchartsPage() {
  const [activeTab, setActiveTab] = useState<AppTabId>("garage");
  const [selectedBackofficeApp, setSelectedBackofficeApp] = useState<string>("thoughts");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedChart, setSelectedChart] = useState<(typeof garageFlowcharts)[0]>(garageFlowcharts[0]);
  const [activeNode, setActiveNode] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Get current flowcharts and categories based on active tab
  const currentFlowcharts = useMemo(() => {
    if (activeTab === "garage") {
      return garageFlowcharts;
    }
    const app = backofficeApps.find(a => a.id === selectedBackofficeApp);
    return app?.flowcharts || [];
  }, [activeTab, selectedBackofficeApp]);

  const currentCategories = useMemo(() => {
    if (activeTab === "garage") {
      return garageCategories;
    }
    const app = backofficeApps.find(a => a.id === selectedBackofficeApp);
    return app?.categories || ["All"];
  }, [activeTab, selectedBackofficeApp]);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Reset selection when tab or app changes
  useEffect(() => {
    setSelectedCategory("All");
    if (currentFlowcharts.length > 0) {
      setSelectedChart(currentFlowcharts[0]);
    }
  }, [activeTab, selectedBackofficeApp]);

  // Auto-advance active node
  useEffect(() => {
    if (!selectedChart) return;
    const interval = setInterval(() => {
      setActiveNode((prev) => (prev >= selectedChart.nodes.length ? 1 : prev + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedChart]);

  // Reset activeNode when chart changes
  useEffect(() => {
    setActiveNode(1);
  }, [selectedChart?.id]);

  const filteredCharts =
    selectedCategory === "All"
      ? currentFlowcharts
      : currentFlowcharts.filter((chart) => chart.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#0c0c0e]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0c0c0e]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                User Flow <span className="text-[#FBD10D]">Charts</span>
              </h1>
              <p className="text-sm text-white/50 mt-1">
                {activeTab === "garage" ? "Interactive visual guides for Garage 2.0" : `${backofficeApps.find(a => a.id === selectedBackofficeApp)?.label} App Flows`}
              </p>
            </div>
            {/* Legend inline */}
            <div className="hidden md:flex items-center gap-4">
              {legendItems.map((item) => (
                <div key={item.type} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${item.color}`} />
                  <span className="text-xs text-white/50">{item.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="max-w-[1800px] mx-auto flex">
        {/* Left sidebar - Card list */}
        <div className="w-80 flex-shrink-0 border-r border-white/10 h-[calc(100vh-73px)] sticky top-[73px] overflow-hidden flex flex-col">
          {/* App Tabs */}
          <div className="p-3 border-b border-white/10">
            <div className="flex gap-1">
              {appTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === tab.id
                      ? "bg-[#FBD10D] text-[#0c0c0e]"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Backoffice App Selector (only show when backoffice tab is active) */}
          {activeTab === "backoffice" && (
            <div className="p-3 border-b border-white/10 bg-[#1a1a24]/50">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Select App</p>
              <div className="space-y-1">
                {backofficeApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedBackofficeApp(app.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all
                      ${selectedBackofficeApp === app.id
                        ? "bg-[#FBD10D]/10 border border-[#FBD10D]/40 text-[#FBD10D]"
                        : "bg-white/5 border border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                      }
                    `}
                  >
                    <span className="text-lg">{app.icon}</span>
                    <span className="font-medium text-sm">{app.label}</span>
                    <span className="ml-auto text-xs text-white/30">{app.flowcharts.length} flows</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category filter */}
          <div className="p-3 border-b border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {currentCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium transition-all
                    ${selectedCategory === category
                      ? "bg-[#FBD10D] text-[#0c0c0e]"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable card list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredCharts.map((chart) => (
                <motion.div
                  key={chart.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <SidebarCard
                    chart={chart}
                    isSelected={selectedChart?.id === chart.id}
                    onClick={() => setSelectedChart(chart)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredCharts.length === 0 && (
              <p className="text-center text-white/40 text-sm py-8">
                No flowcharts in this category
              </p>
            )}
          </div>
        </div>

        {/* Right side - Flowchart display */}
        <div className="flex-1 h-[calc(100vh-73px)] overflow-y-auto">
          {selectedChart ? (
            <div className="p-6">
              {/* Chart header with step indicator */}
              <div className="mb-6 pb-4 border-b border-white/10">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Icon and title */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FBD10D]/20 to-[#FBA70A]/10 flex items-center justify-center text-xl border border-[#FBD10D]/20">
                      {selectedChart.icon}
                    </div>
                    <div>
                      <span className="text-xs text-[#FBD10D] uppercase tracking-wider font-medium">
                        {selectedChart.category}
                      </span>
                      <h2 className="text-xl font-bold text-white">{selectedChart.title}</h2>
                    </div>
                  </div>

                  {/* Right: Step indicator */}
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      {selectedChart.nodes.map((node, index) => (
                        <React.Fragment key={node.id}>
                          <button
                            onClick={() => setActiveNode(node.id)}
                            className={`
                              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                              transition-all duration-300 cursor-pointer
                              ${
                                activeNode === node.id
                                  ? "bg-[#FBD10D] text-[#0c0c0e] scale-110"
                                  : activeNode > node.id
                                    ? "bg-[#FBD10D]/40 text-white"
                                    : "bg-white/10 text-white/50 hover:bg-white/20"
                              }
                            `}
                          >
                            {node.id}
                          </button>
                          {index < selectedChart.nodes.length - 1 && (
                            <div
                              className={`w-2 h-0.5 rounded-full ${activeNode > node.id ? "bg-[#FBD10D]/60" : "bg-white/10"}`}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="text-xs text-white/50 mt-1.5">
                      Step {activeNode}: <span className="text-[#FBD10D] font-medium">{selectedChart.nodes.find((n) => n.id === activeNode)?.label}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Canvas Flowchart */}
              <div className="h-[75vh]">
                <CanvasFlowChart
                  chart={selectedChart}
                  activeNode={activeNode}
                  onActiveNodeChange={setActiveNode}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">👈</div>
                <p className="text-white/50">Select a flowchart from the sidebar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
