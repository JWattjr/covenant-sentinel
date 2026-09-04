"use client";

import { LoaderCircle, LogOut, WalletCards } from "lucide-react";

import { useWallet } from "@/lib/genlayer/wallet";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletControl() {
  const { address, isConnected, isLoading, isOnCorrectNetwork, connectWallet, disconnectWallet } = useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 sm:flex">
          <span className={`size-1.5 rounded-full ${isOnCorrectNetwork ? "bg-emerald-300" : "bg-amber-300"}`} />
          <span className="font-mono">{shortAddress(address)}</span>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Disconnect wallet"
          aria-label="Disconnect wallet"
          onClick={disconnectWallet}
        >
          <LogOut className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="primary-button"
      disabled={isLoading}
      onClick={() => void connectWallet()}
    >
      {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <WalletCards className="size-4" />}
      <span>{isLoading ? "Checking wallet" : "Connect wallet"}</span>
    </button>
  );
}
