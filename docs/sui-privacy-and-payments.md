# Sui Privacy and Payment Visibility

## Does Sui hide which accounts spend what on what?

**Today: no.** Sui’s ledger is **public and auditable**. Per [Sui Security docs](https://docs.sui.io/concepts/sui-architecture/sui-security):

- All transactions and object state are **publicly visible**.
- Anyone can read the full history of transactions and object changes.
- So **which account sent what to whom** (and amounts) is visible on-chain.

Sui explicitly recommends: *“If you are mindful of your privacy, you might use multiple addresses to benefit from some degree of pseudonymity, or third-party custodial or non-custodial services. Specific smart contracts with additional cryptographic privacy protections can also be provided by third parties.”*

So there is **no built-in protocol privacy layer** today that hides account–spend–recipient linkage.

---

## What Sui does offer (today)

| Feature | What it does | Hides “who spent what on what”? |
|--------|----------------|----------------------------------|
| **zkLogin** | Sign tx with OAuth (Google, etc.) via ZK proof; no need to expose a long-term Sui key. | No. It hides the link between your **OAuth identity** and your **Sui address**. On-chain, the Sui address and tx details are still visible. |
| **zkSend** | Create claimable links for SUI/NFTs; recipient claims without exposing a fixed address in advance. | Partially. Can reduce linkability of “who received” in some flows; base-layer tx (sender/amount) is still visible once claimed. |
| **Multiple addresses** | Use many keys/addresses. | Pseudonymity only. Each address’s history is still public; linking addresses is a matter of heuristics and off-chain data. |

So: **no**, Sui does **not** currently provide a privacy layer that hides which accounts spend what on what on the base chain.

---

## What’s coming (Sui’s direction)

Sui has signaled **protocol-level confidentiality** for the future (e.g. native private transactions, with selective disclosure for compliance). That would be the kind of layer that could hide account–spend–recipient by default while allowing authorized disclosure. There is no concrete public timeline in the docs for when that ships; treat it as roadmap, not available today.

---

## What we do in DLUX (application-layer privacy)

We don’t control the Sui protocol. We **do** add **application-layer privacy** where it matters:

- **Ad verification (ZK + homomorphic)**  
  We prove “an ad was viewed / clicked” and aggregate stats **without** revealing which account or identity viewed/clicked. See [ad-view-proof.circom](../circuits/ad-view-proof.circom), [ad-tracking-api.md](contracts/ad-tracking-api.md) (Privacy Guarantees), and the ZK/homomorphic design.  
  So: **who spent attention / engagement** on ads is hidden in our system; **who spent SUI** on-chain is not.

- **Subscription / payments**  
  Subscription and other SUI payments are normal on-chain transfers. So **which account paid for a subscription (or anything else)** is visible on the public ledger. We don’t have a Sui-level privacy layer to hide that.

If/when Sui adds **native confidential transfers or a privacy layer**, we could integrate it so that subscription and other payments can be made without exposing which account spent what on what to the public chain.

---

## Can we use homomorphic signatures and bundles to hide who spent what for what?

**In theory: yes**, with a **pool/mixer-style design** and the right crypto. We don’t implement this today.

### Homomorphic encryption vs homomorphic signatures

We already use **homomorphic encryption** (Paillier) for **ad verification**: we compute **sums on encrypted data** (e.g. aggregate impression counts) without decrypting who viewed what. That hides *identity in analytics*; it does **not** by itself hide **who authorized which payment** on-chain.

**Homomorphic signatures** are a different primitive: you sign messages (e.g. “I authorize paying X SUI to recipient R”) in a way that allows **combining** many signatures into a single valid “batch” signature. A verifier can check the batch without learning which signer authorized which individual payment. So in principle:

- Many users each produce a **homomorphic signature** on (amount, recipient or commitment).
- An **aggregator** combines these signatures (and maybe batches the corresponding payments).
- The **chain** sees one or a few transactions (e.g. “pool received 100 SUI from N sources” and “pool paid out to these recipients”) and can verify the batch signature (or a ZK proof of correct aggregation) **without** learning which wallet paid which recipient.

So **homomorphic signatures** could support a design that hides “who spent what for what” at the level of **individual linkage**, while the chain still sees **batch in/out** of a pool.

### What “bundles” add

**Sui programmable transaction blocks** (“bundles”) let you put many commands in one transaction. That gives **batching**: one signer can do many moves in one tx. Batching alone does **not** hide the signer—the signer is still the wallet that signed the block.

To hide **who** spent what, the **signer** of the on-chain tx should be a **relayer** or **pool contract** that:

- Holds or moves funds based on **verified claims** (e.g. homomorphic signatures or ZK proofs that “user i authorized amount a to recipient r”).
- Submits **batched** transfers (bundles) so the chain sees “pool → recipients” rather than “Alice → Bob.”

So: **bundles** are useful as the **on-chain shape** of the privacy design (one or few txs doing many payouts); **homomorphic signatures** (or ZK proofs of valid aggregation) are what could **authorize** those payouts without revealing which account authorized which one.

### What we’d need to build it

1. **Pool contract (Move)**  
   - Accepts “deposits” or “claims” (e.g. users send SUI into the pool, or commit to amounts).  
   - Pays out to recipients when the contract is convinced that the payout is authorized (see below).  
   - Only needs to verify **batch validity**, not individual signers.

2. **Off-chain aggregator**  
   - Collects many user authorizations (homomorphic signatures or ZK proofs).  
   - Combines them (homomorphic aggregation or ZK proof that “all these authorizations are valid and sum to this batch”).  
   - Submits a **bundle** (one or more txs) from the **pool** (or relayer) that performs the batched payouts.

3. **Verification on-chain**  
   - Sui/Move do **not** natively verify homomorphic signatures today. So either:  
     - Implement homomorphic-signature verification in Move (possible but heavy and gas-heavy), or  
     - Have the aggregator produce a **ZK proof** that “this batch of payouts is consistent with a valid set of homomorphic signatures (or authorizations).” The Move contract then only verifies the ZK proof (and maybe a small public input), which is a more realistic path.

4. **Trust / decentralization**  
   - Who runs the aggregator? (Permissioned relayer vs decentralized set of relayers.)  
   - Who holds pool funds? (Contract-only vs multisig.)  
   - These are design choices that affect trust and regulatory story.

### Summary

| Idea | Role |
|------|------|
| **Homomorphic signatures** | Let many users authorize payments in a way that can be **aggregated**; the chain (or a ZK proof) only checks the batch, so individual “who paid whom” is not revealed. |
| **Bundles (Sui tx blocks)** | Let the pool/relayer submit **one or few txs** that perform many payouts, so the chain sees batch movements instead of one-to-one transfers. |
| **Pool contract** | Holds or routes funds and only pays out when batch validity (homomorphic or ZK) is verified. |
| **Today** | We do **not** implement this. It’s a plausible R&D direction for “hide who spent what for what” on Sui without waiting for native protocol privacy. |

So: **yes**, homomorphic signatures plus bundles (and a pool + aggregator) could be used to hide who spent what for what, in an application-layer design. Delivering it would require choosing the exact crypto (homomorphic sig scheme or ZK-only), implementing verification (likely ZK on-chain, homomorphic off-chain), and designing the pool and relayer model.

**Roadmap:** A credits-based anonymous send package (buy credits → spend anonymously for subscription, Seal keys, features) is on the feature roadmap: see [FEATURE_ROADMAP.md](../FEATURE_ROADMAP.md) § Priority 4: Privacy & Anonymous Spend.

---

## Summary

| Question | Answer |
|----------|--------|
| Does Sui have a privacy layer today that hides which accounts spend what on what? | **No.** The ledger is public; sender, recipient, and amounts are visible. |
| Can we hide “who spent what on what” on Sui today? | Only in application-specific ways (e.g. our ad verification). Not for general SUI transfers. |
| Can homomorphic signatures + bundles hide who spent what for what? | **In theory yes:** pool/mixer design where users authorize via homomorphic sigs, aggregator batches and submits; chain sees pool in/out, not individual linkage. Requires R&D (pool contract, aggregator, ZK or Move verification). We don’t implement it today. See section above. |
| What can we do today? | Use zkLogin (hide OAuth↔address link), zkSend where useful, multiple addresses for pseudonymity; document that payment flows are public. |
| Future? | Sui has indicated protocol-level confidentiality (e.g. private transactions with selective disclosure); no current timeline in public docs. |
