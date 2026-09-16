import { createClient, chains } from 'genlayer-js';
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

export const EXPLORER_BASE = 'https://explorer-studio.genlayer.com';

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

export const studionet = chains.studionet || {
  id: 61999,
  name: 'GenLayer Studionet',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://studio.genlayer.com/api'] },
    public: { http: ['https://studio.genlayer.com/api'] },
  },
  blockExplorers: {
    default: { name: 'Studionet Explorer', url: 'https://explorer-studio.genlayer.com' },
  },
};

const toAddress = (account) => {
  if (!account) return '';
  if (typeof account === 'string') return account;
  return account.address || '';
};

export const getReadClient = () => {
  try {
    return createClient({ chain: studionet });
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
    chain: studionet,
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

const studionetChainIdHex = () => {
  const id = studionet?.id || 61999;
  return `0x${BigInt(id).toString(16)}`;
};

export const switchToStudionet = async () => {
  if (typeof window === 'undefined' || !window.ethereum) return;
  const chainIdHex = studionetChainIdHex();
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
            chainName: studionet.name || 'GenLayer Studionet',
            nativeCurrency: studionet.nativeCurrency || {
              name: 'GenLayer Token',
              symbol: 'GEN',
              decimals: 18,
            },
            rpcUrls: studionet.rpcUrls?.default?.http || ['https://studio.genlayer.com/api'],
            blockExplorerUrls: [studionet.blockExplorers?.default?.url || 'https://explorer-studio.genlayer.com'],
          }],
        });
      } catch (addError) {
        console.warn('Could not add studionet to MetaMask:', addError);
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
        status: 'FINALIZED',
        retries,
        interval,
      });
    } catch (err) {
      console.warn('waitForTransactionReceipt note:', err);
    }
  }
  return hash;
};
