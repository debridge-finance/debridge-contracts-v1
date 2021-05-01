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
        IWETH _weth,
        IFeeProxy _feeProxy,
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
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external override whenNotPaused() {
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
            IWhiteAggregator(aggregator).isSubmissionConfirmed(submissionId),
            "mint: not confirmed"
        );
        _mint(submissionId, _debridgeId, _receiver, _amount);
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
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
            IWhiteAggregator(aggregatorInfo.aggregator).isSubmissionConfirmed(
                submissionId
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
    function autoClaim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        uint256 _claimFee,
        bytes memory _data
    ) external whenNotPaused() {
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
            IWhiteAggregator(aggregator).isSubmissionConfirmed(submissionId),
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
    function claim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external override whenNotPaused() {
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
            IWhiteAggregator(aggregator).isSubmissionConfirmed(submissionId),
            "claim: not confirmed"
        );
        _claim(submissionId, _debridgeId, _receiver, _amount);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _aggregatorVersion Aggregator version.
    function claimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
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
            IWhiteAggregator(aggregatorInfo.aggregator).isSubmissionConfirmed(
                submissionId
            ),
            "claim: not confirmed"
        );
        _claim(submissionId, _debridgeId, _receiver, _amount);
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
