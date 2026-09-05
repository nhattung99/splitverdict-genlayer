import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Scale,
  Wallet,
  PlusCircle,
  List,
  RefreshCw,
  ClipboardPaste,
  RotateCcw,
  Plus,
  Trash2,
  Share2,
  Users,
  Receipt,
  ExternalLink,
  Equal,
} from 'lucide-react';
import {
  CONTRACT_ADDRESS,
  hasContractAddress,
  getReadClient,
  getWriteClient,
  parseJsonMaybe,
  waitForTx,
  switchToStudionet,
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
  addressExplorerUrl,
} from './genlayerClient.js';
import { GROUP_PRESETS, EXPENSE_PRESETS, AMOUNT_PRESETS } from './data/presets.js';

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

const statusClass = (status) => `badge badge-${String(status || '').toLowerCase()}`;

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

export default function App() {
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState(readParam('tab') || 'expenses');
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [shareHint, setShareHint] = useState('');

  const [groupName, setGroupName] = useState(GROUP_PRESETS[0].name);
  const [memberInputs, setMemberInputs] = useState(['']);

  const [expensePresetId, setExpensePresetId] = useState(EXPENSE_PRESETS[0].id);
  const [description, setDescription] = useState(EXPENSE_PRESETS[0].description);
  const [amountStr, setAmountStr] = useState('1');
  const [selectedGroupId, setSelectedGroupId] = useState(readParam('group') || '');
  const [shareBps, setShareBps] = useState({});

  const [disputeBps, setDisputeBps] = useState({});
  const [evidenceText, setEvidenceText] = useState('');
  const [activeExpenseId, setActiveExpenseId] = useState(readParam('expense') || '');

  const weiPreview = parseGenToWei(amountStr);
  const selectedGroup = groups.find((g) => String(g.group_id) === String(selectedGroupId));
  const selectedMembers = useMemo(() => {
    const raw = selectedGroup?.members || [];
    const list = raw.map((m) => normAddr(m)).filter(isAddress);
    if (account && !list.some((m) => sameAddr(m, account))) {
      return list;
    }
    return list;
  }, [selectedGroup, account]);

  const shareSum = useMemo(
    () => sumBasisPoints(selectedMembers.map((m) => shareBps[m] || '0')),
    [selectedMembers, shareBps]
  );

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
      throw new Error('No contract address is configured. Deploy on GenLayer Studio, then set VITE_CONTRACT_ADDRESS.');
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
        console.warn('studionet connect note:', err);
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
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: fnName,
        args,
        ...(value !== undefined ? { value } : {}),
      });
      setTxHash(hash);
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
      const newId = (countAfter - 1n).toString();
      setSelectedGroupId(newId);
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
      const payload = sharesToJson(members, disputeBps);
      await runWrite('dispute_split', [String(expenseId), payload, evidenceText.trim()]);
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
      <div className="field">
        <div className="row-between">
          <label className="label">Split (basis points, must sum to 10000)</label>
          <button type="button" className="btn-ghost" onClick={() => applyEqualShares(addrs, setBps)}>
            <Equal size={14} /> Equal split
          </button>
        </div>
        {addrs.map((addr) => {
          const bps = bpsMap[addr] || '0';
          const shareWei = computeShareWei(totalWei, bps);
          const isPayer = account && sameAddr(addr, account);
          return (
            <div className="share-row" key={addr}>
              <div className="mono">{shortAddr(addr)}{isPayer ? ' · you' : ''}</div>
              <input
                className="input mono"
                inputMode="numeric"
                value={bps}
                onChange={(e) => setBps({ ...bpsMap, [addr]: sanitizeBpsInput(e.target.value) })}
              />
              <div className="hint" style={{ marginTop: 0 }}>
                {formatBpsPercent(bps)} · {formatWeiToGen(shareWei)} GEN
              </div>
              <div />
            </div>
          );
        })}
        <div className={`share-sum ${ok ? 'ok' : 'bad'}`}>
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
      <div className="card" key={expense.expense_id}>
        <div className="row-between">
          <div>
            <div className="label">Expense #{expense.expense_id} · {detail.group_name || expense.group_name || 'group'}</div>
            <div className="amount">{formatWeiToGen(totalWei)} GEN</div>
            <div className="hint">Payer receives {formatWeiToGen(payoutWei || computeShareWei(totalWei, '0'))} GEN after deposits</div>
          </div>
          <span className={statusClass(status)}>{status}</span>
        </div>
        <p className="desc">{(detail.description || expense.description || '').slice(0, 240)}</p>
        <div className="stack meta">
          <div>Payer: <span className="mono">{shortAddr(payer)}</span></div>
          <div>Winning proposal: <span className="mono">{detail.winning_proposal_id || '—'}</span></div>
        </div>

        {Object.keys(shares).length > 0 && (
          <table className="share-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Share</th>
                <th>Owes</th>
                <th>Deposited</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m} className={sameAddr(m, payer) ? 'payer-row' : ''}>
                  <td className="mono">{shortAddr(m)}{sameAddr(m, payer) ? ' · payer' : ''}</td>
                  <td>{formatBpsPercent(shares[m] || 0)}</td>
                  <td className="mono">{formatWeiToGen(owed[m] || computeShareWei(totalWei, shares[m] || 0))} GEN</td>
                  <td className="mono">{sameAddr(m, payer) ? '—' : `${formatWeiToGen(deposits[m] || 0)} GEN`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(status === 'RESOLVED' || status === 'SETTLED' || status === 'PAYOUT_FAILED') && collectTarget > 0n && (
          <div className="progress" aria-label="deposit progress">
            <span style={{ width: `${progressPct > 100 ? 100 : progressPct}%` }} />
          </div>
        )}

        {detail.verdict_reason && (
          <div className={`verdict-box verdict-${String(status).toLowerCase()}`}>
            <strong>{status === 'DISPUTED' ? 'Latest note' : 'Verdict'}</strong>
            <p>{detail.verdict_reason}</p>
          </div>
        )}

        <div className="actions">
          <button
            className="btn-ghost full"
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
              <button className="btn-secondary full" type="button" onClick={() => copyShare(expense.expense_id)}>
                <Share2 size={15} /> Share expense link
              </button>

              {proposals.length > 0 && (
                <div className="proposal-list">
                  {proposals.map((p) => (
                    <div
                      key={p.id}
                      className={`proposal-item ${p.id === detail.winning_proposal_id ? 'winner' : ''}`}
                    >
                      <div className="row-between">
                        <strong>Proposal #{p.id}</strong>
                        <span className="mono">{shortAddr(p.proposer)}</span>
                      </div>
                      <p className="hint">{p.evidence_text}</p>
                    </div>
                  ))}
                </div>
              )}

              {(status === 'PENDING' || status === 'DISPUTED') && isMember && (
                <button className="btn-primary full" type="button" disabled={loading} onClick={() => handleAccept(expense.expense_id)}>
                  Accept latest split
                </button>
              )}

              {(status === 'PENDING' || status === 'DISPUTED') && isMember && (
                <>
                  {renderShareEditor(members, disputeBps, setDisputeBps, totalWei)}
                  <div className="field">
                    <label className="label">Evidence for your counter-split</label>
                    <textarea
                      className="input textarea"
                      rows={3}
                      placeholder="Receipt notes, who ordered what, Venmo screenshot description…"
                      value={evidenceText}
                      onChange={(e) => setEvidenceText(e.target.value)}
                    />
                  </div>
                  <button className="btn-secondary full" type="button" disabled={loading} onClick={() => handleDispute(expense.expense_id, members)}>
                    Dispute with this counter-split
                  </button>
                </>
              )}

              {status === 'DISPUTED' && proposals.length >= 2 && (
                <button className="btn-ai" type="button" disabled={loading} onClick={() => handleResolve(expense.expense_id)}>
                  {resolvingId === expense.expense_id ? (
                    <>
                      <span className="spinner" /> AI is comparing the proposals…
                    </>
                  ) : (
                    <>
                      <Scale size={16} /> Request AI resolution
                    </>
                  )}
                </button>
              )}

              {status === 'RESOLVED' && isMember && !isPayer && myRemaining > 0n && (
                <button className="btn-primary full" type="button" disabled={loading} onClick={() => handleDeposit(expense.expense_id, myRemaining)}>
                  Deposit remaining {formatWeiToGen(myRemaining)} GEN
                </button>
              )}

              {status === 'RESOLVED' && isPayer && (
                <div className="warn-box">You already fronted this bill. Wait for the others to deposit, then settle.</div>
              )}

              {status === 'RESOLVED' && (
                <button className="btn-secondary full" type="button" disabled={loading} onClick={() => handleSettle(expense.expense_id)}>
                  Settle — pay {formatWeiToGen(payoutWei)} GEN to payer
                </button>
              )}

              {status === 'PAYOUT_FAILED' && (
                <button className="btn-primary full" type="button" disabled={loading} onClick={() => handleRetry(expense.expense_id)}>
                  <RotateCcw size={15} /> Retry settlement
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="free-banner">
        Free to use — you only pay GenLayer network gas when you sign a transaction. There is no platform fee.
      </div>

      {!hasContractAddress && (
        <div className="missing-banner">
          No contract address is wired yet. The app is in preview mode and will not crash.
          Deploy on GenLayer Studio, confirm <strong>Result: SUCCESS</strong>, then set{' '}
          <span className="mono">VITE_CONTRACT_ADDRESS</span> in <span className="mono">frontend/.env</span> and restart{' '}
          <span className="mono">npm run dev</span>.
        </div>
      )}

      <header className="header">
        <div className="brand">
          <div className="brand-mark">
            <Scale size={22} />
          </div>
          <div>
            <h1>SplitVerdict</h1>
            <p>AI-arbitrated group expense settlement</p>
          </div>
        </div>
        <div className="header-right">
          <div className="network"><span className="dot" /> studionet</div>
          {account ? (
            <button className="btn-secondary mono" type="button">
              <Wallet size={16} /> {shortAddr(account)}
            </button>
          ) : (
            <button className="btn-primary" type="button" onClick={connectWallet}>
              <Wallet size={16} /> Connect wallet
            </button>
          )}
        </div>
      </header>

      <section className="howto-card">
        <h2>How to try this app</h2>
        <ol>
          <li>Install MetaMask. Click <strong>Connect wallet</strong> — the app switches to <strong>studionet</strong>.</li>
          <li>Fund that address with GEN from the GenLayer Studio <strong>Accounts</strong> panel. Do not use the public testnet faucet.</li>
          <li>Create a group with at least one other member address, then log an expense. Shares must sum to exactly <span className="mono">10000</span> bps.</li>
          <li>A member can <strong>Accept latest split</strong>, or <strong>Dispute</strong> with a counter-split plus evidence. A second funded wallet is best for the dispute path.</li>
          <li>On a dispute, request AI resolution. Validators must agree on the exact <span className="mono">winning_proposal_id</span>.</li>
          <li>Each non-payer deposits their exact remaining share, then anyone can <strong>Settle</strong> to pay the original payer. Open the tx on{' '}
            <a className="explorer-link" href={addressExplorerUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
              Studio Explorer <ExternalLink size={13} />
            </a>.
          </li>
        </ol>
      </section>

      <nav className="tabs">
        <button className={`tab ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>
          <Receipt size={16} /> Expenses ({expenses.length})
        </button>
        <button className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
          <Users size={16} /> Groups ({groups.length})
        </button>
        <button className={`tab ${tab === 'new-group' ? 'active' : ''}`} onClick={() => setTab('new-group')}>
          <PlusCircle size={16} /> New group
        </button>
        <button className={`tab ${tab === 'new-expense' ? 'active' : ''}`} onClick={() => setTab('new-expense')}>
          <List size={16} /> New expense
        </button>
      </nav>

      {txHash && (
        <div className="ok-banner">
          Transaction submitted:{' '}
          <a className="explorer-link" href={txExplorerUrl(txHash)} target="_blank" rel="noreferrer">
            {shortAddr(txHash)} <ExternalLink size={13} />
          </a>
        </div>
      )}
      {shareHint && <div className="ok-banner">{shareHint}</div>}
      {errorMessage && <div className="err-banner">{errorMessage}</div>}

      {tab === 'expenses' && (
        <div>
          <div className="row-between" style={{ marginBottom: '1rem' }}>
            <h2>Open expenses</h2>
            <button className="btn-secondary" type="button" onClick={refreshAll} disabled={listLoading || !hasContractAddress}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {!hasContractAddress && (
            <div className="card empty">
              <Scale size={36} />
              <p style={{ marginTop: '0.75rem' }}>Preview mode — a deployed contract address is required to load live expenses.</p>
              <button className="btn-primary" style={{ marginTop: '1rem' }} type="button" onClick={() => setTab('new-group')}>
                Explore create flow
              </button>
            </div>
          )}

          {hasContractAddress && listLoading && expenses.length === 0 && (
            <div className="card empty">
              <p>Loading expenses from studionet…</p>
            </div>
          )}

          {hasContractAddress && !listLoading && expenses.length === 0 && (
            <div className="card empty">
              <p>No expenses yet.</p>
              <button className="btn-primary" style={{ marginTop: '1rem' }} type="button" onClick={() => setTab('new-expense')}>
                Log the first expense
              </button>
            </div>
          )}

          <div className="grid">
            {expenses.map(renderExpenseCard)}
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div>
          <div className="row-between" style={{ marginBottom: '1rem' }}>
            <h2>Groups</h2>
            <button className="btn-secondary" type="button" onClick={fetchGroups} disabled={!hasContractAddress}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {groups.length === 0 && (
            <div className="card empty">
              <p>No groups yet.</p>
              <button className="btn-primary" style={{ marginTop: '1rem' }} type="button" onClick={() => setTab('new-group')}>
                Create a group
              </button>
            </div>
          )}
          <div className="grid">
            {groups.map((g) => (
              <div className="card" key={g.group_id}>
                <div className="row-between">
                  <div>
                    <div className="label">Group #{g.group_id}</div>
                    <div className="amount" style={{ fontSize: '1rem' }}>{g.name}</div>
                  </div>
                </div>
                <div className="stack meta" style={{ marginTop: '0.7rem' }}>
                  <div>Creator: <span className="mono">{shortAddr(g.creator)}</span></div>
                  {(g.members || []).map((m) => (
                    <div key={m} className="mono">{shortAddr(m)}</div>
                  ))}
                </div>
                <div className="actions">
                  <button
                    className="btn-primary full"
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
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'new-group' && (
        <form className="card create-card" onSubmit={handleCreateGroup}>
          <h2>Create a group</h2>
          <div className="field">
            <label className="label">Name preset</label>
            <div className="chips">
              {GROUP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip-card ${groupName === p.name ? 'active' : ''}`}
                  onClick={() => setGroupName(p.name)}
                >
                  <b>{p.icon} {p.name}</b>
                  <span>{p.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label">Group name</label>
            <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Other member addresses (your wallet is added automatically)</label>
            {memberInputs.map((m, i) => (
              <div className="url-row" key={`m-${i}`}>
                <input
                  className="input mono"
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
                  className="btn-ghost"
                  onClick={async () => {
                    const text = await pasteClipboard();
                    const next = [...memberInputs];
                    next[i] = text;
                    setMemberInputs(next);
                  }}
                >
                  <ClipboardPaste size={14} /> Paste
                </button>
                {memberInputs.length > 1 && (
                  <button type="button" className="btn-ghost" onClick={() => setMemberInputs(memberInputs.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setMemberInputs([...memberInputs, ''])}>
              <Plus size={14} /> Add member
            </button>
            <div className="hint">Need at least one other 0x address. Creator is always included.</div>
          </div>
          <button className="btn-primary full" type="submit" disabled={loading || !hasContractAddress}>
            {loading ? 'Creating…' : 'Create group'}
          </button>
          {!hasContractAddress && <p className="hint">Create stays disabled until VITE_CONTRACT_ADDRESS is set.</p>}
        </form>
      )}

      {tab === 'new-expense' && (
        <form className="card create-card" onSubmit={handleCreateExpense}>
          <h2>Log an expense</h2>

          <div className="field">
            <label className="label">Group</label>
            {groups.length === 0 ? (
              <div className="warn-box">
                No groups yet.{' '}
                <button type="button" className="btn-ghost" onClick={() => setTab('new-group')}>Create a group first</button>
              </div>
            ) : (
              <div className="chips">
                {groups.map((g) => (
                  <button
                    key={g.group_id}
                    type="button"
                    className={`chip ${String(selectedGroupId) === String(g.group_id) ? 'active' : ''}`}
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
          </div>

          <div className="field">
            <label className="label">What was this for?</label>
            <div className="chips">
              {EXPENSE_PRESETS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip-card ${expensePresetId === c.id ? 'active' : ''}`}
                  onClick={() => {
                    setExpensePresetId(c.id);
                    setDescription(c.description);
                  }}
                >
                  <b>{c.icon} {c.name}</b>
                  <span>{c.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">Description</label>
            <textarea
              className="input textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Total amount (GEN)</label>
            <div className="chips" style={{ marginBottom: '0.55rem' }}>
              {AMOUNT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip ${amountStr === p ? 'active' : ''}`}
                  onClick={() => setAmountStr(p)}
                >
                  {p} GEN
                </button>
              ))}
            </div>
            <input
              className="input mono"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(sanitizeGenInput(e.target.value))}
            />
            <div className="hint mono">wei (parseGenToWei): {weiPreview.toString()}</div>
          </div>

          {renderShareEditor(selectedMembers, shareBps, setShareBps, weiPreview)}

          <button className="btn-primary full" type="submit" disabled={loading || !hasContractAddress || groups.length === 0}>
            {loading ? 'Saving…' : `Create expense · ${formatWeiToGen(weiPreview)} GEN`}
          </button>
          {!hasContractAddress && <p className="hint">Create stays disabled until VITE_CONTRACT_ADDRESS is set.</p>}
        </form>
      )}

      {hasContractAddress && (
        <footer className="footer">
          Contract{' '}
          <a className="explorer-link mono" href={addressExplorerUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
            {shortAddr(CONTRACT_ADDRESS)} <ExternalLink size={12} />
          </a>
          {' · '}studionet
        </footer>
      )}
    </div>
  );
}
