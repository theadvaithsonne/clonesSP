"use client"

import { useState, Dispatch, SetStateAction, useEffect, useRef } from "react"
import { ChevronUp, Zap, Pencil, X, Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Task, Column } from "../types/kanban"
import { toast } from "sonner"

type DialogType = "tasks" | "subtasks" | "stages" | null

interface AicopilotProps {
  columns: Column[]
  setColumns: Dispatch<SetStateAction<Column[]>>
  taskRoomId: string
  userId: string
  stagecolumns: Task[]
  setStagecolumns: React.Dispatch<React.SetStateAction<Task[]>>
  fetchListView: (page: number) => Promise<void>
  hasMore: boolean
  isFetching: boolean
  nextPageToFetch: number
}

export function AICopilot({
  setColumns,
  columns,
  taskRoomId,
  stagecolumns,
  userId,
  hasMore,
  isFetching,
  fetchListView, setStagecolumns,
  nextPageToFetch
}: AicopilotProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)
  const [taskRoomContext, setTaskRoomContext] = useState("")
  const [stageContext, setStageContext] = useState("")
  const [selectedTasks, setSelectedTasks] = useState<string>("")

  // Loading States
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false)
  const [isGeneratingStages, setIsGeneratingStages] = useState(false)

  // Stage Generation State
  const [generatedStages, setGeneratedStages] = useState<any[]>([])
  const [selectedStageIndices, setSelectedStageIndices] = useState<Set<number>>(new Set())
  const [showStageSelection, setShowStageSelection] = useState(false)

  // Task Generation State
  const [generatedTasks, setGeneratedTasks] = useState<any[]>([])
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set())
  // const [showTaskSelection, setShowTaskSelection] = useState(false) // Deprecated in favor of taskDialogStep
  const [taskDialogStep, setTaskDialogStep] = useState<'input' | 'selection' | 'stage-selection'>('input')
  const [selectedTargetStageId, setSelectedTargetStageId] = useState<string>("")


  // Subtask Generation State
  const [generatedSubtasks, setGeneratedSubtasks] = useState<any[]>([])
  const [selectedSubtaskIndices, setSelectedSubtaskIndices] = useState<Set<number>>(new Set())
  const [showSubtaskSelection, setShowSubtaskSelection] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)

  // Editing State
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null)
  const [editingStageValue, setEditingStageValue] = useState<{ name: string, description: string }>({ name: "", description: "" })

  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null)
  const [editingTaskValue, setEditingTaskValue] = useState<{ title: string, description: string, priority: string }>({ title: "", description: "", priority: "medium" })

  const [editingSubtaskIndex, setEditingSubtaskIndex] = useState<number | null>(null)
  const [editingSubtaskValue, setEditingSubtaskValue] = useState<{ subTaskDetail: string }>({ subTaskDetail: "" })


  const scrollContainerRef = useRef<HTMLDivElement>(null)
  console.log("1vcx43", columns)

  // Scroll handler for loading more tasks in subtask dialog
  const handleScrollLoad = () => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
    const isNearBottom = distanceFromBottom < 100

    if (isNearBottom && hasMore && !isFetching) {
      fetchListView(nextPageToFetch)
    }
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (activeDialog !== "subtasks" || !container) return

    container.addEventListener('scroll', handleScrollLoad, { passive: true })
    return () => container.removeEventListener('scroll', handleScrollLoad)
  }, [activeDialog, hasMore, isFetching, nextPageToFetch])

  // Bulk create tasks
  const createBulkTasks = async (taskArray: any[]) => {
    if (!taskArray?.length || !taskRoomId || !userId) return { success: false }
    setIsGeneratingTasks(true)
    const res = await fetch(`https://uatapi.garage.app/taskroom/v1/tasks/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskArray, roomId: taskRoomId, userId })
    })

    const data = await res.json()
    // if (!res.ok) return { success: false, error: data.message }
    if (data?.status) {
      await setColumns(prev => prev.map((col, i) => col?._id == selectedTargetStageId ? {
        ...col,
        tasks: [...col.tasks, ...data.data],
        paginatedTaskRecords: [...col.tasks, ...data.data],
        taskCount: (col.taskCount ?? 0) + data.data.length
      } : col))
      await setIsExpanded(false)
      await setStagecolumns((prevColumns) => [...prevColumns, ...data.data]);
      await setSelectedTargetStageId("")
      setIsGeneratingTasks(false)
    }
    else {
      toast(data?.message)
      setIsGeneratingTasks(false)
      // setSelectedTargetStageId("")
    }
    // Add new tasks to first column (To Do)


    return { success: true, data }
  }
  // Bulk create subtaskss
  const createBulkSubTask = async (subTaskDetailArray: any[]) => {
    if (!subTaskDetailArray?.length || !taskRoomId || !userId) return { success: false }
    setIsGeneratingSubtasks(true)
    const res = await fetch(`https://uatapi.garage.app/taskroom/v1/sub_tasks/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subTaskDetailArray, roomId: taskRoomId, taskId: selectedTasks, userId })
    })

    const data = await res.json()
    // if (!res.ok) return { success: false, error: data.message }
    if (data?.status) {
      toast(data?.message)
      setIsExpanded(false)
      setIsGeneratingSubtasks(false)
    }
    else {
      toast(data?.message)
      setIsGeneratingSubtasks(false)
    }


    return { success: true, data }
  }
  console.log("stageArray", generatedStages)
  // Bulk create stages
  const createBulkStage = async (stageArray: any[], isReplace: boolean) => {
    if (!stageArray?.length || !taskRoomId || !userId) return { success: false }
    setIsGeneratingStages(true)
    const res = await fetch(`https://uatapi.garage.app/taskroom/v1/stages/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageArray, roomId: taskRoomId, userId, isReplace })
    })

    const data = await res.json()
    // if (!res.ok) return { success: false, error: data.message }
    if (data?.status) {
      if (isReplace) {
        setColumns([
          ...(data?.data?.data?.map((col: any) => ({
            ...col,
            tasks: [],
            paginatedTaskRecords: [] // forces empty tasks array
          })) ?? []),
        ]);
      }
      else {
        setColumns([
          ...(data?.data?.data?.map((col: any) => ({
            ...col,
            tasks: [],
            paginatedTaskRecords: [] // forces empty tasks array
          })) ?? []),

          ...columns.slice(0, -1),
          columns[columns.length - 1],
        ]);
      }

      setIsExpanded(false)
      setIsGeneratingStages(false)
      toast(data?.message)
    }
    else {
      toast(data?.message)
      setIsGeneratingStages(false)
    }

    return { success: true, data }
  }

  const stageColors = ["#b0b3ba59", "#8fb6fabd", "#f4d03fc0", "#c397f9b8", "#f58a8ab9", "#a3a7f7bc", "#f498c5ac"]
  const getRandomColor = () => stageColors[Math.floor(Math.random() * stageColors.length)]

  // Generate Stages
  const generateStage = async () => {
    if (!stageContext.trim()) return
    setIsGeneratingStages(true)

    try {
      const res = await fetch('/api/taskroom/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('garage_tok') || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-2024-11-20',
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system', content: `You are a project management expert familiar with Basecamp's To-Do Groups (stages like "Backlog", "In Progress").

Generate 5 custom workflow stages for a taskroom focused on [describe your project, e.g., "marketing campaign planning"]. Make them sequential, like a Kanban flow: starting with ideation/backlog and ending with completion/review. and You are a perfect JSON Stage generator for Taskroom. 
Respond with ONLY a valid JSON object and NOTHING else (no markdown, no explanations, no extra text):
output struture:

{
  "stageArray": [
    { "name": "Stage Name", "description": "Short description of what happens in this stage", "color": "", "type": "custom" }
  ]
}
  - always "Done" Stage name at the end of every create stage.never for get it.
- Always use lowercase priority.
- Never add extra fields.
- Never wrap in \`\`\`json or any markdown.
- Generate realistic Stage based solely on the user description.
- Generate 5 to 10 realistic tasks based on the user's project description.
- Never add extra fields. Never wrap in markdown. Never add comments.
Generate 5-10 realistic workflow stages based on the user description. Leave "color" empty.` },
            { role: 'user', content: stageContext }
          ]
        })
      })

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content?.trim() || '{}'
      const jsonStr = content.match(/\{[\s\S]*\}/)?.[0] || '{}'
      const parsed = JSON.parse(jsonStr)
      const stages = (parsed.stageArray || []).map((s: any, i: number) => ({
        name: String(s.name || 'Untitled').substring(0, 200),
        description: String(s.description || '').substring(0, 200),
        color: getRandomColor(),
        type: "custom",
        orderId: i
      }))

      if (stages.length > 0) {
        setGeneratedStages(stages)
        // Select all by default
        setSelectedStageIndices(new Set(stages.map((_: any, i: number) => i)))
        setShowStageSelection(true)
      }
    } catch (err) {
      console.error("Stage generation failed:", err)
      toast("Failed to generate stages. Please try again.")
    } finally {
      setIsGeneratingStages(false)
    }
  }

  const handleCreateSelectedStages = async (isReplace: boolean) => {
    const stagesToCreate = generatedStages.filter((_, i) => selectedStageIndices.has(i))
    if (stagesToCreate.length === 0) {
      toast("Please select at least one stage")
      return
    }

    await createBulkStage(stagesToCreate, isReplace)
    // Reset state after successful creation (createBulkStage handles closing dialog if successful, but we should reset local state)
    setGeneratedStages([])
    setSelectedStageIndices(new Set())
    setShowStageSelection(false)
    setStageContext("")
    setShowReplaceDialog(false)
    setActiveDialog(null)
  }

  const handleInitCreateStages = () => {
    const stagesToCreate = generatedStages.filter((_, i) => selectedStageIndices.has(i))
    if (stagesToCreate.length === 0) {
      toast("Please select at least one stage")
      return
    }
    setShowReplaceDialog(true)
  }

  const toggleStageSelection = (index: number) => {
    const newSelected = new Set(selectedStageIndices)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedStageIndices(newSelected)
  }

  const clearAllStages = () => {
    setSelectedStageIndices(new Set())
  }

  const handleCreateSelectedTasks = async () => {
    const tasksToCreate = generatedTasks
      .filter((_, i) => selectedTaskIndices.has(i))  // keep only selected tasks
      .map(task => ({
        ...task,
        stageId: selectedTargetStageId,  // overwrite stageId for every selected task
        // if your task uses stageID (camelCase), use: stageID: selectedTargetStageId
      }));
    if (tasksToCreate.length === 0) {
      toast("Please select at least one task")
      return
    }

    // Update stageId for all tasks
    const finalTasks = tasksToCreate.map(t => ({
      ...t,

    }))
    console.log("generatedTasks", tasksToCreate)
    await createBulkTasks(tasksToCreate)
    setGeneratedTasks([])
    setSelectedTaskIndices(new Set())
    setTaskDialogStep('input')
    setTaskRoomContext("")
    setActiveDialog(null)

  }

  const handleProceedToStageSelection = () => {
    if (selectedTaskIndices.size === 0) {
      toast("Please select at least one task")
      return
    }
    setTaskDialogStep('stage-selection')
  }


  const toggleTaskSelection = (index: number) => {
    const newSelected = new Set(selectedTaskIndices)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedTaskIndices(newSelected)
  }

  const clearAllTasks = () => {
    setSelectedTaskIndices(new Set())
  }

  const handleCreateSelectedSubtasks = async () => {
    const subtasksToCreate = generatedSubtasks.filter((_, i) => selectedSubtaskIndices.has(i))
    if (subtasksToCreate.length === 0) {
      toast("Please select at least one subtask")
      return
    }

    await createBulkSubTask(subtasksToCreate)
    setGeneratedSubtasks([])
    setSelectedSubtaskIndices(new Set())
    setShowSubtaskSelection(false)
    setSelectedTasks("")
    setActiveDialog(null)
  }

  const toggleSubtaskSelection = (index: number) => {
    const newSelected = new Set(selectedSubtaskIndices)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedSubtaskIndices(newSelected)
  }

  const clearAllSubtasks = () => {
    setSelectedSubtaskIndices(new Set())
  }


  const generateSubtask = async () => {
    if (!selectedTasks.trim()) return
    setIsGeneratingSubtasks(true)

    try {
      const res = await fetch('/api/taskroom/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('garage_tok') || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-2024-11-20',
          temperature: 0.0,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system', content: `You are a perfect JSON SubTask generator for Tasks. 
Respond with ONLY a valid JSON object and NOTHING else (no markdown, no explanations, no extra text):
output struture:


{
  "subTaskDetailArray": [
    { "subTaskDetail": "subtask Name"  }
  ]
}
- Always use lowercase priority.
-color flied leave empty always
- Never add extra fields.
- Never wrap in \`\`\`json or any markdown.
- Generate realistic Stage based solely on the user description.
- Generate 5 to 10 realistic tasks based on the user's project description.
- Never add extra fields. Never wrap in markdown. Never add comments.
Generate 5-10 realistic workflow subtasks based on the user description.` },
            { role: 'user', content: selectedTasks }
          ]
        })
      })

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content?.trim() || '{}'
      const jsonStr = content.match(/\{[\s\S]*\}/)?.[0] || '{}'
      const parsed = JSON.parse(jsonStr)
      const subTaskDetailArray = (parsed.subTaskDetailArray || []).map((s: any, i: number) => ({
        subTaskDetail: String(s.subTaskDetail || 'Untitled').substring(0, 200),
      }))

      if (subTaskDetailArray.length > 0) {
        setGeneratedSubtasks(subTaskDetailArray)
        setSelectedSubtaskIndices(new Set(subTaskDetailArray.map((_: any, i: number) => i)))
        setShowSubtaskSelection(true)
      }
    } catch (err) {
      console.error("Subtask generation failed:", err)
      toast("Failed to generate subtasks. Please try again.")
    } finally {
      setIsGeneratingSubtasks(false)
    }
  }


  console.log("selectedTasks", selectedTasks)
  // Generate Tasks
  const generateTasks = async () => {
    if (!taskRoomContext.trim()) return
    setIsGeneratingTasks(true)

    try {
      const res = await fetch('/api/taskroom/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('garage_tok') || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-2024-11-20',
          temperature: 0.0,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system', content: `You are a perfect JSON Task generator for taskroom. 
Respond with ONLY a valid JSON object and NOTHING else (no markdown, no explanations, no extra text):
output struture:
{
  "tasks": [
    {
      "title": "Short title",
      "description": "Detailed description (1-3 sentences)",
      "priority": "low|medium|high",
      "assignedToId": "",
      "startDate": "${new Date()?.getTime()}",
      "dueDate": "ISO date in future",
      "stageId": "${columns?.[0]?._id || ''}",
      "tags": ["tag1", "tag2"],
      "attachments": []
    }
  ]
}
- Always use lowercase priority.
- Never add extra fields.
- Never wrap in \`\`\`json or any markdown.
- Generate realistic Stage based solely on the user description.
- Generate 20 to 30 realistic tasks based on the user's project description.
- Never add extra fields. Never wrap in markdown. Never add comments.
-dueDate ≥ startDate
Generate 20–30 realistic tasks. Use lowercase priority. dueDate ≥ today. Never add extra fields.` },
            { role: 'user', content: taskRoomContext }
          ]
        })
      })

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content?.trim() || '{}'
      const jsonStr = content.match(/\{[\s\S]*\}/)?.[0] || '{}'
      const parsed = JSON.parse(jsonStr)
      const rawTasks = Array.isArray(parsed) ? parsed : parsed.tasks || []
      const dateRoom = new Date();
      dateRoom.setHours(23, 59, 59, 999)
      const taskArray = rawTasks.map((t: any) => ({
        title: String(t.title || 'Untitled').substring(0, 200),
        description: String(t.description || '').substring(0, 1000),
        priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
        assignedToId: '',
        startDate: new Date()?.getTime(),
        dueDate: dateRoom?.getTime(),
        stageId: columns?.[0]?._id,
        tags: Array.isArray(t.tags) ? t.tags : [],
        attachments: []
      }))

      if (taskArray.length > 0) {
        setGeneratedTasks(taskArray)
        setSelectedTaskIndices(new Set(taskArray.map((_: any, i: number) => i)))
        if (taskArray.length > 0) {
          setGeneratedTasks(taskArray)
          setSelectedTaskIndices(new Set(taskArray.map((_: any, i: number) => i)))
          setTaskDialogStep('selection')
        }
      }
    } catch (err) {
      console.error("Task generation failed:", err)
      toast("Failed to generate tasks. Please try again.")
    } finally {
      setIsGeneratingTasks(false)
    }
  }

  // Generate Subtasks (placeholder – you can expand later)
  const handleGenerateSubtasks = async () => {
    if (selectedTasks.length === 0) return
    setIsGeneratingSubtasks(true)

    try {
      // TODO: Call your subtask generation API here
      console.log("Generating subtasks for tasks:", selectedTasks)
      // await generateAndCreateSubtasks(selectedTasks)
      await new Promise(r => setTimeout(r, 2000)) // fake delay
    } catch (err) {
      console.error("Subtask generation failed:", err)
    } finally {
      setIsGeneratingSubtasks(false)
      setSelectedTasks("")
      setActiveDialog(null)
    }
  }

  // Edit Handlers
  const startEditingStage = (index: number, stage: any) => {
    setEditingStageIndex(index)
    setEditingStageValue({ name: stage.name, description: stage.description })
  }

  const saveEditingStage = () => {
    if (editingStageIndex === null) return
    const newStages = [...generatedStages]
    newStages[editingStageIndex] = { ...newStages[editingStageIndex], ...editingStageValue }
    setGeneratedStages(newStages)
    setEditingStageIndex(null)
  }

  const startEditingTask = (index: number, task: any) => {
    setEditingTaskIndex(index)
    setEditingTaskValue({ title: task.title, description: task.description, priority: task.priority })
  }

  const saveEditingTask = () => {
    if (editingTaskIndex === null) return
    const newTasks = [...generatedTasks]
    newTasks[editingTaskIndex] = { ...newTasks[editingTaskIndex], ...editingTaskValue }
    setGeneratedTasks(newTasks)
    setEditingTaskIndex(null)
  }

  const startEditingSubtask = (index: number, subtask: any) => {
    setEditingSubtaskIndex(index)
    setEditingSubtaskValue({ subTaskDetail: subtask.subTaskDetail })
  }

  const saveEditingSubtask = () => {
    if (editingSubtaskIndex === null) return
    const newSubtasks = [...generatedSubtasks]
    newSubtasks[editingSubtaskIndex] = { ...newSubtasks[editingSubtaskIndex], ...editingSubtaskValue }
    setGeneratedSubtasks(newSubtasks)
    setEditingSubtaskIndex(null)
  }
  console.log("stagecolumns", stagecolumns)

  return (
    <>
      {/* AI Co-pilot Fixed Bar */}
      <div className="sticky bottom-0 left-0 right-0 border-t border-[#e5e7eb29] bg-[#0e0e12] z-40">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <span className="font-semibold">AI Co-pilot</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-white">
            {isExpanded ? "Collapse" : "Expand"}
            <ChevronUp className={`h-4 w-4 ml-2 transition-transform ${isExpanded ? "" : "rotate-180"}`} />
          </Button>
        </div>

        {isExpanded && (
          <div className="border-t border-[#e5e7eb29] px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => setActiveDialog("tasks")} className="flex flex-col items-center gap-3 rounded-lg border border-[#e5e7eb29] p-6 hover:bg-[#1e1e2d] transition group">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e1e2d]">
                  <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white">Generate Tasks</h3>
                  <p className="text-sm text-gray-400">AI creates tasks for your TaskRoom</p>
                </div>
              </button>

              <button onClick={() => setActiveDialog("subtasks")} className="flex flex-col items-center gap-3 rounded-lg border border-[#e5e7eb29] p-6 hover:bg-[#1e1e2d] transition group">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e1e2d]">
                  <svg className="h-6 w-6 text-green-600 group-hover:text-green-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white">Generate Subtasks</h3>
                  <p className="text-sm text-gray-400">Break down tasks into subtasks</p>
                </div>
              </button>

              <button onClick={() => setActiveDialog("stages")} className="flex flex-col items-center gap-3 rounded-lg border border-[#e5e7eb29] p-6 hover:bg-[#1e1e2d] transition group">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e1e2d]">
                  <svg className="h-6 w-6 text-purple-600 group-hover:text-purple-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white">Generate Stages</h3>
                  <p className="text-sm text-gray-400">AI creates workflow stages</p>
                </div>
              </button>
            </div>

            <div className="mt-8 rounded-lg border border-[#e5e7eb29] bg-[#1e1e2d]/50 p-4">
              <div className="flex gap-3">
                <Zap className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white">AI Co-pilot Tips</h4>
                  <p className="text-sm text-gray-400">
                    The more context you provide about your TaskRoom, the better AI can generate relevant tasks, subtasks, and stages. Include details about your project goals, team structure, and timeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Tasks Dialog */}
      <Dialog open={activeDialog === "tasks"} onOpenChange={(o) => {
        if (!o) {
          setActiveDialog(null)
          setTaskDialogStep('input')
          setGeneratedTasks([])
        }
      }}>
        <DialogContent className={`${taskDialogStep === 'input' ? "" : "max-w-md"} bg-[#0e0e12] border-[#e5e7eb29]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Generate Tasks with AI</DialogTitle>
            <DialogDescription>
              {taskDialogStep === 'input' && "Describe your project and AI will create relevant tasks"}
              {taskDialogStep === 'selection' && "Review and select the tasks you want to create"}
              {taskDialogStep === 'stage-selection' && "Select the stage where these tasks should be added"}
            </DialogDescription>
          </DialogHeader>

          {taskDialogStep === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white">TaskRoom Context</label>
                <textarea
                  value={taskRoomContext}
                  onChange={(e) => setTaskRoomContext(e.target.value)}
                  placeholder="e.g., Building a mobile e-commerce app with React Native, 3-month timeline, includes authentication, payments, etc."
                  className="mt-2 min-h-32 w-full rounded-md border border-[#e5e7eb29] bg-[#0e0e12] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
                <Button onClick={generateTasks} disabled={isGeneratingTasks || !taskRoomContext.trim()} className="bg-black hover:bg-black border border-[#e5e7eb29] text-white gap-2">
                  {isGeneratingTasks ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Generating Tasks...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Generate Tasks
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {taskDialogStep === 'selection' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Generated Tasks ({selectedTaskIndices.size} selected)</h4>
                <button
                  onClick={clearAllTasks}
                  className="flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3 w-3" /> Clear All
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {generatedTasks.map((task, index) => (
                  <div
                    key={index}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 transition-colors ${selectedTaskIndices.has(index)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/50"
                      }`}
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedTaskIndices.has(index)}
                        onChange={() => toggleTaskSelection(index)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      {editingTaskIndex === index ? (
                        <div className="space-y-2">
                          <input
                            value={editingTaskValue.title}
                            onChange={(e) => setEditingTaskValue({ ...editingTaskValue, title: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Task Title"
                          />
                          <div className="flex gap-2">
                            <select
                              value={editingTaskValue.priority}
                              onChange={(e) => setEditingTaskValue({ ...editingTaskValue, priority: e.target.value })}
                              className="rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <textarea
                            value={editingTaskValue.description}
                            onChange={(e) => setEditingTaskValue({ ...editingTaskValue, description: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Description"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={saveEditingTask} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingTaskIndex(null)} className="text-red-600 hover:text-red-700"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{task.title}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${task.priority === 'high' ? 'bg-red-100 text-red-700' :
                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                {task.priority}
                              </span>
                              <button onClick={() => startEditingTask(index, task)} className="text-muted-foreground hover:text-foreground">
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTaskDialogStep('input')}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleProceedToStageSelection}
                  disabled={selectedTaskIndices.size === 0}
                  className="gap-2 bg-black hover:bg-black"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {taskDialogStep === 'stage-selection' && (
            <div className="space-y-4">
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                {columns.map((col,i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedTargetStageId(col._id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedTargetStageId === col._id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                      }`}
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: col.color || '#ccc' }}
                    />
                    <span className="font-medium text-sm">{col.name}</span>
                    {selectedTargetStageId === col._id && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTaskDialogStep('selection')}
                  className="text-muted-foreground"
                >
                  Back
                </Button>



                <Button
                  onClick={handleCreateSelectedTasks}
                  disabled={!selectedTargetStageId || isGeneratingTasks}
                  className="gap-2 bg-black hover:bg-black"
                >
                  {isGeneratingTasks ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Creating Tasks...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Create Tasks
                    </>
                  )}

                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Subtasks Dialog */}
      < Dialog open={activeDialog === "subtasks"
      } onOpenChange={(o) => {
        if (!o) {
          setActiveDialog(null)
          setShowSubtaskSelection(false)
          setGeneratedSubtasks([])
        }
      }}>
        <DialogContent className={showSubtaskSelection ? "max-w-md" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Generate Subtasks with AI</DialogTitle>
            <DialogDescription>
              {showSubtaskSelection
                ? "Review and select the subtasks you want to create"
                : "Select tasks to break into subtasks"}
            </DialogDescription>
          </DialogHeader>

          {!showSubtaskSelection ? (
            <div className="space-y-4">
              <div>
                {/* <label className="text-sm font-medium">Select Tasks</label> */}
                <div ref={scrollContainerRef} className="mt-2 h-96 overflow-y-auto rounded-md border border-[#e5e7eb29]  p-3">
                  {stagecolumns.map((task, i) => (
                    <label key={i} className="flex items-start gap-3 p-3  border  border-[#e5e7eb29] rounded mb-2 cursor-pointer">

                      {
                        task._id && (
                          <input
                            type="checkbox"
                            checked={selectedTasks.includes(task?._id)}
                            onChange={() => task._id && setSelectedTasks(task._id)}
                            className="mt-1 h-4 w-4"
                          />
                        )
                      }

                      <div className="flex-1">

                        {task.title && <p className="text-sm  line-clamp-2">{task.title}</p>}
                      </div>
                    </label>
                  ))}
                  {hasMore && (
                    <div className="text-center py-4">
                      {isFetching ? "Loading..." : <Button size="sm" onClick={() => fetchListView(nextPageToFetch)}>Load More</Button>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
                <Button
                  onClick={generateSubtask}
                  disabled={isGeneratingSubtasks}
                  className="gap-2 bg-black hover:bg-black border-[#e5e7eb29] border text-white"
                >
                  {isGeneratingSubtasks ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Generating Subtasks...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Generate Subtasks
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Generated Subtasks ({selectedSubtaskIndices.size} selected)</h4>
                <button
                  onClick={clearAllSubtasks}
                  className="flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3 w-3" /> Clear All
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {generatedSubtasks.map((subtask, index) => (
                  <div
                    key={index}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 transition-colors ${selectedSubtaskIndices.has(index)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/50"
                      }`}
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedSubtaskIndices.has(index)}
                        onChange={() => toggleSubtaskSelection(index)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      {editingSubtaskIndex === index ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editingSubtaskValue.subTaskDetail}
                            onChange={(e) => setEditingSubtaskValue({ ...editingSubtaskValue, subTaskDetail: e.target.value })}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          <button onClick={saveEditingSubtask} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditingSubtaskIndex(null)} className="text-red-600 hover:text-red-700"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{subtask.subTaskDetail}</span>
                          <button onClick={() => startEditingSubtask(index, subtask)} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubtaskSelection(false)}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleCreateSelectedSubtasks}
                  disabled={selectedSubtaskIndices.size === 0 || isGeneratingSubtasks}
                  className="gap-2 bg-white hover:bg-gray-200 text-black font-semibold"
                >
                  {isGeneratingSubtasks ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Creating Subtasks...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />Create Subtasks
                    </>
                  )}


                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog >

      {/* Generate Stages Dialog */}
      < Dialog open={activeDialog === "stages"} onOpenChange={(o) => {
        if (!o) {
          setActiveDialog(null)
          setShowStageSelection(false)
          setGeneratedStages([])
        }
      }}>
        <DialogContent className={`${showStageSelection ? "max-w-md" : ""} bg-[#0e0e12] border-[#e5e7eb29]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Generate Stages with AI</DialogTitle>
            <DialogDescription>
              {showStageSelection
                ? "Tell us about your TaskRoom workflow and AI will generate relevant stages"
                : "Describe your workflow and AI will create stages"}
            </DialogDescription>
          </DialogHeader>

          {!showStageSelection ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white">Workflow Description</label>
                <textarea
                  value={stageContext}
                  onChange={(e) => setStageContext(e.target.value)}
                  placeholder="e.g., Agile product development: Ideation → Design → Development → Review → Testing → Deployment"
                  className="mt-2 min-h-32 w-full rounded-md border border-[#e5e7eb29] bg-[#0e0e12] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
                <Button onClick={generateStage} disabled={isGeneratingStages || !stageContext.trim()} className="gap-2 bg-white hover:bg-gray-200 text-black font-semibold">
                  {isGeneratingStages ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Generating Stages...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Generate Stages
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Generated Stages ({selectedStageIndices.size} selected)</h4>
                <button
                  onClick={clearAllStages}
                  className="flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3 w-3" /> Clear All
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {generatedStages.map((stage, index) => (
                  <div
                    key={index}
                    className={`relative flex items-start gap-3 rounded-lg border p-3 transition-colors ${selectedStageIndices.has(index)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/50"
                      }`}
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedStageIndices.has(index)}
                        onChange={() => toggleStageSelection(index)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      {editingStageIndex === index ? (
                        <div className="space-y-2">
                          <input
                            value={editingStageValue.name}
                            onChange={(e) => setEditingStageValue({ ...editingStageValue, name: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Stage Name"
                          />
                          <textarea
                            value={editingStageValue.description}
                            onChange={(e) => setEditingStageValue({ ...editingStageValue, description: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Description"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={saveEditingStage} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingStageIndex(null)} className="text-red-600 hover:text-red-700"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="font-medium text-sm">{stage.name}</span>
                            </div>
                            <button onClick={() => startEditingStage(index, stage)} className="text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                          {stage.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {stage.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStageSelection(false)}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleInitCreateStages}
                  disabled={selectedStageIndices.size === 0 || isGeneratingStages}
                  className="gap-2 bg-white hover:bg-gray-200 text-black font-semibold"
                >

                  {isGeneratingStages ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Creating Stages...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Create Stages
                    </>
                  )}

                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog >
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent className="bg-[#0e0e12] border-[#e5e7eb29]">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Stage Creation</DialogTitle>
            <DialogDescription className="text-gray-400">
              Do you want to replace with existing stage yes or no?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => handleCreateSelectedStages(false)} className="bg-transparent border-[#e5e7eb29] text-white hover:bg-[#1e1e2d]">
              No
            </Button>
            <Button onClick={() => handleCreateSelectedStages(true)} className="bg-white hover:bg-gray-200 text-black font-semibold">
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
