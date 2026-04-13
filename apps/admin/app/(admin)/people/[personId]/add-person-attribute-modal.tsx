"use client";

import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addPersonAttribute } from "./actions";

export function AddPersonAttributeModal({ personId }: { personId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await addPersonAttribute(personId, name, value);
      setName("");
      setValue("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add attribute.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button type="button" variant="soft" color="gray">
          + Add attribute
        </Button>
      </Dialog.Trigger>

      <Dialog.Content size="2" style={{ maxWidth: 420 }}>
        <Dialog.Title>Add person attribute</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          Use one-level key/value fields like <Text as="span">entity_type</Text> or{" "}
          <Text as="span">company_name</Text>.
        </Dialog.Description>

        <form onSubmit={onSubmit}>
          <Flex direction="column" gap="3" mt="3">
            <Flex direction="column" gap="1">
              <Text size="2" weight="medium">
                Name
              </Text>
              <TextField.Root
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="entity_type"
                required
                disabled={pending}
              />
            </Flex>

            <Flex direction="column" gap="1">
              <Text size="2" weight="medium">
                Value
              </Text>
              <TextField.Root
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="expert"
                required
                disabled={pending}
              />
            </Flex>

            {error ? (
              <Text size="2" color="red">
                {error}
              </Text>
            ) : null}

            <Flex justify="end" gap="2" mt="2">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray" disabled={pending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
