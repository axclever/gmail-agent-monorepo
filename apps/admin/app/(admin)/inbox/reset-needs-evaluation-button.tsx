"use client";

import { Button } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleThreadNeedsEvaluation } from "./actions";

export function ResetNeedsEvaluationButton({
  threadId,
  currentValue,
}: {
  threadId: string;
  currentValue: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onReset() {
    setPending(true);
    try {
      await toggleThreadNeedsEvaluation(threadId, currentValue);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to toggle needsEvaluation.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="1" variant="ghost" color="gray" onClick={onReset} disabled={pending}>
      {pending ? "..." : String(currentValue)}
    </Button>
  );
}
