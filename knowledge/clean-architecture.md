# Clean Architecture Guide

Black-box architecture rules: every module should be understandable, testable, and replaceable without reading its internals.

## Design the interface first

Define what a module exposes before writing the implementation. Names describe purpose, not mechanism. Keep the public surface minimal — if something can be private, it should be.

## Hide implementation details

Callers must never need to know how something works internally. Don't expose internal types, helper functions, or intermediate state. Returning raw DB rows or third-party response shapes from a service is a leaky abstraction — map to domain types at the boundary.

## Wrap external dependencies

Never use third-party libraries directly throughout the codebase. Wrap them behind an interface so the dependency can be swapped — the service layer wraps external APIs, storage, and email. A new SDK import inside a component or route handler is a review flag.

## Dependencies point inward

Business logic must not import from delivery mechanisms (HTTP handlers, UI components, CLIs). Route handlers and components call services; services call the data access layer; never the reverse. No cross-module reaching into another module's internals.

## Layered responsibilities

Route handlers: authenticate, validate input (schema), call one service, shape the response. Services: business logic and orchestration. Data access: queries only. Business logic inside a route handler or a SQL query inside a component crosses layers.

## Global mutable state

Shared mutable state between modules creates invisible coupling and ordering bugs. Pass state explicitly or scope it to a request/session. Module-level `let` caches in server code are a concurrency hazard.

## Minimal impact changes

A change should touch only what's necessary. If a fix requires editing ten files, question the approach — it usually means a responsibility lives in the wrong place.
