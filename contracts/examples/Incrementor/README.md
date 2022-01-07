1. Deploy and initialize Incrementor on two chains
2. Call addControllingAddress on receiving chain with
    - `_nativeSender` set to the contract address on the sending chain
    - `_chainIdFrom` set to the sending chain id
3. Call Incrementor.send on sending chain
    - _receiver and _data will be ignored, so you may sat any values for them
4. Wait for transaction to go through
5. Call DeBridgeGate.claim on the receiving chain