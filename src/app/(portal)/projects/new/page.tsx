import type { Metadata } from "next";
import Link from "next/link";
import { listClientsForAdmin } from "@/server/queries/projects";
import { requireAdmin } from "@/server/session";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireAdmin();
  const clients = await listClientsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/projects" className="text-sm text-zinc-500 hover:underline">
          ← Projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New project</h1>
      </div>
      <ProjectForm clients={clients} />
    </div>
  );
}
