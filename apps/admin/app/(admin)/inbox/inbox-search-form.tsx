"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Flex, IconButton, TextField } from "@radix-ui/themes";

export function InboxSearchForm({ defaultQuery }: { defaultQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  useEffect(() => {
    setQ(defaultQuery);
  }, [defaultQuery]);

  const clear = useCallback(() => {
    setQ("");
    router.push("/inbox");
  }, [router]);

  const showClear = q.trim().length > 0;

  return (
    <form
      action="/inbox"
      method="get"
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Flex gap="2" align="center" wrap="wrap" justify="end">
        <TextField.Root
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email or subject…"
          size="2"
          style={{ width: 320, maxWidth: "100%", minWidth: 200 }}
        >
          {showClear ? (
            <TextField.Slot side="right">
              <IconButton
                type="button"
                size="1"
                variant="ghost"
                color="gray"
                aria-label="Clear search"
                onClick={clear}
              >
                <X size={14} strokeWidth={2} />
              </IconButton>
            </TextField.Slot>
          ) : null}
        </TextField.Root>
        <Button type="submit" size="2">
          Search
        </Button>
      </Flex>
    </form>
  );
}
