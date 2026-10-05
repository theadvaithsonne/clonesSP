type FlexibleAssignments = Record<string, unknown>;

export interface ProjectData {
  _id?: string;
  title?: string;
  attributes?: string[];
  tags?: string[];
  pricingtiers?: PricingTier[];
  images?: string[];
  documents?: string[];
  video?: string;
  requirements?: Requirement[];
  summary?: string;
  steps?: ProjectStep[];
  faqs?: FAQ[];
  status?: "draft" | "published" | "archived";
  createdAt?: Date;
  updatedAt?: Date;
  email?: string;
  description?: string;
  category?: string;
  price?: number;
  packages?: ServicePackage[];
  pipelineId?: string;
  workspaceId?: string;
  assignedToUserId?: string;
  subJobs?: FlexibleAssignments;
  appCode?: string,
  isPipelineRequired?: boolean,
  userId?: string,
  vendorDetails?: {
    vendorId?: string
  }
}

export interface PricingTier {
  name: string;
  title: string;
  description: string;
  deliveryDays: number;
  revisions: string;
  options: string[];
  price: string;
}

export interface Requirement {
  id: string;
  type: "freeText" | "multipleChoice" | "fileAttachment";
  question: string;
  isMandatory: boolean;
  options?: string[];
}

export interface ProjectStep {
  id: string;
  title: string;
  description: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface ComponentProps {
  data: ProjectData;
  updateData: (newData: Partial<ProjectData>) => void;
}

export interface AccountantProfile {
  _id: string;
  name: string;
  lastname: string;
  accountantType: string;
  yearsOfExperience: string;
  availabilityStatus: string;
  profilepicture: string;
  title: string;
  specialities: string[];
  skills: string[];
  bio: string;
  coverPhoto: string;
  experience: {
    experienceid: string;
    title: string;
    company: string;
    location: string;
    country: string;
    startdate: string;
    enddate: string;
    description: string;
  }[];
  education: {
    educationid: string;
    school: string;
    degree: string;
    fieldofstudy: string;
    startyear: string;
    endyear: string;
    description: string;
  }[];
  languages: {
    language: string;
    credential: string;
  }[];
  countriesserved: {
    country: string;
    credential: string;
  }[];
  currency: string;
  hourlyratebeforefee: string;
  servicefee: string;
  hourlyrateafterfee: string;
  country: string;
  city: string;
  email: string;
  PortfolioDetails: {
    _id: string;
    projectTitle: string;
    thumbnail: string;
    description: string;
    skills: string[];
    content: Array<{
      image?: string;
      name?: string;
      description?: string;
      video?: string;
    }>;
  }[];
}


export type Skill = {
  name: string;
  selected?: boolean;
};

export type ProjectSize = "large" | "medium" | "small";
export type Duration = "more-than-6" | "3-to-6" | "1-to-3" | "custom";
export type ExperienceLevel = "entry" | "intermediate" | "expert";
export type ContractType = "convertible" | "fixed";
export type PricingType = "hourly" | "fixed";
export type EnglishLevel = "any" | "conversational" | "fluent" | "native";
export type HoursPerWeek = "more-than-30" | "less-than-30" | "not-sure";
export type HireDate = "1-3-days" | "one-week" | "two-week" | "one-month";
export type ProfessionalsNeeded = "one" | "multiple";

export interface AssignmentFormData {
  title: string;
  skills: Skill[];
  projectSize?: ProjectSize;
  duration?: Duration;
  experienceLevel?: ExperienceLevel;
  contractType?: ContractType;
  pricingType?: PricingType;
  price?: number;
  currency?: string;
  description?: string;
  attachments?: File[];
  screeningQuestions: string[];
  englishLevel?: EnglishLevel;
  hoursPerWeek?: HoursPerWeek;
  hireDate?: HireDate;
  professionalsNeeded?: ProfessionalsNeeded;
  talentType?: string;
  location?: string;
}

export interface ServicePackage {
  name: string;
  type: string;
  description: string;
  price: number;
  deliveryTime: number;
  revisions: string;
  features?: string[];
}
