import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONTRACT_ADDRESS,
  hasContractAddress,
  getReadClient,
  getWriteClient,
  parseJsonMaybe,
  waitForTx,
  switchToStudionet,
  addressExplorerUrl,
  parseGenToWei,
  formatWeiToGen,
  sanitizeGenInput,
  sanitizeBpsInput,
  toWeiString,
  toBpsInt,
  computeShareWei,
  equalBasisPoints,
  sumBasisPoints,
  formatBpsPercent,
  BASIS_POINTS_TOTAL,
  formatWriteError,
  txExplorerUrl,
} from './genlayerClient.js';
import { GROUP_PRESETS, EXPENSE_PRESETS, AMOUNT_PRESETS } from './data/presets.js';
import CosmicBackdrop from './CosmicBackdrop.jsx';

const FAUCET_URL = 'https://studio.genlayer.com';
const EXPLORER_CONTRACT = addressExplorerUrl(CONTRACT_ADDRESS);

const shortAddr = (a) => {
  if (!a) return '—';
  const s = String(a);
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const sameAddr = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const normAddr = (a) => String(a || '').trim().toLowerCase();
const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || '').trim());

const pasteClipboard = async () => {
  const text = await navigator.clipboard.readText();
  return (text || '').trim();
};

const readParam = (key) => {
  try {
    return new URLSearchParams(window.location.search).get(key) || '';
  } catch {
    return '';
  }
};

const sharesToJson = (members, bpsMap) => {
  const out = {};
  for (const m of members) {
    const key = normAddr(m);
    if (!isAddress(key)) continue;
    out[key] = toBpsInt(bpsMap[key] ?? bpsMap[m] ?? '0').toString();
  }
  return JSON.stringify(out);
};

const statusTone = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'SETTLED' || s === 'RESOLVED') {
    return 'bg-tertiary-container/15 text-tertiary border border-tertiary-container/30';
  }
  if (s === 'DISPUTED' || s === 'PAYOUT_FAILED') {
    return 'bg-[#FF9100]/10 text-[#FF9100] border border-[#FF9100]/30';
  }
  return 'bg-primary-container/10 text-primary-fixed border border-primary-container/25';
};

const navClass = (active) =>
  active
    ? 'px-space-sm py-space-xs transition-all bg-primary-container text-on-primary-container font-bold rounded-lg shadow-[0_0_15px_rgba(212,175,55,0.28)]'
    : 'px-space-sm py-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all font-headline-sm text-label-telemetry-sm';

const btnPrimary =
  'inline-flex items-center justify-center gap-space-xs px-space-xl py-space-md rounded-xl bg-primary-container text-on-primary-container font-headline-sm text-headline-sm font-bold shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:shadow-[0_0_30px_rgba(212,175,55,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';
const btnSecondary =
  'inline-flex items-center justify-center gap-space-xs px-space-lg py-space-md rounded-xl bg-secondary text-on-secondary font-headline-sm text-headline-sm font-bold shadow-[0_0_20px_rgba(224,182,255,0.35)] hover:shadow-[0_0_30px_rgba(224,182,255,0.6)] hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost =
  'inline-flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-xl bg-white/[0.03] border border-white/10 text-on-surface hover:border-primary-container/50 hover:bg-primary-container/[0.08] transition-all disabled:opacity-50';
const inputClass =
  'w-full bg-[#0A0E1A] border border-white/15 text-on-surface rounded-xl px-space-md py-space-sm outline-none focus:border-primary-container focus:shadow-[0_0_10px_rgba(212,175,55,0.22)] font-data-mono-num text-data-mono-num';
const glassCard =
  'rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl p-space-xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6)] border border-white/[0.06]';

