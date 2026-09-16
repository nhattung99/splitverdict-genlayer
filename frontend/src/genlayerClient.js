import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import {
  parseGenToWei,
  formatWeiToGen,
  sanitizeGenInput,
  sanitizeBpsInput,
  toWeiString,
  toBpsInt,
  computeShareWei,
  remainingShareWei,
  equalBasisPoints,
  sumBasisPoints,
  formatBpsPercent,
  BASIS_POINTS_TOTAL,
  WEI_PER_GEN,
} from './money.js';

export {
  parseGenToWei,
  formatWeiToGen,
  sanitizeGenInput,
  sanitizeBpsInput,
  toWeiString,
  toBpsInt,
  computeShareWei,
  remainingShareWei,
  equalBasisPoints,
  sumBasisPoints,
  formatBpsPercent,
  BASIS_POINTS_TOTAL,
  WEI_PER_GEN,
};

const ZERO = '0x0000000000000000000000000000000000000000';
const rawAddress = (import.meta.env.VITE_CONTRACT_ADDRESS || '').trim();

export const EXPLORER_BASE = studioDevnet.blockExplorers?.default?.url || 'https://explorer-studio-dev.genlayer.com';
export const STUDIO_RPC = studioDevnet.rpcUrls?.default?.http?.[0] || 'https://studio-dev.genlayer.com/api';
export const STUDIO_APP = 'https://studio-dev.genlayer.com';

export const txExplorerUrl = (hash) => {
  if (!hash) return EXPLORER_BASE;
  return `${EXPLORER_BASE}/tx/${hash}`;
};

export const addressExplorerUrl = (addr) => {
  if (!addr) return EXPLORER_BASE;
  return `${EXPLORER_BASE}/address/${addr}`;
};

export const CONTRACT_ADDRESS = rawAddress || ZERO;

export const hasContractAddress = Boolean(
  rawAddress &&
  rawAddress !== ZERO &&
  /^0x[0-9a-fA-F]{40}$/.test(rawAddress)
);

export { studioDevnet };

const toAddress = (account) => {
  if (!account) return '';
  if (typeof account === 'string') return account;
  return account.address || '';
};

export const getReadClient = () => {
  try {
    return createClient({ chain: studioDevnet });
  } catch (err) {
    console.warn('Read client init failed:', err);
    return null;
  }
};

export const getWriteClient = (account) => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is required to sign SplitVerdict transactions on GenLayer.');
  }
  return createClient({
    chain: studioDevnet,
    account: toAddress(account),
    provider: window.ethereum,
  });
};

export const parseJsonMaybe = (res) => {
  if (res === null || res === undefined) return res;
  if (typeof res === 'string') {
    try {
      return JSON.parse(res);
    } catch {
      return res;
    }
  }
  return res;
};

export const formatWriteError = (err) => {
  const msg = String(err?.shortMessage || err?.details || err?.message || err || '');
  const low = msg.toLowerCase();
  if (low.includes('user rejected') || low.includes('user denied') || low.includes('rejected the request')) {
    return 'Transaction cancelled in MetaMask.';
  }
  if (low.includes('insufficient') || low.includes('funds')) {
    return 'Not enough GEN for this deposit plus gas.';
  }
  return msg || 'Write transaction failed.';
};

const trustedFees = (estimate) => {
  const preset = estimate?.recommendedPreset || estimate;
  if (!preset?.distribution || preset.feeValue === undefined) return undefined;
  return {
    distribution: preset.distribution,
    feeValue: preset.feeValue,
    ...(preset.messageAllocations !== undefined ? { messageAllocations: preset.messageAllocations } : {}),
  };
};

export const estimateWriteFees = async (client, { functionName, args, value }) => {
  if (typeof client.estimateTransactionFeesForWrite === 'function') {
    try {
      const estimate = await client.estimateTransactionFeesForWrite({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        ...(value !== undefined ? { value } : {}),
      });
      const fees = trustedFees(estimate);
      if (fees) return fees;
    } catch (err) {
      console.warn('estimateTransactionFeesForWrite note:', err);
    }
  }
  if (typeof client.estimateTransactionFees === 'function') {
    try {
      const estimate = await client.estimateTransactionFees({});
      return trustedFees(estimate);
    } catch (err) {
      console.warn('estimateTransactionFees note:', err);
    }
  }
  return undefined;
};

export const switchToStudioDev = async (client) => {
  if (client && typeof client.connect === 'function') {
    try {
      await client.connect('studioDevnet');
      return;
    } catch (err) {
      console.warn('studioDevnet connect note:', err);
    }
  }
  if (typeof window === 'undefined' || !window.ethereum) return;
  const chainIdHex = `0x${BigInt(studioDevnet.id).toString(16)}`;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: studioDevnet.name,
            nativeCurrency: studioDevnet.nativeCurrency,
            rpcUrls: studioDevnet.rpcUrls.default.http,
            blockExplorerUrls: [EXPLORER_BASE],
          }],
        });
      } catch (addError) {
        console.warn('Could not add Studio Dev to MetaMask:', addError);
      }
    }
  }
};

export const waitForTx = async (client, hash, { retries = 30, interval = 2000 } = {}) => {
  if (!hash) return null;
  if (client && typeof client.waitForTransactionReceipt === 'function') {
    try {
      return await client.waitForTransactionReceipt({
        hash,
        waitUntil: 'finalized',
        retries,
        interval,
      });
    } catch (err) {
      console.warn('waitForTransactionReceipt note:', err);
    }
  }
  return hash;
};
