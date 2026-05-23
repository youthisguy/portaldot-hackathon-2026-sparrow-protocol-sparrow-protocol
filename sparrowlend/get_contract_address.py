  
from substrateinterface import SubstrateInterface

substrate = SubstrateInterface(url="ws://127.0.0.1:9944")

# Block #123 where your transaction was included
block_hash = substrate.get_block_hash(123)
print(f"Checking block #123: {block_hash}")

# Get events from block #123
events = substrate.query("System", "Events", block_hash=block_hash)

print("\nSearching for contract instantiation events...")
print("=" * 60)

for event in events:
    event_dict = event.value
    module = event_dict.get('event', {}).get('module_id', '')
    event_id = event_dict.get('event', {}).get('event_id', '')
    
    print(f"Event: {module}.{event_id}")
    
    if module == "Contracts" and event_id == "Instantiated":
        attrs = event_dict['event']['attributes']
        print(f"\n🎉 CONTRACT ADDRESS FOUND!")
        print(f"Address: {attrs.get('contract') or attrs.get('address')}")
        print(f"Deployer: {attrs.get('deployer')}")
        
        # Also check for any error events
    elif event_id == "ExtrinsicFailed":
        print(f"⚠️ ExtrinsicFailed: {event_dict['event']['attributes']}")

print("\n" + "=" * 60)
print("If no Instantiated event found, the deployment may have failed.")
print("Check if there's an ExtrinsicFailed event above.")