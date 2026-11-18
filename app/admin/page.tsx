import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { AdminAccess } from "@/features/admin/admin-access";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Croebet",
  description: null,
  robots: { index: false, follow: false },
};
export default function Admin() {
  // Fail closed on the server until a verified backend session is available.
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PageShell>
      <AdminAccess />
    </PageShell>
  );
}
