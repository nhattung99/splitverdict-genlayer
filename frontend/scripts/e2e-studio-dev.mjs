import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const ADDRESS = '0x501112b24225f9285ED69eac89F7fbF955C7A71B';
const EXPLORER = 'https://explorer-studio-dev.genlayer.com';
const WEI_PER_GEN = 10n ** 18n;
const TOTAL_WEI = 2n * WEI_PER_GEN;

const chain = studioDevnet;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseJson = (raw) => {
  if (raw == null) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

const asClient = (account) => createClient({ chain, account });

const withFees = async (client, extra = {}) => {
  if (typeof client.estimateTransactionFeesForWrite === 'function') {
    try {
      const estimate = await client.estimateTransactionFeesForWrite({
        address: extra.address,
        functionName: extra.functionName,
        args: extra.args,
        ...(extra.value !== undefined ? { value: extra.value } : {}),
      });
      const preset = estimate?.recommendedPreset || estimate;
      if (preset?.distribution && preset.feeValue !== undefined) {
        return {
          ...extra,
          fees: {
            distribution: preset.distribution,
            feeValue: preset.feeValue,
            ...(preset.messageAllocations !== undefined ? { messageAllocations: preset.messageAllocations } : {}),
          },
        };
      }
    } catch (err) {
      console.warn('fee estimate for write skipped:', err?.message || err);
    }
  }
  if (typeof client.estimateTransactionFees !== 'function') return extra;
  try {
    const fees = await client.estimateTransactionFees({});
    return { ...extra, fees };
  } catch (err) {
    console.warn('fee estimate skipped:', err?.message || err);
    return extra;
  }
};

const wait = async (client, hash, label) => {
  console.log(label, `${EXPLORER}/tx/${hash}`);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
    retries: 40,
    interval: 2000,
  });
  const status = receipt?.status || receipt?.consensus_result || receipt;
  console.log(label, 'FINALIZED', typeof status === 'string' ? status : JSON.stringify(status, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  return receipt;
};

const fund = async (client, address) => {
  const amount = (1000n * WEI_PER_GEN).toString();
  try {
    await client.request({ method: 'sim_fundAccount', params: [address, amount] });
    console.log('funded', address);
    return;
  } catch (err) {
    console.warn('sim_fundAccount note:', err?.message || err);
  }
};

const read = async (client, functionName, args = []) => {
  const raw = await client.readContract({
    address: ADDRESS,
    functionName,
    args,
  });
  return parseJson(raw);
};

const write = async (client, functionName, args, value) => {
  const payload = await withFees(client, {
    address: ADDRESS,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  });
  return client.writeContract(payload);
};

const payer = createAccount();
const roommate = createAccount();
const payerClient = asClient(payer);
const roommateClient = asClient(roommate);

console.log('payer', payer.address);
console.log('roommate', roommate.address);

await fund(payerClient, payer.address);
await fund(roommateClient, roommate.address);

const groupsBefore = BigInt(String(await read(payerClient, 'get_group_count') || '0'));
const createGroupHash = await write(
  payerClient,
  'create_group',
  ['Hackathon dinner', JSON.stringify([roommate.address])],
);
await wait(payerClient, createGroupHash, 'create_group');
await sleep(1000);
const groupsAfter = BigInt(String(await read(payerClient, 'get_group_count') || '0'));
if (groupsAfter <= groupsBefore) throw new Error('create_group did not increment group count');
const groupId = (groupsAfter - 1n).toString();
console.log('group', groupId, await read(payerClient, 'get_group', [groupId]));

const shares = JSON.stringify({
  [payer.address.toLowerCase()]: '5000',
  [roommate.address.toLowerCase()]: '5000',
});
const expensesBefore = BigInt(String(await read(payerClient, 'get_expense_count') || '0'));
const createExpenseHash = await write(
  payerClient,
  'create_expense',
  [groupId, String(TOTAL_WEI), 'Hackathon dinner split', shares],
);
await wait(payerClient, createExpenseHash, 'create_expense');
await sleep(1000);
const expensesAfter = BigInt(String(await read(payerClient, 'get_expense_count') || '0'));
if (expensesAfter <= expensesBefore) throw new Error('create_expense did not increment expense count');
const expenseId = (expensesAfter - 1n).toString();
console.log('expense', expenseId);

const acceptHash = await write(roommateClient, 'accept_split', [expenseId]);
await wait(roommateClient, acceptHash, 'accept_split');
await sleep(1000);
console.log('accepted', await read(payerClient, 'get_expense', [expenseId]));

const depositHash = await write(roommateClient, 'deposit_share', [expenseId], TOTAL_WEI / 2n);
await wait(roommateClient, depositHash, 'deposit_share');
await sleep(1000);

const settleHash = await write(payerClient, 'settle', [expenseId]);
await wait(payerClient, settleHash, 'settle');
await sleep(1000);
const settled = await read(payerClient, 'get_expense', [expenseId]);
console.log('settled', settled);
if (String(settled?.status || '').toUpperCase() !== 'SETTLED') {
  throw new Error(`expected SETTLED, got ${settled?.status}`);
}
console.log('E2E SUCCESS', `${EXPLORER}/address/${ADDRESS}`);
