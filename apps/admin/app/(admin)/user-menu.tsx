"use client";

import { MoreHorizontal } from "lucide-react";
import { signOut } from "next-auth/react";
import { DropdownMenu, Flex, IconButton } from "@radix-ui/themes";

export function UserMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton variant="ghost" color="gray" radius="full" aria-label="User menu">
          <MoreHorizontal size={16} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item color="red" onSelect={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

