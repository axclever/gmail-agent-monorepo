import { redirect } from "next/navigation";
import { Box, Flex, Text } from "@radix-ui/themes";
import { Landing } from "./landing";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <Landing />
      </main>
    );
  }

  const role = (session.user as { role?: string }).role;

  if (role !== "ADMIN") {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <Box style={{ maxWidth: 520 }}>
          <Flex direction="column" gap="3">
            <Text size="6" weight="bold">
              Access denied
            </Text>
            <Text color="gray">
              Your account is signed in, but does not have ADMIN role yet.
            </Text>
          </Flex>
        </Box>
      </main>
    );
  }

  redirect("/inbox");
}
