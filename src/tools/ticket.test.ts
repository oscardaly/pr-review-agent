import { describe, expect, test } from "bun:test";

import { extractTicketIdentifier } from "./ticket";

describe("extractTicketIdentifier", () => {
  test("finds a ticket reference in a PR title", () => {
    expect(extractTicketIdentifier("[FLU-123] Add export endpoint")).toBe(
      "FLU-123",
    );
  });

  test("finds a ticket reference anywhere in the description", () => {
    expect(
      extractTicketIdentifier("Implements the pagination from ACME-42."),
    ).toBe("ACME-42");
  });

  test("ignores text without a ticket shape", () => {
    expect(extractTicketIdentifier("bump to v1-2")).toBeUndefined();
    expect(extractTicketIdentifier("fix the export helpers")).toBeUndefined();
  });
});
