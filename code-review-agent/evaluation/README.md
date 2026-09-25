# Evaluation Scenarios

The Code Review Agent is evaluated against five intentionally
introduced code changes.

## Scenario 01 — Correctness

An account withdrawal comparison is reversed.

Expected:
- Correctness specialist selected
- Testing may also be selected
- High-severity logic finding
- REQUEST CHANGES

## Scenario 02 — Security

A parameterized SQL query is replaced with string interpolation.

Expected:
- Security specialist selected
- SQL injection identified
- High or Critical severity

## Scenario 03 — Performance

A bulk database operation is replaced with sequential queries.

Expected:
- Performance specialist selected
- N+1/sequential query problem identified

## Scenario 04 — Architecture

A route bypasses the service layer and directly accesses storage.

Expected:
- Architecture or quality specialist selected
- Layering/responsibility issue identified

## Scenario 05 — Testing

Business behavior changes while existing tests are not updated.

Expected:
- Testing and/or correctness selected
- Missing or stale test coverage identified

The scenarios are Git repositories containing a committed safe
baseline followed by an intentionally uncommitted change.
