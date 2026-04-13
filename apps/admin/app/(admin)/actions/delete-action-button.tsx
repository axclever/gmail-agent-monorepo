"use client";

import { Button } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAction } from "./actions";

export function DeleteActionButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    const ok = window.confirm("Delete this action?");
    if (!ok) return;

    setPending(true);
    try {
      await deleteAction(actionId);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to delete action.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="1" variant="soft" color="red" disabled={pending} onClick={onDelete}>
      {pending ? "..." : "Delete"}
    </Button>
  );
}
