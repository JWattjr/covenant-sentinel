// Builds docs/submission/milestone-v1.json from deploy/proof-v1.json. Every address and link comes from the proof.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { addressLink, txLink } from "./lib/explorer.mjs";

const proof = JSON.parse(readFileSync("deploy/proof-v1.json", "utf8"));
const up = proof.final.upgrades;
const amd = proof.final.amendment;
const c8 = proof.state.c8 ?? {};
const tx = (label) => proof.transactions.find((t) => t.label === label);
const link = (label) => txLink(tx(label).hash);

const milestone = {
  title: "Covenant Sentinel defense suite",
  summary:
    "Three contracts that check the rules around a policy-bound treasury: validator-judged upgrade reviews, policy amendment comparisons, and a per-spender record written only from finalized results. Live on StudioNet with eight recorded cases, including real deviations.",
  network: "GenLayer StudioNet (chain 61999)",
  app_url: "https://covenant-sentinel.vercel.app/defense",
  repository: "https://github.com/JWattjr/covenant-sentinel",
  contracts_commit: "https://github.com/JWattjr/covenant-sentinel/tree/ba28acf66bd24e4484c554dfe1182233ef2e91b0",
  proof_file_url: "https://covenant-sentinel.vercel.app/defense/proof-v1.json",
  contracts: Object.entries(proof.contracts).map(([name, c]) => ({
    name,
    address: c.address,
    explorer: addressLink(c.address),
    role: {
      UpgradeGuard: "Validators judge ADVANCE, HOLD or ROLLBACK from a commit-pinned source diff, with one quoted line.",
      PolicyAmendments: "Validators judge LOOSENS, TIGHTENS or NEUTRAL against the frozen Sentinel policy, with one quoted clause.",
      TreasuryRecord: "No model. Per-spender record and verified claim receipts, written only from committed Sentinel results. It moves no funds.",
    }[name],
  })),
  existing_contracts_unchanged: [
    { name: "CovenantSentinel", explorer: addressLink(proof.existing.sentinel) },
    { name: "SentinelVault", explorer: addressLink(proof.existing.vault) },
  ],
  judgment_points: [
    "Upgrade review: ADVANCE, HOLD or ROLLBACK, quote must be a line of the diff.",
    "Policy amendment: LOOSENS, TIGHTENS or NEUTRAL, quote must be a clause from either policy text.",
    "Validators agree on the evidence: the leader's quote must appear in each validator's own fetch.",
    "Unreachable or mismatched evidence is VOID, never a verdict against a party.",
  ],
  results: {
    amendment_tighten_attempt_1: { planned: "TIGHTENS", actual: amd.tighten.outcome.verdict, state: amd.tighten.state },
    amendment_tighten_attempt_2: { planned: "TIGHTENS", actual: amd.tighten2?.outcome.verdict ?? null, state: amd.tighten2?.state ?? null },
    amendment_loosen: { planned: "LOOSENS", actual: amd.loosen.outcome.verdict, state: amd.loosen.state },
    upgrade_advance: { planned: "ADVANCE", actual: up.advance.outcome.verdict, state: up.advance.state },
    upgrade_rollback_hidden_call: { planned: "ROLLBACK", actual: up.rollback.outcome.verdict, state: up.rollback.state },
    upgrade_injection: { planned: "ROLLBACK", actual: up.inject.outcome.verdict, state: up.inject.state },
    upgrade_unreachable: { planned: "VOID", actual: up.void.outcome.status, state: up.void.state },
    spender_a: c8.spenderA ?? null,
    spender_b: c8.spenderB ?? null,
  },
  proof_links: {
    recorded_proof: "deploy/proof-v1.json",
    transactions: proof.transactions.map((t) => ({ label: t.label, explorer: txLink(t.hash), consensus: t.consensus, execution: t.execution })),
    key: {
      amendment_judge_loosen: link("c2-judge-loosen"),
      upgrade_judge_rollback: link("c4-judge"),
      treasury_claim: link("c8-claim-A1"),
    },
  },
  how_to_verify: [
    "npm run verify:proof-v1 (read-only; checks every explorer link through the explorer API)",
    "Open /defense in the console: recorded proof and live reads are shown separately",
  ],
  honest_limits: [
    "The Sentinel's policy was not changed: publishing a new policy needs the governor key, which was not available.",
    "The DEMO credit happens in the existing vault. The treasury claim only records a receipt after verifying that credit; it moves no funds.",
    "Amendment attempt 1 proposed \"5,000 DEMO, the published maximum\", which conflicts with the Sentinel's 10,000 cap, so its NEUTRAL verdict reflects ambiguous wording. Attempt 2 adds a new rule and was judged TIGHTENS.",
    "StudioNet exposes no appeal, so the LOOSENS appeal window is displayed only.",
    "Direct tests cover one contract at a time; treasury cross-contract reads and clock-based transitions are proven live.",
  ],
  deposits: proof.deposits,
};

mkdirSync("docs/submission", { recursive: true });
writeFileSync("docs/submission/milestone-v1.json", JSON.stringify(milestone, null, 2));
console.log("wrote docs/submission/milestone-v1.json");
