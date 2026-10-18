import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import { applyStudentParentLinkDecision } from "../lib/parent-link-decision";

function fakeTransaction(claimed: boolean) {
  const calls: string[] = [];
  const tx = {
    parent_student_link_requests: {
      updateMany: async () => {
        calls.push("claim");
        return { count: claimed ? 1 : 0 };
      },
    },
    parent_student_links: {
      upsert: async () => {
        calls.push("grant");
      },
    },
    parent_student_link_events: {
      create: async () => {
        calls.push("audit");
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls };
}

const input = {
  requestId: 17,
  parentId: 3,
  studentId: 42,
  now: new Date("2026-10-18T00:00:00Z"),
};

test("approval grants access only after claiming a pending request", async () => {
  const { tx, calls } = fakeTransaction(true);
  const result = await applyStudentParentLinkDecision(tx, {
    ...input,
    decision: "approve",
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ["claim", "grant", "audit"]);
});

test("rejection records a decision without granting access", async () => {
  const { tx, calls } = fakeTransaction(true);
  const result = await applyStudentParentLinkDecision(tx, {
    ...input,
    decision: "reject",
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ["claim", "audit"]);
});

test("expired or already handled requests cannot grant access", async () => {
  const { tx, calls } = fakeTransaction(false);
  const result = await applyStudentParentLinkDecision(tx, {
    ...input,
    decision: "approve",
  });
  assert.equal(result, false);
  assert.deepEqual(calls, ["claim"]);
});
