'use client'

import { useState, useEffect } from 'react'
import { X, Copy, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from "@/components/ui/skeleton"
// import { Spinner } from '@/components/ui/spinner'
// import { StageSummarySkeleton } from '@/components/skeleton-loader'
import { toast } from "sonner"

import Cookies from "js-cookie";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
interface JwtPayload {
    // Adjust these fields according to YOUR actual JWT payload
    sub?: string        // user id
    name?: string
    email?: string
    role?: string
    exp?: number
    orgId?: string
    iat?: number
    userId?: string
    // ... add any custom claims like garageId, permissions, etc.
    [key: string]: any
}
interface ChecklistItem {
    _id?: string
    description?: string
    orderId?: number
    isCompleted: boolean
}

interface ChecklistData {
    _id?: string
    name: string
    childCount?: number
    completedChildCount?: number
    checklistItems?: ChecklistItem[]
}

interface Card {
    _id: string
    name: string
    assignedToIds: string
    isCompleted: boolean
    isOverDue: boolean
    createdAt: string
    updatedAt: string
    checklistData: ChecklistData[]
    tagData: any[]
}

interface AssigneeInfo {
    _id: string
    name: string
    email: string
}

interface IndividualMember {
    cards: Card[]
    assignedToIds: string
    assigneeData: AssigneeInfo[]
}

interface StageSummaryResponse {
    status: boolean
    stageData: {
        _id: string
        name: string
        cardCount: number
    }
    data: Array<{
        individual_members: IndividualMember[]
        group_members: any[]
        unassigned: any[]
    }>
}

interface StageSummaryDialogProps {
    stageId: string
    stageName: string
    isOpen: boolean
    onClose: () => void
    baseUrl?: string
}

interface AssigneeGroup {
    userId: string | null
    name: string
    initials: string
    cards: Card[]
}

function StageSummarySkeleton() {
    return (
        <div className="space-y-8">
            {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>

                    <div className="space-y-4 ml-11">
                        {[1, 2].map((j) => (
                            <div key={j} className="flex items-start gap-2">
                                <Skeleton className="w-2 h-2 rounded-full mt-1.5" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    {/* Checklist stubs */}
                                    <div className="space-y-2 pl-2 pt-1">
                                        <Skeleton className="h-3 w-1/2" />
                                        <div className="space-y-1 pl-4">
                                            <Skeleton className="h-3 w-1/3" />
                                            <Skeleton className="h-3 w-1/4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function StageSummaryDialog({
    stageId,
    stageName,
    isOpen,
    onClose,
    baseUrl = "https://uatapi.garage.app/flowboard"
}: StageSummaryDialogProps) {
    const [data, setData] = useState<StageSummaryResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return

        const fetchStageSummary = async () => {
            setLoading(true)
            setError(null)
            try {
                const token = localStorage.getItem("garage_tok")
                if (!token) {
                    toast.error("Authentication token missing")
                    return
                }

                const response = await fetch(`${baseUrl}/v1/stages/summery/${stageId}`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                })

                if (!response.ok) {
                    throw new Error('Failed to fetch stage summary')
                }

                const result: StageSummaryResponse = await response.json()
                setData(result)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred')
            } finally {
                setLoading(false)
            }
        }

        fetchStageSummary()
    }, [isOpen, stageId, baseUrl])

    const groupByAssignee = (responseData: StageSummaryResponse['data']): AssigneeGroup[] => {
        const groups: Record<string, AssigneeGroup> = {}
        console.log("responseData", responseData)
        responseData.forEach((dataGroup) => {
            dataGroup.individual_members.forEach((member) => {
                const assigneeInfo = member.assigneeData[0]
                if (assigneeInfo) {
                    const userId = assigneeInfo._id
                    const name = assigneeInfo.name
                    const initials = name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)

                    if (!groups[userId]) {
                        groups[userId] = {
                            userId,
                            name,
                            initials,
                            cards: member.cards,
                        }
                    }
                }
            })
            dataGroup?.group_members.forEach((member) => {
                // Loop over ALL assignees in the array
                member.assigneeData?.forEach((assigneeInfo) => {
                    if (!assigneeInfo?._id) return;

                    const userId = assigneeInfo._id;
                    const name = assigneeInfo.name || "Unknown";

                    const initials = name
                        .split(/\s+/)
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || "??";

                    // Initialize if first time seeing this user
                    if (!groups[userId]) {
                        groups[userId] = {
                            userId,
                            name,
                            initials,
                            cards: [],           // important: start with empty array
                        };
                    }

                    // Add this member's card to the user's list
                    if (member.cards) {
                        groups[userId].cards.push(...member.cards);
                        // or if you want to keep card reference + assignee context:
                        // groups[userId].cards.push(member.cards);
                    }
                });
            });
            dataGroup?.unassigned.forEach((assigneeInfo) => {
                // Loop over ALL assignees in the array

                // if (!assigneeInfo?._id) return;

                const userId = assigneeInfo?._id;
                const name = "Unassigned";

                const initials = "Un";

                // Initialize if first time seeing this user
                if (!groups[userId]) {
                    groups[userId] = {
                        userId,
                        name,
                        initials,
                        cards: [],           // important: start with empty array
                    };
                }

                // Add this member's card to the user's list

                groups[userId]?.cards?.push(assigneeInfo);
                // or if you want to keep card reference + assignee context:
                // groups[userId].cards.push(member.cards);


            });
        })

        return Object.values(groups)
    }

    const copyToClipboard = () => {
        if (!data) return

        let text = `${data.stageData.name} — Summary\n`
        text += `Summary of cards grouped by assignee\n\n`

        const groups = groupByAssignee(data.data)
        groups.forEach((group) => {
            text += `${group.initials} ${group?.name ? group?.name : "unassigned"}\n`
            group.cards.forEach((card) => {
                const status = card.isCompleted ? '✓' : '○'
                text += `  • ${status} ${card.name}\n`

                if (card.checklistData && card.checklistData.length > 0) {
                    card.checklistData.forEach((checklist) => {
                        const completed = checklist.completedChildCount || 0
                        const total = checklist.childCount || 0
                        text += `    ${checklist.name}\n`

                        if (checklist.checklistItems && checklist.checklistItems.length > 0) {
                            checklist.checklistItems.forEach((item) => {
                                const itemStatus = item.isCompleted ? 'completed' : '○pen'
                                const itemText = item.description || 'Unnamed item'
                                text += `      ${itemStatus} ${itemText}\n`
                            })
                        }
                    })
                }
            })
            text += '\n'
        })

        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }

    const handleSharePdf = () => {
        if (!data) return

        const doc = new jsPDF()

        // Title
        doc.setFontSize(18)
        doc.text(`${data.stageData.name} — Summary`, 14, 20)

        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text("Summary of cards grouped by assignee", 14, 28)

        let yPos = 40
        const lineHeight = 7
        const pageHeight = doc.internal.pageSize.height

        const checkPageBreak = (height = lineHeight) => {
            if (yPos + height > pageHeight - 20) {
                doc.addPage()
                yPos = 20
            }
        }

        const groups = groupByAssignee(data.data)

        groups.forEach((group) => {
            checkPageBreak(15) // checking for header space

            // Group Header
            doc.setFontSize(14)
            doc.setTextColor(0)
            doc.text(group.name, 14, yPos)
            yPos += 10

            // Cards
            doc.setFontSize(11)
            group.cards.forEach((card) => {
                const status = card.isCompleted ? '[Completed]' : '[Open]'
                const text = `${status} ${card.name}`

                // Split text to fit width
                const splitText = doc.splitTextToSize(text, 180)
                checkPageBreak(splitText.length * lineHeight)
                doc.text(splitText, 14, yPos)
                yPos += splitText.length * lineHeight

                // Checklists
                if (card.checklistData && card.checklistData.length > 0) {
                    card.checklistData.forEach((cl) => {
                        checkPageBreak()
                        doc.setFontSize(10)
                        doc.setTextColor(80)
                        doc.text(`- ${cl.name}`, 20, yPos)
                        yPos += 6

                        if (cl.checklistItems && cl.checklistItems.length > 0) {
                            cl.checklistItems.forEach((item) => {
                                checkPageBreak()
                                const itemStatus = item.isCompleted ? '[Completed]' : '[Open]'
                                doc.text(`  ${itemStatus} ${item.description || "Item"}`, 25, yPos)
                                yPos += 5
                            })
                        }
                        doc.setFontSize(11)
                        doc.setTextColor(0)
                    })
                }
                yPos += 2 // gap between cards
            })
            yPos += 5 // gap between groups
        })

        doc.save(`Summary-${data.stageData.name}.pdf`)
    }

    const handleShareDocx = async () => {
        if (!data) return

        const children: Paragraph[] = []

        // Title
        children.push(
            new Paragraph({
                text: `${data.stageData.name} — Summary`,
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
                text: "Summary of cards grouped by assignee",
                spacing: { after: 400 },
            })
        )

        const groups = groupByAssignee(data.data)

        groups.forEach((group) => {
            // Group Header
            children.push(
                new Paragraph({
                    text: group.name,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 },
                })
            )

            group.cards.forEach((card) => {
                const status = card.isCompleted ? '[Completed]' : '[Open]'

                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${status} ${card.name}`,
                                bold: true,

                            })
                        ],
                        bullet: { level: 0 }, // List item
                    })
                )

                if (card.checklistData && card.checklistData.length > 0) {
                    card.checklistData.forEach((cl) => {
                        children.push(
                            new Paragraph({
                                text: `${cl.name}`,
                                bullet: { level: 1 },
                                style: "ListParagraph",
                            })
                        )

                        if (cl.checklistItems && cl.checklistItems.length > 0) {
                            cl.checklistItems.forEach((item) => {
                                const itemStatus = item.isCompleted ? '[Completed]' : '[Open]'
                                children.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: `${itemStatus} ${item.description || "Item"}`,

                                            })
                                        ],
                                        bullet: { level: 2 },
                                    })
                                )
                            })
                        }
                    })
                }
            })
        })

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        })

        const blob = await Packer.toBlob(doc)
        saveAs(blob, `Summary-${data.stageData.name}.docx`)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border">
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-foreground">
                            {data?.stageData?.name || stageName} — Summary
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Summary of cards grouped by assignee</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-rounded-md scrollbar-track-transparent scrollbar-thumb-muted">
                    {loading ? (
                        <StageSummarySkeleton />
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-destructive">{error}</p>
                        </div>
                    ) : data ? (
                        <div className="space-y-8">
                            {groupByAssignee(data.data).map((group) => (
                                <div key={group.userId}>
                                    <div className="flex items-center gap-3 mb-0">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                                            {group.initials}
                                        </div>
                                        <h3 className="font-semibold text-foreground">{group.name}</h3>
                                    </div>

                                    <div className="space-y-3 ml-11">
                                        {group.cards.map((card) => (
                                            <div key={card._id}>
                                                <div className="flex items-start gap-2">
                                                    <span className=" text-muted-foreground">•</span>
                                                    <div className="flex-1">
                                                        <p
                                                            className={`text-sm font-medium text-foreground
                                                                }`}
                                                        >
                                                            {card.name}
                                                        </p>
                                                        {/* <p
                                                            className={`text-xs font-normal text-foreground
                                                                }`}
                                                        >
                                                            {card.name}
                                                        </p> */}

                                                        {/* Tags */}
                                                        {card.tagData && card.tagData.length > 0 && (
                                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                                {card.tagData.map((tag, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-block px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
                                                                    >
                                                                        {tag.name || tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Checklist Items */}
                                                        {card.checklistData && card.checklistData.length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                {card.checklistData.map((checklist, idx) => (
                                                                    <div key={idx} className="space-y-2">
                                                                        <p className="text-xs text-muted-foreground font-medium">
                                                                            {checklist.name}

                                                                        </p>

                                                                        {checklist.checklistItems && checklist.checklistItems.length > 0 && (
                                                                            <div className="space-y-1 ml-2">
                                                                                {checklist.checklistItems.map((item, itemIdx) => (
                                                                                    <div key={itemIdx} className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={item.isCompleted}
                                                                                            disabled
                                                                                            className="w-3 h-3"
                                                                                        />
                                                                                        <span
                                                                                            className={`text-xs ${item.isCompleted
                                                                                                ? 'text-muted-foreground line-through'
                                                                                                : 'text-muted-foreground'
                                                                                                }`}
                                                                                        >
                                                                                            {item.description || 'Unnamed item'}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* Footer Actions */}
                <div className="border-t border-border p-6 flex gap-3 justify-center">
                    <Button
                        onClick={copyToClipboard}
                        variant="default"
                        className="flex items-center gap-2 bg-black dark:bg-blue-900"
                        disabled={loading || !data}
                    >
                        <Copy className="w-4 h-4" />
                        Copy Text
                    </Button>
                    <Button
                        onClick={handleSharePdf}
                        variant="outline"
                        className="flex items-center gap-2 bg-transparent"
                        disabled={loading || !data}
                    >
                        <FileText className="w-4 h-4" />
                        Share as PDF
                    </Button>
                    <Button
                        onClick={handleShareDocx}
                        variant="outline"
                        className="flex items-center gap-2 bg-transparent"
                        disabled={loading || !data}
                    >
                        <FileText className="w-4 h-4" />
                        Share as DOCX
                    </Button>
                </div>
            </div>
        </div>
    )
}
