"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import { X } from "lucide-react";

// ─── JWT ──────────────────────────────────────────────────────────────────────

interface JwtPayload {
    sub?: string;
    name?: string;
    email?: string;
    role?: string;
    exp?: number;
    orgId?: string;
    iat?: number;
    userId?: string;
    [key: string]: any;
}

const BASE_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskRoom {
    _id: string;
    name?: string;
    title?: string;
    description?: string;
}

interface Workspace {
    _id: string;
    name?: string;
    description?: string;
}

interface Space {
    _id: string;
    name?: string;
    description?: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

const fetchTaskRooms = async (
    orgId: string,
    userId: string,
    page: number,
    size: number
): Promise<TaskRoom[]> => {
    const endpoint = `https://uatapi.garage.app/taskroom/v1/rooms?orgId=${orgId}&page=${page}&size=1000&userId=${userId}`;
    const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
    const data = await response.json();
    return data?.data || [];
};

const fetchWorkspaces = async (): Promise<Workspace[]> => {
    const response = await fetch(`${BASE_URL}workspaces/me?size=1000&owner=true`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
    const data = await response.json();
    return data?.data || [];
};

const fetchSpacesByWorkspace = async (workspaceId: string): Promise<Space[]> => {
    const response = await fetch(
        `${BASE_URL}spaces/me?workspaceId=${workspaceId}&page=1&size=1000&owner=true`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
    const data = await response.json();
    return data?.data || [];
};

const assignRoom = async (payload: {
    roomId: string;
    workspaceId: string;
    spaceId: string;
    userId: string
}) => {
    const response = await fetch(`https://uatapi.garage.app/taskroom/v1/migerate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || `Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
};

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS = ["V1 Workspace", "V2 Workspace", "Space"];

function Stepper({ current }: { current: number }) {
    return (
        <div className="flex items-center mb-8">
            {STEPS.map((label, i) => {
                const n = i + 1;
                const isDone = current > n;
                const isActive = current === n;
                return (
                    <div key={n} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                  ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : ""}
                  ${isActive ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30" : ""}
                  ${!isDone && !isActive ? "border-zinc-700 text-zinc-500 bg-zinc-800" : ""}
                `}
                            >
                                {isDone ? "✓" : n}
                            </div>
                            <span
                                className={`text-[10px] mt-1 whitespace-nowrap font-medium
                  ${isActive ? "text-indigo-400" : isDone ? "text-emerald-400" : "text-zinc-500"}`}
                            >
                                {label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div
                                className={`flex-1 h-px mx-2 mb-4 transition-all ${isDone ? "bg-emerald-500" : "bg-zinc-700"
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────

function ItemRow({
    label,
    sub,
    badge,
    selected,
    onClick,
}: {
    label: string;
    sub?: string;
    badge?: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl cursor-pointer transition-all
        ${selected
                    ? "border-indigo-500 bg-indigo-500/10 shadow-sm shadow-indigo-500/20"
                    : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/60 bg-zinc-800/30"
                }`}
        >
            <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
          ${selected ? "border-indigo-400" : "border-zinc-600"}`}
            >
                {selected && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100 truncate">{label}</div>
                {sub && <div className="text-xs text-zinc-500 truncate mt-0.5">{sub}</div>}
            </div>
            {badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex-shrink-0 font-medium">
                    {badge}
                </span>
            )}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Loader({ text = "Loading…" }: { text?: string }) {
    return (
        <div className="flex items-center justify-center gap-2 py-10 text-zinc-500 text-sm">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
            {text}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return (
        <div className="text-center py-10 text-zinc-500 text-sm">
            <div className="text-2xl mb-2">🗂️</div>
            {text}
        </div>
    );
}

function ErrorMsg({ text }: { text: string }) {
    return (
        <div className="bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl px-3 py-2 text-xs mb-3">
            ⚠️ {text}
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-xs py-1.5">
            <span className="text-zinc-500">{label}</span>
            <span className="text-zinc-200 font-medium truncate max-w-[180px] text-right">{value}</span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MigrationWizardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [step, setStep] = useState(1);

    // Step 1
    const [userId, setUserId] = useState("");
    const [taskRooms, setTaskRooms] = useState<TaskRoom[]>([]);
    const [selectedTaskRoom, setSelectedTaskRoom] = useState<TaskRoom | null>(null);
    const [loadingStep1, setLoadingStep1] = useState(false);
    const [errorStep1, setErrorStep1] = useState<string | null>(null);

    // Step 2
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
    const [loadingStep2, setLoadingStep2] = useState(false);
    const [errorStep2, setErrorStep2] = useState<string | null>(null);

    // Step 3
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
    const [loadingStep3, setLoadingStep3] = useState(false);
    const [errorStep3, setErrorStep3] = useState<string | null>(null);

    // Submit
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // ── Init: load task rooms from JWT ────────────────────────────────────────

    useEffect(() => {
        if (!isOpen) return;
        const init = async () => {
            const token = localStorage.getItem("garage_tok");
            if (!token) return;
            try {
                const payload = jwtDecode<JwtPayload>(token);
                if (payload?.orgId && payload?.userId) {
                    setUserId(payload.userId);
                    setLoadingStep1(true);
                    const data = await fetchTaskRooms(payload.orgId, payload.userId, 1, 1000);
                    setTaskRooms(data);
                }
            } catch (error) {
                console.error("Error initialising:", error);
                setErrorStep1("Failed to load task rooms from token.");
            } finally {
                setLoadingStep1(false);
            }
        };
        init();
    }, [isOpen]);
    useEffect(() => {
        setStep(1);
    }, [])
    // ── Step handlers ─────────────────────────────────────────────────────────

    const handleGoStep2 = async () => {
        setStep(2);
        setLoadingStep2(true);
        setErrorStep2(null);
        setWorkspaces([]);
        setSelectedWorkspace(null);
        try {
            const data = await fetchWorkspaces();
            setWorkspaces(data);
        } catch (e: any) {
            setErrorStep2(e.message);
            toast.error("Failed to fetch workspaces");
        } finally {
            setLoadingStep2(false);
        }
    };

    const handleGoStep3 = async () => {
        if (!selectedWorkspace) return;
        setStep(3);
        setLoadingStep3(true);
        setErrorStep3(null);
        setSpaces([]);
        setSelectedSpace(null);
        try {
            const data = await fetchSpacesByWorkspace(selectedWorkspace._id);
            setSpaces(data);
        } catch (e: any) {
            setErrorStep3(e.message);
            toast.error("Failed to fetch spaces");
        } finally {
            setLoadingStep3(false);
        }
    };

    const handleAdd = async () => {
        if (!selectedTaskRoom || !selectedWorkspace || !selectedSpace) return;
        setSubmitting(true);
        try {
            await assignRoom({
                roomId: selectedTaskRoom._id,
                workspaceId: selectedWorkspace._id,
                spaceId: selectedSpace._id,
                userId: userId
            });
            setSubmitted(true);
            toast.success("Assigned successfully!");
        } catch (e: any) {
            toast.error(e.message || "Failed to assign");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setStep(1);

         setSelectedTaskRoom(null);
          setErrorStep1(null);
        setWorkspaces([]);
         setSelectedWorkspace(null); setErrorStep2(null);
        setSpaces([]);
         setSelectedSpace(null); setErrorStep3(null);
        setSubmitted(false);
    };

    if (!isOpen) return null;

    // ── Success Screen ────────────────────────────────────────────────────────

    if (submitted) {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12l4.5 4.5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <p className="font-semibold text-zinc-100 text-base">Assigned successfully</p>
                    <p className="text-xs text-zinc-500 mt-1">The space has been linked across all selections</p>
                    <div className="border-t border-zinc-800 mt-5 pt-4 space-y-1">
                        <SummaryRow
                            label="V1 Workspace"
                            value={selectedTaskRoom?.name || selectedTaskRoom?.title || selectedTaskRoom?._id || "—"}
                        />
                        <SummaryRow label="V2 Workspace" value={selectedWorkspace?.name || "—"} />
                        <SummaryRow label="Space" value={selectedSpace?.name || "—"} />
                    </div>
                    <button
                        onClick={handleReset}
                        className="mt-5 px-5 py-2 text-sm border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition"
                    >
                        Start over
                    </button>
                </div>
            </div>
        );
    }

    // ── Main Wizard ───────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md relative">
                <button onClick={onClose} className="absolute -top-12 right-0 text-zinc-400 hover:text-zinc-100 flex items-center gap-2 text-sm bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800 backdrop-blur-sm transition-all hover:bg-zinc-800">
                    <X className="w-4 h-4" />
                    <span>Close</span>
                </button>

                <div className="mb-6">
                    <h1 className="text-lg font-semibold text-zinc-100">Task Room Setup</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">Link a V1 task room to a V2 workspace space</p>
                </div>

                <Stepper current={step} />

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">

                    {/* ── Step 1 ──────────────────────────────────────────────────── */}
                    {step === 1 && (
                        <div>
                            <p className="text-sm font-semibold text-zinc-100 mb-0.5">Choose your V1 workspace</p>
                            <p className="text-xs text-zinc-500 mb-4">Select a task room to continue</p>

                            {errorStep1 && <ErrorMsg text={errorStep1} />}

                            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                                {loadingStep1 ? (
                                    <Loader text="Fetching task rooms…" />
                                ) : taskRooms.length === 0 ? (
                                    <Empty text="No task rooms found." />
                                ) : (
                                    taskRooms.map((r) => (
                                        <ItemRow
                                            key={r._id}
                                            label={r.name || r.title || r._id}
                                            sub={r.description}
                                            badge="V1"
                                            selected={selectedTaskRoom?._id === r._id}
                                            onClick={() => setSelectedTaskRoom(r)}
                                        />
                                    ))
                                )}
                            </div>

                            <div className="flex justify-end mt-5 pt-4 border-t border-zinc-800">
                                <button
                                    onClick={handleGoStep2}
                                    disabled={!selectedTaskRoom}
                                    className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-500/20"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2 ──────────────────────────────────────────────────── */}
                    {step === 2 && (
                        <div>
                            <p className="text-sm font-semibold text-zinc-100 mb-0.5">Choose V2 workspace</p>
                            <p className="text-xs text-zinc-500 mb-4">Select the workspace to link</p>

                            {errorStep2 && <ErrorMsg text={errorStep2} />}

                            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                                {loadingStep2 ? (
                                    <Loader text="Fetching workspaces…" />
                                ) : workspaces.length === 0 ? (
                                    <Empty text="No workspaces found." />
                                ) : (
                                    workspaces.map((w) => (
                                        <ItemRow
                                            key={w._id}
                                            label={w.name || w._id}
                                            sub={w.description}
                                            badge="V2"
                                            selected={selectedWorkspace?._id === w._id}
                                            onClick={() => setSelectedWorkspace(w)}
                                        />
                                    ))
                                )}
                            </div>

                            <div className="flex justify-between mt-5 pt-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleGoStep3}
                                    disabled={!selectedWorkspace}
                                    className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-500/20"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3 ──────────────────────────────────────────────────── */}
                    {step === 3 && (
                        <div>
                            <p className="text-sm font-semibold text-zinc-100 mb-0.5">Choose a space</p>
                            <p className="text-xs text-zinc-500 mb-4">
                                Select a space from{" "}
                                <span className="font-medium text-indigo-400">
                                    {selectedWorkspace?.name || "the workspace"}
                                </span>
                            </p>

                            {errorStep3 && <ErrorMsg text={errorStep3} />}

                            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                                {loadingStep3 ? (
                                    <Loader text="Fetching spaces…" />
                                ) : spaces.length === 0 ? (
                                    <Empty text="No spaces found in this workspace." />
                                ) : (
                                    spaces.map((sp) => (
                                        <ItemRow
                                            key={sp._id}
                                            label={sp.name || sp._id}
                                            sub={sp.description}
                                            selected={selectedSpace?._id === sp._id}
                                            onClick={() => setSelectedSpace(sp)}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Summary preview */}
                            {selectedSpace && (
                                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl mt-4 px-3 py-2 space-y-1">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-medium">Summary</p>
                                    <SummaryRow
                                        label="V1 Workspace"
                                        value={selectedTaskRoom?.name || selectedTaskRoom?.title || selectedTaskRoom?._id || "—"}
                                    />
                                    <SummaryRow label="V2 Workspace" value={selectedWorkspace?.name || "—"} />
                                    <SummaryRow label="Space" value={selectedSpace?.name || "—"} />
                                </div>
                            )}

                            <div className="flex justify-between mt-5 pt-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={!selectedSpace || submitting}
                                    className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-500/20 font-medium"
                                >
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                            Adding…
                                        </span>
                                    ) : (
                                        "Add ✓"
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
