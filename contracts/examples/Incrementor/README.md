1. Deploy and initialize Incrementor on two chains
2. Call addControllingAddress on receiving chain with
    - `_nativeSender` set to the contract address on the sending chain
    - `_chainIdFrom` set to the sending chain id
3. Call Incrementor.send on sending chain
    - _data will be ignored, so you may set any value, for example empty string ""
4. Wait for the message to go through the bridge
5. Call DeBridgeGate.claim on the receiving chain