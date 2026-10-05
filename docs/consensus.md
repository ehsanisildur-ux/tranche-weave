# Consensus and arithmetic

Boundary: recipient submits pinned record -> leader fetches complete source -> semantic condition judgments -> validators independently fetch and derive all judgments -> exact decision vector plus anchor relevance -> deterministic cumulative credits -> transferable balances.

The deployed policy is the normative rulebook. The configured publisher provides assertions in public records. Hashes bind those actual bytes; hashes alone cannot certify an event. Every consequential MET, NOT_MET and UNKNOWN decision is visible and independently checked against full text.

Let supply be S and weights w_i sum to 10000. Initial allocations start at floor(S*w_i/10000). Unassigned units go to the highest fractional remainders, with constructor index breaking ties. This assigns exactly S units. At cumulative release b, target_i=floor(allocation_i*b/10000). Delta_i=target_i-credited_i. Strictly increasing release fractions make every delta nonnegative. At b=10000, all allocations are fully issued.

Transfers debit and credit equal amounts and never change credited_i. Therefore aggregate balances equal issued units, issued never exceeds supply, and terminal credits sum exactly to supply. Earlier transfer balances do not affect future entitlement calculation.

The 101-unit demonstration with 6000/4000 weights yields allocations [61,40]. Fractions 3333,6667,10000 yield cumulative credits [20,13], [40,26], [61,40]. A transfer of 7 after the first release changes final balances to [54,40,7], preserving the exact 101-unit supply.

Distinctness: this mechanism is a finite-supply apportionment and cumulative vesting ledger with balance transfers. It has no graph revisions, proposal acceptance workflow, certificate consumption, auction portfolio, interval union, median aggregation, obligation compiler or resource lock queue.

No confidence scores are used. A MET/UNKNOWN or MET/NOT_MET disagreement always rejects the leader result. Quote strings may differ between independent extractions, but the leader's selected quotes must occur verbatim and independently pass relevance checks. A valid substring alone is insufficient.
