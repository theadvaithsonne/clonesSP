import { useState, useEffect } from 'react'
import { X, Copy, FileText, Check, UserPlus, Archive, Send, LayoutDashboard } from 'lucide-react'
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx"
import { saveAs } from "file-saver"

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
    title?: string
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

const AVATAR_COLORS = [
    { bg: 'rgba(55,138,221,0.12)', text: '#5b9fd4' },
    { bg: 'rgba(127,119,221,0.12)', text: '#9580d4' },
    { bg: 'rgba(29,158,117,0.12)', text: '#38b898' },
    { bg: 'rgba(216,90,48,0.12)', text: '#d4826a' },
    { bg: 'rgba(212,83,126,0.12)', text: '#d47098' },
]

function getAvatarColor(index: number) {
    return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function StageSummarySkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {[1, 2, 3].map((i) => (
                <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1a1a22' }} />
                        <div style={{ width: 100, height: 12, borderRadius: 6, background: '#1a1a22' }} />
                    </div>
                    <div style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[1, 2].map((j) => (
                            <div key={j} style={{ background: '#0d0d10', borderRadius: 10, padding: '12px 14px' }}>
                                <div style={{ width: '70%', height: 12, borderRadius: 6, background: '#1a1a22', marginBottom: 8 }} />
                                <div style={{ width: '40%', height: 10, borderRadius: 6, background: '#1a1a22' }} />
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
                if (!token) { toast.error("Authentication token missing"); return }
                const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}stages/summery/${stageId}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                })
                if (!response.ok) throw new Error('Failed to fetch stage summary')
                const result = await response.json()
                setData(result)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred')
            } finally {
                setLoading(false)
            }
        }
        fetchStageSummary()
    }, [isOpen, stageId])

    const groupByAssignee = (responseData: StageSummaryResponse['data']): AssigneeGroup[] => {
        const groups: Record<string, AssigneeGroup> = {}
        responseData?.forEach((dataGroup) => {
            dataGroup?.individual_members?.forEach((member) => {
                const assigneeInfo = member.assigneeData[0]
                if (assigneeInfo) {
                    const userId = assigneeInfo._id
                    const name = assigneeInfo.name
                    const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                    if (!groups[userId]) groups[userId] = { userId, name, initials, cards: member.cards }
                }
            })
            dataGroup?.group_members.forEach((member) => {
                member.assigneeData?.forEach((assigneeInfo: any) => {
                    if (!assigneeInfo?._id) return
                    const userId = assigneeInfo._id
                    const name = assigneeInfo.name || "Unknown"
                    const initials = name.split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || "??"
                    if (!groups[userId]) groups[userId] = { userId, name, initials, cards: [] }
                    if (member.cards) groups[userId].cards.push(...member.cards)
                })
            })
            dataGroup?.unassigned.forEach((assigneeInfo: any) => {
                const userId = assigneeInfo?._id
                if (!groups[userId]) groups[userId] = { userId, name: "Unassigned", initials: "Un", cards: [] }
                groups[userId]?.cards?.push(assigneeInfo)
            })
        })
        return Object.values(groups)
    }

    const getStats = () => {
        if (!data) return { total: 0, completed: 0, assignees: 0, overdue: 0 }
        const groups = groupByAssignee(data.data)
        const allCards = groups.flatMap(g => g.cards)
        return {
            total: allCards.length,
            completed: allCards.filter(c => c.isCompleted).length,
            assignees: groups.length,
            overdue: allCards.filter(c => c.isOverDue).length,
        }
    }

    const copyToClipboard = () => {
        if (!data) return
        let text = `${data.stageData.name} — Summary\n\n`
        groupByAssignee(data.data).forEach((group) => {
            text += `${group.name}\n`
            group.cards.forEach((card) => {
                text += `  • ${card.isCompleted ? '✓' : '○'} ${card.title}\n`
                card.checklistData?.forEach((checklist) => {
                    text += `    ${checklist.name}\n`
                    checklist.checklistItems?.forEach((item) => {
                        text += `      ${item.isCompleted ? '✓' : '○'} ${item.description || 'Unnamed item'}\n`
                    })
                })
            })
            text += '\n'
        })
        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }

    const handleSharePdf = () => {
        if (!data) return
        const doc = new jsPDF()
        doc.setFontSize(18)
        doc.text(`${data.stageData.name} — Summary`, 14, 20)
        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text("Summary of cards grouped by assignee", 14, 28)
        let yPos = 40
        const lineHeight = 7
        const pageHeight = doc.internal.pageSize.height
        const checkPageBreak = (height = lineHeight) => {
            if (yPos + height > pageHeight - 20) { doc.addPage(); yPos = 20 }
        }
        groupByAssignee(data.data).forEach((group) => {
            checkPageBreak(15)
            doc.setFontSize(14); doc.setTextColor(0)
            doc.text(group.name, 14, yPos); yPos += 10
            doc.setFontSize(11)
            group.cards.forEach((card) => {
                const text = `${card.isCompleted ? '[Done]' : '[Open]'} ${card.title}`
                const splitText = doc.splitTextToSize(text, 180)
                checkPageBreak(splitText.length * lineHeight)
                doc.text(splitText, 14, yPos); yPos += splitText.length * lineHeight
                card.checklistData?.forEach((cl) => {
                    checkPageBreak(); doc.setFontSize(10); doc.setTextColor(80)
                    doc.text(`- ${cl.name}`, 20, yPos); yPos += 6
                    cl.checklistItems?.forEach((item) => {
                        checkPageBreak()
                        doc.text(`  ${item.isCompleted ? '[Done]' : '[Open]'} ${item.description || "Item"}`, 25, yPos)
                        yPos += 5
                    })
                    doc.setFontSize(11); doc.setTextColor(0)
                })
                yPos += 2
            })
            yPos += 5
        })
        doc.save(`Summary-${data.stageData.name}.pdf`)
    }

    const handleShareDocx = async () => {
        if (!data) return
        const children: Paragraph[] = [
            new Paragraph({ text: `${data.stageData.name} — Summary`, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: "Summary of cards grouped by assignee", spacing: { after: 400 } }),
        ]
        groupByAssignee(data.data).forEach((group) => {
            children.push(new Paragraph({ text: group.name, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }))
            group.cards.forEach((card) => {
                children.push(new Paragraph({
                    children: [new TextRun({ text: `${card.isCompleted ? '[Done]' : '[Open]'} ${card.title}`, bold: true })],
                    bullet: { level: 0 },
                }))
                card.checklistData?.forEach((cl) => {
                    children.push(new Paragraph({ text: cl.name, bullet: { level: 1 } }))
                    cl.checklistItems?.forEach((item) => {
                        children.push(new Paragraph({
                            children: [new TextRun({ text: `${item.isCompleted ? '[Done]' : '[Open]'} ${item.description || "Item"}` })],
                            bullet: { level: 2 },
                        }))
                    })
                })
            })
        })
        const doc = new Document({ sections: [{ properties: {}, children }] })
        const blob = await Packer.toBlob(doc)
        saveAs(blob, `Summary-${data.stageData.name}.docx`)
    }

    if (!isOpen) return null

    const stats = getStats()
    const groups = data ? groupByAssignee(data.data) : []

    const s: Record<string, React.CSSProperties> = {
        overlay: {
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: 20,
        },
        modal: {
            background: '#111113', borderRadius: 16,
            width: '100%', maxWidth: 580,
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
        },
        header: {
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', padding: '22px 24px 18px',
        },
        headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
        stageIcon: {
            width: 36, height: 36, borderRadius: 10,
            background: '#1e1e22', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#6b6b80', fontSize: 18,
        },
        title: { fontSize: 15, fontWeight: 500, color: '#e8e8f0', letterSpacing: '-0.01em' },
        sub: { fontSize: 12, color: '#555568', marginTop: 2 },
        closeBtn: {
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#44444f', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, fontSize: 18,
        },
        statsRow: { display: 'flex', padding: '14px 24px', gap: 0 },
        statBox: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
        statVal: { fontSize: 22, fontWeight: 500, color: '#e0e0ec', letterSpacing: '-0.03em' },
        statLbl: { fontSize: 11, color: '#44444f', textTransform: 'uppercase', letterSpacing: '0.06em' },
        divider: { height: 1, background: '#1c1c20', margin: '0 24px' },
        body: { flex: 1, overflowY: 'auto', padding: '8px 24px 16px' },
        groupBlock: { marginBottom: 22 },
        groupHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '6px 0' },
        groupName: { fontSize: 13, fontWeight: 500, color: '#c8c8d8' },
        cardCount: { fontSize: 11, color: '#383848', marginLeft: 'auto' },
        cardsList: { marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 6 },
        card: { background: '#0d0d10', borderRadius: 10, padding: '12px 14px' },
        cardRow: { display: 'flex', alignItems: 'flex-start', gap: 10 },
        cardTitle: { fontSize: 13, color: '#b0b0c4', lineHeight: 1.45, flex: 1 },
        badgeRow: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, marginLeft: 16 },
        badge: { fontSize: 11, padding: '2px 8px', borderRadius: 100, background: '#191921', color: '#48485e' },
        clBlock: { marginTop: 10, marginLeft: 16 },
        clHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
        clName: { fontSize: 11, color: '#3a3a50', fontWeight: 500 },
        clCount: { fontSize: 11, color: '#2e2e42' },
        progWrap: { height: 2, background: '#1a1a22', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
        checkItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' },
        checkTxt: { fontSize: 12, color: '#48485e', lineHeight: 1.4 },
        checkTxtDone: { fontSize: 12, color: '#303040', textDecoration: 'line-through', lineHeight: 1.4 },
        footer: { padding: '16px 24px', display: 'flex', gap: 8, alignItems: 'center' },
        sep: { width: 1, height: 24, background: '#1c1c22', margin: '0 2px' },
    }

    const btnBase: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 16px', borderRadius: 10, border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: 400,
        whiteSpace: 'nowrap', fontFamily: 'inherit',
    }

    const StatusDot = ({ done }: { done: boolean }) => (
        <div style={{
            width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
            background: done ? '#2eb87a' : '#2e2e3a',
        }} />
    )

    const CheckBox = ({ done }: { done: boolean }) => (
        <div style={{
            width: 13, height: 13, borderRadius: 3, flexShrink: 0,
            background: done ? '#2eb87a' : '#1a1a22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {done && (
                <svg width="9" height="9" viewBox="0 0 9 9">
                    <polyline points="1.5,4.5 3.5,6.5 7.5,2" fill="none" stroke="#0d0d10" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            )}
        </div>
    )

    const Avatar = ({ initials, index }: { initials: string; index: number }) => {
        const color = initials === 'Un' ? { bg: '#1e1e1e', text: '#666672' } : getAvatarColor(index)
        return (
            <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: color.bg, color: color.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 500,
            }}>
                {initials}
            </div>
        )
    }

    return (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={s.modal}>

                {/* Header */}
                <div style={s.header}>
                    <div style={s.headerLeft}>
                        <div style={s.stageIcon}>
                            <LayoutDashboard size={16} />
                        </div>
                        <div>
                            <div style={s.title}>{data?.stageData?.name || stageName} — Summary</div>
                            <div style={s.sub}>Cards grouped by assignee</div>
                        </div>
                    </div>
                    <button style={s.closeBtn} onClick={onClose} aria-label="Close">
                        <X size={16} />
                    </button>
                </div>

                {/* Stats */}
                {!loading && data && (
                    <>
                        <div style={s.statsRow}>
                            {[
                                { val: stats.total, lbl: 'Total cards' },
                                { val: stats.completed, lbl: 'Completed' },
                                { val: stats.assignees, lbl: 'Assignees' },
                                { val: stats.overdue, lbl: 'Overdue' },
                            ].map((stat, i) => (
                                <div key={i} style={{
                                    ...s.statBox,
                                    ...(i > 0 ? { borderLeft: '1px solid #1c1c20', paddingLeft: 20, marginLeft: 4 } : {}),
                                }}>
                                    <span style={s.statVal}>{stat.val}</span>
                                    <span style={s.statLbl}>{stat.lbl}</span>
                                </div>
                            ))}
                        </div>
                        <div style={s.divider} />
                    </>
                )}

                {/* Body */}
                <div style={s.body}>
                    {loading ? (
                        <StageSummarySkeleton />
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: '#c05050', fontSize: 14 }}>{error}</div>
                    ) : data ? (
                        <div>
                            {groups.map((group, gi) => (
                                <div key={group.userId} style={s.groupBlock}>
                                    <div style={s.groupHeader}>
                                        <Avatar initials={group.initials} index={gi} />
                                        <span style={s.groupName}>{group.name}</span>
                                        <span style={s.cardCount}>{group.cards.length} {group.cards.length === 1 ? 'card' : 'cards'}</span>
                                    </div>
                                    <div style={s.cardsList}>
                                        {group.cards.map((card) => {
                                            const totalItems = card.checklistData?.reduce((acc, cl) => acc + (cl.childCount || 0), 0) || 0
                                            const doneItems = card.checklistData?.reduce((acc, cl) => acc + (cl.completedChildCount || 0), 0) || 0
                                            const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
                                            return (
                                                <div key={card._id} style={s.card}>
                                                    <div style={s.cardRow}>
                                                        <StatusDot done={card.isCompleted} />
                                                        <span style={s.cardTitle}>{card.title}</span>
                                                    </div>

                                                    {card.tagData?.length > 0 && (
                                                        <div style={s.badgeRow}>
                                                            {card.tagData.map((tag, idx) => (
                                                                <span key={idx} style={s.badge}>{tag.name || tag}</span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {card.checklistData?.length > 0 && (
                                                        <div style={s.clBlock}>
                                                            {card.checklistData.map((cl, idx) => (
                                                                <div key={idx}>
                                                                    <div style={s.clHeader}>
                                                                        <span style={s.clName}>{cl.name}</span>
                                                                        <span style={s.clCount}>{cl.completedChildCount || 0} / {cl.childCount || 0}</span>
                                                                    </div>
                                                                    <div style={s.progWrap}>
                                                                        <div style={{ height: '100%', borderRadius: 2, background: '#2eb87a', width: `${pct}%` }} />
                                                                    </div>
                                                                    {cl.checklistItems?.map((item, iIdx) => (
                                                                        <div key={iIdx} style={s.checkItem}>
                                                                            <CheckBox done={item.isCompleted} />
                                                                            <span style={item.isCompleted ? s.checkTxtDone : s.checkTxt}>
                                                                                {item.description || 'Unnamed item'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div style={s.divider} />

                {/* Footer */}
                <div style={s.footer}>
                    <button style={{ ...btnBase, background: '#18181d', color: '#606078' }} onClick={copyToClipboard} disabled={loading || !data}>
                        <Copy size={14} /> Copy text
                    </button>
                    <button style={{ ...btnBase, background: '#18181d', color: '#606078' }} onClick={handleSharePdf} disabled={loading || !data}>
                        <FileText size={14} /> PDF
                    </button>
                    <button style={{ ...btnBase, background: '#18181d', color: '#606078' }} onClick={handleShareDocx} disabled={loading || !data}>
                        <FileText size={14} /> DOCX
                    </button>

                   
                </div>

            </div>
        </div>
    )
}
