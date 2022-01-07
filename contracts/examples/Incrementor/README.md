1. Copy L2Base using instruction in ../L2Base/README.md 
2. Copy this contract, Incrementor.sol
3. Deploy and initialize Incrementor on two chains
4. Call addControllingAddress on receiving chain with
    - `_nativeSender` set to the contract address on the sending chain
    - `_chainIdFrom` set to the sending chain id
5. Call Incrementor.send on sending chain
    - _data will be ignored, so you may set any value, for example empty string ""
6. Wait for the message to go through the bridge
7. Call DeBridgeGate.claim on the receiving chain