import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { AdminPanel } from "@/features/admin/admin-panel";

export const metadata: Metadata = {
  title: "Admin | Croebet",
  robots: { index: false, follow: false },
};
export default function Admin() {
  return (
    <PageShell>
      <AdminPanel />
    </PageShell>
  );
}
