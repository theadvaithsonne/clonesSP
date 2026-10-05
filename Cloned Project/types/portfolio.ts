export interface Portfolio {
    _id?: string;
    title: string;
    role?: string;
    description: string;
    skills: string[];
    images: string[];
    documents: string[];
    audioFiles: string[];
    videoUrl?: string;
    createdAt?: Date;
    updatedAt?: Date;
    userId: string;
} 