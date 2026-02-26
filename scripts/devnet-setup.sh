#!/bin/bash
set -e

echo "🔄 WUSD Protocol Devnet Setup Script"
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

cd /home/kresn/wusd

# Step 1: Check wallet balance
echo -e "${YELLOW}1️⃣  Checking wallet...${NC}"
BALANCE=$(solana balance --url devnet 2>/dev/null | awk '{print $1}')
WALLET=$(solana address)
echo "   Wallet: $WALLET"
echo "   Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    echo -e "${YELLOW}   ⚠️  Low balance! Requesting airdrop...${NC}"
    solana airdrop 2 --url devnet || echo "   Airdrop failed (rate limited). Get SOL from https://faucet.solana.com"
    sleep 2
    BALANCE=$(solana balance --url devnet 2>/dev/null | awk '{print $1}')
    echo "   New balance: $BALANCE SOL"
fi

# Step 2: Build program
echo ""
echo -e "${YELLOW}2️⃣  Building anchor program...${NC}"
cd /home/kresn/wusd/anchor
anchor build 2>&1 | tail -3
echo -e "${GREEN}   ✅ Program built${NC}"

# Step 3: Deploy to devnet
echo ""
echo -e "${YELLOW}3️⃣  Deploying to devnet...${NC}"
solana config set --url devnet > /dev/null
anchor deploy --provider.cluster devnet 2>&1 | tail -5
echo -e "${GREEN}   ✅ Program deployed to devnet${NC}"

# Copy IDL to frontend
mkdir -p /home/kresn/wusd/frontend/src/lib/idl
cp /home/kresn/wusd/anchor/target/idl/anchor.json /home/kresn/wusd/frontend/src/lib/idl/
cp /home/kresn/wusd/anchor/target/idl/anchor.json /home/kresn/wusd/frontend/src/lib/types/
cp /home/kresn/wusd/anchor/target/types/anchor.ts /home/kresn/wusd/frontend/src/lib/types/
echo -e "${GREEN}   ✅ IDL copied to frontend${NC}"

# Step 4: Initialize protocol
echo ""
echo -e "${YELLOW}4️⃣  Initializing protocol on devnet...${NC}"
cd /home/kresn/wusd
npm run setup:init 2>&1 | grep -E "(✅|❌|WUSD Mint:|Global State:|SOL Pool:|Pool PDA:|Error)" || true

# Step 5: Set mock price feed
echo ""
echo -e "${YELLOW}5️⃣  Setting mock price feed (\$100 SOL/USD)...${NC}"
npm run setup:price 2>&1 | grep -E "(✅|MockPriceFeed|Price:)" || true

# Step 6: Update frontend .env.local
echo ""
echo -e "${YELLOW}6️⃣  Updating frontend/.env.local...${NC}"

# Read current addresses from protocol-addresses.json if exists
if [ -f "protocol-addresses.json" ]; then
    WUSD_MINT=$(grep -o '"stablecoinMint": "[^"]*"' protocol-addresses.json | cut -d'"' -f4)
    GOV_MINT=$(grep -o '"governanceMint": "[^"]*"' protocol-addresses.json | cut -d'"' -f4)
    PRICE_FEED="Frk815hsMWLwiCoTXCm8gc82dPH8sH55ZTr4WshQtBok"
    
    cat > frontend/.env.local << EOF
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_PROGRAM_ID=DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz
NEXT_PUBLIC_STABLECOIN_MINT=${WUSD_MINT}
NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT=${GOV_MINT}
NEXT_PUBLIC_PRICE_FEED=${PRICE_FEED}
EOF
    echo -e "${GREEN}   ✅ .env.local updated${NC}"
else
    echo -e "${RED}   ⚠️  protocol-addresses.json not found${NC}"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}✅ DEVNET SETUP COMPLETE!${NC}"
echo ""
echo "📋 Configuration:"
echo "   Network: Solana Devnet"
echo "   RPC: https://api.devnet.solana.com"
echo "   Program ID: DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz"
echo ""
echo "🚀 Next steps:"
echo "   1. cd frontend && npm run dev"
echo "   2. Connect Phantom/Solflare wallet (switch to devnet)"
echo "   3. Get devnet SOL from https://faucet.solana.com"
echo "   4. Deposit SOL → Mint WUSD"
echo "═══════════════════════════════════════════════════════"
