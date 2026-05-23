# Sparrow Protocol

> Portaldot's native money market and isolated margin trading engine.

---

## Project Overview

- **Problem Statement:** DeFi on Substrate-based chains lacks composable, capital-efficient primitives. Traders have no access to leverage, and lenders have no way to earn optimized yield — both critical building blocks for any functioning onchain financial ecosystem.

- **Solution:** Sparrow Protocol delivers two tightly integrated smart contracts:
  - **SparrowLend** — a money market supporting variable deposits (MasterChef-style yield accumulator) and fixed-term deposits with rate-locked APY and early-exit penalties. Interest follows a kinked utilization curve (2% base → 8% optimal → 30% max), inspired by Compound V2.
  - **SparrowMargin** — an isolated margin trading engine for Long/Short positions with tiered leverage (5x under 10,000 UNIT, 3x above), health-factor-based liquidations with a 5% liquidator bonus, and funding rate settlement every 100 blocks.

- **Blockchain Relevance:** Both contracts are written in ink! 4.3 (Rust/WASM) and deployed on `pallet-contracts`. SparrowMargin makes cross-contract calls to SparrowLend for all borrowing and repayment atomically on position open and close — demonstrating composable DeFi primitive design on Substrate. Target chain is Portaldot, pending a node binary update to Contracts API v9+.

---

## Technical Architecture

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    SparrowLend                            │
│  Money Market + Yield Pool                                │
│                                                           │
│  • Variable deposits → MasterChef yield shares            │
│  • Fixed deposits    → Guaranteed APY                     │
│  • Kinked rate model → 2% → 8% optimal → 30% max         │
│  • Reserve factor    → 10% of interest to protocol        │
└──────────────────────┬───────────────────────────────────┘
                       │ borrow_for() / repay_for()
                       │ cross-contract, authorized only
┌──────────────────────▼───────────────────────────────────┐
│                   SparrowMargin                           │
│  Isolated Margin Trading Engine                           │
│                                                           │
│  • Long / Short positions, up to 5x leverage              │
│  • Health factor liquidations + 5% liquidator bonus       │
│  • Funding rate settlement every 100 blocks               │
│  • Mock price oracle (set_mock_price)                     │
└──────────────────────────────────────────────────────────┘
```

### Core Tech Stack

| Layer | Tool |
|---|---|
| Blockchain platform | substrate-contracts-node (pallet-contracts v9+) / Portaldot |
| Smart contract language | ink! 4.3 (Rust / WASM) |
| Build tool | cargo-contract |
| Frontend framework | Not applicable — terminal CLI demo |
| Other components | Native UNIT balance (no wrapped tokens), mock price oracle |

---

## Smart Contracts

### Contract File Directory

```
portaldot-hackathon-2026-sparrow-protocol-sparrow-protocol/
├── sparrowlend/
│   ├── src/lib.rs        # Money market contract
│   ├── Cargo.toml
│   └── rust-toolchain.toml
├── sparrowmargin/
│   ├── src/lib.rs        # Margin trading contract
│   ├── Cargo.toml
│   └── rust-toolchain.toml
├── README.md
└── LICENSE
```

### Key Contracts

**SparrowLend** (`sparrowlend/src/lib.rs`)

| Function | Description |
|---|---|
| `deposit` | Deposit UNIT into the variable pool; mints yield-bearing shares |
| `deposit_fixed` | Deposit with a locked APY for a fixed term |
| `withdraw` | Redeem shares for UNIT plus accumulated yield |
| `borrow_for` | Authorized cross-contract call from SparrowMargin to borrow on behalf of a trader |
| `repay_for` | Authorized cross-contract call to repay a trader's debt |
| `set_margin_contract` | Admin: link the authorized SparrowMargin address |

**SparrowMargin** (`sparrowmargin/src/lib.rs`)

| Function | Description |
|---|---|
| `deposit_collateral` | Deposit UNIT collateral before opening a position |
| `open_position` | Open a Long or Short with specified leverage; cross-calls SparrowLend to borrow |
| `close_position` | Close a position, repay debt via SparrowLend, and receive payout |
| `get_health_factor` | Query a position's health (u32::MAX = fully healthy, no debt) |
| `liquidate` | Liquidate an unhealthy position; liquidator earns 5% bonus |
| `set_mock_price` | Admin: update the mock price oracle |

### Deployed Contracts

| Contract | Address |
|---|---|
| SparrowLend | `5EiRyzh5RK6GtPRNhJszYDM9JcsyAhNYqUc4bdaQSvGxc4nP` |
| SparrowMargin | `5D3cq4kYqACT721DftgJGG7XKam8gZHGM6RAtfqwV729jPzy` |

**Network:** `ws://127.0.0.1:9944` (substrate-contracts-node --dev)  
**Deployer:** `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY` (Alice `//Alice`)

> ⚠️ Deployed on substrate-contracts-node due to Portaldot node binary limitation (specVersion 1002, Contracts API v5 rejects ink! 4.x wasm). Contracts compile and deploy as-is to Portaldot once the node binary is updated to Contracts API v9+.

---

## Installation & Setup

### Requirements

- Rust (nightly-2025-01-01) with `wasm32-unknown-unknown` target
- `cargo-contract`
- substrate-contracts-node v0.42.0

