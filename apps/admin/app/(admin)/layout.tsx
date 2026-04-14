import { prisma } from "@gmail-agent/db";
import { Box, Button, Flex, Separator, Text } from "@radix-ui/themes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

function formatRefreshTokenTimeLeft(expiresAt: Date | null | undefined): {
  label: string;
  color: "red" | "gray";
} {
  if (!expiresAt) return { label: "—", color: "gray" };
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return { label: "Expired", color: "red" };
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(ms / dayMs);
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (days >= 1) {
    return { label: `${days} day${days === 1 ? "" : "s"} left`, color: "gray" };
  }
  if (hours >= 1) {
    return { label: `${hours} hour${hours === 1 ? "" : "s"} left`, color: "gray" };
  }
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
  return { label: `${mins} min${mins === 1 ? "" : "s"} left`, color: "gray" };
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const connectedMailbox = user?.id
    ? await prisma.gmailMailbox.findFirst({
        where: { userId: user.id, provider: "GMAIL" },
        orderBy: { updatedAt: "desc" },
        select: { email: true, status: true, tokenExpiresAt: true },
      })
    : null;

  const mailboxTimeLeft = connectedMailbox
    ? formatRefreshTokenTimeLeft(connectedMailbox.tokenExpiresAt)
    : null;

  const fullName = user?.name?.trim() ?? "";
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0] ?? ""}${nameParts[1][0] ?? ""}`.toUpperCase()
      : (fullName.slice(0, 2) || user?.email?.slice(0, 2) || "U").toUpperCase();

  return (
    <Flex
      style={{
        height: "100dvh",
        minHeight: "100dvh",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          width: 264,
          flexShrink: 0,
          minHeight: 0,
          overflowY: "auto",
          borderRight: "1px solid var(--gray-6)",
          padding: "1.25rem 1rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box style={{ marginBottom: "1.25rem" }}>
          <Flex align="center" gap="2">
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: 9999,
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--gray-6)",
                color: "var(--gray-12)",
                fontWeight: 700,
                lineHeight: 1,
                fontSize: 14,
              }}
              aria-hidden
            >
              @
            </Box>
            <Box style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.1 }}>
              Gmail agent
            </Box>
          </Flex>
        </Box>
        {connectedMailbox ? (
          <Box
            style={{
              width: "100%",
              marginBottom: "0.75rem",
              border: "1px solid var(--gray-6)",
              borderRadius: "var(--radius-3)",
              padding: "0.625rem 0.75rem",
              background: "var(--gray-3)",
            }}
          >
            <Text size="1" color="gray">
              Connected Gmail account
            </Text>
            <Text
              size="2"
              weight="medium"
              style={{
                display: "block",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {connectedMailbox.email}
            </Text>
            <Flex
              justify="between"
              align="center"
              gap="2"
              style={{ marginTop: 8, minWidth: 0 }}
            >
              <Text
                size="1"
                weight="medium"
                color={mailboxTimeLeft!.color}
                style={{ lineHeight: 1.35, minWidth: 0, flex: 1 }}
              >
                {mailboxTimeLeft!.label}
              </Text>
              <Button asChild size="1" variant="soft" color="gray" style={{ flexShrink: 0 }}>
                <a href="/api/gmail/connect">Refresh</a>
              </Button>
            </Flex>
          </Box>
        ) : (
          <Button
            asChild
            variant="soft"
            color="gray"
            radius="large"
            size="3"
            style={{
              width: "100%",
              justifyContent: "center",
              marginBottom: "0.75rem",
              border: "1px solid var(--gray-6)",
            }}
          >
            <a
              href="/api/gmail/connect"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3.25 6.5v10.75h3.25V9.48L12 13.62l5.5-4.14v7.77h3.25V6.5L12 13 3.25 6.5Z"
                  fill="#EA4335"
                />
                <path
                  d="M3.25 6.5 12 13 20.75 6.5 18.85 4.8 12 9.86 5.15 4.8 3.25 6.5Z"
                  fill="#FBBC04"
                />
                <path
                  d="M3.25 17.25h3.25V9.48L3.25 6.5v10.75Z"
                  fill="#4285F4"
                />
                <path
                  d="M17.5 9.48v7.77h3.25V6.5l-3.25 2.98Z"
                  fill="#34A853"
                />
              </svg>
              Connect Gmail
            </a>
          </Button>
        )}
        <Box style={{ marginTop: "0.5rem" }}>
          <SidebarNav />
        </Box>

        <Box style={{ marginTop: "auto" }}>
          <Separator size="4" style={{ margin: "1rem 0 0.75rem" }} />
          <Flex align="center" gap="3" justify="between">
            <Flex align="center" gap="3" style={{ minWidth: 0, flex: 1 }}>
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--gray-5)",
                  color: "var(--gray-12)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {initials}
              </Box>
              <Text
                size="2"
                weight="medium"
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.email || "No email"}
              </Text>
            </Flex>

            <UserMenu />
          </Flex>
        </Box>
      </Box>

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </Flex>
  );
}

