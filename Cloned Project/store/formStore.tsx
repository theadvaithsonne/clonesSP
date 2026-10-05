import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";

// Types (based on your existing form types)
export interface FormElement {
  id: string;
  type: "text" | "email" | "textarea" | "select" | "radio" | "checkbox" | "file" | "date" | "number";
  label: string;
  required: boolean;
  width: "full" | "half" | "third";
  properties?: Record<string, any>;
}

export interface FormSettings {
  collectEmail: boolean;
  accessControl: "public" | "private" | "organization";
  submissionLimitPerUser: number;
  allowAnonymous?: boolean;
  requireLogin?: boolean;
  customTheme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
}

export interface Form {
  id: string;
  title: string;
  description: string;
  elements: FormElement[];
  settings: FormSettings;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
  isPublished?: boolean;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  submittedAt: string;
  submitterEmail?: string;
  submitterName?: string;
}

export interface FormState {
  // Data
  forms: Form[];
  currentForm: Form | null;
  submissions: FormSubmission[];
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  selectedElementId: string | null;
  isPreviewMode: boolean;
  isPanelCollapsed: boolean;
  
  // Modal states
  shareDialogOpen: boolean;
  settingsDialogOpen: boolean;
  
  // Actions - Form Management
  setForms: (forms: Form[]) => void;
  setCurrentForm: (form: Form | null) => void;
  addForm: (form: Form) => void;
  updateForm: (id: string, form: Partial<Form>) => void;
  deleteForm: (id: string) => void;
  duplicateForm: (id: string) => void;
  
  // Actions - Form Elements
  addElement: (element: FormElement) => void;
  updateElement: (id: string, element: Partial<FormElement>) => void;
  deleteElement: (id: string) => void;
  moveElement: (dragIndex: number, hoverIndex: number) => void;
  setSelectedElement: (id: string | null) => void;
  
  // Actions - Form Settings
  updateFormTitle: (title: string) => void;
  updateFormDescription: (description: string) => void;
  updateFormSettings: (settings: Partial<FormSettings>) => void;
  
  // Actions - UI State
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setPreviewMode: (preview: boolean) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  setShareDialogOpen: (open: boolean) => void;
  setSettingsDialogOpen: (open: boolean) => void;
  clearError: () => void;
  
  // Actions - API Calls
  fetchForms: () => Promise<void>;
  fetchForm: (id: string) => Promise<void>;
  saveForm: () => Promise<boolean>;
  publishForm: (id: string) => Promise<boolean>;
  unpublishForm: (id: string) => Promise<boolean>;
  fetchSubmissions: (formId: string) => Promise<void>;
  
  // Helper methods
  getElementByIndex: (index: number) => FormElement | undefined;
  getElementIndex: (id: string) => number;
  canMoveElement: (fromIndex: number, toIndex: number) => boolean;
  getFormUrl: (id: string) => string;
  getEmbedCode: (id: string) => string;
}

