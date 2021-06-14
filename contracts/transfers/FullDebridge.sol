// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IFullDebridge.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IFullAggregator.sol";
import "../periphery/WrappedAsset.sol";
import "./Debridge.sol";

contract FullDebridge is Debridge, IFullDebridge {
    using SafeERC20 for IERC20;

    IFeeProxy public feeProxy; // proxy to convert the collected fees into Link's
    IWETH public weth; // wrapped native token contract

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minAmount Minimal amount of current chain token to be wrapped.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ratio.
    /// @param _aggregator Submission aggregator address.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function initialize(
        uint256 _excessConfirmations,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minReserves,
        uint256 _amountThreshold,
        address _aggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IWETH _weth,
        IFeeProxy _feeProxy,
        IDefiController _defiController
    ) public payable initializer {
        super._initialize(
            _excessConfirmations,
            _minAmount,
            _maxAmount,
            _minReserves,
            _amountThreshold,
            _aggregator,
            _callProxy,
            _supportedChainIds,
            _chainSupportInfo,
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
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        address _fallbackAddress,
        uint256 _executionFee,
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
                _fallbackAddress,
                _executionFee,
                _data
            );
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregator).getSubmissionConfirmations(
                submissionId
            );
        require(confirmed, "autoMint: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "autoMint: amount not confirmed"
            );
        }
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external whenNotPaused() {
        bytes32 submissionId =
            getAutoSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
                _receiver,
                _nonce,
                _fallbackAddress,
                _executionFee,
                _data
            );
        AggregatorInfo memory aggregatorInfo =
            getOldAggregator[_aggregatorVersion];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregatorInfo.aggregator)
                .getSubmissionConfirmations(submissionId);
        require(confirmed, "mintWithOldAggregator: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "mintWithOldAggregator: amount not confirmed"
            );
        }
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
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
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregator).getSubmissionConfirmations(
                submissionId
            );
        require(confirmed, "mint: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "mint: amount not confirmed"
            );
        }
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            "0x"
        );
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
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregatorInfo.aggregator)
                .getSubmissionConfirmations(submissionId);
        require(confirmed, "mintWithOldAggregator: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "mintWithOldAggregator: amount not confirmed"
            );
        }
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            "0x"
        );
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
        address _fallbackAddress,
        uint256 _executionFee,
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
                _fallbackAddress,
                _executionFee,
                _data
            );
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregator).getSubmissionConfirmations(
                submissionId
            );
        require(confirmed, "autoClaim: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "autoClaim: amount not confirmed"
            );
        }
        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoClaimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external whenNotPaused() {
        bytes32 submissionId =
            getAutoSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _amount,
                _receiver,
                _nonce,
                _fallbackAddress,
                _executionFee,
                _data
            );
        AggregatorInfo memory aggregatorInfo =
            getOldAggregator[_aggregatorVersion];
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregatorInfo.aggregator)
                .getSubmissionConfirmations(submissionId);
        require(confirmed, "autoClaimWithOldAggregator: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "autoClaimWithOldAggregator: amount not confirmed"
            );
        }
        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
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
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregator).getSubmissionConfirmations(
                submissionId
            );
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "claim: amount not confirmed"
            );
        }
        require(confirmed, "claim: not confirmed");
        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            "0x"
        );
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
        (uint256 confirmations, bool confirmed) =
            IFullAggregator(aggregatorInfo.aggregator)
                .getSubmissionConfirmations(submissionId);
        require(confirmed, "claimWithOldAggregator: not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "claimWithOldAggregator: amount not confirmed"
            );
        }
        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            "0x"
        );
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
