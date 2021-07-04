// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IFullAnyDebridge.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IFullAggregator.sol";
import "../periphery/WrappedAsset.sol";
import "./AnyDebridge.sol";

contract FullAnyDebridge is AnyDebridge, IFullAnyDebridge {
    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMint(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 submissionId = getAutoSubmisionId(
            debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        (, bool confirmed) = IFullAggregator(aggregator)
        .getSubmissionConfirmations(submissionId);
        require(confirmed, "autoMint: not confirmed");
        _mint(
            submissionId,
            _tokenAddress,
            _chainId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMintWithOldAggregator(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 submissionId = getAutoSubmisionId(
            debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        AggregatorInfo memory aggregatorInfo = getOldAggregator[
            _aggregatorVersion
        ];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        (, bool confirmed) = IFullAggregator(aggregatorInfo.aggregator)
        .getSubmissionConfirmations(submissionId);
        require(confirmed, "mintWithOldAggregator: not confirmed");
        _mint(
            submissionId,
            _tokenAddress,
            _chainId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    function mint(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external override whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 submissionId = getSubmisionId(
            debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        (, bool confirmed) = IFullAggregator(aggregator)
        .getSubmissionConfirmations(submissionId);
        require(confirmed, "mint: not confirmed");
        _mint(
            submissionId,
            _tokenAddress,
            _chainId,
            _receiver,
            _amount,
            address(0),
            0,
            "0x"
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        uint8 _aggregatorVersion
    ) external override {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 submissionId = getSubmisionId(
            debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        AggregatorInfo memory aggregatorInfo = getOldAggregator[
            _aggregatorVersion
        ];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        (, bool confirmed) = IFullAggregator(aggregatorInfo.aggregator)
        .getSubmissionConfirmations(submissionId);
        require(confirmed, "mintWithOldAggregator: not confirmed");
        _mint(
            submissionId,
            _tokenAddress,
            _chainId,
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
        bytes32 submissionId = getAutoSubmisionId(
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
        (, bool confirmed) = IFullAggregator(aggregator)
        .getSubmissionConfirmations(submissionId);
        require(confirmed, "autoClaim: not confirmed");
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
        bytes32 submissionId = getAutoSubmisionId(
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
        AggregatorInfo memory aggregatorInfo = getOldAggregator[
            _aggregatorVersion
        ];
        (, bool confirmed) = IFullAggregator(aggregatorInfo.aggregator)
        .getSubmissionConfirmations(submissionId);
        require(confirmed, "autoClaimWithOldAggregator: not confirmed");
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
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        (, bool confirmed) = IFullAggregator(aggregator)
        .getSubmissionConfirmations(submissionId);
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
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        AggregatorInfo memory aggregatorInfo = getOldAggregator[
            _aggregatorVersion
        ];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        (, bool confirmed) = IFullAggregator(aggregatorInfo.aggregator)
        .getSubmissionConfirmations(submissionId);
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
}
