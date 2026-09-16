# SplitVerdict — AI-arbitrated group expense settlement

A payer logs a group expense with an initial split in basis points. Other members accept it, or dispute with a counter-split plus evidence. Independent AI validators must agree on the exact same `winning_proposal_id`. Members then deposit their exact owed GEN and `settle` pays the original payer.

SplitVerdict requires GenLayer: ordinary EVM contracts cannot run independent AI validators that must agree on one discrete winning split.

## Live App

https://splitverdict-genlayer.vercel.app

## Deployed Contract

- **Network:** Studionet (chain ID **61999**)
- **Studio app:** https://studio.genlayer.com
- **RPC:** https://studio.genlayer.com/api
- **Address:** [`0x79a36B7A50850943752926f8C5b108e7039fF973`](https://explorer-studio.genlayer.com/address/0x79a36B7A50850943752926f8C5b108e7039fF973)
- **Explorer:** https://explorer-studio.genlayer.com

The live dapp connects MetaMask to Studionet (`61999`).

## Run the dapp

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy the contract (Studionet)

1. Open [GenLayer Studio](https://studio.genlayer.com/contracts).
2. New Intelligent Contract → paste [`contracts/split_verdict.py`](contracts/split_verdict.py).
3. Confirm the first two lines are `# v0.2.16` and the pinned `Depends` hash.
4. Run & Debug → Deploy. Confirm **GenVM Result: SUCCESS**.
5. Set `VITE_CONTRACT_ADDRESS` in `frontend/.env` and restart `npm run dev`.

See [`scripts/deploy/studionet.md`](scripts/deploy/studionet.md) for payout notes.

## Money rules

Every money field is wei / base units. Shares are integer basis points that must sum to exactly `10000`. Owed amount is `floor(total * bps / 10000)`. The payer does not deposit against themself; `settle` forwards the **sum of non-payer deposits** (what the contract actually holds), not the sticker total.

`deposit_share` is `@gl.public.write.payable` — Studio GenVM rejects non-zero `value` on a plain write.

## Tests

```bash
gltest tests/test_split_verdict.py
npm run test:money
npm run check:float
```
