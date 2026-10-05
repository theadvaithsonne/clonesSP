import { useUploadThing, uploadFiles } from "../lib/uploadthing";
import { toast } from "sonner";

// Re-export backend S3-backed helpers
export { useUploadThing, uploadFiles };

// Decorative components to prevent import errors in legacy files
export const UploadButton = () => null;
export const UploadDropzone = () => null;

// Common file validation utilities
export const validateFile = (file: File, options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}) => {
  const { maxSize = 16 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options;
  
  // Check file size
  if (file.size === 0) {
    toast.error(`File "${file.name}" is empty and cannot be uploaded`);
    return false;
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    toast.error(`File "${file.name}" is too large (max ${maxSizeMB}MB)`);
    return false;
  }
  
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.some(type => file.type.startsWith(type))) {
    toast.error(`File "${file.name}" has an unsupported file type`);
    return false;
  }
  
  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.toLowerCase().split('.').pop();
    if (!extension || !allowedExtensions.includes(`.${extension}`)) {
      toast.error(`File "${file.name}" has an unsupported file extension`);
      return false;
    }
  }
  
  return true;
};

// Common upload configuration
export const uploadConfig = {
  image: {
    maxSize: 8 * 1024 * 1024, // 8MB
    allowedTypes: ['image/'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    endpoint: 'imageUploader'
  },
  document: {
    maxSize: 16 * 1024 * 1024, // 16MB
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
    endpoint: 'documentUploader'
  },
  drive: {
    maxSize: 32 * 1024 * 1024, // 32MB
    allowedTypes: ['image/', 'application/', 'text/'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
    endpoint: 'driveUploader'
  },
  portfolio: {
    maxSize: 16 * 1024 * 1024, // 16MB
    allowedTypes: ['image/', 'application/pdf', 'audio/'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp3', '.wav'],
    endpoint: 'portfolioImage' // or portfolioDocument, portfolioAudio
  }
};