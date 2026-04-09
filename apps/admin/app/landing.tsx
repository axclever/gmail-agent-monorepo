"use client";

import { signIn } from "next-auth/react";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";

export function Landing() {
  return (
    <Card size="4" style={{ maxWidth: 520 }}>
      <Flex direction="column" gap="4" align="start">
        <Heading size="8">Leadround Agentic</Heading>
        <Text color="gray">
          Sign in with Google to access the admin dashboard.
        </Text>
        <Button onClick={() => signIn("google")} size="3">
          Sign in with Google
        </Button>
      </Flex>
    </Card>
  );
}

