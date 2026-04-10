"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, ListChecks, Plug, SlidersHorizontal, Users } from "lucide-react";
import { Box, Button, Flex } from "@radix-ui/themes";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox / Threads", Icon: Inbox },
  { href: "/people", label: "People", Icon: Users },
  { href: "/rules", label: "Rules", Icon: SlidersHorizontal },
  { href: "/actions", label: "Actions", Icon: ListChecks },
  { href: "/integrations", label: "Integrations", Icon: Plug },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <Flex direction="column" gap="2">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive = pathname === href;
        return (
          <Button
            key={href}
            asChild
            variant={isActive ? "solid" : "soft"}
            color={isActive ? "indigo" : "gray"}
            highContrast={isActive}
            radius="large"
            size="3"
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            <Link href={href} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Box asChild style={{ display: "grid", placeItems: "center" }}>
                <Icon size={16} />
              </Box>
              {label}
            </Link>
          </Button>
        );
      })}
    </Flex>
  );
}

