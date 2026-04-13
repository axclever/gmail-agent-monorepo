export function buildClassificationFacts(
  clsByKind: Map<string, string>,
  replyNeededBool: boolean | null,
): Record<string, unknown>;

export function buildEmailHaystack(latestMessage: unknown): string;

export function buildConditionContextFromThreadRow(
  thread: {
    classifications?: Array<{ kind: string; value: string }>;
    replyRequired?: boolean | null;
    status?: string | null;
    hasUnrepliedInbound?: boolean | null;
    lastMessageDirection?: string | null;
    lastIntent?: string | null;
    waitingOnOtherParty?: boolean | null;
  },
  latestMessage: unknown,
): {
  classification: Record<string, unknown>;
  email: { subject_body_text: string };
  thread: Record<string, unknown>;
};

export function ruleConditionsMatch(
  conditions: unknown,
  context: {
    classification: Record<string, unknown>;
    email: { subject_body_text: string };
    thread: Record<string, unknown>;
  },
): boolean;
