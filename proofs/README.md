# StudioNet proofs

GenLayer CLI deployed TrancheWeave on gasless StudioNet, chain 61999.

Contract: `0x0A667ea5Ad30d54E4BF8Ab906B9e2C4f1622388a`.

[Deployment](https://explorer-studio.genlayer.com/tx/0x170da3d9d89d73cb212c055bbc4815333a9562f1178f805a60608bcfb2ae50b8) · [Manifest](deployment.json) · [Source](../contracts/tranche_weave.py).

All eight transactions are FINALIZED, MAJORITY_AGREE and execution-successful. The source read back from the deployed contract matches published source bytes: SHA-256 `e1103ce5adffb35f819f36c937a642c0a26855bf0a49c1d8835d80c713d6e118`.

The constructor fixes 101 units, weights 6000/4000, allocations [61,40], and cumulative release fractions 3333/6667/10000 basis points. Every write was followed by actual onchain reads.

| Scenario | Transaction | Cumulative credits | Holder balances | Outcome |
|---|---|---|---|---|
| Planned release | [transaction](https://explorer-studio.genlayer.com/tx/0x88b72d744c5df7002109947d8fd0d193611da0fe616249711624666d0a80cd80) | [0,0] | [0,0,0] | BLOCKED |
| Missing disposition, decoy subject | [transaction](https://explorer-studio.genlayer.com/tx/0x641f35ca19204f888cb29806add5b3ae0a51a0d6a9f1c36d681a6eff1d7d8cef) | [0,0] | [0,0,0] | REVIEW |
| First completed checkpoint | [transaction](https://explorer-studio.genlayer.com/tx/0x8393397882fc74aac18ab1925702b7b6c161d0dac5a0e9c910342ac1dc43eee5) | [20,13] | [20,13,0] | RELEASED |
| Transfer seven vested units | [transaction](https://explorer-studio.genlayer.com/tx/0x2ff859281ea8e23e9a2034630889886cce7dc11ea802d4a60dc6be3750fe39e4) | [20,13] | [13,13,7] | Supply unchanged |
| Failed restoration | [transaction](https://explorer-studio.genlayer.com/tx/0xe1661c6e155f846f01f78fa17cfdccbe46a752cacce726f3cfc9b3e3214913f3) | [20,13] | [13,13,7] | BLOCKED |
| Successful restoration | [transaction](https://explorer-studio.genlayer.com/tx/0xe3cbd950c74e711dda3e66c4e69741654ef96012f46bf1abbbf4cbede702c32b) | [40,26] | [33,26,7] | RELEASED |
| Completed handover | [transaction](https://explorer-studio.genlayer.com/tx/0xc687a52316877cf9a555bec5a637579d14c1c263e854a03e182060646fc8f8b8) | [61,40] | [54,40,7] | RELEASED; all 101 units issued |

The REVIEW receipt preserves three agree/two disagree votes. The transfer has five agree votes; other receipts have three agree/two idle. Majority agreement is not unanimity. Full vote records are retained in `*-receipt.json`.

## Reproduce verification

Run `node scripts/verify-proofs.cjs`. It checks eight receipt outcomes, deployed source commitment, full record hashes, exact quote substrings, checkpoint order, decision-derived outcomes, every credit delta and conservation of all issued units. The verifier checks recorded evidence offline; the CLI harness performed live state reads and semantic validators evaluated source relevance.

[Original scenario run](https://github.com/ehsanisildur-ux/tranche-weave/actions/runs/37273960710) verified all scenarios through the second release, then submitted the final release before the RPC gateway returned HTML during receipt polling. [Read-only recovery](https://github.com/ehsanisildur-ux/tranche-weave/actions/runs/37275094512) retrieved that same hash, verified final state and read back source. Recovery signed no writes and did not deploy another contract.

An [earlier deployment attempt](https://github.com/ehsanisildur-ux/tranche-weave/actions/runs/37273397548) exposed a CLI address-encoding mismatch in a balance read; the current source accepts both decoded addresses and strings and includes a regression test. That earlier contract is not the contract identified above.

The records are synthetic publisher reports. Consensus demonstrates interpretation and ledger transitions, not real-world truth. The configured publisher remains a trust boundary. Proof accounts are ephemeral and not retained; this deployment is a reference proof, not a managed allocation service. Dummy recipient addresses receive contract-native units, not GEN.
