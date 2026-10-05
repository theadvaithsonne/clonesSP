export type FormFieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "email"
  | "phone"
  | "file";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select, radio, checkbox
  defaultValue?: string | string[] | boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface FormSettings {
  collectEmail: boolean;
  accessControl: "public" | "private" | "password";
  password?: string;
  submissionLimitPerUser: number;
}

export interface Form {
  _id?: string;
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  settings: FormSettings;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  submittedBy?: string;
  submittedAt: Date;
}

export interface DragItem {
  type: string;
  id: string;
  fieldType: FormFieldType;
  index?: number;
}
