// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWhiteDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IWhiteFullDebridge.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IWhiteAggregator.sol";
import "../periphery/WrappedAsset.sol";
import "./WhiteDebridge.sol";

contract WhiteFullDebridge is WhiteDebridge, IWhiteFullDebridge {
    using SafeERC20 for IERC20;

    IFeeProxy public feeProxy; // proxy to convert the collected fees into Link's
    IWETH public weth; // wrapped native token contract

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
        IWETH _weth,
        IFeeProxy _feeProxy,
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
    {
        weth = _weth;
        feeProxy = _feeProxy;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    function mint(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external override {
        bytes32 mintId =
            getSubmisionId(_debridgeId, _amount, _receiver, _nonce);
        require(
            IWhiteAggregator(aggregator).isMintConfirmed(mintId),
            "mint: not confirmed"
        );
        _mint(mintId, _debridgeId, _receiver, _amount);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function claim(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external override {
        bytes32 burntId =
            getSubmisionId(_debridgeId, _amount, _receiver, _nonce);
        require(
            IWhiteAggregator(aggregator).isBurntConfirmed(burntId),
            "claim: not confirmed"
        );
        _claim(burntId, _debridgeId, _receiver, _amount);
    }

    /* ADMIN */

    /// @dev Fund aggregator.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Submission aggregator address.
    function fundAggregator(bytes32 _debridgeId, uint256 _amount)
        external
        onlyAdmin()
    {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(
            debridge.chainId == chainId,
            "fundAggregator: wrong target chain"
        );
        require(
            debridge.collectedFees >= _amount,
            "fundAggregator: not enough fee"
        );
        debridge.collectedFees -= _amount;
        if (debridge.tokenAddress == address(0)) {
            weth.deposit{value: _amount}();
            weth.transfer(address(feeProxy), _amount);
            feeProxy.swapToLink(address(weth), _amount, aggregator);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(
                address(feeProxy),
                _amount
            );
            feeProxy.swapToLink(debridge.tokenAddress, _amount, aggregator);
        }
    }

    /// @dev Set fee converter proxy.
    /// @param _feeProxy Fee proxy address.
    function setFeeProxy(IFeeProxy _feeProxy) external onlyAdmin() {
        feeProxy = _feeProxy;
    }

    /// @dev Set wrapped native asset address.
    /// @param _weth Weth address.
    function setWeth(IWETH _weth) external onlyAdmin() {
        weth = _weth;
    }
}
