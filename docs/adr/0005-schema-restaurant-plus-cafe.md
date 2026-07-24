# ADR 0005: Restaurant & Cafe in structured data — additionalType, not a type array

Date: 2026-07-24 · Status: accepted · Backlog: R31

## Context

The business is literally named "Apple Vegan Cafe & Restaurant" and operates as
both. schema.org models these as sibling types under `FoodEstablishment`:
`Restaurant` and `CafeOrCoffeeShop`. We want both signals without fake-review
markup (banned by ADR-level policy) and without breaking our JSON-LD guards
(unit + e2e assert a single string `@type` and a safe-type allowlist).

## Options

1. **`@type: ["Restaurant", "CafeOrCoffeeShop"]`** — valid JSON-LD/schema.org.
   But Google's structured-data guidance recommends one most-specific type per
   entity; multi-type entities degrade unpredictably in testing tools, and our
   own guards would need array handling for a signal Google mostly ignores.
2. **`@type: "Restaurant"` + `additionalType: "https://schema.org/CafeOrCoffeeShop"`**
   — the standard escape hatch for secondary types. Parsers that understand it
   gain the cafe semantics; everything else safely ignores a plain URL property.
   Guards stay intact.
3. Do nothing — `name` and `servesCuisine` already carry the meaning.

## Decision

Option 2. `buildRestaurant` now always emits
`additionalType: 'https://schema.org/CafeOrCoffeeShop'`. Primary `@type`
remains `Restaurant` — the most-specific type Google actually consumes for
food-establishment features (menu URL, hours, OrderAction).

Still forbidden regardless of type: `aggregateRating`, `review` (self-serving
review policy), `FAQPage` (retired May 2026).

## Consequences

- Rich Results eligibility unchanged (verified: single string `@type`).
- Unit test asserts the additionalType; e2e safe-type guard untouched.
- If Google ever documents first-class multi-type support, revisit option 1.
