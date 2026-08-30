import type { User as SupabaseUser } from "@supabase/supabase-js";

import prisma from "@/lib/prisma";

type SyncableSupabaseUser = Pick<SupabaseUser, "id" | "email" | "user_metadata">;

export async function syncSupabaseUser(user: SyncableSupabaseUser) {
  if (!user.email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
  const name =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;
  const image = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null;

  return prisma.user.upsert({
    where: {
      id: user.id,
    },
    create: {
      id: user.id,
      email: user.email,
      name,
      image,
    },
    update: {
      email: user.email,
      name,
      image,
    },
  });
}
