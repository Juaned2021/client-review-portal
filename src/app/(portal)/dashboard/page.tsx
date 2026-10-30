import type { Metadata } from "next";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="text-zinc-500">Your projects will appear here.</p>
    </div>
  );
}
