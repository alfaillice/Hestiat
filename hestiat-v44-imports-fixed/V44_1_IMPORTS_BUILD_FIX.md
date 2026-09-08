# Hestiat V44.1 — imports/build fix

- Replaced fragile relative imports from `app/**` to `src/server/**` with the stable `@/src/server/**` alias.
- Added TypeScript path alias `@/* -> ./*`.
- Removed the invalid Booking -> CommunicationPreference relation.
- Preserved User -> CommunicationPreference one-to-one relation.
- Version 0.44.1.
