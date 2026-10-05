import { ObjectId } from "mongodb";

export interface Organization {
  _id?: ObjectId;
  id: string;
  name: string;
  size?: string;
  industry?: string;
  website?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  _id?: ObjectId;
  userId: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  _id?: ObjectId;
  userId: string;
  organizationId: string; // Add organization ID field
  companyId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  convertedToClient?: boolean;
  convertedAt?: Date;
  convertedEmployeeId?: string;
}

export interface Product {
  _id?: ObjectId;
  userId: string; // The admin who created the product
  organizationId: string; // The organization/company ID this product belongs to
  name: string;
  description?: string;
  price?: number;
  sku?: string;
  category?: string;
  commissionPercentage?: number;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // The admin who created the product
}

export type ActivityStatus = "open" | "closed";
export type ActivityType = "task" | "event" | "call";

interface BaseActivity {
  _id?: ObjectId;
  userId: string;
  title: string;
  description?: string;
  status: ActivityStatus;
  entityType: "company" | "contact" | "deal" | "product";
  entityId: string;
  entityName: string;
  createdAt: Date;
  updatedAt: Date;
  type: ActivityType;
}

export interface Task extends BaseActivity {
  type: "task";
  dueDate: string;
  priority: "low" | "medium" | "high";
}

export interface Event extends BaseActivity {
  type: "event";
  startDate: string;
  endDate: string;
  location?: string;
  isOnlineMeeting: boolean;
  participants: string[];
}

export interface Call extends BaseActivity {
  type: "call";
  date: string;
  duration?: number;
  outcome?: string;
  callType: "outbound" | "inbound";
  purpose?: string;
  agenda?: string;
}

export type Activity = Task | Event | Call;

export interface ActivityLog {
  _id?: ObjectId;
  userId: string;
  type: "create" | "update" | "delete" | "view";
  entityType: "company" | "contact" | "deal" | "product";
  entityId: string;
  entityName: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// API Response Types
export interface ContactApiResponse {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  userId?: string;
  organizationId?: string;
  companyId?: string;
  jobTitle?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  convertedToClient?: boolean;
  convertedAt?: string;
  convertedEmployeeId?: string;
}

export interface FunnelProduct {
  name: string;
  type: "product" | "status";
}

export interface FunnelApiResponse {
  id?: string;
  _id?: string;
  funnelId?: string;
  funnelName?: string;
  name?: string;
  funnelDesc?: string;
  funnelDescription?: string;
  description?: string;
  products?: FunnelProduct[];
  funnelStage?: FunnelProduct[];
  numberOfStages?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FunnelsApiResponse {
  funnels: FunnelApiResponse[];
  total?: number;
  pagination?: {
    total: number;
  };
}
