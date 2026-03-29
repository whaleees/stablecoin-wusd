# WUSD Stablecoin Protocol

WUSD is a Solana overcollateralized stablecoin prototype built with Anchor and a Next.js frontend.

Live app: https://stablecoin-wusd.vercel.app/

## What this project includes

- On-chain Anchor program for collateralized borrowing flows:
  - initialize global state and pool registry
  - initialize collateral pools
  - deposit and withdraw collateral
  - mint and repay WUSD debt
  - liquidate unhealthy vaults
  - mock price feed updates for local testing
- Frontend dashboard (Next.js 16 + React 19) for wallet-based interactions.
- TypeScript scripts for protocol setup, diagnostics, activity seeding, mock oracle updates, and keeper jobs.

## Tech stack

- Solana + Anchor
- Rust (on-chain program)
- TypeScript + Node.js (off-chain scripts)
- Next.js + Tailwind CSS (frontend)
- Pyth SDK libraries for oracle integration and simulation

## Repository layout

- anchor: Anchor workspace and on-chain program
- frontend: Next.js app
- scripts: setup, keeper, faucet, and test helper scripts
- test-keys: local test keypairs and addresses
- protocol-addresses.json: generated addresses used by scripts/frontend config

## Prerequisites

Install these before running locally:

- Node.js 18+
- npm
- Rust toolchain
- Solana CLI
- Anchor CLI

Optional but recommended:

- Phantom or Solflare wallet for frontend testing

## Quick start (localnet)

1. Install root dependencies:

```bash
npm install
```

2. Install Anchor workspace dependencies:

```bash
cd anchor
npm install
cd ..
```

3. Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

4. Run full local setup (validator reset, build/deploy, protocol init, env generation):

```bash
npm run reset
```

5. Start frontend:

```bash
cd frontend
npm run dev
```

6. Open http://localhost:3000 and connect your wallet.

## Quick start (devnet)

Use the devnet automation script:

```bash
bash scripts/devnet-setup.sh
```

Then run frontend:

```bash
cd frontend
npm run dev
```

Make sure your wallet is switched to Solana devnet.

## Environment variables

The setup scripts generate frontend environment values in frontend/.env.local.

Common variables:

- NEXT_PUBLIC_RPC_URL
- NEXT_PUBLIC_RPC_ENDPOINT
- NEXT_PUBLIC_SOLANA_CLUSTER
- NEXT_PUBLIC_PROGRAM_ID
- NEXT_PUBLIC_STABLECOIN_MINT
- NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT
- NEXT_PUBLIC_PRICE_FEED
- FAUCET_PRIVATE_KEY (for frontend API faucet route)

For script execution, these may also be used:

- RPC_URL
- ANCHOR_WALLET
- WALLET_PATH

## Useful commands

From repository root:

- npm run reset: full localnet reset + deploy + initialization
- npm run setup:init: initialize protocol state
- npm run setup:price: set mock price feed
- npm run setup:pools: configure multiple collateral pools
- npm run seed:activity: seed protocol activity
- npm run seed:activity:light: lighter activity seed
- npm run seed:activity:heavy: heavier activity seed
- npm run seed:activity:liq: liquidation-focused seed
- npm run keeper: run oracle/keeper loop
- npm run keeper:multi: run multi-pool keeper loop

From frontend:

- npm run dev: start development server
- npm run build: production build
- npm run lint: lint checks
- npm run ci: build + lint + formatting checks

## Program ID and network

Current program ID in Anchor config:

- DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz

Configured for:

- localnet
- devnet

## Testing

Anchor tests:

```bash
cd anchor
anchor test
```

TypeScript integration and diagnostics scripts are available in scripts/.

## Safety notice

This project appears to be a prototype/educational codebase and should be treated as unaudited.
Do not use in production with real funds until formal security review and risk controls are completed.
