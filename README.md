# Cross-Chain Message Verifier

A research demo combining **ECDSA signatures**, **Merkle proofs**, and **replay protection** for cross-chain message verification.

## System Design

```
Source Chain                         Off-chain                    Destination Chain
────────────                         ─────────                    ─────────────────
Messages (N) ──► buildMerkleTree ──► root ──► approveRoot() ──► approvedRoots[root]
                  │
                  ├── getProof(i) ──► proof[i]
                  │
                  └── sign(msgHash) ─► signature ──► verifyAndExecute(proof, root, msg, sig)
                                                           │
                                                      ┌────┴────┐
                                                      │   PASS   │
                                                      │  REJECT  │
                                                      └──────────┘
```

## Quick Start

```bash
npm install
npx hardhat compile
npx hardhat test
```

### Scripts

| Script | What it does |
|--------|-------------|
| `npx hardhat run scripts/merkle.js` | Message encoding, Merkle tree build, proof generation |
| `npx hardhat run scripts/relayer-demo.js` | Full relayer flow: messages → tree → deploy → approve → verify → events |
| `npx hardhat run scripts/e2e-demo.js` | End-to-end demo with replay/expiry/invalid-proof interception tests |
| `npx hardhat run scripts/deploy.js --network sepolia` | Deploy to Sepolia testnet |

