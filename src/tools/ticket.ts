export type Ticket = {
  identifier: string;
  title: string;
  description: string;
};

/** Resolves a ticket identifier to its content; undefined when the ticket can't be fetched. */
export type TicketClient = (identifier: string) => Promise<Ticket | undefined>;

// Ticket-shaped false positives (e.g. "UTF-8") are harmless: fetching a
// nonexistent ticket resolves to undefined and the review proceeds without it.
const TICKET_IDENTIFIER = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;

/** Finds a Linear-style ticket reference (e.g. FLU-123) in PR title/description. */
export const extractTicketIdentifier = (text: string): string | undefined =>
  text.match(TICKET_IDENTIFIER)?.[0];
