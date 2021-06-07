// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IWhiteLightVerifier.sol";
import "../interfaces/IWhiteLightNFTDebridge.sol";
import "./WhiteNFTDebridge.sol";

contract WhiteLightNFTDebridge is WhiteNFTDebridge, IWhiteLightNFTDebridge {
    /// @dev Constructor that initializes the most important configurations.
    /// @param _aggregator Submission aggregator address.
    function initialize(
        address _aggregator,
        address _callProxy,
        address _feeToken
    ) public initializer {
        super._initialize(
            _aggregator,
            _callProxy,
            _feeToken
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId id of token to be transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    function mint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _tokenId,
        uint256 _nonce,
        bytes[] calldata _signatures
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _tokenId,
                _receiver,
                _nonce
            );
        require(
            IWhiteLightVerifier(aggregator).submit(submissionId, _signatures),
            "mint: not confirmed"
        );
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _tokenId
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId Id of token to be transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _tokenId,
        uint256 _nonce,
        bytes[] calldata _signatures,
        uint8 _aggregatorVersion
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _tokenId,
                _receiver,
                _nonce
            );
        AggregatorInfo memory aggregatorInfo =
            getOldAggregator[_aggregatorVersion];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        require(
            IWhiteLightVerifier(aggregatorInfo.aggregator).submit(
                submissionId,
                _signatures
            ),
            "mint: not confirmed"
        );
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _tokenId
        );
    }

    /// @dev Set wrapped native asset address.
    /// @param _feeToken Weth address.
    function setFeeToken(address _feeToken) external override onlyAdmin() {
        feeToken = _feeToken;
    }
}