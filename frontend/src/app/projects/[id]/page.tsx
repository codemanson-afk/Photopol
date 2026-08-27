import { redirect } from "next/navigation";

export default async function ProjectIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workspace?project=${id}`);
}
