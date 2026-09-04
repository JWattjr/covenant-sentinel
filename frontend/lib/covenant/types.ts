export type ProposalType = "TREASURY_TRANSFER" | "EMERGENCY_PAUSE";

export type ProposalStatus =
  | "PENDING"
  | "EVALUATING"
  | "EXECUTION_QUEUED"
  | "EXECUTED"
  | "CANCELLED"
  | "ALLOW"
  | "TIMELOCK"
  | "BLOCK"
  | "INSUFFICIENT_EVIDENCE";

export type Verdict = "ALLOW" | "TIMELOCK" | "BLOCK" | "INSUFFICIENT_EVIDENCE" | "";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "";

export interface EvidenceFinding {
  source_id: string;
  rule_id: string;
  finding: string;
}

export interface CovenantProposal {
  proposal_id: string;
  proposal_type: ProposalType;
  proposer: string;
  target: string;
  asset_id: string;
  amount: number;
  purpose: string;
  incident_claim: string;
  evidence_urls: string[];
  requested_pause_hours: number;
  policy_version: number;
  created_sequence: number;
  status: ProposalStatus;
  verdict: Verdict;
  risk_level: RiskLevel;
  reason_code: string;
  violated_rule_ids: string[];
  satisfied_rule_ids: string[];
  evidence_findings: EvidenceFinding[];
  summary: string;
  execution_status: string;
}

export interface PolicyVersion {
  version: number;
  policy_text: string;
  max_transfer_amount: number;
  canonical_id: string;
  created_by: string;
  rule_ids: string[];
}

export interface VaultState {
  governor: string;
  sentinel: string;
  sentinel_configured: boolean;
  demo_balance: number;
  paused: boolean;
  pause_incident_id: string;
  pause_duration_hours: number;
  pause_reason: string;
}

export interface ProtocolStatistics {
  submitted: number;
  cancelled: number;
  allow: number;
  timelock: number;
  block: number;
  insufficient_evidence: number;
  executed: number;
}

export interface GuardedVaultConfiguration {
  governor: string;
  guarded_vault: string;
  vault_configured: boolean;
  max_pause_hours: number;
}

export interface CovenantDashboard {
  /** `null` before the governor has published the first policy version. */
  policy: PolicyVersion | null;
  proposals: CovenantProposal[];
  statistics: ProtocolStatistics;
  vault: VaultState;
  configuration: GuardedVaultConfiguration;
  domains: string[];
}

/**
 * Where a submitted transaction currently sits in the GenLayer lifecycle.
 *
 * `DECIDED` deliberately does not mean "done": finality-safe child messages
 * have not been delivered, and an appeal may be available on supported networks.
 */
export type TransactionPhase = "SUBMITTED" | "DECIDED" | "FINALIZED" | "FAILED" | "APPEALED";

export interface TransactionSnapshot {
  hash: string;
  /** Human label for the contract call this receipt belongs to. */
  label: string;
  phase: TransactionPhase;
  /** Consensus status name reported by the node, e.g. ACCEPTED / FINALIZED. */
  statusName: string;
  /** GenVM execution result name, e.g. FINISHED_WITH_RETURN. */
  executionResultName: string;
  /** `null` when the node has not reported an execution result yet. */
  executionSucceeded: boolean | null;
  finalized: boolean;
  appealable: boolean;
  /** Child transactions the contract emitted (vault instructions, callbacks). */
  triggeredIds: string[];
  detail: string;
}

export interface TransferDraft {
  actionId: string;
  target: string;
  assetId: string;
  amount: number;
  purpose: string;
  evidenceUrls: string[];
}

export interface EmergencyDraft {
  incidentId: string;
  incidentClaim: string;
  evidenceUrls: string[];
  requestedPauseHours: number;
}
