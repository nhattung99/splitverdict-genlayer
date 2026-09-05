# Deploy SplitVerdict on studionet

1. Open https://studio.genlayer.com
2. Paste `contracts/split_verdict.py` as a new Intelligent Contract.
3. Keep the first two header lines unless Studio ships a newer `Depends` hash.
4. Deploy from Run & Debug. Open the tx and confirm `Result: SUCCESS` (not only FINALIZED).
5. Copy the contract address into `frontend/.env` as `VITE_CONTRACT_ADDRESS`.

Until that address is set, the dapp runs in preview mode.

Payouts to wallets use `_Recipient(addr).emit_transfer(..., on="finalized")` (EVM / EOA path). Do not send GEN with `gl.get_contract_at(wallet)` — Studio shows that as an OUT `(construct...)` GENVM ERROR.

An already-deployed contract cannot be patched. Redeploy this file, then update `VITE_CONTRACT_ADDRESS`.
