const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const fs = require('fs');

const NODE_URL = 'ws://127.0.0.1:9944';
const WASM_PATH = './target/ink/sparrowlend.wasm';

async function main() {
    console.log('='.repeat(60));
    console.log('  SparrowLend Deployment - PortalDot');
    console.log('='.repeat(60));

    // Connect
    console.log('\n🔌 Connecting to node...');
    const provider = new WsProvider(NODE_URL);
    const api = await ApiPromise.create({ provider });
    
    const chain = await api.rpc.system.chain();
    console.log(`✓ Connected to ${chain}`);
    
    // Setup keyring
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    console.log(`✓ Deployer: ${alice.address}`);
    
    // Read WASM
    console.log('\n📦 Reading contract files...');
    const wasm = fs.readFileSync(WASM_PATH);
    console.log(`✓ WASM size: ${wasm.length} bytes`);
    
    // Constructor selector for new()
    const selector = '0x9bae9d5e';
    console.log(`✓ Constructor selector: ${selector}`);
    
    // Gas limit - using WeightV1 (simple integer) for older runtime
    const gasLimit = 200_000_000_000;
    
    console.log('\n🚀 Deploying contract...');
    
    // Use the simplest form of instantiateWithCode
    const tx = api.tx.contracts.instantiateWithCode(
        0,        // endowment
        gasLimit, // gas limit
        wasm,     // code
        selector, // data
        '0x'      // salt
    );
    
    // Submit and watch
    await new Promise((resolve, reject) => {
        let contractAddress = null;
        
        tx.signAndSend(alice, ({ status, events, txHash }) => {
            console.log(`📝 Status: ${status.type}`);
            
            if (status.isInBlock) {
                console.log(`   Block hash: ${status.asInBlock}`);
                console.log(`   TX Hash: ${txHash.toHex()}`);
            }
            
            // Process events
            events.forEach(({ event, phase }) => {
                const { section, method, data } = event;
                
                console.log(`   Event: ${section}.${method}`);
                
                if (section === 'contracts' && method === 'Instantiated') {
                    contractAddress = data[1].toString();
                    console.log(`\n✅ CONTRACT DEPLOYED SUCCESSFULLY!`);
                    console.log(`   Address: ${contractAddress}`);
                    fs.writeFileSync('contract_address.txt', contractAddress);
                    console.log(`   Address saved to contract_address.txt`);
                }
                
                if (method === 'ExtrinsicFailed') {
                    console.log(`\n❌ Deployment failed!`);
                    console.log(`   Error: ${data[0].toString()}`);
                }
            });
            
            if (status.isFinalized) {
                if (contractAddress) {
                    resolve(contractAddress);
                } else {
                    reject(new Error('No Instantiated event found'));
                }
            }
            
            if (status.isError) {
                reject(new Error('Transaction error'));
            }
        }).catch(reject);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('  Deployment Complete!');
    console.log('='.repeat(60));
    
    await api.disconnect();
}

main().catch(console.error);