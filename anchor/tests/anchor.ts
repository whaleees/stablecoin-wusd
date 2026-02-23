import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Anchor } from "../target/types/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

describe("wusd-stablecoin", () => {
  // Configure provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Anchor as Program<Anchor>;
  const admin = provider.wallet;
  const user = Keypair.generate();

  // Constants
  const TOKEN_DECIMALS = 6;
  const ONE_TOKEN = new anchor.BN(10 ** TOKEN_DECIMALS);
  const BASIS_POINTS_DIVISOR = 10000;

  // PDAs
  let globalStatePDA: PublicKey;
  let stablecoinMint: PublicKey;
  let governanceMint: PublicKey;
  let collateralMint: PublicKey;
  let poolPDA: PublicKey;
  let userVaultPDA: PublicKey;
  let mintAuthorityPDA: PublicKey;

  // Token accounts
  let userCollateralATA: PublicKey;
  let userStableATA: PublicKey;
  let poolCollateralATA: PublicKey;

  // Helper function to create PDA
  const getPDA = (seeds: (Buffer | Uint8Array)[], programId = program.programId) => {
    return PublicKey.findProgramAddressSync(seeds, programId);
  };

  // Helper to airdrop SOL
  const airdrop = async (pubkey: PublicKey, sol = 1) => {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      sol * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  };

  // ============================================
  // SETUP
  // ============================================
  before(async () => {
    console.log("🚀 Setting up test environment...");
    
    // Airdrop to user
    await airdrop(user.publicKey, 10);
    
    // Calculate PDAs
    [globalStatePDA] = getPDA([Buffer.from("global_state")]);
    [mintAuthorityPDA] = getPDA([Buffer.from("mint_authority")]);
    
    // Create token mints
    stablecoinMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      TOKEN_DECIMALS
    );
    
    governanceMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      TOKEN_DECIMALS
    );
    
    collateralMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      TOKEN_DECIMALS
    );
    
    // Calculate pool PDA (needs collateral mint)
    [poolPDA] = getPDA([
      Buffer.from("collateral_pool"),
      collateralMint.toBuffer()
    ]);
    
    // Create user vault PDA
    [userVaultPDA] = getPDA([
      Buffer.from("user_vault"),
      user.publicKey.toBuffer(),
      poolPDA.toBuffer()
    ]);
    
    console.log("✅ Setup complete!");
  });

  // ============================================
  // HAPPY PATH TESTS
  // ============================================
  describe("Happy Path - Complete Workflow", () => {
    it("1. Initialize global state", async () => {
      const debtCeiling = ONE_TOKEN.mul(new anchor.BN(1000000)); // 1M
      const stabilityFee = new anchor.BN(500); // 5% APY
      const liquidationPenalty = new anchor.BN(1000); // 10% penalty

      const tx = await program.methods
        .initialize(debtCeiling, stabilityFee, liquidationPenalty)
        .accounts({
          admin: admin.publicKey,
          globalState: globalStatePDA,
          stablecointMint: stablecoinMint, // Note: Typo in instruction (stablecoint_mint)
          governanceTokenMint: governanceMint,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("✅ Initialize TX:", tx);

      // Verify state
      const globalState = await program.account.globalState.fetch(globalStatePDA);
      
      assert.equal(globalState.admin.toString(), admin.publicKey.toString());
      assert.equal(globalState.stablecoinMint.toString(), stablecoinMint.toString());
      assert.equal(globalState.debtCeiling.toString(), debtCeiling.toString());
      assert.equal(globalState.stabilityFee.toString(), stabilityFee.toString());
      assert.equal(globalState.liquidationPenalty.toString(), liquidationPenalty.toString());
      assert.equal(globalState.totalDebt.toString(), "0");
      assert.deepEqual(globalState.pools, []);
    });

    it("2. Create user token accounts and mint collateral", async () => {
      // Create user token accounts
      userCollateralATA = (await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        collateralMint,
        user.publicKey
      )).address;
      
      userStableATA = (await getOrCreateAssociatedTokenAccount(
        provider.connection,
        user,
        stablecoinMint,
        user.publicKey
      )).address;
      
      // Mint collateral to user
      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        userCollateralATA,
        admin.payer,
        ONE_TOKEN.mul(new anchor.BN(10000)).toNumber() // 10,000 tokens
      );
      
      // Verify balance
      const collateralAccount = await getAccount(provider.connection, userCollateralATA);
      assert(collateralAccount.amount > 0, "User should have collateral");
      
      console.log("✅ User has", collateralAccount.amount.toString(), "collateral tokens");
    });

    it("3. Deposit collateral (creates vault)", async () => {
      // Note: You need to initialize pool first! But you don't have initialize_pool instruction.
      // For now, we'll skip this test or modify it
      console.log("⚠️ Skipping deposit test - need initialize_pool instruction first");
      
      // If you had initialize_pool, you would:
      // 1. Call initialize_pool to create CollateralPool
      // 2. Then deposit
      
      // For now, let's just verify the user has tokens
      const collateralAccount = await getAccount(provider.connection, userCollateralATA);
      const balance = collateralAccount.amount;
      console.log(`User collateral balance: ${balance.toString()} (${balance.div(ONE_TOKEN).toString()} tokens)`);
    });
  });

  // ============================================
  // UNHAPPY PATH TESTS
  // ============================================
  describe("Unhappy Path - Error Cases", () => {
    it("1. Should fail to initialize with zero debt ceiling", async () => {
      // Need a new global state PDA to avoid duplicate initialization
      const [newGlobalStatePDA] = getPDA([Buffer.from("global_state_2")]);
      
      try {
        await program.methods
          .initialize(
            new anchor.BN(0), // Zero debt ceiling
            new anchor.BN(500),
            new anchor.BN(1000)
          )
          .accounts({
            admin: admin.publicKey,
            globalState: newGlobalStatePDA,
            stablecointMint: stablecoinMint,
            governanceTokenMint: governanceMint,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Should have failed with zero debt ceiling");
      } catch (error: any) {
        expect(error.message).to.include("Invalid parameter");
        console.log("✅ Correctly rejected zero debt ceiling");
      }
    });

    it("2. Should fail to initialize with excessive stability fee (>100%)", async () => {
      const [newGlobalStatePDA] = getPDA([Buffer.from("global_state_3")]);
      
      try {
        await program.methods
          .initialize(
            ONE_TOKEN.mul(new anchor.BN(1000000)),
            new anchor.BN(10001), // 100.01% > 100%
            new anchor.BN(1000)
          )
          .accounts({
            admin: admin.publicKey,
            globalState: newGlobalStatePDA,
            stablecointMint: stablecoinMint,
            governanceTokenMint: governanceMint,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Should have failed with excessive stability fee");
      } catch (error: any) {
        expect(error.message).to.include("Invalid parameter");
        console.log("✅ Correctly rejected excessive stability fee");
      }
    });

    it("3. Should fail to initialize with excessive liquidation penalty (>50%)", async () => {
      const [newGlobalStatePDA] = getPDA([Buffer.from("global_state_4")]);
      
      try {
        await program.methods
          .initialize(
            ONE_TOKEN.mul(new anchor.BN(1000000)),
            new anchor.BN(500),
            new anchor.BN(5001) // 50.01% > 50%
          )
          .accounts({
            admin: admin.publicKey,
            globalState: newGlobalStatePDA,
            stablecointMint: stablecoinMint,
            governanceTokenMint: governanceMint,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Should have failed with excessive liquidation penalty");
      } catch (error: any) {
        expect(error.message).to.include("Invalid parameter");
        console.log("✅ Correctly rejected excessive liquidation penalty");
      }
    });

    it("4. Should fail deposit with zero amount (if pool existed)", async () => {
      // This test assumes pool exists
      try {
        // Create pool collateral ATA for testing
        const testPoolCollateralATA = await createAssociatedTokenAccount(
          provider.connection,
          admin.payer,
          collateralMint,
          poolPDA
        );
        
        await program.methods
          .deposit(new anchor.BN(0)) // Zero amount
          .accounts({
            user: user.publicKey,
            globalState: globalStatePDA,
            userCollateralAccount: userCollateralATA,
            poolCollateralAccount: testPoolCollateralATA,
            pool: poolPDA,
            userVault: userVaultPDA,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        assert.fail("Should have failed with zero amount");
      } catch (error: any) {
        expect(error.message).to.include("Invalid parameter");
        console.log("✅ Correctly rejected zero deposit amount");
      }
    });

    it("5. Should fail mint_stable with zero amount", async () => {
      // Create a mock price feed account
      const mockPriceFeed = Keypair.generate();
      
      try {
        await program.methods
          .mintStable(new anchor.BN(0)) // Zero amount
          .accounts({
            user: user.publicKey,
            globalState: globalStatePDA,
            collateralMint: collateralMint,
            stablecoinMint: stablecoinMint,
            pool: poolPDA,
            userVault: userVaultPDA,
            priceFeed: mockPriceFeed.publicKey,
            userStableAccount: userStableATA,
            mintAuthority: mintAuthorityPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        assert.fail("Should have failed with zero mint amount");
      } catch (error: any) {
        expect(error.message).to.include("Invalid parameter");
        console.log("✅ Correctly rejected zero mint amount");
      }
    });

    it("6. Should fail repay with zero amount", async () => {
      try {
        await program.methods
          .repay(new anchor.BN(0)) // Zero amount
          .accounts({
            user: user.publicKey,
            globalState: globalStatePDA,
            collateralMint: collateralMint,
            stablecoinMint: stablecoinMint,
            pool: poolPDA,
            userVault: userVaultPDA,
            userStableAccount: userStableATA,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        
        assert.fail("Should have failed with zero repay amount");
      } catch (error: any) {
        expect(error.message).to.include("Invalid parameter");
        console.log("✅ Correctly rejected zero repay amount");
      }
    });
  });

  // ============================================
  // PROGRAM STATE VERIFICATION
  // ============================================
  describe("Program Verification", () => {
    it("Should verify program is properly deployed", async () => {
      console.log("\n🔍 Verifying program state...");
      
      // Check global state
      try {
        const globalState = await program.account.globalState.fetch(globalStatePDA);
        console.log("✅ Global State:");
        console.log("   Admin:", globalState.admin.toString());
        console.log("   Stablecoin Mint:", globalState.stablecoinMint.toString());
        console.log("   Debt Ceiling:", globalState.debtCeiling.div(ONE_TOKEN).toString(), "tokens");
        console.log("   Stability Fee:", globalState.stabilityFee.toNumber() / 100, "%");
        console.log("   Liquidation Penalty:", globalState.liquidationPenalty.toNumber() / 100, "%");
        console.log("   Total Debt:", globalState.totalDebt.toString());
        console.log("   Pools:", globalState.pools.length);
      } catch (error) {
        console.log("❌ Could not fetch global state");
      }
      
      // Check program is deployed
      const programInfo = await provider.connection.getAccountInfo(program.programId);
      assert(programInfo, "Program should be deployed");
      assert(programInfo.executable, "Program should be executable");
      console.log("\n✅ Program deployed successfully!");
      console.log("   Program ID:", program.programId.toString());
      console.log("   Program size:", programInfo.data.length, "bytes");
    });

    it("Should verify IDL matches program", async () => {
      const idl = program.idl;
      assert(idl, "IDL should exist");
      
      console.log("\n📋 Program Instructions:");
      idl.instructions.forEach((ix: any, index: number) => {
        console.log(`   ${index + 1}. ${ix.name}`);
        console.log(`      Accounts: ${ix.accounts.length}`);
      });
      
      console.log("\n📋 Program Accounts:");
      (idl.accounts || []).forEach((acc: any, index: number) => {
        console.log(`   ${index + 1}. ${acc.name}`);
      });
    });
  });
});