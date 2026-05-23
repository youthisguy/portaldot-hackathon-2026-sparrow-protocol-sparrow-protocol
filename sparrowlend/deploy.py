#!/usr/bin/env python3
import os
import json
import time
from substrateinterface import SubstrateInterface, Keypair
from substrateinterface.contracts import ContractCode, ContractInstance

LOCAL_NODE_URL = "ws://127.0.0.1:9944"
WASM_FILE = "./target/ink/sparrowlend.wasm"
METADATA_FILE = "./target/ink/sparrowlend.json"

print("=" * 60)
print("  SparrowLend Deployment - PortalDot")
print("=" * 60)

# Connect (without type_registry_preset for your version)
portaldot = SubstrateInterface(url=LOCAL_NODE_URL, ss58_format=42)
keypair = Keypair.create_from_uri("//Alice")

print(f"\n✓ Connected to {LOCAL_NODE_URL}")
print(f"✓ Deployer: {keypair.ss58_address}")

# Create contract code
code = ContractCode.create_from_contract_files(
    metadata_file=METADATA_FILE,
    wasm_file=WASM_FILE,
    substrate=portaldot,
)

# IMPORTANT: Use a simple integer gas limit that's reasonable
# The maximum safe gas that won't exhaust block limits
GAS_LIMIT = 200_000_000_000  # 200 billion (works with your library)

print(f"\n📊 Gas limit: {GAS_LIMIT:,}")

# Step 1: Try deployment with this gas limit
print("\n🚀 Deploying contract...")

try:
    # Deploy without dry_run (since your version might not support it)
    contract = code.deploy(
        keypair=keypair,
        constructor="new",
        args={},
        endowment=0,
        gas_limit=GAS_LIMIT,
    )
    
    print(f"\n✅ SUCCESS! Contract deployed!")
    print(f"   Address: {contract.contract_address}")
    
    # Save address
    with open("contract_address.txt", "w") as f:
        f.write(contract.contract_address)
    print(f"   Address saved to contract_address.txt")
    
    # Test the contract
    print("\n📖 Testing contract...")
    try:
        result = contract.read(keypair, "get_pool_stats")
        if result.is_success:
            data = result.contract_result_data
            print("✓ get_pool_stats() returned:")
            if data and len(data) >= 6:
                print(f"   available_liquidity : {data[0]}")
                print(f"   tvl                 : {data[1]}")
                print(f"   util_pct            : {data[2]}")
                print(f"   borrow_rate_bps     : {data[3]}")
                print(f"   supply_apy_bps      : {data[4]}")
                print(f"   reward_per_share    : {data[5]}")
        else:
            print(f"⚠️ Could not read contract: {result.error_message}")
    except Exception as e:
        print(f"⚠️ Read error: {e}")
        
except Exception as e:
    print(f"\n❌ Deployment failed: {e}")
    
    # If the above fails, try with a different approach
    print("\n🔄 Trying alternative deployment method...")
    
    try:
        # Try with upload_code=True
        contract = code.deploy(
            keypair=keypair,
            constructor="new",
            args={},
            endowment=0,
            gas_limit=GAS_LIMIT,
            upload_code=True,
        )
        
        print(f"\n✅ SUCCESS! Contract deployed!")
        print(f"   Address: {contract.contract_address}")
        
        with open("contract_address.txt", "w") as f:
            f.write(contract.contract_address)
            
    except Exception as e2:
        print(f"\n❌ Alternative also failed: {e2}")
        
        # Final attempt: raw RPC with wait_for_inclusion=False to avoid DigestItem
        print("\n🔄 Final attempt: Raw RPC without waiting...")
        
        try:
            with open(WASM_FILE, "rb") as f:
                wasm = f.read()
            
            with open(METADATA_FILE) as f:
                meta = json.load(f)
            
            selector = None
            if "V3" in meta:
                for const in meta["V3"]["spec"]["constructors"]:
                    if const["label"] == "new":
                        selector = const["selector"]
                        break
            else:
                for const in meta["spec"]["constructors"]:
                    if const["label"] == "new":
                        selector = const["selector"]
                        break
            
            if selector.startswith("0x"):
                selector = selector[2:]
            
            call = portaldot.compose_call(
                call_module="Contracts",
                call_function="instantiate_with_code",
                call_params={
                    "endowment": 0,
                    "gas_limit": GAS_LIMIT,
                    "code": "0x" + wasm.hex(),
                    "data": "0x" + selector,
                    "salt": "0x",
                },
            )
            
            extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=keypair)
            
            # Submit without waiting to avoid DigestItem error
            result = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=False)
            print(f"\n✅ Transaction submitted!")
            print(f"   TX Hash: {result.extrinsic_hash}")
            print(f"\nCheck contract address in polkadot.js UI:")
            print(f"   https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944")
            print(f"   Search for TX: {result.extrinsic_hash}")
            print(f"   Look for 'contracts.Instantiated' event")
            
        except Exception as e3:
            print(f"\n❌ Raw RPC also failed: {e3}")

print("\n" + "=" * 60)
print("  Deployment process complete")
print("=" * 60)