"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { DropdownMenu, IconButton } from "@radix-ui/themes";

export function UserMenu() {
  const router = useRouter();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton variant="ghost" color="gray" radius="full" aria-label="User menu">
          <MoreHorizontal size={16} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item onSelect={() => router.push("/mailbox")}>Mailbox</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => router.push("/integrations")}>
          Integrations
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => router.push("/settings")}>Settings</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item color="red" onSelect={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

