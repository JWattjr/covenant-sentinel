# Architecture decisions

## GenLayer decides the ambiguous part

Hard limits such as the 10,000-demo-unit maximum are calculated in contract
code. GenLayer consensus is used only for evidence-based questions: mandate
alignment, an unresolved critical exploit, conflicting credible sources, and
whether an emergency claim supports a short temporary pause. This makes the
verdict an enforceable state transition rather than a decorative score.

## Pinned runner compatibility

Both single-file contracts pin
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, the concrete
runner specified by the current GenLayer project boilerplate and compatible with
its direct test runtime. The linter may advertise a newer runner independently;
that runner is intentionally not adopted until the boilerplate test/runtime
pair supports it. This preserves a real, reproducible lint-and-test path rather
than using an alias or an untested version.

## Finality before irreversible effects

The vault is called through an internal message with `on="finalized"`. An
accepted receipt is provisional and may be appealed, so it cannot transfer
demo accounting units or pause the vault. The vault also sends its execution
acknowledgement through a finalized message. The frontend separately shows
transaction status and child execution evidence.

## Why a simulated treasury

The hackathon MVP proves authorization, replay protection, finality, and
consensus flow using a small integer demo balance. It does not claim custody of
real TVL, bridged assets, or cross-chain execution. A future token or adapter
requires an independently audited custody model and, for a relayer, explicit
trust assumptions.

## Evidence source model

The governor maintains an allowlist of DNS domains. A submitted URL must use
HTTPS, resolve syntactically to an approved domain or its subdomain, and avoid
private/local targets. Emergency proposals require two URLs from distinct
approved domains. This is a source-hygiene control, not a guarantee that a
source is correct or uncompromised.

## Temporary pause expiry

Intelligent contracts do not execute on a wall-clock schedule. The vault records
the approved capped duration but does not pretend to self-unpause. A governor
can ask the Sentinel to issue a finalized manual release for the active incident.
That operational limitation is visible in the product and documentation; the
governor cannot directly pause the vault or bypass consensus to create a pause.
