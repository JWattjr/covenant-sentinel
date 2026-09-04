"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, custom, type WalletClient } from "viem";

// GenLayer Network Configuration (from environment variables with fallbacks)
export const GENLAYER_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || "61999");
export const GENLAYER_CHAIN_ID_HEX = `0x${GENLAYER_CHAIN_ID.toString(16).toUpperCase()}`;

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME || "GenLayer Studio",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    decimals: 18,
  },
  rpcUrls: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api"],
  blockExplorerUrls: [],
};

// Minimal EIP-1193 surface used by both the wallet UI and genlayer-js.
export interface EthereumProvider {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
}

interface Eip6963ProviderDetail {
  info: {
    name?: string;
    rdns?: string;
  };
  provider: EthereumProvider;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

let selectedMetaMaskProvider: EthereumProvider | null = null;
let metaMaskDiscovery: Promise<EthereumProvider | null> | null = null;

function injectedMetaMaskFallback(): EthereumProvider | null {
  if (typeof window === "undefined") return null;

  const injected = window.ethereum;
  const providers = Array.isArray(injected?.providers) ? injected.providers : [];
  const explicitMetaMask = providers.find(
    (provider) => provider.isMetaMask && !provider.isPhantom,
  );
  if (explicitMetaMask) return explicitMetaMask;

  // Some wallets claim `isMetaMask` for compatibility. Never select Phantom's
  // shim as the MetaMask signer when both extensions are installed.
  if (injected?.isMetaMask && !injected.isPhantom) return injected;
  return null;
}

/**
 * Resolve MetaMask through EIP-6963 instead of trusting `window.ethereum`.
 *
 * Multiple installed wallets can race to define the legacy global. EIP-6963
 * gives us the actual provider object plus a stable reverse-DNS identity, so
 * account discovery and transaction signing cannot silently use two wallets.
 */
export function discoverMetaMaskProvider(): Promise<EthereumProvider | null> {
  if (selectedMetaMaskProvider) return Promise.resolve(selectedMetaMaskProvider);
  if (typeof window === "undefined") return Promise.resolve(null);
  if (metaMaskDiscovery) return metaMaskDiscovery;

  metaMaskDiscovery = new Promise((resolve) => {
    const announced: Eip6963ProviderDetail[] = [];

    const onAnnouncement: EventListener = (event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (!detail?.provider || announced.some((candidate) => candidate.provider === detail.provider)) {
        return;
      }
      announced.push(detail);
    };

    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnouncement);

      const exact = announced.find(
        ({ info, provider }) =>
          info.rdns?.toLowerCase() === "io.metamask" &&
          provider.isMetaMask &&
          !provider.isPhantom,
      );
      const named = announced.find(
        ({ info, provider }) =>
          info.name?.toLowerCase() === "metamask" &&
          provider.isMetaMask &&
          !provider.isPhantom,
      );

      selectedMetaMaskProvider = exact?.provider ?? named?.provider ?? injectedMetaMaskFallback();
      resolve(selectedMetaMaskProvider);
    }, 250);
  });

  return metaMaskDiscovery;
}

/**
 * Get the GenLayer RPC URL from environment variables
 */
export function getStudioUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api"
  );
}

/**
 * Check if MetaMask is installed
 */
export async function isMetaMaskInstalled(): Promise<boolean> {
  return Boolean(await discoverMetaMaskProvider());
}

/**
 * Get the Ethereum provider (MetaMask)
 */
export function getEthereumProvider(): EthereumProvider | null {
  return selectedMetaMaskProvider ?? injectedMetaMaskFallback();
}

/**
 * Request accounts from MetaMask
 * @returns Array of addresses
 */
export async function requestAccounts(): Promise<string[]> {
  const provider = await discoverMetaMaskProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });
    return accounts;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw new Error(`Failed to connect to MetaMask: ${error.message}`);
  }
}

/**
 * Get current MetaMask accounts without requesting permission
 * @returns Array of addresses
 */
