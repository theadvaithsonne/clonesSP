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
//comment
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
