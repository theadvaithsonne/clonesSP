"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { isThoughtsInlineMode, dispatchThoughtsInlineNavigate } from "@/lib/thoughts-events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  LayoutTemplate,
  Search,
  Plus,
  FileText,
  Briefcase,
  ListChecks,
  Calendar,
  Target,
  BookOpen,
  Lightbulb,
  Users,
  Code,
  PenTool,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import {
  coverPhotoBlock,
  documentListBlock,
  calendarViewBlock,
  timelineViewBlock,
  chartViewBlock,
  linkedViewBlock,
  tableViewBlock,
  boardViewBlock,
  galleryViewBlock,
  nestedPageBlock,
  pageLinkPillBlock,
  mentionPersonBlock,
  mentionPageBlock,
  datePickerBlock,
  reminderBlock,
  tableOfContentsBlock,
} from "../components/blocks";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";

interface Template {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: string;
  content: string;
}

const templates: Template[] = [
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    description: "Structure for capturing meeting discussions and action items",
    icon: Users,
    color: "bg-blue-500",
    category: "Business",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Weekly Team Sync - Q1 Planning", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "📅 Date: ", styles: { bold: true } },
          { type: "text", text: new Date().toLocaleDateString(), styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "👥 Attendees: ", styles: { bold: true } },
          { type: "text", text: "Sarah (PM), John (Dev), Maria (Design), Alex (QA)", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "⏱️ Duration: ", styles: { bold: true } },
          { type: "text", text: "30 minutes", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📋 Agenda", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Review last week's deliverables", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Discuss upcoming feature priorities", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Address blockers and dependencies", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💬 Discussion Points", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Feature A Progress:", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Backend API completed and deployed to staging", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Frontend integration 80% complete", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Need design review for edge cases", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Blockers:", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Waiting for API keys from third-party service", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "✅ Action Items", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Sarah: Follow up with vendor for API access by EOD", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "John: Complete frontend integration by Wednesday", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Maria: Provide design feedback on edge cases by Tuesday", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Alex: Prepare test cases for feature A", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📌 Next Meeting", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Same time next week - Focus on sprint retrospective", styles: {} }],
      },
    ]),
  },
  {
    id: "project-plan",
    title: "Project Plan",
    description: "Organize project goals, milestones, and deliverables",
    icon: Briefcase,
    color: "bg-purple-500",
    category: "Business",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Mobile App Redesign Project", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "📱 Project: ", styles: { bold: true } },
          { type: "text", text: "Customer Mobile App Redesign 2024", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "👤 Project Lead: ", styles: { bold: true } },
          { type: "text", text: "Emily Rodriguez", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "📅 Timeline: ", styles: { bold: true } },
          { type: "text", text: "January - April 2024 (16 weeks)", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "💰 Budget: ", styles: { bold: true } },
          { type: "text", text: "$150,000", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🎯 Project Objectives", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Improve user engagement by 40%", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Reduce app load time from 3s to under 1s", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Increase conversion rate by 25%", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Achieve 4.5+ star rating in app stores", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📊 Key Deliverables", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "User research and competitive analysis report", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "New design system and UI component library", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Redesigned user flows for core features", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Performance optimization implementation", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Beta testing with 500 users", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🗓️ Timeline & Milestones", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Phase 1: Research & Planning (Weeks 1-3)", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "User interviews and surveys (200+ participants)", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Analytics review and pain point identification", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Stakeholder alignment workshops", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Phase 2: Design (Weeks 4-8)", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Wireframes and user flow mapping", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "High-fidelity mockups and prototypes", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Design system creation", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Phase 3: Development (Weeks 9-13)", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Frontend implementation (iOS & Android)", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Backend API updates", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Performance optimization", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Phase 4: Testing & Launch (Weeks 14-16)", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "QA testing and bug fixes", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Beta testing program", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Phased rollout (10% → 50% → 100%)", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "👥 Team & Resources", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "2 UX/UI Designers", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "3 Frontend Developers (iOS/Android)", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "2 Backend Developers", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "1 QA Engineer", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "1 Product Manager", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "⚠️ Risks & Mitigation", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Risk: Scope creep → Mitigation: Strict change control process", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Risk: User resistance to change → Mitigation: Gradual rollout with onboarding", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Risk: Technical dependencies → Mitigation: Early integration testing", styles: {} }],
      },
    ]),
  },
  {
    id: "todo-list",
    title: "Todo List",
    description: "Simple checklist for tasks and to-dos",
    icon: ListChecks,
    color: "bg-green-500",
    category: "Personal",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "📝 Today's Tasks", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), styles: { italic: true } },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🔥 High Priority", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Review and respond to client emails", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Complete quarterly report presentation", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Schedule team meeting for next week", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📋 Regular Tasks", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Update project documentation", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Review pull requests from team", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Prepare agenda for Friday's standup", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💡 Ideas / Later", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Research new design tools", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Plan team building activity", styles: {} }],
        checked: false,
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "✅ 1/8 tasks completed", styles: { italic: true } },
        ],
      },
    ]),
  },
  {
    id: "daily-journal",
    title: "Daily Journal",
    description: "Reflect on your day with structured prompts",
    icon: BookOpen,
    color: "bg-yellow-500",
    category: "Personal",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "📔 Daily Reflection", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), styles: { italic: true } },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🙏 What I'm Grateful For", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "The support and encouragement from my team today", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "A productive morning with deep focus work", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Coffee chat with Sarah - great conversation about work-life balance", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "✨ Today's Highlights", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Successfully launched the new dashboard feature", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Received positive feedback from stakeholders on the presentation", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Helped a colleague debug a challenging issue", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💭 Reflections & Learnings", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Today reminded me of the importance of clear communication. The morning stand-up was particularly effective because everyone came prepared with updates and blockers. I also learned a new approach to handling async data in React that I can apply to future projects.", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🎯 Wins & Accomplishments", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Completed all high-priority tasks from my todo list", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Maintained focus during deep work sessions (2 x 90 minutes)", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Exercised for 30 minutes during lunch break", styles: {} }],
        checked: true,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🌱 Areas for Improvement", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Need to better manage interruptions during focus time", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Should have asked for help earlier on the CSS layout issue", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📝 Tomorrow's Priorities", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Start work on the API integration for the payment feature", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Review design mockups with the design team", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Prepare for client demo on Friday", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💡 Random Thoughts", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Been thinking about how we can improve our code review process. Maybe we should try pair programming sessions for complex features?", styles: {} }],
      },
    ]),
  },
  {
    id: "brainstorm",
    title: "Brainstorming",
    description: "Capture ideas and creative thoughts",
    icon: Lightbulb,
    color: "bg-orange-500",
    category: "Creative",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "💡 Brainstorming: New User Onboarding Experience", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Date: ", styles: { bold: true } },
          { type: "text", text: new Date().toLocaleDateString(), styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Problem: ", styles: { bold: true } },
          { type: "text", text: "Our current onboarding drop-off rate is 45% at step 2. Users are confused about setting up their profile.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Goal: ", styles: { bold: true } },
          { type: "text", text: "Reduce onboarding drop-off to under 20% and improve user activation", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🎯 Wild Ideas (No Limits)", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "AI-powered onboarding assistant that asks questions and sets up profile automatically", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Gamify the onboarding with progress badges and rewards", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Video walkthrough with interactive hotspots", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Social import: pull data from LinkedIn/GitHub automatically", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Skip onboarding entirely - smart defaults with guided tours when they need features", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "✅ Practical Ideas", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Reduce onboarding steps from 5 to 3 - make profile details optional", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Add a progress indicator so users know how far along they are", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Include example data/templates to help users understand what to fill in", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Add contextual help tooltips explaining why we need each piece of information", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Allow users to 'save and continue later' if they're not ready", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🌟 Best Ideas (To Explore Further)", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Reduce to 3 steps with smart defaults (HIGH IMPACT, LOW EFFORT)", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Add progress indicator and example templates (MEDIUM IMPACT, LOW EFFORT)", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Social import for LinkedIn/GitHub (HIGH IMPACT, MEDIUM EFFORT)", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🚫 Challenges & Concerns", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Legal/privacy concerns with social import - need compliance review", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "AI assistant might be too complex for MVP - explore in Phase 2", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Need to validate with user testing before building", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📋 Next Steps", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Create wireframes for 3-step onboarding flow", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Research competitor onboarding experiences", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Set up user testing sessions for next week", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Discuss technical feasibility with dev team", styles: {} }],
        checked: false,
      },
    ]),
  },
  {
    id: "code-snippet",
    title: "Code Snippet",
    description: "Store and organize code examples",
    icon: Code,
    color: "bg-indigo-500",
    category: "Technical",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "🔧 Custom React Hook: useDebounce", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Language: ", styles: { bold: true } },
          { type: "text", text: "TypeScript / React", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Use Case: ", styles: { bold: true } },
          { type: "text", text: "Debounce search inputs, API calls, or any rapidly changing values", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Tags: ", styles: { bold: true } },
          { type: "text", text: "#react #hooks #typescript #performance", styles: {} },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📝 Description", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "This custom hook delays updating a value until after a specified delay. Perfect for search inputs where you don't want to trigger API calls on every keystroke.", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💻 Code", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "import { useState, useEffect } from 'react';", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "function useDebounce<T>(value: T, delay: number = 500): T {", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "  const [debouncedValue, setDebouncedValue] = useState<T>(value);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "  useEffect(() => {", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "    const handler = setTimeout(() => {", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "      setDebouncedValue(value);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "    }, delay);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "    return () => clearTimeout(handler);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "  }, [value, delay]);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "  return debouncedValue;", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "}", styles: { code: true } }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🎯 Usage Example", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "const [searchTerm, setSearchTerm] = useState('');", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "const debouncedSearch = useDebounce(searchTerm, 700);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "useEffect(() => {", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "  // This only runs 700ms after user stops typing", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "  fetchSearchResults(debouncedSearch);", styles: { code: true } }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "}, [debouncedSearch]);", styles: { code: true } }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📚 References", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "React Hooks Documentation: https://react.dev/reference/react", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Similar implementation: usehooks-ts.com/react-hook/use-debounce", styles: {} }],
      },
    ]),
  },
  {
    id: "blog-post",
    title: "Blog Post",
    description: "Template for writing blog posts and articles",
    icon: PenTool,
    color: "bg-pink-500",
    category: "Creative",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Building Better User Experiences: 5 Lessons from Our Product Redesign", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "By ", styles: { italic: true } },
          { type: "text", text: "Alex Chen", styles: { italic: true, bold: true } },
          { type: "text", text: " • ", styles: { italic: true } },
          { type: "text", text: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), styles: { italic: true } },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Reading time: 8 minutes • Tags: #UX #Design #ProductDevelopment", styles: { italic: true } },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "Introduction", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Last quarter, we embarked on a complete redesign of our mobile application. With over 100,000 active users, the stakes were high, and the learning curve was steep. After four months of research, design, development, and testing, we successfully launched our new experience with a 92% user satisfaction rate.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Here are the five most important lessons we learned along the way that every product team should know.", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "1. Start with User Research, Not Assumptions", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "We initially thought we knew what our users wanted. We were wrong.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Before jumping into design, we conducted:", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "30 in-depth user interviews", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Surveys with 500+ respondents", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Analytics deep-dive into user behavior patterns", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Competitive analysis of 10 similar products", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Key insight: ", styles: { bold: true } },
          { type: "text", text: "Users weren't struggling with the features we thought were problematic. Instead, they wanted better navigation and faster access to their most-used tools.", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "2. Prototype Early and Often", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "We created over 20 different prototypes before settling on the final design. Each iteration taught us something new about user preferences and technical constraints.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Tools that helped us:", styles: { italic: true } }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Figma for collaborative design", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Maze for user testing", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Loom for async feedback", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "3. Don't Ignore Performance", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "A beautiful design means nothing if it's slow. We learned this the hard way during beta testing when users complained about loading times despite loving the new interface.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Our performance improvements:", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Reduced initial load time from 3.2s to 0.8s", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Implemented lazy loading for images", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Optimized bundle size by 40%", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "4. Plan for a Gradual Rollout", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Instead of a big-bang launch, we rolled out the new design in phases:", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Week 1: Internal team (50 users)", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Week 2: Beta testers (500 users)", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Week 3: 10% of user base", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Week 4: 50% of user base", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Week 5: Full rollout", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "This approach allowed us to catch and fix issues before they affected our entire user base.", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "5. Listen to Feedback, But Stay True to Your Vision", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "We received hundreds of pieces of feedback during the rollout. Not all of it aligned with our product vision, and that's okay.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "We created a framework to evaluate feedback:", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Does it align with our core product principles?", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Is it requested by multiple users or just one?", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Does it improve the experience for our target user persona?", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "What's the effort vs. impact ratio?", styles: {} }],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "Conclusion", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Product redesigns are challenging, but they're also opportunities for massive improvement. By focusing on user research, rapid prototyping, performance, gradual rollouts, and thoughtful feedback evaluation, we created an experience that users love.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "The results speak for themselves:", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "92% user satisfaction rate", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "35% increase in daily active users", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "40% reduction in support tickets", styles: {} }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "4.8 star rating on app stores (up from 3.9)", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "What challenges have you faced in your product redesigns? I'd love to hear your experiences in the comments below.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "---", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "About the author: ", styles: { italic: true, bold: true } },
          { type: "text", text: "Alex Chen is a Senior Product Designer with 8 years of experience building user-centered products. Currently leading design at TechCorp, helping teams create better digital experiences.", styles: { italic: true } },
        ],
      },
    ]),
  },
  {
    id: "weekly-goals",
    title: "Weekly Goals",
    description: "Plan and track your weekly objectives",
    icon: Target,
    color: "bg-red-500",
    category: "Personal",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "🎯 Weekly Goals & Objectives", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Week of: ", styles: { bold: true } },
          { type: "text", text: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + " - " + new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Theme: ", styles: { bold: true } },
          { type: "text", text: "Focus & Execution", styles: { italic: true } },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💼 Work & Career", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Complete Q1 performance review document", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Ship v2.0 of the dashboard feature", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Have 1-on-1s with all team members", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Prepare presentation for Friday's stakeholder meeting", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Review and merge 5 pending PRs", styles: {} }],
        checked: true,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📚 Learning & Development", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Complete 2 modules of React Advanced Patterns course", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Read 'Atomic Habits' chapters 5-8", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Write blog post about custom React hooks", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💪 Health & Fitness", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Workout 4 times this week (Mon, Wed, Fri, Sat)", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Meal prep for the entire week on Sunday", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Get 7+ hours of sleep each night", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Drink 2L water daily", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "🏠 Personal & Life", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Call parents and catch up", styles: {} }],
        checked: true,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Plan weekend trip with friends", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Organize home office and desk", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Schedule dentist appointment", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💰 Financial Goals", styles: {} }],
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Review monthly budget and expenses", styles: {} }],
        checked: false,
      },
      {
        type: "checkListItem",
        content: [{ type: "text", text: "Set up automatic savings transfer", styles: {} }],
        checked: false,
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "📊 Progress Tracker", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Completed: ", styles: { bold: true } },
          { type: "text", text: "4 / 19 goals (21%)", styles: {} },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Focus areas: ", styles: { bold: true } },
          { type: "text", text: "Need to prioritize health goals and learning objectives", styles: { italic: true } },
        ],
      },
      {
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: "💭 Weekly Reflection (End of Week)", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "What went well: ", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Challenges faced: ", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "", styles: {} }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Key learnings: ", styles: { bold: true } },
        ],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "", styles: {} }],
      },
    ]),
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const notesSchema = React.useMemo(() => BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      coverPhoto: coverPhotoBlock(),
      documentList: documentListBlock(),
      calendarView: calendarViewBlock(),
      timelineView: timelineViewBlock(),
      chartView: chartViewBlock(),
      linkedView: linkedViewBlock(),
      tableView: tableViewBlock(),
      boardView: boardViewBlock(),
      galleryView: galleryViewBlock(),
      nestedPage: nestedPageBlock(),
      pageLinkPill: pageLinkPillBlock(),
      mentionPerson: mentionPersonBlock(),
      mentionPage: mentionPageBlock(),
      datePicker: datePickerBlock(),
      reminder: reminderBlock(),
      tableOfContents: tableOfContentsBlock(),
    } as any,
  }), []);

  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const previewEditor = useCreateBlockNote({
    schema: notesSchema as unknown as Parameters<typeof useCreateBlockNote>[0]["schema"],
    initialContent: undefined,
  });

  const handlePreviewTemplate = (template, e) => {
    e.stopPropagation();
    try {
      const blocks = JSON.parse(template.content);
      setPreviewTemplate(template);
      setTimeout(() => {
        previewEditor.replaceBlocks(previewEditor.document, blocks);
      }, 100);
    } catch {
    }
  };

    const handleUseTemplate = async (template: Template) => {
    try {
      // Create a new note with the template content
      const response = await authenticatedFetch(buildExternalUrl("notes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.title,
          content: template.content,
          color: "#ffffff",
          tags: [template.category],
        }),
      });

      if (!response.ok) throw new Error("Failed to create note from template");

      const result = await response.json();
      toast.success(`Note created from ${template.title} template!`);

      // Navigate to the all notes page to see the new note
      if (isThoughtsInlineMode()) {
        dispatchThoughtsInlineNavigate("all-notes");
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error creating note from template:", error);
      toast.error("Failed to create note from template");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Templates</h1>
            <span className="text-sm text-muted-foreground">
              ({filteredTemplates.length} templates)
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 px-6 pb-4">
          {categories.map(category => (
            <Button
              key={category}
              variant="outline"
              className={cn(
                selectedCategory === category &&
                  "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white border-0"
              )}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTemplates.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <LayoutTemplate className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No templates found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template) => {
              const Icon = template.icon;
              return (
                <Card
                  key={template.id}
                  className="group cursor-pointer transition-all hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "rounded-lg p-2 text-white",
                        template.color
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{template.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.category}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                    <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => handlePreviewTemplate(template, e)}
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white border-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUseTemplate(template);
                        }}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Use
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#191919] border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-semibold">{previewTemplate?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">{previewTemplate?.description}</p>
            <div className="prose prose-sm max-w-none border border-zinc-800 rounded-lg p-4 bg-[#141414] min-h-[200px] garage-notes-editor">
              <BlockNoteView editor={previewEditor} theme="dark" editable={false} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white" onClick={() => setPreviewTemplate(null)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white border-0" onClick={() => { if (previewTemplate) { handleUseTemplate(previewTemplate); setPreviewTemplate(null); } }}>
                <Plus className="mr-1 h-4 w-4" />
                Use Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
