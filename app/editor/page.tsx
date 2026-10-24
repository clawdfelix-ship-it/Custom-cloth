import { KitEditor } from "@/components/editor/KitEditor";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function EditorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <KitEditor tier={session.tier} premium={session.premium} username={session.username} />
  );
}
