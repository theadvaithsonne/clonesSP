import { create } from 'zustand';
import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';

export interface Stage {
    name: string;
    color: string;
    stageType: 'tostart' | 'active' | 'done' | 'closed';
    orderId: number;
}

export interface StageTemplate {
    _id?: string;
    name: string;
    color: string;
    stagelist: Stage[];
    type: 'inherit' | 'custom';
    userId?: string;
}



interface TemplateState {
    isOpenTempate: boolean;
    selectedTemplate: string;
    template: StageTemplate;
    currentRoom: { id: string; name: string } | null;
    pendingRoomCreationData: { data: any, workspaceId: string } | null;
    isLoading: boolean;

    setIsOpenTempate: (isOpen: boolean) => void;
    setSelectedTemplate: (templateId: string) => void;
    setTemplate: (template: StageTemplate) => void;
    setCurrentRoom: (room: { id: string; name: string } | null) => void;
    setPendingRoomCreationData: (payload: { data: any, workspaceId: string } | null) => void;

    templates: StageTemplate[];
    setTemplates: (templates: StageTemplate[]) => void;
    fetchTemplates: () => Promise<void>;
    addStageTemplate: () => Promise<void>;
    setNewTemplate: () => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
    isOpenTempate: false,
    selectedTemplate: 'custom',
    template: {
        name: 'New Template',
        color: '#3b82f6',
        stagelist: [],
        type: 'custom'
    },
    currentRoom: null,
    pendingRoomCreationData: null,
    templates: [],
    isLoading: false,

    setIsOpenTempate: (isOpen) => set({ isOpenTempate: isOpen }),
    setSelectedTemplate: (selected) => {
        if (selected === 'add-new') return;

        const foundTemplate = get().templates.find(t => t._id === selected);
        if (foundTemplate) {
            set({
                selectedTemplate: selected,
                template: foundTemplate
            });
        } else {
            set({ selectedTemplate: selected });
        }
    },
    setTemplate: (template) => set({ template }),
    setCurrentRoom: (currentRoom) => set({ currentRoom }),
    setPendingRoomCreationData: (payload) => set({ pendingRoomCreationData: payload }),
    setTemplates: (templates) => set({ templates }),

    fetchTemplates: async () => {
        set({ isLoading: true });
        try {
            const token = localStorage.getItem("garage_tok")
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}Template/stages`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                set({ templates: response.data?.data || [] });
            } else {
                toast.error(response.data?.message || "Failed to fetch stage templates");
            }
        } catch (error: any) {
            console.error("Failed to fetch stage templates:", error);
            toast.error(error.response?.data?.message || 'Failed to fetch stage templates');
        } finally {
            set({ isLoading: false });
        }
    },

    addStageTemplate: async () => {
        const { template } = get();
        set({ isLoading: true });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}Template/stages`,
                {
                    name: template.name,
                    color: template.color,
                    stagelist: template.stagelist,
                    type: template.type,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data?.status || response.data?.success) {
                const newTemp = response.data?.data?.data || response.data?.data;
                if (newTemp?._id) {
                    set((state) => ({
                        templates: state.templates.some((t) => t._id === newTemp._id)
                            ? state.templates
                            : [...state.templates, newTemp],
                        selectedTemplate: newTemp._id,
                        template: newTemp,
                    }));
                }
                toast.success("Stage template saved");
            } else {
                toast.error(response.data?.message || "Failed to add stage template");
            }
        } catch (error: any) {
            console.error("Failed to add stage template:", error);
            toast.error(error.response?.data?.message || 'Failed to add stage template');
        } finally {
            set({ isLoading: false });
        }
    },
    setNewTemplate: () => {
        set({
            selectedTemplate: 'custom', // Defaulting to custom for a new one
            template: {
                name: 'New Template',
                color: '#3b82f6',
                stagelist: [],
                type: 'custom'
            }
        });
    },
}));