export const useFormStore = create<FormState>()(
  persist(
    (set, get) => ({
      // Initial state
      forms: [],
      currentForm: null,
      submissions: [],
      isLoading: false,
      isSaving: false,
      error: null,
      selectedElementId: null,
      isPreviewMode: false,
      isPanelCollapsed: false,
      shareDialogOpen: false,
      settingsDialogOpen: false,

      // Form Management Actions
      setForms: (forms) => set({ forms }),
      
      setCurrentForm: (form) => set({ 
        currentForm: form,
        selectedElementId: null,
        isPreviewMode: false,
      }),
      
      addForm: (form) => set((state) => ({
        forms: [...state.forms, form]
      })),
      
      updateForm: (id, formData) => set((state) => ({
        forms: state.forms.map(form => 
          form.id === id ? { ...form, ...formData } : form
        ),
        currentForm: state.currentForm?.id === id 
          ? { ...state.currentForm, ...formData }
          : state.currentForm
      })),
      
      deleteForm: (id) => set((state) => ({
        forms: state.forms.filter(form => form.id !== id),
        currentForm: state.currentForm?.id === id ? null : state.currentForm
      })),
      
      duplicateForm: (id) => {
        const form = get().forms.find(f => f.id === id);
        if (form) {
          const duplicatedForm: Form = {
            ...form,
            id: Math.random().toString(36).substr(2, 9),
            title: `${form.title} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            submissionCount: 0,
            isPublished: false,
          };
          get().addForm(duplicatedForm);
        }
      },

      // Form Elements Actions
      addElement: (element) => {
        const currentForm = get().currentForm;
        if (currentForm) {
          const updatedForm = {
            ...currentForm,
            elements: [...currentForm.elements, element],
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
          get().setSelectedElement(element.id);
        }
      },
      
      updateElement: (id, elementData) => {
        const currentForm = get().currentForm;
        if (currentForm) {
          const updatedForm = {
            ...currentForm,
            elements: currentForm.elements.map(element => 
              element.id === id ? { ...element, ...elementData } : element
            ),
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
        }
      },
      
      deleteElement: (id) => {
        const currentForm = get().currentForm;
        if (currentForm) {
          const updatedForm = {
            ...currentForm,
            elements: currentForm.elements.filter(element => element.id !== id),
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
          
          // Clear selection if deleted element was selected
          if (get().selectedElementId === id) {
            get().setSelectedElement(null);
          }
        }
      },
      
      moveElement: (dragIndex, hoverIndex) => {
        const currentForm = get().currentForm;
        if (currentForm && get().canMoveElement(dragIndex, hoverIndex)) {
          const elements = [...currentForm.elements];
          const dragElement = elements[dragIndex];
          
          elements.splice(dragIndex, 1);
          elements.splice(hoverIndex, 0, dragElement);
          
          const updatedForm = {
            ...currentForm,
            elements,
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
        }
      },
      
      setSelectedElement: (id) => set({ selectedElementId: id }),

      // Form Settings Actions
      updateFormTitle: (title) => {
        const currentForm = get().currentForm;
        if (currentForm) {
          const updatedForm = {
            ...currentForm,
            title,
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
        }
      },
      
      updateFormDescription: (description) => {
        const currentForm = get().currentForm;
        if (currentForm) {
          const updatedForm = {
            ...currentForm,
            description,
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
        }
      },
      
      updateFormSettings: (settings) => {
        const currentForm = get().currentForm;
        if (currentForm) {
          const updatedForm = {
            ...currentForm,
            settings: { ...currentForm.settings, ...settings },
            updatedAt: new Date().toISOString(),
          };
          get().setCurrentForm(updatedForm);
        }
      },

      // UI State Actions
      setLoading: (loading) => set({ isLoading: loading }),
      setSaving: (saving) => set({ isSaving: saving }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      setPreviewMode: (preview) => set({ isPreviewMode: preview }),
      setPanelCollapsed: (collapsed) => set({ isPanelCollapsed: collapsed }),
      setShareDialogOpen: (open) => set({ shareDialogOpen: open }),
      setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),

      // API Actions
      fetchForms: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authenticatedFetch(buildExternalUrl("forms"));
          if (!response.ok) {
            throw new Error('Failed to fetch forms');
          }
          
          const forms = await response.json();
          set({ forms, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch forms';
          set({ error: errorMessage, isLoading: false });
        }
      },

      fetchForm: async (id: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authenticatedFetch(buildExternalUrl(`forms/${id}`));
          if (!response.ok) {
            throw new Error('Failed to fetch form');
          }
          
          const form = await response.json();
          set({ currentForm: form, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch form';
          set({ error: errorMessage, isLoading: false });
        }
      },

      saveForm: async () => {
        const currentForm = get().currentForm;
        if (!currentForm) return false;
        
        set({ isSaving: true, error: null });
        
        try {
          const url = currentForm.id 
            ? buildExternalUrl(`forms/${currentForm.id}`)
            : buildExternalUrl("forms");
          
          const method = currentForm.id ? "PUT" : "POST";
          
          const response = await authenticatedFetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(currentForm),
          });

          if (!response.ok) {
            throw new Error('Failed to save form');
          }

          const savedForm = await response.json();
          
          // Update current form and forms list
          get().setCurrentForm(savedForm);
          
          if (currentForm.id) {
            get().updateForm(currentForm.id, savedForm);
          } else {
            get().addForm(savedForm);
          }
          
          set({ isSaving: false });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save form';
          set({ error: errorMessage, isSaving: false });
          return false;
        }
      },

      publishForm: async (id: string) => {
        try {
          const response = await authenticatedFetch(buildExternalUrl(`forms/${id}/publish`), {
            method: "POST",
          });

          if (!response.ok) {
            throw new Error('Failed to publish form');
          }

          get().updateForm(id, { isPublished: true });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to publish form';
          set({ error: errorMessage });
          return false;
        }
      },

      unpublishForm: async (id: string) => {
        try {
          const response = await authenticatedFetch(buildExternalUrl(`forms/${id}/unpublish`), {
            method: "POST",
          });

          if (!response.ok) {
            throw new Error('Failed to unpublish form');
          }

          get().updateForm(id, { isPublished: false });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to unpublish form';
          set({ error: errorMessage });
          return false;
        }
      },

      fetchSubmissions: async (formId: string) => {
        try {
          const response = await authenticatedFetch(buildExternalUrl(`forms/${formId}/submissions`));
          if (!response.ok) {
            throw new Error('Failed to fetch submissions');
          }
          
          const submissions = await response.json();
          set({ submissions });
        } catch (error) {
          console.error('Error fetching submissions:', error);
        }
      },

      // Helper methods
      getElementByIndex: (index: number) => {
        const currentForm = get().currentForm;
        return currentForm?.elements[index];
      },

      getElementIndex: (id: string) => {
        const currentForm = get().currentForm;
        return currentForm?.elements.findIndex(element => element.id === id) ?? -1;
      },

      canMoveElement: (fromIndex: number, toIndex: number) => {
        const currentForm = get().currentForm;
        if (!currentForm) return false;
        
        const maxIndex = currentForm.elements.length - 1;
        return fromIndex >= 0 && fromIndex <= maxIndex && 
               toIndex >= 0 && toIndex <= maxIndex &&
               fromIndex !== toIndex;
      },

      getFormUrl: (id: string) => {
        return `${window.location.origin}/view/form/${id}`;
      },

      getEmbedCode: (id: string) => {
        const url = get().getFormUrl(id);
        return `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
      },
    }),
    {
      name: "form-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist forms data, not UI state
      partialize: (state) => ({ 
        forms: state.forms,
      }),
    }
  )
);

// Selectors for better performance
export const useForms = () => useFormStore((state) => state.forms);
export const useCurrentForm = () => useFormStore((state) => state.currentForm);
export const useSelectedElement = () => useFormStore((state) => {
  const { currentForm, selectedElementId } = state;
  return currentForm?.elements.find(element => element.id === selectedElementId) || null;
});
export const useFormLoading = () => useFormStore((state) => state.isLoading);
export const useFormSaving = () => useFormStore((state) => state.isSaving);
export const useFormError = () => useFormStore((state) => state.error);
