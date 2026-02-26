#!/bin/bash
set -e

echo "🔄 WUSD Protocol Full Setup Script"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Node path (WSL uses Windows node)
NODE="/mnt/c/Program Files/nodejs/node.exe"

cd /home/kresn/wusd

# Step 1: Stop existing validator
echo -e "${YELLOW}1️⃣  Stopping existing validator...${NC}"
pkill -f solana-test-validator || true
sleep 2

# Step 2: Start fresh validator
echo -e "${YELLOW}2️⃣  Starting fresh validator...${NC}"
nohup solana-test-validator --reset > /tmp/validator.log 2>&1 &
echo "   Waiting for validator to start..."
sleep 8

# Check validator is running
if ! solana cluster-version > /dev/null 2>&1; then
    echo "❌ Validator failed to start. Check /tmp/validator.log"
    exit 1
fi
echo -e "${GREEN}   ✅ Validator running: $(solana cluster-version)${NC}"

# Step 3: Build and deploy anchor program
echo ""
echo -e "${YELLOW}3️⃣  Building and deploying anchor program...${NC}"
cd /home/kresn/wusd/anchor
anchor build 2>&1 | tail -3
anchor deploy 2>&1 | tail -3
echo -e "${GREEN}   ✅ Program built and deployed${NC}"

# Copy IDL to frontend
mkdir -p /home/kresn/wusd/frontend/src/lib/idl
cp /home/kresn/wusd/anchor/target/idl/anchor.json /home/kresn/wusd/frontend/src/lib/idl/
cp /home/kresn/wusd/anchor/target/idl/anchor.json /home/kresn/wusd/frontend/src/lib/types/
cp /home/kresn/wusd/anchor/target/types/anchor.ts /home/kresn/wusd/frontend/src/lib/types/
echo -e "${GREEN}   ✅ IDL copied to frontend${NC}"

# Step 4: Run protocol setup
echo ""
echo -e "${YELLOW}4️⃣  Initializing protocol...${NC}"
cd /home/kresn/wusd
npm run setup:init 2>&1 | grep -E "(✅|WUSD Mint:|Global State:|SOL Pool:|Pool PDA:)" || true

# Step 5: Set mock price feed via program PDA
echo ""
echo -e "${YELLOW}5️⃣  Setting mock price feed (\$100 SOL/USD)...${NC}"
npx ts-node scripts/set-mock-price.ts 2>&1 | grep -E "(✅|MockPriceFeed PDA:|Price:)" || true

# Step 6: Update .env.local
echo ""
echo -e "${YELLOW}6️⃣  Updating frontend/.env.local...${NC}"

# Read addresses from protocol-addresses.json
WUSD_MINT=$("$NODE" -e "console.log(require('./protocol-addresses.json').wusdMint)")
GOV_MINT=$("$NODE" -e "console.log(require('./protocol-addresses.json').governanceMint)")
PROGRAM_ID=$("$NODE" -e "console.log(require('./protocol-addresses.json').programId)")

# Mock price feed PDA is deterministic
PRICE_FEED=$("$NODE" -e "
const { PublicKey } = require('@solana/web3.js');
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from('mock_price_feed')],
  new PublicKey('DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz')
);
console.log(pda.toBase58());
")

cat > /home/kresn/wusd/frontend/.env.local << EOF
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899
NEXT_PUBLIC_SOLANA_CLUSTER=localnet
NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID}
NEXT_PUBLIC_STABLECOIN_MINT=${WUSD_MINT}
NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT=${GOV_MINT}
NEXT_PUBLIC_PRICE_FEED=${PRICE_FEED}
EOF

echo -e "${GREEN}   ✅ .env.local updated${NC}"

# Step 7: Airdrop SOL to test wallet (if needed)
echo ""
echo -e "${YELLOW}7️⃣  Checking wallet balance...${NC}"
BALANCE=$(solana balance 2>&1 | grep -oP '[\d.]+' | head -1)
echo "   Balance: ${BALANCE} SOL"

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo ""
echo "📋 Addresses:"
echo "   Program ID: ${PROGRAM_ID}"
echo "   WUSD Mint: ${WUSD_MINT}"
echo "   Price Feed: ${PRICE_FEED}"
echo ""
echo "📊 Mock Price: \$100 SOL/USD"
echo ""
echo "🚀 Next steps:"
echo "   1. cd frontend && npm run dev"
echo "   2. Connect wallet"
echo "   3. Deposit SOL → Mint WUSD"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
