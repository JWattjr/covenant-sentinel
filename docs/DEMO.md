# Demo script: the defense suite (90 seconds)

Desktop only, 1440 by 960. Open the console at `/defense`. Everything the first 60 seconds show comes from the recorded proof, and it works without a wallet.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:12 | Defense suite header, then the "Recorded" and "Live" pills | "The Sentinel decides spends. This adds three checks on the rules themselves: policy amendments, upgrades, and a spender record." |
| 0:12–0:30 | Policy amendment timeline. Click the LOOSEN row. | "The governor proposed a looser policy. Validators quoted the removed clause, LOOSENS, and it takes effect after 60 minutes. The appeal window is shown, but StudioNet exposes no native appeal, so it is not actionable." |
| 0:30–0:50 | Upgrade review. Click the ROLLBACK card, then the injected card. | "Same diff, two cases. The hidden external call is quoted and rolled back. The injected comment asks for ADVANCE, the scanner still flags the call, and the result is ROLLBACK." |
| 0:50–0:60 | The VOID card for unreachable evidence. | "Evidence that cannot be fetched is VOID. Nothing is decided against the proposer." |
| 1:00–1:15 | Spender record. Spender A at 2x, spender B frozen. | "Three clean spends raised the allowance to 2x. The blocked spend froze its spender. Payouts are DEMO vault credits, claimed only after the credit is verified." |
| 1:15–1:30 | Transactions list. Point to a FINALIZED entry with its explorer link. Then run `npm run verify:proof-v1` in a terminal. | "Every transaction counts only when consensus is finalized and execution returned. Each link is checked against the explorer, and the recorded proof stays separate from live reads." |

## Before recording

1. Run `npm run dev` from `frontend` and open `/defense`.
2. Confirm the recorded panel loads and the live reads show green pills. If live reads fail, the recorded proof is still complete, and the script still works.
3. Check that no table overflows at 1440 by 960.
