# Sparrow Protocol

> Portaldot's native money market and isolated margin trading engine.

---

## Project Info

- **Project Name:** Sparrow Protocol — Money Market & Isolated Margin Engine
- **Team Name:** Sparrow Protocol
- **Track:** Native Onchain Apps
- **Repository:** `portaldot-hackathon-2026-sparrow-protocol-sparrow-protocol`
- **License:** MIT

---

## Demo Scene Description

Alice starts the local substrate-contracts-node, then deploys SparrowLend and SparrowMargin via terminal using `cargo contract`. She links the two contracts with `set_margin_contract`. She deposits 10 UNIT into SparrowLend as a lender, then deposits 5 UNIT collateral into SparrowMargin as a trader. She opens a Long position at 1x leverage, then queries the health factor — returning `u32::MAX` (fully healthy, no debt). She closes the position and receives her 1 UNIT payout. Every step shows a `TransactionFeePaid` event with exact gas fee. Total flow: 9 steps, under 90 seconds. All contracts are live onchain, cross-contract linked, and callable via CLI.

---

## Technical Highlights

**SparrowLend** is a money market with two deposit modes: variable deposits using a MasterChef-style `reward_per_share` accumulator for gas-efficient yield distribution without iterating over lenders, and fixed-term deposits with a rate locked at deposit time and early withdrawal penalties routed to the protocol reserve. The interest rate follows a kinked utilization curve (2% base → 8% at 80% utilization → 30% max), inspired by Compound V2.

**SparrowMargin** is an isolated margin engine supporting Long/Short positions with tiered leverage (5x under 10,000 UNIT, 3x above). Health factors are computed per-position using collateral value vs debt. Liquidators earn a 5% bonus. Funding rate settlement fires every 100 blocks. Cross-contract calls to SparrowLend handle all borrowing and repayment atomically on position open and close.

Both contracts are written in ink! 4.3, compiled to WASM, and deployed on substrate-contracts-node (pallet-contracts v9+). SparrowLend has 30+ unit tests covering all core flows.

> ⚠️ Deployed on substrate-contracts-node due to Portaldot node binary limitation (specVersion 1002, Contracts API v5 rejects ink! 4.x wasm). Contracts compile and deploy as-is to Portaldot once the node binary is updated to Contracts API v9+.

---

## Deployed Contracts

| Contract | Address |
|---|---|
| SparrowLend | `5EiRyzh5RK6GtPRNhJszYDM9JcsyAhNYqUc4bdaQSvGxc4nP` |
| SparrowMargin | `5D3cq4kYqACT721DftgJGG7XKam8gZHGM6RAtfqwV729jPzy` |

**Network:** `ws://127.0.0.1:9944` (substrate-contracts-node --dev)
**Deployer:** `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY` (Alice //Alice)

---

## Confirmed Onchain Transactions

| # | Action | Gas Fee | Event |
|---|--------|---------|-------|
| 1 | Deploy SparrowLend | 2.473mUNIT | `Instantiated` |
| 2 | Deploy SparrowMargin | 2.662mUNIT | `Instantiated` |
| 3 | set_margin_contract | 1.132mUNIT | `MarginContractSet` |
| 4 | deposit (1 UNIT) | 1.755mUNIT | `Deposited { shares_minted: 1000000000000 }` |
| 5 | deposit_collateral (5 UNIT) | 1.513mUNIT | `CollateralDeposited { amount: 5000000000000 }` |
| 6 | open_position (Long 1x) | 2.556mUNIT | `PositionOpened { position_id: 1, entry_price: 1000000 }` |
| 7 | get_health_factor(1) | — | `Ok(4294967295)` = u32::MAX (fully healthy) |
| 8 | close_position(1) | 1.690mUNIT | `PositionClosed { payout: 1UNIT }` |

---

## Architecture

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
│  • Mock price oracle (set_mock_price)   │
└──────────────────────────────────────────────────────────┘
```

---

## What Is Mocked

| Item | Notes |
|---|---|
| Price oracle | `set_mock_price` admin call — clearly labeled, no external dependency |
| Asset tokens | Native UNIT balance used directly — no wrapped tokens |
| Frontend | Not built — terminal CLI demo only |

---

## How to Run Locally

### Prerequisites

```bash
rustup toolchain install nightly-2025-01-01
rustup target add wasm32-unknown-unknown --toolchain nightly-2025-01-01
cargo install cargo-contract --force
```

### 1. Start the node

```bash
curl -L https://github.com/paritytech/substrate-contracts-node/releases/download/v0.42.0/substrate-contracts-node-mac-universal.tar.gz \
     -o scn.tar.gz
tar -xzf scn.tar.gz
chmod +x substrate-contracts-node-mac/substrate-contracts-node
xattr -cr substrate-contracts-node-mac/substrate-contracts-node
./substrate-contracts-node-mac/substrate-contracts-node --dev
```

### 2. Build

```bash
cd sparrowlend && cargo contract build --release
cd ../sparrowmargin && cargo contract build --release
```

### 3. Deploy SparrowLend

```bash
cd sparrowlend
cargo contract instantiate \
  target/ink/sparrowlend.contract \
  --constructor new \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute
# Note the printed contract address
```

### 4. Deploy SparrowMargin

```bash
cd ../sparrowmargin
cargo contract instantiate \
  target/ink/sparrowmargin.contract \
  --constructor new \
  --args <SPARROWLEND_ADDRESS> 1000000 \
  --suri //Alice \
  --url ws://127.0.0.1:9944 \
  --execute
# Note the printed contract address
```

### 5. Link contracts

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

### 6. Run the demo flow

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

### 7. Run tests

```bash
cd sparrowlend
cargo test
# 30+ unit tests
```

---

## Project Structure

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

---

## Tech Stack

| Layer | Tool |
|---|---|
| Smart contracts | ink! 4.3 (Rust / WASM) |
| Chain | substrate-contracts-node (pallet-contracts v9+) |
| Build tool | cargo-contract |
| Target chain | Portaldot (pending node binary update) |

---

## Declaration

I confirm that:
1. All code was independently developed during this hackathon;
2. All delivery requirements of this specification have been met;
3. I agree that the organizing committee may publicly review and technically reproduce the code.

---

## License

MIT