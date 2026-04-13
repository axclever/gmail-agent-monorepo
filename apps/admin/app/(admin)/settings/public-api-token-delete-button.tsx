"use client";

import { Button } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePublicApiToken } from "./actions";

export function PublicApiTokenDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete token "${name}"?`)) return;
    setPending(true);
    try {
      await deletePublicApiToken(id);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete token.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="1" variant="soft" color="red" onClick={onDelete} disabled={pending}>
      {pending ? "Deleting..." : "Delete"}
    </Button>
  );
}
