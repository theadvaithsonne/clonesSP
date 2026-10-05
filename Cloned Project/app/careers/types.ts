export interface Vacancy {
  _id: string;
  orgId: string;
  title: string;
  department: string;
  location: string;
  employmentType: "full-time" | "part-time" | "contract" | "internship";
  description: string;
  requirements?: string;
  salary?: string;
  status: "open" | "closed" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  _id: string;
  vacancyId: string;
  vacancyTitle: string;
  orgId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  resumeUrl?: string;
  coverLetter?: string;
  status: "pending" | "reviewed" | "shortlisted" | "rejected" | "hired";
  createdAt: string;
}
