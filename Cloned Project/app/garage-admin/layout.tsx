import { AdminSearchProvider } from "@/components/garage-admin/admin-search";

export default function GarageAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSearchProvider>
      <div>{children}</div>
    </AdminSearchProvider>
  );
}
