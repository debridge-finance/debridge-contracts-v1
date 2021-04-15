// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IWhiteLightAggregator.sol";
import "../interfaces/IWhiteLightDebridge.sol";
import "./WhiteDebridge.sol";

contract WhiteLightDebridge is WhiteDebridge, IWhiteLightDebridge {
    using SafeERC20 for IERC20;

    address public aggregatorAddr;

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minAmount Minimal amount of current chain token to be wrapped.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ratio.
    /// @param _aggregator Submission aggregator address.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    constructor(
        uint256 _minAmount,
        uint256 _transferFee,
        uint256 _minReserves,
        address _aggregator,
        uint256[] memory _supportedChainIds,
        IDefiController _defiController
    )
        WhiteDebridge(
            _minAmount,
            _transferFee,
            _minReserves,
            _aggregator,
            _supportedChainIds,
            _defiController
        )
    {}

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function mint(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData
    ) external override {
        bytes32 mintId =
            getSubmisionId(_debridgeId, _amount, _receiver, _nonce);
        require(
            IWhiteLightAggregator(aggregator).submitMint(mintId, _trxData),
            "mint: not confirmed"
        );
        _mint(mintId, _debridgeId, _receiver, _amount);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function claim(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] calldata _trxData
    ) external override {
        bytes32 burntId =
            getSubmisionId(_debridgeId, _amount, _receiver, _nonce);
        require(
            IWhiteLightAggregator(aggregator).submitBurn(burntId, _trxData),
            "claim: not confirmed"
        );
        _claim(burntId, _debridgeId, _receiver, _amount);
    }
}
