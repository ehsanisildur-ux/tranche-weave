# TrancheWeave

A GenLayer allocation ledger with semantic checkpoint vesting and transferable released units.

The contract fixes a finite supply, weighted recipients, cumulative release fractions, condition rules and a publisher repository at deployment. It creates no owner role or editable policy. Only allocated recipients may trigger evaluation. Full commit-pinned publisher records are fetched and hash-checked inside both leader and validator execution. Exact agreement on every MET, NOT_MET and UNKNOWN decision determines whether balances change.

## Mechanism

1. Largest-remainder apportionment assigns the entire fixed supply to recipients once. Equal remainders are resolved by constructor order.
2. Only the current checkpoint can be evaluated. Any NOT_MET blocks release; otherwise any UNKNOWN requires review. Both preserve issued supply and checkpoint position.
3. All MET advances the checkpoint. Recipient cumulative entitlement is `floor(allocation * cumulative_basis_points / 10000)`. Only its increase is credited. The final 10000-basis-point checkpoint releases all remaining units.
4. Holders can transfer already issued units. Transfer changes balances without changing lifetime credits, so later vesting neither recreates spent units nor confiscates them from transferees.

These are contract-native allocation units. They are not GEN, an ERC-20 token, externally backed value, or proof of service fulfillment. Applications may read `balance_of` to implement access or allocation rights. TrancheWeave does not enforce external redemption.

## Source and consensus boundaries

The immutable `source_repository` identifies the publisher authorized by the deployment policy. Only `records/*.md` at a concrete 40-character Git commit is accepted. Each source is SHA-256 checked, UTF-8 decoded and limited to 8000 bytes. A beneficiary supplies a locator and commitment, never a classification.

Validators independently re-fetch full text, independently classify every rule without leader decisions in their derivation prompt, require exact decision agreement, and separately assess the material relevance of every leader anchor. Both positive and negative decisions require source quotes; absent evidence is UNKNOWN. Source instructions, forecasts, other subjects and negated claims are explicitly excluded. No numeric confidence tolerance can cross a release gate.

Consensus establishes what the configured publisher record supports. It does not independently establish that the publisher is honest or that physical events occurred. Use an appropriate independent publisher for real deployments. The repository's records are plainly synthetic demonstration fixtures.

## Public interface

| Method | Effect |
|---|---|
| `evaluate(index, url, sha256)` | Recipient-triggered evaluation of current checkpoint; records outcome and credit deltas |
| `transfer(recipient, amount)` | Transfers positive vested units from caller; no delegated spending |
| `balance_of(account)` | Reads transferable allocation balance |
| `get_state()` | Reads immutable policy, allocations, lifetime credits, issued supply and evaluation history |

Maximums: 5 recipients, 6 checkpoints, 3 conditions per checkpoint and 32 accepted evaluations. Duplicate content hashes cannot be retried at the same checkpoint. Transient network/model errors do not produce accepted business outcomes. An admitted recipient can exhaust the bounded attempt log using distinct published records; membership is a trust boundary. Conflicting or dishonest records require publisher governance outside this contract. There is no owner override, clawback, force-release, expiry or upgrade path.

## Validation

Install `requirements.txt`, then run:

```sh
genvm-lint download --version v0.2.16
genvm-lint check contracts/tranche_weave.py --json
pytest tests/direct -q
```

Tests cover supply conservation, cumulative rounding, tiny allocations, checkpoint ordering, duplicate records, admission, transfer limits, forged quotes, source restrictions and validator replay under dissent. Direct tests mock web/model output; live StudioNet proofs exercise actual web fetches and model consensus.

[Consensus design](docs/consensus.md) · [Source](contracts/tranche_weave.py) · [Live proof records](proofs/README.md)

The GenLayer CLI transport harness is adapted from ScopeLatch; vesting storage, supply apportionment, checkpoint transitions, transfers and tests are new. This is not a domain variant of its FIFO semaphore.
