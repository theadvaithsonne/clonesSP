// Document-related TypeScript interfaces

export interface Document {
  id: string;
  programId: string;
  subfolder: string;
  organizationId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface DocumentMetadata {
  programId: string;
  subfolder: string;
  organizationId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

export interface DocumentResponse {
  status: boolean;
  data?: Document;
  message?: string;
}

export interface DocumentListResponse {
  status: boolean;
  data?: Document[];
  count?: number;
  message?: string;
}

export interface SubFolder {
  name: string;
  icon: string;
}

// File type mapping for consistent file type detection
export const FILE_TYPE_MAP: Record<string, string> = {
  'pdf': 'PDF',
  'doc': 'Docx',
  'docx': 'Docx',
  'xls': 'Excel',
  'xlsx': 'Excel',
  'ppt': 'PowerPoint',
  'pptx': 'PowerPoint',
  'txt': 'Text',
  'jpg': 'Image',
  'jpeg': 'Image',
  'png': 'Image',
  'gif': 'Image',
};

// Helper function to get file type from filename
export const getFileTypeFromName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return FILE_TYPE_MAP[extension || ''] || 'File';
};
