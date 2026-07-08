import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import type { ReviewState } from "../state";
import { makeIngestNode } from "./ingest";

const SAMPLE_DIFF = readFileSync(
  new URL("../../../fixtures/sample-pr.diff", import.meta.url),
  "utf-8",
);

const stateWith = (title: string): ReviewState =>
  ({
    rawDiff: SAMPLE_DIFF,
    metadata: {
      number: 42,
      title,
      description: "Adds the export endpoint.",
      author: "sam-dev",
      repository: "acme/listaid",
    },
  }) as ReviewState;

describe("makeIngestNode", () => {
  test("resolves the referenced ticket through the injected client", async () => {
    const ticket = {
      identifier: "FLU-123",
      title: "Export donations per customer",
      description: "Ops need a CSV export.",
    };
    const ingest = makeIngestNode({
      ticketClient: async (identifier) =>
        identifier === "FLU-123" ? ticket : undefined,
    });

    const update = await ingest(stateWith("[FLU-123] Add export endpoint"));

    expect(update.ticket).toEqual(ticket);
    expect(update.rawDiff).toBe("");
  });

  test("proceeds without a ticket when no client is wired or nothing is referenced", async () => {
    const noClient = makeIngestNode({});
    const noReference = makeIngestNode({
      ticketClient: async () => {
        throw new Error("must not be called without a ticket reference");
      },
    });

    expect((await noClient(stateWith("[FLU-123] Add export"))).ticket).toBeUndefined();
    expect((await noReference(stateWith("Add export endpoint"))).ticket).toBeUndefined();
  });
});
