# Contribution draft

Category: Builder -> Intelligent Contracts

Title: TrancheWeave: Consensus checkpoint vesting ledger

## Notes / Description

TrancheWeave is a standalone GenLayer ledger for finite allocation units vested through semantic checkpoints. Deployment fixes publisher, conditions, cumulative fractions, supply and weighted recipients. Largest-remainder apportionment assigns every unit without supply drift. Recipients submit commit-pinned records and SHA-256 hashes; leader and validators independently fetch full texts, classify every condition as MET, NOT_MET or UNKNOWN, and check source anchors. Exact decision agreement gates release. Failed or uncertain checkpoints preserve balances; successful checkpoints credit only cumulative entitlement increases. Holders can transfer vested units without changing later entitlements. The final checkpoint releases all rounding remnants. The repo includes pinned GenVM source, 20 direct tests and consensus documentation. Units are contract-native allocations, not GEN or proof of real-world fulfillment; the configured publisher remains a trust boundary.

## Links

- Source: https://github.com/ehsanisildur-ux/tranche-weave/blob/main/contracts/tranche_weave.py
- Repository: https://github.com/ehsanisildur-ux/tranche-weave
- Proofs: https://github.com/ehsanisildur-ux/tranche-weave/blob/main/proofs/README.md

Deployment proofs are pending. Do not claim live proof success until receipts and state verification pass.
