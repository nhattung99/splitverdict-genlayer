# SplitVerdict — AI-arbitrated group expense settlement

A payer logs a group expense with an initial split in basis points. Other members accept it, or dispute with a counter-split plus evidence. Independent AI validators must agree on the exact same `winning_proposal_id`. Members then deposit their exact owed GEN and `settle` pays the original payer.

SplitVerdict requires GenLayer: ordinary EVM contracts cannot run independent AI validators that must agree on one discrete winning split.

## Live App

https://splitverdict-genlayer.vercel.app

## Deployed Contract

- **Network:** studionet (GenLayer Studio hosted)
- **Address:** `0x4a6402B732D33F6Fae32e068d4fa0960aD80e10A`
- **Explorer:** https://genlayer-explorer.vercel.app/address/0x4a6402B732D33F6Fae32e068d4fa0960aD80e10A

## Run the dapp

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000. Without `VITE_CONTRACT_ADDRESS` the UI stays in preview mode (forms work, writes stay disabled).

## Deploy the contract

1. Open [GenLayer Studio](https://studio.genlayer.com).
2. New Intelligent Contract → paste [`contracts/split_verdict.py`](contracts/split_verdict.py).
3. Confirm the header (`v0.2.16` + `Depends` hash) matches the current Studio template.
4. Run & Debug → Deploy. Confirm **GenVM Result: SUCCESS**.
5. Set `VITE_CONTRACT_ADDRESS` in `frontend/.env` and restart `npm run dev`.

## Money rules

Every money field is wei / base units. Shares are integer basis points that must sum to exactly `10000`. Owed amount is `floor(total * bps / 10000)`. The payer does not deposit against themself; `settle` forwards the **sum of non-payer deposits** (what the contract actually holds), not the sticker total.

`deposit_share` is `@gl.public.write.payable` — Studio GenVM rejects non-zero `value` on a plain write.

## Tests

```bash
gltest tests/test_split_verdict.py
npm run test:money
npm run check:float
```
