import { AccountView } from "@/components/editor/AccountView";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <AccountView
      username={session.username}
      email={session.email}
      tier={session.tier}
      premium={session.premium}
    />
  );
}
