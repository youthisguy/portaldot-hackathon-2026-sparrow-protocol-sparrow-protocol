from substrateinterface import SubstrateInterface
import json

substrate = SubstrateInterface(url="ws://127.0.0.1:9944")

print("Checking pending transactions...")
print("=" * 60)

# Get pending extrinsics
try:
    pending = substrate.rpc_request("author_pendingExtrinsics", [])
    print(f"Number of pending extrinsics: {len(pending)}")
    
    for i, extrinsic in enumerate(pending):
        print(f"\nPending #{i+1}:")
        print(f"  Hex: {extrinsic[:100]}...")  # First 100 chars
        
        # Try to decode if possible
        try:
            decoded = substrate.decode_extrinsic(extrinsic)
            print(f"  Decoded: {decoded}")
        except:
            print("  Could not decode")
            
except Exception as e:
    print(f"Error: {e}")

# Check if our specific transaction is in the queue
print("\n" + "=" * 60)
print("Checking node health...")
try:
    health = substrate.rpc_request("system_health", [])
    print(f"Health: {json.dumps(health, indent=2)}")
except Exception as e:
    print(f"Error: {e}")