export async function getAccounts(): Promise<string[]> {
  const provider = await discoverMetaMaskProvider();

  if (!provider) {
    return [];
  }

  try {
    const accounts = await provider.request({
      method: "eth_accounts",
    });
    return accounts;
  } catch (error) {
    console.error("Error getting accounts:", error);
    return [];
  }
}

/**
 * Get the current chain ID from MetaMask
 */
export async function getCurrentChainId(): Promise<string | null> {
  const provider = await discoverMetaMaskProvider();

  if (!provider) {
    return null;
  }

  try {
    const chainId = await provider.request({
      method: "eth_chainId",
    });
    return chainId;
  } catch (error) {
    console.error("Error getting chain ID:", error);
    return null;
  }
}

/**
 * Add GenLayer network to MetaMask
 */
export async function addGenLayerNetwork(): Promise<void> {
  const provider = await discoverMetaMaskProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [GENLAYER_NETWORK],
    });
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected adding the network");
    }
    throw new Error(`Failed to add GenLayer network: ${error.message}`);
  }
}

/**
 * Switch to GenLayer network
 */
export async function switchToGenLayerNetwork(): Promise<void> {
  const provider = await discoverMetaMaskProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
    });
  } catch (error: any) {
    // If the chain is not added, add it
    if (error.code === 4902) {
      await addGenLayerNetwork();
    } else if (error.code === 4001) {
      throw new Error("User rejected switching the network");
    } else {
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }
}

/**
 * Check if we're on the GenLayer network
 */
export async function isOnGenLayerNetwork(): Promise<boolean> {
  const chainId = await getCurrentChainId();

  if (!chainId) {
    return false;
  }

  // Convert both to decimal for comparison
  const currentChainIdDecimal = parseInt(chainId, 16);
  return currentChainIdDecimal === GENLAYER_CHAIN_ID;
}

/**
 * Connect to MetaMask and ensure we're on GenLayer network
 * @returns The connected address
 */
export async function connectMetaMask(): Promise<string> {
  if (!(await isMetaMaskInstalled())) {
    throw new Error("MetaMask is not installed");
  }

  // Request accounts
  const accounts = await requestAccounts();

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found");
  }

  // Check and switch to GenLayer network
  const onCorrectNetwork = await isOnGenLayerNetwork();

  if (!onCorrectNetwork) {
    await switchToGenLayerNetwork();
  }

  return accounts[0];
}

/**
 * Request user to switch MetaMask account
 * Shows MetaMask account picker even if already connected
 * Uses wallet_requestPermissions to force account selection dialog
 * @returns The newly selected account address
 */
export async function switchAccount(): Promise<string> {
  const provider = await discoverMetaMaskProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    // Request permissions - this shows account picker
    await provider.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });

    // Get the newly selected account
    const accounts = await provider.request({
      method: "eth_accounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No account selected");
    }

    return accounts[0];
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected account switch");
    } else if (error.code === -32002) {
      throw new Error("Account switch request already pending");
    }
    throw new Error(`Failed to switch account: ${error.message}`);
  }
}

/**
 * Create a viem wallet client from MetaMask provider
 */
export function createMetaMaskWalletClient(): WalletClient | null {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    return createWalletClient({
      chain: studionet as any,
      transport: custom(provider),
    });
  } catch (error) {
    console.error("Error creating wallet client:", error);
    return null;
  }
}

/**
 * Create a GenLayer client with MetaMask account
 *
 * Note: The genlayer-js SDK doesn't directly support custom transports like viem.
 * When an address is provided, the SDK uses the explicitly selected EIP-1193
 * provider for transaction signing via MetaMask.
 */
export function createGenLayerClient(address?: string) {
  const config: any = {
    chain: studionet,
  };

  if (address) {
    config.account = address as `0x${string}`;
  }

  const provider = getEthereumProvider();
  if (provider) {
    config.provider = provider;
  }

  try {
    return createClient(config);
  } catch (error) {
    console.error("Error creating GenLayer client:", error);
    // Return client without account on error
    return createClient({
      chain: studionet,
    });
  }
}

/**
 * Get a client instance with MetaMask account
 */
export async function getClient() {
  const accounts = await getAccounts();
  const address = accounts[0];
  return createGenLayerClient(address);
}
