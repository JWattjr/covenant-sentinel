"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useWallet } from "@/lib/genlayer/wallet";

import { CovenantSentinelClient, hasDeploymentConfiguration } from "./client";
import type { EmergencyDraft, TransactionSnapshot, TransferDraft } from "./types";

const MAX_TRACKED_TRANSACTIONS = 8;

function mergeSnapshot(list: TransactionSnapshot[], next: TransactionSnapshot) {
  const without = list.filter((entry) => entry.hash !== next.hash);
  return [next, ...without].slice(0, MAX_TRACKED_TRANSACTIONS);
}

export function useCovenant() {
  const { address, isConnected } = useWallet();
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState<TransactionSnapshot[]>([]);
  const configured = hasDeploymentConfiguration();

  const client = useMemo(
    () => (configured ? new CovenantSentinelClient(isConnected ? address ?? undefined : undefined) : null),
    [address, configured, isConnected],
  );

  const dashboard = useQuery({
    queryKey: ["covenant-sentinel", "dashboard"],
    queryFn: () => {
      if (!client) throw new Error("Deployment is not configured.");
      return client.getDashboard();
    },
    enabled: Boolean(client),
    refetchInterval: configured ? 15_000 : false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: 1,
  });

  const afterWrite = useCallback(
    (result: TransactionSnapshot) => {
      setTransactions((current) => mergeSnapshot(current, result));
      void queryClient.invalidateQueries({ queryKey: ["covenant-sentinel"] });
      return result;
    },
    [queryClient],
  );

  const requireSigner = (message: string) => {
    if (!client || !isConnected) throw new Error(message);
    return client;
  };

  const transfer = useMutation({
    mutationFn: async (draft: TransferDraft) =>
      requireSigner("Connect a GenLayer wallet before submitting a proposal.").submitTransfer(draft),
    onSuccess: afterWrite,
  });

  const emergency = useMutation({
    mutationFn: async (draft: EmergencyDraft) =>
      requireSigner(
        "Connect an authorized reporter wallet before submitting an incident.",
      ).submitEmergencyPause(draft),
    onSuccess: afterWrite,
  });

  const evaluate = useMutation({
    mutationFn: async (proposalId: string) =>
      requireSigner(
        "Connect a GenLayer wallet before initiating consensus evaluation.",
      ).evaluateProposal(proposalId),
    onSuccess: afterWrite,
  });

  const releasePause = useMutation({
    mutationFn: async (incidentId: string) =>
      requireSigner("Only the governor wallet can request a pause release.").releaseEmergencyPause(
        incidentId,
      ),
    onSuccess: afterWrite,
  });

  const appeal = useMutation({
    mutationFn: async (snapshot: TransactionSnapshot) =>
      requireSigner("Connect a GenLayer wallet before appealing a decision.").appeal(
        snapshot.hash,
        snapshot.label,
      ),
    onSuccess: afterWrite,
  });

  /** Poll one tracked receipt so a decided call can be watched to finality. */
  const refresh = useMutation({
    mutationFn: async (snapshot: TransactionSnapshot) => {
      if (!client) throw new Error("Deployment is not configured.");
      return client.refreshTransaction(snapshot.hash, snapshot.label);
    },
    onSuccess: afterWrite,
  });

  const busy =
    transfer.isPending ||
    emergency.isPending ||
    evaluate.isPending ||
    releasePause.isPending ||
    appeal.isPending;

  return {
    configured,
    dashboard,
    transactions,
    latestTransaction: transactions[0] ?? null,
    busy,
    transfer,
    emergency,
    evaluate,
    releasePause,
    appeal,
    refresh,
  };
}
