# Ready contribution

Category: Builder -> Intelligent Contracts

Title: TrancheWeave: Consensus checkpoint vesting ledger

## Notes / Description

TrancheWeave is a GenLayer ledger for allocation units vested through checkpoints. Deployment fixes publisher, conditions, cumulative fractions, supply and weighted recipients. Largest-remainder apportionment assigns the supply. Recipients submit commit-pinned records and hashes; leader and validators independently fetch full texts, derive MET, NOT_MET or UNKNOWN for every condition and verify source anchors. Exact decision agreement gates cumulative credits. Failed or uncertain checkpoints preserve balances. Transfers move only vested units without changing later entitlements; the final checkpoint releases rounding remnants. StudioNet CLI proofs cover blocked/review outcomes, partial releases, a transfer and exact final conservation of 101 units. Eight finalized MAJORITY_AGREE receipts match onchain reads. Includes pinned GenVM source and 21 direct tests. Synthetic publisher records demonstrate the mechanism; units are contract-native allocations, not GEN or proof of fulfillment.

## Links

- Source: https://github.com/ehsanisildur-ux/tranche-weave/blob/main/contracts/tranche_weave.py
- Repository: https://github.com/ehsanisildur-ux/tranche-weave
- Proofs: https://github.com/ehsanisildur-ux/tranche-weave/blob/main/proofs/README.md

StudioNet contract: `0x0A667ea5Ad30d54E4BF8Ab906B9e2C4f1622388a`.

Deployment: https://explorer-studio.genlayer.com/tx/0x170da3d9d89d73cb212c055bbc4815333a9562f1178f805a60608bcfb2ae50b8

Notes length: 995 characters. Receipts retain dissenting votes. The configured publisher is a trust boundary; consensus does not establish physical truth independently of its records.