export default function App() {
  const initialExpense = readParam('expense');
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState(readParam('tab') || (initialExpense ? 'expenses' : 'home'));
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [shareHint, setShareHint] = useState('');
  const [toastOpen, setToastOpen] = useState(true);

  const [groupName, setGroupName] = useState(GROUP_PRESETS[0].name);
  const [memberInputs, setMemberInputs] = useState(['']);
  const [expensePresetId, setExpensePresetId] = useState(EXPENSE_PRESETS[0].id);
  const [description, setDescription] = useState(EXPENSE_PRESETS[0].description);
  const [amountStr, setAmountStr] = useState('1');
  const [selectedGroupId, setSelectedGroupId] = useState(readParam('group') || '');
  const [shareBps, setShareBps] = useState({});
  const [disputeBps, setDisputeBps] = useState({});
  const [evidenceText, setEvidenceText] = useState('');
  const [activeExpenseId, setActiveExpenseId] = useState(initialExpense || '');

  const weiPreview = parseGenToWei(amountStr);
  const selectedGroup = groups.find((g) => String(g.group_id) === String(selectedGroupId));
  const selectedMembers = useMemo(() => {
    const raw = selectedGroup?.members || [];
    return raw.map((m) => normAddr(m)).filter(isAddress);
  }, [selectedGroup]);

  const shareSum = useMemo(
    () => sumBasisPoints(selectedMembers.map((m) => shareBps[m] || '0')),
    [selectedMembers, shareBps]
  );

  const settledCount = expenses.filter((e) => (details[e.expense_id]?.status || e.status) === 'SETTLED').length;
  const disputedCount = expenses.filter((e) => (details[e.expense_id]?.status || e.status) === 'DISPUTED').length;
  const openCount = expenses.length - settledCount;
  const totalLockedWei = expenses.reduce((acc, e) => acc + BigInt(toWeiString(e.total_amount)), 0n);

  const applyEqualShares = (members, setter) => {
    const addrs = members.map((m) => normAddr(m)).filter(isAddress);
    const parts = equalBasisPoints(addrs.length);
    const next = {};
    addrs.forEach((addr, i) => {
      next[addr] = parts[i] || '0';
    });
    setter(next);
  };

  useEffect(() => {
    if (selectedMembers.length > 0 && Object.keys(shareBps).length === 0) {
      applyEqualShares(selectedMembers, setShareBps);
    }
  }, [selectedMembers, shareBps]);

  const requireReady = () => {
    if (!hasContractAddress) {
      throw new Error('No contract address is configured. Deploy on Studionet (61999), then set VITE_CONTRACT_ADDRESS.');
    }
    if (!account) {
      throw new Error('Connect a wallet first.');
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setErrorMessage('MetaMask is required to use SplitVerdict.');
        return;
      }
      setErrorMessage(null);
      await switchToStudionet();
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      try {
        const client = getWriteClient(addr);
        if (client.connect) await client.connect('studionet');
      } catch (err) {
        console.warn('Studionet connect note:', err);
      }
      setAccount(addr);
      setMemberInputs((prev) => {
        const next = [...prev];
        if (!next[0]) next[0] = addr;
        return next;
      });
    } catch (err) {
      setErrorMessage(formatWriteError(err) || 'Could not connect wallet');
    }
  };

  const fetchGroups = useCallback(async () => {
    if (!hasContractAddress) {
      setGroups([]);
      return;
    }
    const client = getReadClient();
    if (!client) return;
    try {
      const res = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'list_groups',
        args: [],
      });
      const data = parseJsonMaybe(res);
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('list_groups failed:', err);
      setGroups([]);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (!hasContractAddress) {
      setExpenses([]);
      return;
    }
    const client = getReadClient();
    if (!client) return;
    try {
      setListLoading(true);
      let rows = [];
      try {
        const res = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'list_expenses',
          args: [''],
        });
        const data = parseJsonMaybe(res);
        if (Array.isArray(data)) rows = data;
      } catch (err) {
        console.warn('list_expenses failed:', err);
      }
      if (rows.length === 0) {
        try {
          const countRaw = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_expense_count',
            args: [],
          });
          const count = Number(String(countRaw ?? '0').replace(/[^0-9]/g, '') || '0');
          const rebuilt = [];
          for (let i = 0; i < count; i += 1) {
            try {
              const one = await client.readContract({
                address: CONTRACT_ADDRESS,
                functionName: 'get_expense',
                args: [String(i)],
              });
              const row = parseJsonMaybe(one);
              if (row && typeof row === 'object' && !Array.isArray(row)) {
                rebuilt.push({ expense_id: String(i), ...row });
              }
            } catch (err) {
              console.warn(`get_expense ${i} failed:`, err);
            }
          }
          rows = rebuilt;
        } catch (err) {
          console.warn('get_expense_count fallback failed:', err);
        }
      }
      setExpenses(rows);
    } finally {
      setListLoading(false);
    }
  }, []);

  const fetchDetail = async (expenseId) => {
    if (!hasContractAddress || !expenseId) return null;
    try {
      const client = getReadClient();
      const res = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_expense',
        args: [String(expenseId)],
      });
      const row = parseJsonMaybe(res);
      setDetails((prev) => ({ ...prev, [expenseId]: row }));
      return row;
    } catch (err) {
      console.warn('get_expense failed:', err);
      return null;
    }
  };

  const refreshAll = useCallback(async () => {
    await fetchGroups();
    await fetchExpenses();
    if (activeExpenseId) await fetchDetail(activeExpenseId);
  }, [fetchGroups, fetchExpenses, activeExpenseId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(String(groups[0].group_id));
    }
  }, [groups, selectedGroupId]);

  const readExpenseCount = async () => {
    const client = getReadClient();
    if (!client) return 0n;
    const countRaw = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_expense_count',
      args: [],
    });
    return BigInt(String(countRaw ?? '0').replace(/[^0-9]/g, '') || '0');
  };

  const readGroupCount = async () => {
    const client = getReadClient();
    if (!client) return 0n;
    const countRaw = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_group_count',
      args: [],
    });
    return BigInt(String(countRaw ?? '0').replace(/[^0-9]/g, '') || '0');
  };

  const runWrite = async (fnName, args, value, { resolving, wait } = {}) => {
    requireReady();
    setErrorMessage(null);
    setTxHash(null);
    if (resolving) setResolvingId(resolving);
    setLoading(true);
    try {
      const client = getWriteClient(account);
      const writeArgs = {
        address: CONTRACT_ADDRESS,
        functionName: fnName,
        args,
        ...(value !== undefined ? { value } : {}),
      };
      try {
        if (typeof client.estimateTransactionFeesForWrite === 'function') {
          writeArgs.fees = await client.estimateTransactionFeesForWrite(writeArgs);
        } else if (typeof client.estimateTransactionFees === 'function') {
          writeArgs.fees = await client.estimateTransactionFees({});
        }
      } catch (err) {
        console.warn('Fee estimate skipped:', err);
      }
      const hash = await client.writeContract(writeArgs);
      setTxHash(hash);
      setToastOpen(true);
      await waitForTx(client, hash, wait || {});
      await refreshAll();
      return hash;
    } catch (err) {
      setErrorMessage(formatWriteError(err) || `${fnName} failed`);
      throw err;
    } finally {
      setLoading(false);
      setResolvingId(null);
    }
  };

  const shareLink = (expenseId) => `${window.location.origin}${window.location.pathname}?expense=${expenseId}`;

  const copyShare = async (expenseId) => {
    const url = shareLink(expenseId);
    try {
      await navigator.clipboard.writeText(url);
      setShareHint(`Copied expense link #${expenseId}`);
    } catch {
      setShareHint(url);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const extras = memberInputs.map((m) => m.trim()).filter((m) => m && !sameAddr(m, account));
      for (const m of extras) {
        if (!isAddress(m)) throw new Error(`Invalid member address: ${m}`);
      }
      if (extras.length < 1) throw new Error('Add at least one other member address.');
      const countBefore = await readGroupCount();
      const hash = await runWrite('create_group', [groupName.trim(), extras]);
      const countAfter = await readGroupCount();
      if (countAfter <= countBefore) {
        throw new Error(`Transaction finalized but the group was not created. Check Explorer: ${txExplorerUrl(hash)}`);
      }
      setSelectedGroupId((countAfter - 1n).toString());
      setTab('new-expense');
    } catch (err) {
      setErrorMessage(err?.message || 'Create group failed');
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      if (!selectedGroupId) throw new Error('Create or select a group first.');
      const wei = parseGenToWei(amountStr);
      if (wei <= 0n) throw new Error('Total amount must be greater than 0 GEN.');
      if (!description.trim()) throw new Error('Description cannot be empty.');
      if (shareSum !== BASIS_POINTS_TOTAL) {
        throw new Error(`Shares must sum to exactly 10000 bps (got ${shareSum.toString()}).`);
      }
      const payload = sharesToJson(selectedMembers, shareBps);
      const countBefore = await readExpenseCount();
      const hash = await runWrite('create_expense', [String(selectedGroupId), wei, description.trim(), payload]);
      const countAfter = await readExpenseCount();
      if (countAfter <= countBefore) {
        throw new Error(`Transaction finalized but the expense was not created. Check Explorer: ${txExplorerUrl(hash)}`);
      }
      const newId = (countAfter - 1n).toString();
      setActiveExpenseId(newId);
      await fetchDetail(newId);
      await copyShare(newId);
      setTab('expenses');
    } catch (err) {
      setErrorMessage(err?.message || 'Create expense failed');
    }
  };

  const handleAccept = async (expenseId) => {
    try {
      await runWrite('accept_split', [String(expenseId)]);
      await fetchDetail(expenseId);
    } catch (err) {
      setErrorMessage(err?.message || 'Accept split failed');
    }
  };

  const handleDispute = async (expenseId, members) => {
    try {
      const sum = sumBasisPoints(members.map((m) => disputeBps[normAddr(m)] || '0'));
      if (sum !== BASIS_POINTS_TOTAL) {
        throw new Error(`Counter-shares must sum to exactly 10000 bps (got ${sum.toString()}).`);
      }
      if (!evidenceText.trim()) throw new Error('Add evidence text (receipt notes, who ordered what, etc).');
      await runWrite('dispute_split', [String(expenseId), sharesToJson(members, disputeBps), evidenceText.trim()]);
      setEvidenceText('');
      await fetchDetail(expenseId);
    } catch (err) {
      setErrorMessage(err?.message || 'Dispute failed');
    }
  };

  const handleResolve = async (expenseId) => {
    try {
      await runWrite('resolve_dispute', [String(expenseId)], undefined, {
        resolving: expenseId,
        wait: { retries: 60, interval: 3000 },
      });
      setActiveExpenseId(expenseId);
      await fetchDetail(expenseId);
    } catch (err) {
      setErrorMessage(err?.message || 'AI resolution failed');
    }
  };

  const handleDeposit = async (expenseId, remainingWei) => {
    try {
      if (remainingWei <= 0n) throw new Error('Nothing left to deposit.');
      await runWrite('deposit_share', [String(expenseId)], remainingWei);
      await fetchDetail(expenseId);
    } catch (err) {
      setErrorMessage(err?.message || 'Deposit failed');
    }
  };

  const handleSettle = async (expenseId) => {
    try {
      await runWrite('settle', [String(expenseId)]);
      await fetchDetail(expenseId);
    } catch (err) {
      setErrorMessage(err?.message || 'Settle failed');
    }
  };

  const handleRetry = async (expenseId) => {
    try {
      await runWrite('retry_settlement', [String(expenseId)]);
      await fetchDetail(expenseId);
    } catch (err) {
      setErrorMessage(err?.message || 'Retry settlement failed');
    }
  };

  const renderShareEditor = (members, bpsMap, setBps, totalWei) => {
    const addrs = members.map((m) => normAddr(m)).filter(isAddress);
    const total = sumBasisPoints(addrs.map((m) => bpsMap[m] || '0'));
    const ok = total === BASIS_POINTS_TOTAL;
    return (
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase tracking-wider">
            Split (basis points, must sum to 10000)
          </label>
          <button type="button" className={btnGhost} onClick={() => applyEqualShares(addrs, setBps)}>
            <span className="material-symbols-outlined text-[16px]">equal</span>
            Equal split
          </button>
        </div>
        {addrs.map((addr) => {
          const bps = bpsMap[addr] || '0';
          const shareWei = computeShareWei(totalWei, bps);
          const isYou = account && sameAddr(addr, account);
          return (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_1fr] gap-space-xs items-center" key={addr}>
              <div className="font-data-mono-num text-data-mono-num text-primary-fixed">
                {shortAddr(addr)}{isYou ? ' · you' : ''}
              </div>
              <input
                className={inputClass}
                inputMode="numeric"
                value={bps}
                onChange={(e) => setBps({ ...bpsMap, [addr]: sanitizeBpsInput(e.target.value) })}
              />
              <div className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant">
                {formatBpsPercent(bps)} · {formatWeiToGen(shareWei)} GEN
              </div>
            </div>
          );
        })}
        <div className={`font-data-mono-num text-data-mono-num ${ok ? 'text-tertiary' : 'text-error'}`}>
          {total.toString()} / 10000 bps {ok ? '· ready' : '· adjust until this is exact'}
        </div>
      </div>
    );
  };

  const renderExpenseCard = (expense) => {
    const detail = details[expense.expense_id] || {};
    const status = detail.status || expense.status;
    const totalWei = toWeiString(detail.total_amount || expense.total_amount);
    const isOpen = activeExpenseId === expense.expense_id;
    const members = (detail.members || []).map(normAddr).filter(isAddress);
    const shares = detail.shares || {};
    const deposits = detail.deposits || {};
    const owed = detail.owed || {};
    const payoutWei = toWeiString(detail.payout_amount || '0');
    const payer = detail.payer || expense.payer;
    const isMember = account && members.some((m) => sameAddr(m, account));
    const isPayer = account && sameAddr(account, payer);
    const myKey = account ? normAddr(account) : '';
    const myOwed = myKey ? BigInt(toWeiString(owed[myKey] || '0')) : 0n;
    const myDeposited = myKey ? BigInt(toWeiString(deposits[myKey] || '0')) : 0n;
    const myRemaining = myOwed > myDeposited ? myOwed - myDeposited : 0n;
    const proposals = detail.proposals || [];
    const collected = members.reduce((acc, m) => {
      if (sameAddr(m, payer)) return acc;
      return acc + BigInt(toWeiString(deposits[m] || '0'));
    }, 0n);
    const collectTarget = BigInt(payoutWei || '0');
    const progressPct = collectTarget > 0n ? Number((collected * 100n) / collectTarget) : 0;

    return (
      <article className={`${glassCard} relative overflow-hidden`} key={expense.expense_id}>
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary-container via-primary-fixed to-[#8b6914] opacity-80" />
        <div className="flex items-start justify-between gap-space-md mb-space-md">
          <div>
            <div className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase tracking-wider">
              Expense #{expense.expense_id} · {detail.group_name || expense.group_name || 'group'}
            </div>
            <div className="font-display-hero text-headline-md font-extrabold text-primary-fixed tabular">
              {formatWeiToGen(totalWei)} GEN
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Payer receives {formatWeiToGen(payoutWei || '0')} GEN after deposits
            </p>
          </div>
          <span className={`px-space-sm py-space-2xs rounded-full font-label-telemetry-sm text-label-telemetry-sm uppercase ${statusTone(status)}`}>
            {status}
          </span>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          {(detail.description || expense.description || '').slice(0, 240)}
        </p>
        <div className="flex flex-col gap-space-2xs font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant mb-space-md">
          <div>Payer: <span className="font-data-mono-num text-data-mono-num text-primary">{shortAddr(payer)}</span></div>
          <div>Winning proposal: <span className="font-data-mono-num text-data-mono-num text-secondary">{detail.winning_proposal_id || '—'}</span></div>
        </div>

        {Object.keys(shares).length > 0 && (
          <div className="overflow-x-auto mb-space-md">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-on-surface-variant font-label-telemetry-sm text-label-telemetry-sm uppercase">
                  <th className="py-space-xs pr-space-sm font-medium">Member</th>
                  <th className="py-space-xs pr-space-sm font-medium">Share</th>
                  <th className="py-space-xs pr-space-sm font-medium text-right">Owes</th>
                  <th className="py-space-xs font-medium text-right">Deposited</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                    <td className={`py-space-xs font-data-mono-num text-data-mono-num ${sameAddr(m, payer) ? 'text-primary-container' : ''}`}>
                      {shortAddr(m)}{sameAddr(m, payer) ? ' · payer' : ''}
                    </td>
                    <td className="py-space-xs text-on-surface-variant">{formatBpsPercent(shares[m] || 0)}</td>
                    <td className="py-space-xs font-data-mono-num text-data-mono-num text-right tabular">
                      {formatWeiToGen(owed[m] || computeShareWei(totalWei, shares[m] || 0))} GEN
                    </td>
                    <td className="py-space-xs font-data-mono-num text-data-mono-num text-right tabular">
                      {sameAddr(m, payer) ? '—' : `${formatWeiToGen(deposits[m] || 0)} GEN`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(status === 'RESOLVED' || status === 'SETTLED' || status === 'PAYOUT_FAILED') && collectTarget > 0n && (
          <div className="h-2 rounded-full bg-[#0A0E1A] border border-white/10 overflow-hidden mb-space-md" aria-label="deposit progress">
            <span className="block h-full bg-gradient-to-r from-primary-container to-primary-fixed" style={{ width: `${progressPct > 100 ? 100 : progressPct}%` }} />
          </div>
        )}

        {detail.verdict_reason && (
          <div className="rounded-xl bg-surface-container/80 border border-white/10 p-space-md mb-space-md">
            <div className="font-label-telemetry-sm text-label-telemetry-sm text-primary-fixed uppercase">
              {status === 'DISPUTED' ? 'Latest note' : 'Verdict'}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{detail.verdict_reason}</p>
          </div>
        )}

        <div className="flex flex-col gap-space-sm pt-space-md border-t border-white/[0.08]">
          <button
            className={`${btnGhost} w-full`}
            type="button"
            onClick={() => {
              const next = isOpen ? '' : expense.expense_id;
              setActiveExpenseId(next);
              if (next) {
                fetchDetail(next);
                applyEqualShares(members, setDisputeBps);
              }
            }}
          >
            {isOpen ? 'Hide actions' : 'Open actions'}
          </button>

          {isOpen && (
            <>
              <button className={`${btnGhost} w-full`} type="button" onClick={() => copyShare(expense.expense_id)}>
                <span className="material-symbols-outlined text-[16px]">ios_share</span>
                Share expense link
              </button>

              {proposals.length > 0 && (
                <div className="flex flex-col gap-space-xs">
                  {proposals.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-xl bg-[#0A0E1A] p-space-sm border ${p.id === detail.winning_proposal_id ? 'border-primary-container/50' : 'border-white/10'}`}
                    >
                      <div className="flex justify-between font-headline-sm text-label-telemetry-sm">
                        <strong>Proposal #{p.id}</strong>
                        <span className="font-data-mono-num text-on-surface-variant">{shortAddr(p.proposer)}</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{p.evidence_text}</p>
                    </div>
                  ))}
                </div>
              )}

              {(status === 'PENDING' || status === 'DISPUTED') && isMember && (
                <button className={`${btnPrimary} w-full`} type="button" disabled={loading} onClick={() => handleAccept(expense.expense_id)}>
                  Accept latest split
                </button>
              )}

              {(status === 'PENDING' || status === 'DISPUTED') && isMember && (
                <>
                  {renderShareEditor(members, disputeBps, setDisputeBps, totalWei)}
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">
                    Evidence for your counter-split
                  </label>
                  <textarea
                    className={`${inputClass} min-h-[88px] font-body-md`}
                    rows={3}
                    placeholder="Receipt notes, who ordered what, payment confirmation…"
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                  />
                  <button className={`${btnGhost} w-full`} type="button" disabled={loading} onClick={() => handleDispute(expense.expense_id, members)}>
                    Dispute with this counter-split
                  </button>
                </>
              )}

              {status === 'DISPUTED' && proposals.length >= 2 && (
                <button className={`${btnSecondary} w-full`} type="button" disabled={loading} onClick={() => handleResolve(expense.expense_id)}>
                  {resolvingId === expense.expense_id ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      AI is comparing the proposals…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">balance</span>
                      Request AI resolution
                    </>
                  )}
                </button>
              )}

              {status === 'RESOLVED' && isMember && !isPayer && myRemaining > 0n && (
                <button className={`${btnPrimary} w-full`} type="button" disabled={loading} onClick={() => handleDeposit(expense.expense_id, myRemaining)}>
                  Deposit remaining {formatWeiToGen(myRemaining)} GEN
                </button>
              )}

              {status === 'RESOLVED' && isPayer && (
                <div className="rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] p-space-sm font-body-sm text-body-sm">
                  You already fronted this bill. Wait for the others to deposit, then settle.
                </div>
              )}

              {status === 'RESOLVED' && (
                <button className={`${btnGhost} w-full`} type="button" disabled={loading} onClick={() => handleSettle(expense.expense_id)}>
                  Settle — pay {formatWeiToGen(payoutWei)} GEN to payer
                </button>
              )}

              {status === 'PAYOUT_FAILED' && (
                <button className={`${btnPrimary} w-full`} type="button" disabled={loading} onClick={() => handleRetry(expense.expense_id)}>
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  Retry settlement
                </button>
              )}
            </>
          )}
        </div>
      </article>
    );
  };

  const banners = (
    <div className="w-full max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop flex flex-col gap-space-sm mb-space-lg">
      {!hasContractAddress && (
        <div className="rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] p-space-md font-body-sm text-body-sm">
          No contract address is wired yet. The app is in preview mode. Deploy on Studionet (61999), then set <span className="font-data-mono-num">VITE_CONTRACT_ADDRESS</span>.
        </div>
      )}
      {txHash && (
        <div className="rounded-xl bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary p-space-md font-body-sm text-body-sm">
          Transaction submitted:{' '}
          <a className="underline" href={txExplorerUrl(txHash)} target="_blank" rel="noreferrer">
            {shortAddr(txHash)}
          </a>
        </div>
      )}
      {shareHint && (
        <div className="rounded-xl bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary p-space-md font-body-sm text-body-sm">
          {shareHint}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl bg-error-container/40 border border-error/40 text-error p-space-md font-body-sm text-body-sm">
          {errorMessage}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
        <div className="h-20 max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <button type="button" className="flex items-center gap-space-sm" onClick={() => setTab('home')}>
              <img
                src="/logo.jpg"
                alt="SplitVerdict"
                className="h-10 w-10 rounded-xl object-cover shadow-[0_0_18px_rgba(212,175,55,0.4)]"
              />
              <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-primary">SplitVerdict</span>
            </button>
            <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-surface-container-high">
              <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse" />
              <span className="font-label-telemetry-sm text-label-telemetry-sm text-tertiary uppercase">Studionet 61999</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-space-xs">
            <button type="button" className={navClass(tab === 'home')} onClick={() => setTab('home')}>Home</button>
            <button type="button" className={navClass(tab === 'expenses')} onClick={() => setTab('expenses')}>Expenses</button>
            <button type="button" className={navClass(tab === 'groups')} onClick={() => setTab('groups')}>Groups</button>
            <button type="button" className={navClass(tab === 'new-expense')} onClick={() => setTab('new-expense')}>New expense</button>
            <button type="button" className={navClass(tab === 'new-group')} onClick={() => setTab('new-group')}>New group</button>
          </nav>
          <div className="flex items-center gap-space-sm">
            <a
              className="hidden sm:flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-telemetry-sm text-label-telemetry-sm transition-all"
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
            >
              <span className="material-symbols-outlined text-[16px]">water_drop</span>
              Faucet
            </a>
            {account ? (
              <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-xl bg-surface-container-low">
                <div className="text-right hidden sm:block">
                  <div className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant">{shortAddr(account)}</div>
                  <div className="font-data-mono-num text-data-mono-num font-bold text-primary-fixed">studionet</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                </div>
              </div>
            ) : (
              <button type="button" className={btnPrimary} onClick={connectWallet}>
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                Connect wallet
              </button>
            )}
          </div>
        </div>
        <nav className="md:hidden flex overflow-x-auto gap-space-xs px-gutter-mobile pb-space-sm">
          {['home', 'expenses', 'groups', 'new-expense', 'new-group'].map((id) => (
            <button key={id} type="button" className={navClass(tab === id)} onClick={() => setTab(id)}>
              {id.replace('-', ' ')}
            </button>
          ))}
        </nav>
      </header>

      <main className="w-full pt-20 bg-background min-h-screen">
        <div className="flex flex-col w-full relative overflow-hidden">
          <CosmicBackdrop />

          {tab === 'home' && (
            <>
              <div className="pt-space-lg">{banners}</div>
              <section className="relative w-full max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop pt-space-2xl pb-space-3xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
                  <div className="lg:col-span-7 flex flex-col items-start gap-space-lg">
                    <div className="inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-surface-container-high/90 shadow-[0_0_20px_rgba(212,175,55,0.18)]">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary-fixed-dim" />
                      </span>
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-tertiary uppercase tracking-wider">
                        Consensus matrix online
                      </span>
                      <span className="text-on-surface-variant font-label-telemetry-sm text-label-telemetry-sm">|</span>
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary-fixed">
                        {openCount} OPEN EXPENSES
                      </span>
                    </div>
                    <div className="flex flex-col gap-space-2xs">
                      <span className="font-label-telemetry-lg text-label-telemetry-lg tracking-widest text-primary-container uppercase">
                        AI-arbitrated group settlement
                      </span>
                      <h1 className="font-display-hero text-display-hero-mobile md:text-display-hero text-on-surface font-extrabold tracking-tight">
                        Split. Verify. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-container via-primary-fixed to-[#f5e6c0]">Settle.</span>
                      </h1>
                    </div>
                    <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                      Group expenses on <strong className="text-primary font-semibold">GenLayer</strong>. Members propose splits, independent AI validators must agree on one
                      <span className="font-data-mono-num"> winning_proposal_id</span>, then everyone deposits their exact share.
                    </p>
                    <div className="flex flex-wrap items-center gap-space-md pt-space-xs w-full sm:w-auto">
                      <button type="button" className={btnPrimary} onClick={() => setTab('expenses')}>
                        <span>Explore live expenses</span>
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                      </button>
                      <a className={btnGhost} href={FAUCET_URL} target="_blank" rel="noreferrer">
                        <span className="material-symbols-outlined text-secondary-fixed-dim text-[20px]">water_drop</span>
                        <span>Studio faucet</span>
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-space-lg pt-space-xs text-on-surface-variant font-label-telemetry-sm text-label-telemetry-sm">
                      <div className="flex items-center gap-space-2xs">
                        <span className="material-symbols-outlined text-tertiary-fixed-dim text-[18px]">verified_user</span>
                        <span>Exact-id AI consensus</span>
                      </div>
                      <div className="flex items-center gap-space-2xs">
                        <span className="material-symbols-outlined text-primary-container text-[18px]">payments</span>
                        <span>Integer basis-point splits</span>
                      </div>
                      <div className="flex items-center gap-space-2xs">
                        <span className="material-symbols-outlined text-secondary text-[18px]">lock_open</span>
                        <span>Non-custodial GEN vault</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex justify-center items-center relative">
                    <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
                      <div className="absolute inset-6 rounded-[2.75rem] bg-[#d4af37]/25 blur-3xl animate-pulse" />
                      <img
                        src="/logo.jpg"
                        alt="SplitVerdict logo"
                        className="relative z-10 w-[86%] max-w-[360px] rounded-[2.4rem] object-cover shadow-[0_24px_60px_rgba(0,0,0,0.78),0_0_48px_rgba(212,175,55,0.38)]"
                      />
                      <div className="absolute -bottom-3 -left-4 z-20 px-space-md py-space-xs rounded-xl bg-surface-container-high/95 backdrop-blur-xl shadow-xl flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary-container text-[20px]">query_stats</span>
                        <div className="flex flex-col">
                          <span className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant">AI CONSENSUS</span>
                          <span className="font-data-mono-num text-data-mono-num text-primary-fixed font-bold">strict_eq id</span>
                        </div>
                      </div>
                      <div className="absolute -top-3 -right-3 z-20 px-space-md py-space-xs rounded-xl bg-surface-container-high/95 backdrop-blur-xl shadow-xl flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary-container text-[20px]">bolt</span>
                        <div className="flex flex-col">
                          <span className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant">GROUPS</span>
                          <span className="font-data-mono-num text-data-mono-num text-primary-fixed font-bold">{groups.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="w-full max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop -mt-space-md mb-space-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                  <div className="group relative rounded-2xl bg-surface-container-low/85 backdrop-blur-xl p-space-lg shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.18)] transition-all duration-300 flex items-center justify-between">
                    <div className="flex flex-col gap-space-2xs">
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase tracking-wider">Active groups</span>
                      <div className="font-display-hero text-headline-lg font-extrabold text-on-surface tracking-tight tabular">{groups.length}</div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Crews sharing on-chain expenses</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container">
                      <span className="material-symbols-outlined text-[26px]">groups</span>
                    </div>
                  </div>
                  <div className="group relative rounded-2xl bg-surface-container-low/85 backdrop-blur-xl p-space-lg shadow-lg hover:shadow-[0_0_20px_rgba(224,182,255,0.2)] transition-all duration-300 flex items-center justify-between">
                    <div className="flex flex-col gap-space-2xs">
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase tracking-wider">Open ledger</span>
                        <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                      </div>
                      <div className="font-display-hero text-headline-lg font-extrabold text-secondary tracking-tight tabular">
                        {formatWeiToGen(totalLockedWei)} <span className="text-headline-sm font-headline-sm text-secondary-fixed font-medium">GEN</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{openCount} expenses still open</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-[26px]">savings</span>
                    </div>
                  </div>
                  <div className="group relative rounded-2xl bg-surface-container-low/85 backdrop-blur-xl p-space-lg shadow-lg hover:shadow-[0_0_20px_rgba(52,248,133,0.15)] transition-all duration-300 flex items-center justify-between">
                    <div className="flex flex-col gap-space-2xs">
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase tracking-wider">Settled telemetry</span>
                      <div className="font-display-hero text-headline-lg font-extrabold text-on-surface tracking-tight tabular">
                        {settledCount} <span className="text-headline-sm font-headline-sm text-tertiary font-medium">paid</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Validated by GenLayer AI consensus</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-tertiary">
                      <span className="material-symbols-outlined text-[26px]">task_alt</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="w-full max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop py-space-xl" id="mode-selection">
                <div className="flex flex-col gap-space-xs mb-space-xl text-center items-center">
                  <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary uppercase tracking-widest">Choose your settlement path</span>
                  <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">Engineered settlement chambers</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
                    Accept an uncontested split, or escalate to AI arbitration when the table cannot agree.
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl">
                  <div className="group relative rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl p-space-xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6)] hover:shadow-[0_0_35px_rgba(212,175,55,0.28)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary-container via-primary to-primary-container opacity-80" />
                    <div>
                      <div className="flex items-center justify-between mb-space-lg">
                        <div className="flex items-center gap-space-md">
                          <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary-container">
                            <span className="material-symbols-outlined text-[32px]">handshake</span>
                          </div>
                          <div>
                            <div className="inline-flex items-center gap-space-xs">
                              <span className="font-headline-md text-headline-md font-bold text-on-surface">ACCEPT PATH</span>
                              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                            </div>
                            <span className="font-body-sm text-body-sm text-on-surface-variant">Uncontested splits</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-space-sm mb-space-xl">
                        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/40">
                          <span className="material-symbols-outlined text-primary text-[20px]">group</span>
                          <div>
                            <strong className="text-on-surface font-semibold">Create a group</strong>
                            <p className="text-on-surface-variant font-body-sm text-body-sm">Add at least one other wallet. Creator is always included.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/40">
                          <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                          <div>
                            <strong className="text-on-surface font-semibold">Log the expense</strong>
                            <p className="text-on-surface-variant font-body-sm text-body-sm">Shares must sum to exactly 10000 basis points. Integer GEN only.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/40">
                          <span className="material-symbols-outlined text-tertiary text-[20px]">bolt</span>
                          <div>
                            <strong className="text-on-surface font-semibold">Accept, deposit, settle</strong>
                            <p className="text-on-surface-variant font-body-sm text-body-sm">A member accepts the latest proposal. Others deposit exact remaining shares.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={() => setTab('new-group')}>
                      <span>Open a group</span>
                      <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                    </button>
                  </div>

                  <div className="group relative rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl p-space-xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6)] hover:shadow-[0_0_35px_rgba(224,182,255,0.3)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#8b6914] via-primary-container to-primary-fixed opacity-80" />
                    <div>
                      <div className="flex items-center justify-between mb-space-lg">
                        <div className="flex items-center gap-space-md">
                          <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-secondary">
                            <span className="material-symbols-outlined text-[32px]">balance</span>
                          </div>
                          <div>
                            <div className="inline-flex items-center gap-space-xs">
                              <span className="font-headline-md text-headline-md font-bold text-on-surface">DISPUTE PATH</span>
                              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                            </div>
                            <span className="font-body-sm text-body-sm text-on-surface-variant">AI oracle arbitration</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-space-sm mb-space-xl">
                        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/40">
                          <span className="material-symbols-outlined text-secondary text-[20px]">psychology</span>
                          <div>
                            <strong className="text-on-surface font-semibold">Counter-split + evidence</strong>
                            <p className="text-on-surface-variant font-body-sm text-body-sm">File a competing basis-point map with receipt notes. Status becomes DISPUTED.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/40">
                          <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
                          <div>
                            <strong className="text-on-surface font-semibold">Validators must match one id</strong>
                            <p className="text-on-surface-variant font-body-sm text-body-sm">No score tolerance. Every validator returns the same winning_proposal_id.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/40">
                          <span className="material-symbols-outlined text-tertiary text-[20px]">tune</span>
                          <div>
                            <strong className="text-on-surface font-semibold">{disputedCount} disputes open</strong>
                            <p className="text-on-surface-variant font-body-sm text-body-sm">Request AI resolution, then deposit the exact remaining share.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={() => setTab('expenses')}>
                      <span>Browse disputes</span>
                      <span className="material-symbols-outlined text-[20px]">explore</span>
                    </button>
                  </div>
                </div>
              </section>

              <section className="w-full max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop py-space-2xl">
                <div className="rounded-3xl bg-surface-container-low/75 backdrop-blur-2xl p-space-xl sm:p-space-2xl shadow-xl relative overflow-hidden">
                  <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary-container/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-2xl">
                    <div className="flex flex-col gap-space-2xs">
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-tertiary uppercase tracking-widest">Consensus protocol</span>
                      <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">How verifiable settlement works</h2>
                      <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
                        A trustless loop: competing splits, independent AI validators, then exact-share GEN payouts.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-high font-label-telemetry-sm text-label-telemetry-sm text-primary">
                      <span className="material-symbols-outlined text-[16px]">memory</span>
                      <span>GenLayer Intelligent Contract</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-xl">
                    <div className="relative flex flex-col gap-space-md p-space-lg rounded-2xl bg-surface-container/60">
                      <div className="flex items-center justify-between">
                        <span className="font-display-hero text-headline-lg font-extrabold text-primary-container/30">01</span>
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary-container">
                          <span className="material-symbols-outlined text-[22px]">edit_note</span>
                        </div>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Propose the split</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Log the bill with integer GEN and a 10000-bps map. Members accept it or file a counter-proposal plus evidence.</p>
                    </div>
                    <div className="relative flex flex-col gap-space-md p-space-lg rounded-2xl bg-surface-container/60">
                      <div className="flex items-center justify-between">
                        <span className="font-display-hero text-headline-lg font-extrabold text-secondary/30">02</span>
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary">
                          <span className="material-symbols-outlined text-[22px]">hub</span>
                        </div>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">AI validators cross-examine</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Independent GenLayer nodes read every proposal and must return the exact same winning_proposal_id.</p>
                    </div>
                    <div className="relative flex flex-col gap-space-md p-space-lg rounded-2xl bg-surface-container/60">
                      <div className="flex items-center justify-between">
                        <span className="font-display-hero text-headline-lg font-extrabold text-tertiary-fixed-dim/30">03</span>
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-tertiary">
                          <span className="material-symbols-outlined text-[22px]">redeem</span>
                        </div>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Deposit unlocks payout</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Non-payers deposit floor(total × bps / 10000). Settle forwards that sum to the original payer.</p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {tab !== 'home' && (
            <div className="relative w-full max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop pt-space-xl pb-space-3xl">
              {banners}

              {tab === 'expenses' && (
                <div>
                  <div className="flex items-center justify-between mb-space-lg">
                    <div>
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary uppercase tracking-widest">Live ledger</span>
                      <h2 className="font-headline-lg text-headline-lg font-bold">Open expenses</h2>
                    </div>
                    <button className={btnGhost} type="button" onClick={refreshAll} disabled={listLoading || !hasContractAddress}>
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      Refresh
                    </button>
                  </div>
                  {hasContractAddress && listLoading && expenses.length === 0 && (
                    <div className={`${glassCard} text-center text-on-surface-variant`}>Loading expenses from Studionet…</div>
                  )}
                  {hasContractAddress && !listLoading && expenses.length === 0 && (
                    <div className={`${glassCard} text-center`}>
                      <p className="text-on-surface-variant">No expenses yet.</p>
                      <button className={`${btnPrimary} mt-space-md`} type="button" onClick={() => setTab('new-expense')}>Log the first expense</button>
                    </div>
                  )}
                  {!hasContractAddress && (
                    <div className={`${glassCard} text-center`}>
                      <p className="text-on-surface-variant">Preview mode — a deployed contract is required to load live expenses.</p>
                      <button className={`${btnPrimary} mt-space-md`} type="button" onClick={() => setTab('new-group')}>Explore create flow</button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                    {expenses.map(renderExpenseCard)}
                  </div>
                </div>
              )}

              {tab === 'groups' && (
                <div>
                  <div className="flex items-center justify-between mb-space-lg">
                    <div>
                      <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary uppercase tracking-widest">Crews</span>
                      <h2 className="font-headline-lg text-headline-lg font-bold">Groups</h2>
                    </div>
                    <button className={btnGhost} type="button" onClick={fetchGroups} disabled={!hasContractAddress}>
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      Refresh
                    </button>
                  </div>
                  {groups.length === 0 && (
                    <div className={`${glassCard} text-center`}>
                      <p className="text-on-surface-variant">No groups yet.</p>
                      <button className={`${btnPrimary} mt-space-md`} type="button" onClick={() => setTab('new-group')}>Create a group</button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                    {groups.map((g) => (
                      <div className={glassCard} key={g.group_id}>
                        <div className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">Group #{g.group_id}</div>
                        <div className="font-headline-md text-headline-md text-primary-fixed mb-space-md">{g.name}</div>
                        <div className="flex flex-col gap-space-2xs font-data-mono-num text-data-mono-num text-on-surface-variant mb-space-md">
                          <div>Creator: {shortAddr(g.creator)}</div>
                          {(g.members || []).map((m) => (
                            <div key={m}>{shortAddr(m)}</div>
                          ))}
                        </div>
                        <button
                          className={`${btnPrimary} w-full`}
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(String(g.group_id));
                            applyEqualShares(g.members || [], setShareBps);
                            setTab('new-expense');
                          }}
                        >
                          Log expense in this group
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'new-group' && (
                <form className={`${glassCard} max-w-3xl mx-auto`} onSubmit={handleCreateGroup}>
                  <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary uppercase tracking-widest">New crew</span>
                  <h2 className="font-headline-lg text-headline-lg font-bold mb-space-lg">Create a group</h2>
                  <div className="flex flex-wrap gap-space-sm mb-space-lg">
                    {GROUP_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`text-left min-w-[150px] rounded-xl p-space-sm border ${groupName === p.name ? 'border-primary-container shadow-[0_0_15px_rgba(212,175,55,0.28)]' : 'border-white/10 bg-[#0A0E1A]'}`}
                        onClick={() => setGroupName(p.name)}
                      >
                        <b className="block">{p.icon} {p.name}</b>
                        <span className="text-on-surface-variant font-body-sm text-body-sm">{p.blurb}</span>
                      </button>
                    ))}
                  </div>
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">Group name</label>
                  <input className={`${inputClass} mb-space-lg mt-space-xs`} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">Other member addresses</label>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Your wallet is added automatically.</p>
                  {memberInputs.map((m, i) => (
                    <div className="flex gap-space-xs mb-space-xs" key={`m-${i}`}>
                      <input
                        className={inputClass}
                        placeholder="0x…"
                        value={m}
                        onChange={(e) => {
                          const next = [...memberInputs];
                          next[i] = e.target.value;
                          setMemberInputs(next);
                        }}
                      />
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={async () => {
                          const text = await pasteClipboard();
                          const next = [...memberInputs];
                          next[i] = text;
                          setMemberInputs(next);
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">content_paste</span>
                      </button>
                      {memberInputs.length > 1 && (
                        <button type="button" className={btnGhost} onClick={() => setMemberInputs(memberInputs.filter((_, j) => j !== i))}>
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className={`${btnGhost} mb-space-lg`} onClick={() => setMemberInputs([...memberInputs, ''])}>
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add member
                  </button>
                  <button className={`${btnPrimary} w-full`} type="submit" disabled={loading || !hasContractAddress}>
                    {loading ? 'Creating…' : 'Create group'}
                  </button>
                </form>
              )}

              {tab === 'new-expense' && (
                <form className={`${glassCard} max-w-3xl mx-auto`} onSubmit={handleCreateExpense}>
                  <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary uppercase tracking-widest">New bill</span>
                  <h2 className="font-headline-lg text-headline-lg font-bold mb-space-lg">Log an expense</h2>
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">Group</label>
                  {groups.length === 0 ? (
                    <div className="rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] p-space-sm my-space-sm font-body-sm">
                      No groups yet.{' '}
                      <button type="button" className="underline" onClick={() => setTab('new-group')}>Create a group first</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-space-xs my-space-sm">
                      {groups.map((g) => (
                        <button
                          key={g.group_id}
                          type="button"
                          className={`px-space-sm py-space-xs rounded-full border font-label-telemetry-sm ${String(selectedGroupId) === String(g.group_id) ? 'border-primary-container text-primary-fixed bg-primary-container/10' : 'border-white/10 text-on-surface-variant'}`}
                          onClick={() => {
                            setSelectedGroupId(String(g.group_id));
                            applyEqualShares(g.members || [], setShareBps);
                          }}
                        >
                          {g.name} #{g.group_id}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase mt-space-md block">What was this for?</label>
                  <div className="flex flex-wrap gap-space-sm my-space-sm">
                    {EXPENSE_PRESETS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`text-left min-w-[140px] rounded-xl p-space-sm border ${expensePresetId === c.id ? 'border-primary-container' : 'border-white/10 bg-[#0A0E1A]'}`}
                        onClick={() => {
                          setExpensePresetId(c.id);
                          setDescription(c.description);
                        }}
                      >
                        <b className="block">{c.icon} {c.name}</b>
                        <span className="text-on-surface-variant font-body-sm">{c.blurb}</span>
                      </button>
                    ))}
                  </div>
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">Description</label>
                  <textarea className={`${inputClass} min-h-[88px] font-body-md my-space-sm`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                  <label className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant uppercase">Total amount (GEN)</label>
                  <div className="flex flex-wrap gap-space-xs my-space-sm">
                    {AMOUNT_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`px-space-sm py-space-2xs rounded-full border font-data-mono-num ${amountStr === p ? 'border-primary-container text-primary-fixed' : 'border-white/10 text-on-surface-variant'}`}
                        onClick={() => setAmountStr(p)}
                      >
                        {p} GEN
                      </button>
                    ))}
                  </div>
                  <input className={`${inputClass} mb-space-2xs`} inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(sanitizeGenInput(e.target.value))} />
                  <div className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant mb-space-lg">
                    wei (parseGenToWei): {weiPreview.toString()}
                  </div>
                  <div className="mb-space-lg">{renderShareEditor(selectedMembers, shareBps, setShareBps, weiPreview)}</div>
                  <button className={`${btnPrimary} w-full`} type="submit" disabled={loading || !hasContractAddress || groups.length === 0}>
                    {loading ? 'Saving…' : `Create expense · ${formatWeiToGen(weiPreview)} GEN`}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {toastOpen && (txHash || resolvingId) && (
        <aside className="fixed bottom-6 right-6 z-40 max-w-sm rounded-2xl bg-surface-container-high/95 backdrop-blur-2xl p-space-md shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(212,175,55,0.22)]">
          <div className="flex items-start gap-space-sm">
            <div className="w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary-container shrink-0">
              <span className="material-symbols-outlined text-[20px] animate-spin" style={{ animationDuration: '4s' }}>sync</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-label-telemetry-sm text-label-telemetry-sm text-primary-fixed uppercase tracking-wider">Consensus watcher</span>
                <button type="button" className="text-on-surface-variant hover:text-on-surface" onClick={() => setToastOpen(false)}>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface font-medium">
                {resolvingId ? `AI is comparing proposals on expense #${resolvingId}` : 'Write submitted on Studionet'}
              </p>
              {txHash && (
                <a className="font-label-telemetry-sm text-label-telemetry-sm text-tertiary underline" href={txExplorerUrl(txHash)} target="_blank" rel="noreferrer">
                  {shortAddr(txHash)}
                </a>
              )}
            </div>
          </div>
        </aside>
      )}

      <footer className="w-full bg-surface-container-lowest py-space-xl shadow-[0_-1px_8px_rgba(0,0,0,0.4)]">
        <div className="max-w-max-container mx-auto px-gutter-mobile md:px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-md text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-space-md">
            <div className="flex items-center gap-space-xs">
              <img src="/logo.jpg" alt="" className="h-8 w-8 rounded-lg object-cover" />
              <span className="font-headline-sm text-headline-sm font-bold text-primary">SplitVerdict</span>
            </div>
            <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-surface-container-low">
              <span className="w-2 h-2 rounded-full bg-tertiary-container animate-ping" />
              <span className="font-label-telemetry-sm text-label-telemetry-sm text-tertiary">Studionet heartbeat: nominal</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary-fixed-dim text-[16px]">verified</span>
              <span className="font-label-telemetry-sm text-label-telemetry-sm">Verifiable AI settlement on GenLayer</span>
            </div>
          </div>
          <div className="flex items-center gap-space-lg">
            {hasContractAddress && (
              <a
                className="font-label-telemetry-sm text-label-telemetry-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-space-2xs"
                href={EXPLORER_CONTRACT}
                target="_blank"
                rel="noreferrer"
              >
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                Contract: {shortAddr(CONTRACT_ADDRESS)}
              </a>
            )}
            <span className="font-label-telemetry-sm text-label-telemetry-sm text-outline-variant">© 2026 SplitVerdict</span>
          </div>
        </div>
      </footer>
    </div>
  );
}