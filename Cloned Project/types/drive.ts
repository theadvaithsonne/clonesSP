import { ObjectId } from "mongodb";

export interface DriveItem {
  _id?: ObjectId;
  id: string;
  userId: string;
  name: string;
  type: "file" | "folder";
  mimeType?: string;
  size?: number;
  parentId?: string | null;
  path: string[];
  url?: string;
  createdAt: Date;
  updatedAt: Date;
  isStarred?: boolean;
  isShared?: boolean;
  sharedWith?: string[];
  lastModifiedBy?: string;
}

export interface DriveFolder extends DriveItem {
  type: "folder";
  itemCount?: number;
}

export interface DriveFile extends DriveItem {
  type: "file";
  fileKey: string;
  thumbnailUrl?: string;
} 