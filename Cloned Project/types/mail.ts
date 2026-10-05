export interface Mail {
  id: string;
  name: string;
  email: string;
  subject: string;
  text: string;
  date: string | Date;
  read: boolean;
  labels?: string[];
}
