# Clean Code Guide

Distilled from Clean Code (Martin) and Eskil Steenberg's black-box methodology, adapted to how this team reviews TypeScript.

## Functions do one thing

A function should do one thing, do it well, and do it only. Mixed responsibilities show up as blank-line "paragraphs", flag arguments, or names containing `and`. Extract until each function reads as a single step of the story (the Stepdown Rule).

## Command-query separation

A function either changes state (command) or returns information (query), never both. `setPrice()` must not return the old price — that hides a read inside a write and surprises callers.

## Error handling with context

Prefer exceptions over error codes or null returns. Never return null — return an empty array, throw, or use a Special Case object. Every thrown error names the operation and the failure: `Failed to fetch eBay categories: 502 Bad Gateway`. If `try` appears in a function, it should be the first word — extract the bodies into named functions.

## Don't pass or return null

Returning null creates a null-check tax on every caller and eventually a runtime crash far from the cause. Passing null into APIs that don't expect it is worse. Model absence explicitly (empty collection, optional type, Special Case object).

## Dead code and duplication

Delete unused functions, unreachable branches, and commented-out blocks — git remembers. Duplication is missed abstraction: three similar blocks are a helper waiting to be named.

## Tests are first-class code

Test code deserves the same care as production code. One concept per test, Arrange-Act-Assert with blank lines between phases, and boundary conditions covered (empty arrays, off-by-one, maximum values). A test should still pass if the implementation were rewritten — test the interface, not the internals.

## Tests follow F.I.R.S.T.

Fast — slow tests don't get run, and code rots. Independent — no test depends on another's state; each sets up its own context and runs in any order. Repeatable — same result locally, in CI, and offline; no external service calls in unit tests. Self-validating — pass or fail, never "inspect the logs to decide". Timely — written alongside the code; code written without tests in mind is hard to test.

## Build a domain-specific testing language

Extract helpers and factories until tests read like English: `createMockSession()`, `buildPricingConfig()` — not twenty lines of duplicated setup. Bugs cluster: when a test exposes a bug in a function, test that function exhaustively; it likely hides more.

## Obscured intent

No dense one-liners. Break complex expressions into explanatory variables with meaningful names. If a reviewer has to simulate the expression in their head, it needs an intermediate variable.