```bash
rustup toolchain install nightly-2025-01-01
rustup target add wasm32-unknown-unknown --toolchain nightly-2025-01-01
cargo install cargo-contract --force
```

### Steps

**1. Clone the repository**

```bash
git clone <repository-url>
cd portaldot-hackathon-2026-sparrow-protocol-sparrow-protocol
```

**2. Start the local node**

```bash
curl -L https://github.com/paritytech/substrate-contracts-node/releases/download/v0.42.0/substrate-contracts-node-mac-universal.tar.gz \
     -o scn.tar.gz
tar -xzf scn.tar.gz
chmod +x substrate-contracts-node-mac/substrate-contracts-node
xattr -cr substrate-contracts-node-mac/substrate-contracts-node
./substrate-contracts-node-mac/substrate-contracts-node --dev
```

**3. Build contracts**

```bash
cd sparrowlend && cargo contract build --release
cd ../sparrowmargin && cargo contract build --release
```

**4. Deploy SparrowLend**

```bash
cd sparrowlend
cargo contract instantiate \
  target/ink/sparrowlend.contract \
  --constructor new \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute
# Note the printed contract address → <SPARROWLEND_ADDRESS>
```

**5. Deploy SparrowMargin**

```bash
cd ../sparrowmargin
cargo contract instantiate \
  target/ink/sparrowmargin.contract \
  --constructor new \
  --args <SPARROWLEND_ADDRESS> 1000000 \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute
# Note the printed contract address → <SPARROWMARGIN_ADDRESS>
```

**6. Link the contracts**

```bash
cd ../sparrowlend
cargo contract call \
  --contract <SPARROWLEND_ADDRESS> \
  --message set_margin_contract \
  --args <SPARROWMARGIN_ADDRESS> \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute
```

**7. Run unit tests**

```bash
cd sparrowlend
cargo test
# 30+ unit tests covering all core flows
```

---

## Demo

### Demo Scene

Alice starts the local substrate-contracts-node, deploys both contracts, links them, and runs the full lending + margin trading flow in 9 CLI steps in under 90 seconds. All contracts are live onchain, cross-contract linked, and callable via `cargo contract`.

### Confirmed Onchain Transactions

| # | Action | Gas Fee | Event |
|---|--------|---------|-------|
| 1 | Deploy SparrowLend | 2.473 mUNIT | `Instantiated` |
| 2 | Deploy SparrowMargin | 2.662 mUNIT | `Instantiated` |
| 3 | set_margin_contract | 1.132 mUNIT | `MarginContractSet` |
| 4 | deposit (10 UNIT) | 1.755 mUNIT | `Deposited { shares_minted: 1000000000000 }` |
| 5 | deposit_collateral (5 UNIT) | 1.513 mUNIT | `CollateralDeposited { amount: 5000000000000 }` |
| 6 | open_position (Long 1x) | 2.556 mUNIT | `PositionOpened { position_id: 1, entry_price: 1000000 }` |
| 7 | get_health_factor(1) | — | `Ok(4294967295)` = u32::MAX (fully healthy) |
| 8 | close_position(1) | 1.690 mUNIT | `PositionClosed { payout: 1 UNIT }` |

### Full Demo CLI Flow

```bash
# Deposit into lending pool
cargo contract call \
  --contract <SPARROWLEND_ADDRESS> \
  --message deposit \
  --value 10000000000000 \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute

# Post collateral
cargo contract call \
  --contract <SPARROWMARGIN_ADDRESS> \
  --message deposit_collateral \
  --value 5000000000000 \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute

# Open Long position (1x leverage)
cargo contract call \
  --contract <SPARROWMARGIN_ADDRESS> \
  --message open_position \
  --args Long 100 1000000000000 \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute

# Check health factor
cargo contract call \
  --contract <SPARROWMARGIN_ADDRESS> \
  --message get_health_factor \
  --args 1 \
  --suri //Alice \
  --url ws://127.0.0.1:9944

# Close position
cargo contract call \
  --contract <SPARROWMARGIN_ADDRESS> \
  --message close_position \
  --args 1 \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute
```

### What Is Mocked

| Item | Notes |
|---|---|
| Price oracle | `set_mock_price` admin call — clearly labeled, no external dependency |
| Asset tokens | Native UNIT balance used directly — no wrapped tokens |
| Frontend | Not built — terminal CLI demo only |

---

## Roadmap

### Completed Features

- SparrowLend money market with variable and fixed-term deposit modes
- Kinked interest rate model (Compound V2-inspired)
- SparrowMargin isolated margin engine with Long/Short support
- Tiered leverage (5x / 3x) and health factor liquidations
- Cross-contract borrowing and repayment (SparrowMargin ↔ SparrowLend)
- Funding rate settlement every 100 blocks
- 30+ unit tests covering all core SparrowLend flows

### Next Phase Plans

- Integrate a live price oracle (e.g. Chainlink or a Substrate off-chain worker)
- Build a web frontend (React/Next.js) for lenders and traders
- Deploy to Portaldot mainnet once node binary supports Contracts API v9+
- Add multi-asset collateral and cross-margin mode
- Introduce governance token and protocol fee distribution

---

## Team

- **Team Name:** Sparrow Protocol
- **Contact:** @youthisman

---

## License

MIT