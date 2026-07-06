# Code Style Guide

Team conventions for TypeScript/React codebases. Each section is one rule; the review agent retrieves the sections relevant to a diff.

## Descriptive names everywhere

Use descriptive variable names everywhere — including callback parameters, `.map()`/`.filter()` arguments, and state updater functions. Avoid abbreviations like `p`, `prev`, `img`, `i`, `e`; prefer `product`, `previous`, `image`, `index`, `event`. Method names are verbs (`calculatePrice`, `validateDonor`); class and type names are nouns (`PricingConfig`, `SessionProduct`).

## One word per concept

Do not mix `fetch`/`retrieve`/`get` across the codebase for the same operation. Pick one and use it consistently. If `add` means arithmetic in most places, use `insert` or `append` for collections. Names should reveal side effects: `createOrReturnSession` beats `getSession` if it creates when absent.

## No noise words

Avoid `Data`, `Info`, `Manager`, `Processor` in names. If two names differ only by a noise word (`ProductData` vs `ProductInfo`), they don't make a meaningful distinction.

## Arrow functions and typing

Prefer arrow functions (`const fn = () => {}`) over `function` declarations; use `function` only where hoisting is required. Type React components as `FC<Props>` with the props type visible in the signature. Import types with `import type`.

## Small functions, small files

Each function does one thing. Aim for ~10 lines per function; extract named helpers past ~15. Aim for ~100 lines per file; split larger files into focused modules. One level of abstraction per function — don't mix `analyseProduct()` with `response.body.split("\n")` in the same function.

## Function arguments

Zero arguments is ideal, one or two is normal, three is the maximum — group more into an options object and destructure it in the signature. No flag/boolean arguments: they announce the function does two things; split it instead.

## No magic numbers or strings

Use named constants. `if (retries > 3)` should be `if (retries > MAX_RETRY_ATTEMPTS)`. Prefer positive conditionals (`if (isEligible())`) over negated ones, and extract compound conditionals into named predicates.

## Comments explain why, not what

If a comment restates the code, delete it and make the code clearer. Acceptable comments: intent ("why"), warnings of consequences, TODOs with a ticket. Never commit commented-out code — version control remembers.

## Exact dependency versions

Pin exact versions in `package.json` — never `^` or `~` ranges. Deterministic installs prevent surprise breakage from transitive minor updates.
