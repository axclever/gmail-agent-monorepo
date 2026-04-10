"use client";

import { Button } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteIntegration } from "./actions";

export function IntegrationDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!confirm(`Delete integration “${name}”? This cannot be undone.`)) return;
    setPending(true);
    try {
      await deleteIntegration(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="soft" color="red" size="1" onClick={onClick} disabled={pending}>
      {pending ? "…" : "Delete"}
    </Button>
  );
}
