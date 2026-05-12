# Security Specification for Finance App

## Data Invariants
1. A transaction must always have a valid `uid` matching the authenticated user.
2. A category must have a `type` that is either 'income' or 'expense'.
3. Balance and amount fields must be numbers.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Identity Spoofing**: Creating a transaction with someone else's `uid`.
2. **Identity Spoofing (Update)**: Changing the `uid` of an existing transaction.
3. **Type Poisoning**: Setting `amount` to a string instead of a number.
4. **Invalid Enum**: Setting transaction `type` to "random".
5. **Shadow Fields**: Adding an `isAdmin: true` field to a transaction.
6. **Orphaned Writes**: Creating a transaction without a `description`.
7. **Size Attack**: Setting a 1MB string description.
8. **Temporal Spoofing**: Setting a future `createdAt` from the client.
9. **State Shortcutting**: Updating `isRecurringEntry` without proper logic (implicitly blocked by `hasOnly`).
10. **ID Poisoning**: Using a 1KB string as a document ID.
11. **PII Blanket Read**: Attempting to list all transactions across all users.
12. **Immutable Field Attack**: Attempting to change `createdAt` on update.

## Test Runner Plan
We will verify that these payloads return `PERMISSION_DENIED` using the rules.
