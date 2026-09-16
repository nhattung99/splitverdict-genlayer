# Deploy SplitVerdict on Studionet (61999)

1. Open https://studio.genlayer.com/contracts.
2. Paste `contracts/split_verdict.py` as a new Intelligent Contract.
3. Keep the first two header lines:

```
# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

4. Deploy from Run & Debug. Open the tx and confirm `Result: SUCCESS` (not only FINALIZED).
5. Copy the contract address into `frontend/.env` as `VITE_CONTRACT_ADDRESS`.
6. Confirm the explorer page loads: `https://explorer-studio.genlayer.com/address/<address>`.

The dapp uses Studionet (chain ID 61999, RPC `https://studio.genlayer.com/api`).

Payouts to wallets use `_Recipient(addr).emit_transfer(..., on="finalized")` (EVM / EOA path). Do not send GEN with `gl.get_contract_at(wallet)` — Studio shows that as an OUT `(construct...)` GENVM ERROR.

An already-deployed contract cannot be patched. Redeploy this file on Studionet, then update `VITE_CONTRACT_ADDRESS`.
