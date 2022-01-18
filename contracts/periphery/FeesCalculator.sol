// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../transfers/DeBridgeGate.sol";

contract FeesCalculator is
    Initializable,
    AccessControlUpgradeable
{
    /* ========== STATE VARIABLES ========== */

    // Basis points or bps equal to 1/10000
    // used to express relative values (fees)
    uint256 public constant BPS_DENOMINATOR = 10000;

    DeBridgeGate public gate; // debridge gate address

    /* ========== ERRORS ========== */

    error AdminBadRole();

    /* ========== STRUCTURES ========== */

    struct SubmissionFees {
        uint256 amountAfterFee;
        uint256 fixFee;
        uint256 transferFee;
        bool useAssetFee;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize(
        DeBridgeGate _gate
    ) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        gate = _gate;
    }

    // ============ VIEWS ============

    function getTransferFees(
        address _tokenAddress,
        uint256 _amount,
        uint256 _chainIdTo,
        address _sender,
        bool _useAssetFee,
        uint256 _executionFee
    ) external view returns (SubmissionFees memory feeInfo) {
        // override useAssetFee for native tokens
        feeInfo.useAssetFee = _tokenAddress == address(0) ? true : _useAssetFee;

        // 1. protocol fee
        (feeInfo.fixFee, feeInfo.transferFee) = _calculateProtocolFees(
            _tokenAddress,
            _amount,
            _chainIdTo,
            _sender,
            feeInfo.useAssetFee
        );

        feeInfo.amountAfterFee = _amount - feeInfo.transferFee;
        if (feeInfo.useAssetFee) {
            feeInfo.amountAfterFee -= feeInfo.fixFee;
        }

        // 2. normalization execution fee - round down amount in order not to bridge dust
        _executionFee = _normalizeTokenAmount(_tokenAddress, _executionFee);

        // 3. execution fee
        feeInfo.amountAfterFee -= _executionFee;

        // 4. normalization - round down amount in order not to bridge dust
        feeInfo.amountAfterFee = _normalizeTokenAmount(_tokenAddress, feeInfo.amountAfterFee);

        return feeInfo;
    }

    /* ========== ADMIN ========== */

    function setDeBridgeGate(DeBridgeGate _gate) external onlyAdmin {
        gate = _gate;
    }

    /* ========== INTERNAL ========== */

    function getDebridgeId(
        address _tokenAddress
    ) internal view returns (bytes32 debridgeId) {
        (uint256 nativeChainId, bytes memory nativeAddress) = gate.getNativeInfo(_tokenAddress);

        bool isNativeToken = nativeChainId  == 0
            ? true // token not in mapping
            : nativeChainId == gate.getChainId(); // token native chain id the same

        if (isNativeToken) {
            //We use WETH debridgeId for transfer ETH
            debridgeId = gate.getDebridgeId(
                gate.getChainId(),
                _tokenAddress == address(0) ? address(gate.weth()) : _tokenAddress
            );
        } else {
            debridgeId = gate.getbDebridgeId(
                nativeChainId,
                nativeAddress
            );
        }
        return debridgeId;
    }

    function _calculateProtocolFees(
        address _tokenAddress,
        uint256 _amount,
        uint256 _chainIdTo,
        address _sender,
        bool _useAssetFee
    ) internal view returns (
        uint256 fixFee,
        uint256 transferFee
    ) {
        (
            uint256 chainFixedNativeFee,
            bool chainIsSupported,
            uint16 chainTransferFeeBps
        ) = gate.getChainToConfig(_chainIdTo);
        if (!chainIsSupported) revert DeBridgeGate.WrongChainTo();

        (uint16 discountFixBps, uint16 discountTransferBps) = gate.feeDiscount(_sender);

        // calculate fixed fee
        // use native fixed fees calculation for native tokens despite overwriting _useAssetFee
        if (_useAssetFee) {
            if (_tokenAddress == address(0)) {
                fixFee = chainFixedNativeFee == 0 ? gate.globalFixedNativeFee() : chainFixedNativeFee;
            }
            else {
                // calculate fixed asset fee for ERC20 tokens
                bytes32 debridgeId = getDebridgeId(_tokenAddress);
                fixFee = gate.getDebridgeChainAssetFixedFee(debridgeId, _chainIdTo);
                if (fixFee == 0) revert DeBridgeGate.NotSupportedFixedFee();
            }
        } else {
            // calculate native asset fee
            // use globalFixedNativeFee if value for chain is not setted
            fixFee = chainFixedNativeFee == 0 ? gate.globalFixedNativeFee() : chainFixedNativeFee;
        }
        // Apply discount for a fixed fee
        fixFee -= fixFee * discountFixBps / BPS_DENOMINATOR;
        uint256 assetsFixedFee = _useAssetFee ? fixFee: 0;

        // Calculate transfer fee
        if (chainTransferFeeBps == 0) {
            // use globalTransferFeeBps if value for chain is not setted
            chainTransferFeeBps = gate.globalTransferFeeBps();
        }
        transferFee = (_amount - assetsFixedFee) * chainTransferFeeBps / BPS_DENOMINATOR;
        // apply discount for a transfer fee
        transferFee -= transferFee * discountTransferBps / BPS_DENOMINATOR;

        return (fixFee, transferFee);
    }

    /*
    * @dev round down token amount
    * @param _token address of token, zero for native tokens
    * @param __amount amount for rounding
    */
    function _normalizeTokenAmount(
        address _token,
        uint256 _amount
    ) internal view returns (uint256) {
        uint256 decimals = _token == address(0)
            ? 18
            : IERC20MetadataUpgradeable(_token).decimals();
        uint256 maxDecimals = 8;
        if (decimals > maxDecimals) {
            uint256 multiplier = 10 ** (decimals - maxDecimals);
            _amount = _amount / multiplier * multiplier;
        }
        return _amount;
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 102; // 1.0.2
    }
}
