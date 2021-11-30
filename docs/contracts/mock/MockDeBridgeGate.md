## `MockDeBridgeGate`






### `initializeMock(uint8 _excessConfirmations, address _signatureVerifier, address _callProxy, contract IWETH _weth, address _feeProxy, address _deBridgeTokenDeployer, address _defiController, uint256 overrideChainId)` (public)



Constructor that initializes the most important configurations.


### `getChainId() → uint256 cid` (public)





### `getSubmissionId(bytes32 _debridgeId, uint256 _chainIdFrom, uint256 _chainIdTo, uint256 _amount, address _receiver, uint256 _nonce) → bytes32` (public)



Calculate submission id.





