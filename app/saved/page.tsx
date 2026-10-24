import { SavedKitsView } from "@/components/editor/SavedKitsView";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <SavedKitsView username={session.username} tier={session.tier} premium={session.premium} />;
}
