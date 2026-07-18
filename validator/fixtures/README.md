# Validator demo fixtures

These two schema-valid scene briefs isolate the wheelchair-route trade-off used by the ROOM/50 demo:

- `fail.json`: table B3 leaves a validator-measured `1.05 m` bottleneck and retains 15 seats;
- `pass.json`: table B3 moves `0.15 m` away from the route, the width reaches `1.20 m`, and one ordinary seat is removed while capacity remains at 14.

Run them from the repository root:

```bash
node validator/cli.mjs validator/fixtures/fail.json
node validator/cli.mjs validator/fixtures/pass.json
```

Each command writes `validation-report.json` in the current working directory. The fail fixture exits `1`; the pass fixture exits `0`. These are concept-demo measurements, not a claim of regulatory or construction compliance.

The lowered counter and accessible table are route obstacles. `pickup-counter` represents the non-obstructing interaction face used to bind the pick-up stop; a future detailed model should add the associated solid counter body as a separate obstacle object.
