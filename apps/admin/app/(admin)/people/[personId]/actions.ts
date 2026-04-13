"use server";

import { prisma } from "@gmail-agent/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../(protected)/require-admin";

function normalizeAttrKey(key: string): string {
  return String(key || "").trim();
}

export async function addPersonAttribute(personId: string, key: string, value: string) {
  await requireAdmin();

  const cleanKey = normalizeAttrKey(key);
  if (!cleanKey) {
    throw new Error("Attribute name is required.");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanKey)) {
    throw new Error("Attribute name must contain only letters, numbers, and underscore.");
  }

  const cleanValue = String(value || "").trim();
  if (!cleanValue) {
    throw new Error("Attribute value is required.");
  }

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, customFieldsJson: true },
  });
  if (!person) {
    throw new Error("Person not found.");
  }

  const current =
    person.customFieldsJson &&
    typeof person.customFieldsJson === "object" &&
    !Array.isArray(person.customFieldsJson)
      ? (person.customFieldsJson as Record<string, unknown>)
      : {};

  const next = {
    ...current,
    [cleanKey]: cleanValue,
  };

  await prisma.person.update({
    where: { id: person.id },
    data: { customFieldsJson: next as Prisma.InputJsonValue },
  });

  revalidatePath(`/people/${person.id}`);
  revalidatePath("/people");
}
