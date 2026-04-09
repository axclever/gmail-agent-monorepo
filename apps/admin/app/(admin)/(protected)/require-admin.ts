import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  const role = (session.user as { role?: string }).role;

  if (role !== "ADMIN") {
    redirect("/");
  }

  return session;
}

