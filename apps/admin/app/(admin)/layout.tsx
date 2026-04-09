import { Box, Flex } from "@radix-ui/themes";
import { SidebarNav } from "./sidebar-nav";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Flex style={{ minHeight: "100vh" }}>
      <Box
        style={{
          width: 264,
          borderRight: "1px solid var(--gray-6)",
          padding: "1.25rem 1rem",
        }}
      >
        <Box style={{ marginBottom: "1.25rem" }}>
          <Box style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.1 }}>
            Agentic
          </Box>
          <Box style={{ fontSize: 13, color: "var(--gray-11)", marginTop: 4 }}>
            by Leadround
          </Box>
        </Box>
        <SidebarNav />
      </Box>

      <Box style={{ flex: 1, padding: "1.5rem" }}>{children}</Box>
    </Flex>
  );
}

