# Threat Modelling (diff-scoped)

A disposition for security review. Classic threat modelling asks four questions about a system; apply them to the change in front of you. Pattern-matching catches known-bad code — this frame catches the diff that introduces a new trust boundary while containing no individually suspicious line.

## The four questions, at diff scale

1. **What does this change expose?** New endpoints, tools, handlers, queries, file paths, or parsers are new attack surface — even when their implementation looks clean.
2. **What crosses a trust boundary now that didn't before?** User input reaching a new sink, external content entering a prompt or a store, a service gaining access to data it never touched. A diff that moves data across a boundary deserves scrutiny a same-boundary refactor does not.
3. **What can go wrong?** Run STRIDE over each new surface (below).
4. **Is anything doing something about it?** For each risk, the mitigation should be visible in the diff or already exist in code the diff calls. "The caller probably validates" is a finding, not an assumption.

## STRIDE over the changed surface

- **Spoofing** — can the caller of this new surface be someone other than who the code assumes? Where is identity established?
- **Tampering** — can input, stored state, or in-transit data feeding this code be modified by someone untrusted?
- **Repudiation** — if this new action were abused, would anything have logged who did it?
- **Information disclosure** — what does this surface return, log, or trace that it didn't before? Error paths count.
- **Denial of service** — can a caller make this arbitrarily expensive (unbounded loops, fan-out, retries, payload sizes)?
- **Elevation of privilege** — does this code let data become instructions, or a low-privilege caller reach a high-privilege operation?

## Judgement

Raise a threat-model finding only when you can name the boundary, the actor, and the consequence — "new unauthenticated webhook can trigger paid model calls" — never a vague "this could be risky". If the diff creates surface but mitigations are genuinely present, stay quiet: the frame is for finding gaps, not for narrating threats that are already handled.
