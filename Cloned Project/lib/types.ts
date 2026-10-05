export type Role = "admin" | "user";
export type Member = {
  id?: string;
  name?: string;
  email: string;
  role: Role;
  createdAt?: string;
};
