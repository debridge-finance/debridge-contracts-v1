// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IWhiteLightAggregator.sol";
import "../interfaces/IWhiteLightDebridge.sol";
import "./WhiteDebridge.sol";

contract WhiteLightDebridge is WhiteDebridge, IWhiteLightDebridge {
    using SafeERC20 for IERC20;

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minAmount Minimal amount of current chain token to be wrapped.
    /// @param _fixedFee Fixed transfer fee rate.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ratio.
    /// @param _aggregator Submission aggregator address.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function initialize(
        uint256 _minAmount,
        uint256 _fixedFee,
        uint256 _transferFee,
        uint256 _minReserves,
        address _aggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        IDefiController _defiController
    ) public payable initializer {
        super._initialize(
            _minAmount,
            _fixedFee,
            _transferFee,
            _minReserves,
            _aggregator,
            _callProxy,
            _supportedChainIds,
            _defiController
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function mint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
                _receiver,
                _nonce
            );
        require(
            IWhiteLightAggregator(aggregator).submit(submissionId, _trxData),
            "mint: not confirmed"
        );
        _mint(submissionId, _debridgeId, _receiver, _amount);
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData,
        uint8 _aggregatorVersion
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
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
            IWhiteLightAggregator(aggregatorInfo.aggregator).submit(
                submissionId,
                _trxData
            ),
            "mint: not confirmed"
        );
        _mint(submissionId, _debridgeId, _receiver, _amount);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function claim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
                _receiver,
                _nonce
            );
        require(
            IWhiteLightAggregator(aggregator).submit(submissionId, _trxData),
            "claim: not confirmed"
        );
        _claim(submissionId, _debridgeId, _receiver, _amount);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function autoClaim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData,
        uint256 _claimFee,
        bytes memory _data
    ) external {
        bytes32 submissionId =
            getAutoSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
                _receiver,
                _nonce,
                _claimFee,
                _data
            );
        require(
            IWhiteLightAggregator(aggregator).submit(submissionId, _trxData),
            "claim: not confirmed"
        );
        _autoClaim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _claimFee,
            _data
        );
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    /// @param _aggregatorVersion Aggregator version.
    function claimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData,
        uint8 _aggregatorVersion
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
                _receiver,
                _nonce
            );
        AggregatorInfo memory aggregatorInfo =
            getOldAggregator[_aggregatorVersion];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalid aggregator"
        );
        require(
            IWhiteLightAggregator(aggregatorInfo.aggregator).submit(
                submissionId,
                _trxData
            ),
            "claim: not confirmed"
        );
        _claim(submissionId, _debridgeId, _receiver, _amount);
    }
}
