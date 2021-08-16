// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../transfers/DeBridgeGate.sol";

contract MockDeBridgeGate is DeBridgeGate{

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _signatureVerifier Aggregator address to verify signatures
    /// @param _confirmationAggregator Aggregator address to verify by oracles confirmations
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    /// @param _treasury Address to collect a fee
    function initializeMock(
        uint8 _excessConfirmations,
        address _signatureVerifier,
        address _confirmationAggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IWETH _weth,
        IFeeProxy _feeProxy,
        IDefiController _defiController,
        address _treasury,
        uint256 overrideChainId
    ) public initializer {
        // DeBridgeGate.initialize(_excessConfirmations,
        // _signatureVerifier,
        // _confirmationAggregator,
        // _callProxy,
        // _supportedChainIds,
        // _chainSupportInfo,
        // _weth,
        // _feeProxy,
        // _defiController,
        // _treasury);


        chainId = overrideChainId;
        nativeDebridgeId = getDebridgeId(chainId, address(0));
        _addAsset(nativeDebridgeId, address(0), abi.encodePacked(address(0)), chainId);
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            getChainSupport[_supportedChainIds[i]] = _chainSupportInfo[i];
        }

        signatureVerifier = _signatureVerifier;
        confirmationAggregator = _confirmationAggregator;

        callProxy = _callProxy;
        defiController = _defiController;
        excessConfirmations = _excessConfirmations;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        weth = _weth;
        feeProxy = _feeProxy;
        treasury = _treasury;

        flashFeeBps = 10;
    }
}
