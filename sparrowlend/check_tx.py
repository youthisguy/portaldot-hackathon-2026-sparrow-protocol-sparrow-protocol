 
from substrateinterface import SubstrateInterface

substrate = SubstrateInterface(url="ws://127.0.0.1:9944")
tx_hash = "0x4984e34864b7b98c4ad929598fba57add1760f2be45141fdd7b68500bb969616"

print(f"Checking transaction: {tx_hash}")
print("=" * 60)

# Try to get the transaction from the chain
try:
    # Get recent blocks and look for the transaction
    for block_num in range(1, 10):
        block_hash = substrate.get_block_hash(block_num)
        if not block_hash:
            continue
            
        block = substrate.get_block(block_hash=block_hash)
        
        # Check each extrinsic in the block
        for extrinsic in block['extrinsics']:
            if hasattr(extrinsic, 'extrinsic_hash') and extrinsic.extrinsic_hash == tx_hash:
                print(f"✓ Found transaction in block #{block_num}")
                print(f"  Block hash: {block_hash}")
                
                # Get events for this block
                events = substrate.query("System", "Events", block_hash=block_hash)
                for event in events:
                    print(f"  Event: {event.value}")
                break
        else:
            print(f"Block #{block_num}: Transaction not found")
            
except Exception as e:
    print(f"Error: {e}")

# Check the transaction pool
print("\nChecking pending transactions...")
try:
    pending = substrate.rpc_request("author_pendingExtrinsics", [])
    print(f"Pending extrinsics: {len(pending) if pending else 0}")
    if pending:
        for p in pending:
            if tx_hash in str(p):
                print("Transaction is still pending!")
                break
except Exception as e:
    print(f"Could not check pending: {e}")