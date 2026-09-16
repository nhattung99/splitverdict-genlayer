# Deploy SplitVerdict on Studio Dev (61997)

1. Open https://studio-dev.genlayer.com/contracts.
2. Paste `contracts/split_verdict.py` as a new Intelligent Contract.
3. Keep the first two header lines:

```
# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
```

4. Deploy from Run & Debug. Open the tx and confirm `Result: SUCCESS` (not only FINALIZED).
5. Copy the contract address into `frontend/.env` as `VITE_CONTRACT_ADDRESS`.
6. Confirm the explorer page loads: `https://explorer-studio-dev.genlayer.com/address/<address>`.

The dapp uses Studio Dev (chain ID 61997, RPC `https://studio-dev.genlayer.com/api`).

Payouts to wallets use `_Recipient(addr).emit_transfer(value=v)` (EVM / EOA path). Do not send GEN with `gl.get_contract_at(wallet)` — Studio shows that as an OUT `(construct...)` GENVM ERROR.

An already-deployed contract cannot be patched. Redeploy this file on Studio Dev, then update `VITE_CONTRACT_ADDRESS`.
