// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/ILightVerifier.sol";
import "../interfaces/ILightAnyDebridge.sol";
import "./AnyDebridge.sol";

contract LightAnyDebridge is AnyDebridge, ILightAnyDebridge {
    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
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
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external {
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
        {
            (, bool confirmed) = ILightVerifier(aggregator).submit(
                submissionId,
                _signatures
            );
            require(confirmed, "autoMint: not confirmed");
        }
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
    /// @param _signatures Array of oracles signatures.
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
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external {
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
        require(
            getOldAggregator[_aggregatorVersion].isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        {
            (, bool confirmed) = ILightVerifier(
                getOldAggregator[_aggregatorVersion].aggregator
            ).submit(submissionId, _signatures);
            require(confirmed, "autoMintWithOldAggregator: not confirmed");
        }
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
    /// @param _signatures Array of oracles signatures.
    function mint(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures
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
        {
            (, bool confirmed) = ILightVerifier(aggregator).submit(
                submissionId,
                _signatures
            );
            require(confirmed, "mint: not confirmed");
        }
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
    /// @param _signatures Array of oracles signatures.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
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
        {
            (, bool confirmed) = ILightVerifier(aggregatorInfo.aggregator)
            .submit(submissionId, _signatures);
            require(confirmed, "mintWithOldAggregator: not confirmed");
        }
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
    /// @param _signatures Array of oracles signatures.
    function claim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures
    ) external override {
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        {
            (, bool confirmed) = ILightVerifier(aggregator).submit(
                submissionId,
                _signatures
            );
            require(confirmed, "claim: not confirmed");
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

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoClaim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external {
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
        {
            (, bool confirmed) = ILightVerifier(aggregator).submit(
                submissionId,
                _signatures
            );
            require(confirmed, "autoClaim: not confirmed");
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
    /// @param _signatures Array of oracles signatures.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoClaimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external {
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
        require(
            getOldAggregator[_aggregatorVersion].isValid,
            "mintWithOldAggregator: invalid aggregator"
        );
        {
            (, bool confirmed) = ILightVerifier(
                getOldAggregator[_aggregatorVersion].aggregator
            ).submit(submissionId, _signatures);
            require(confirmed, "mintWithOldAggregator: not confirmed");
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
    /// @param _signatures Array of oracles signatures.
    /// @param _aggregatorVersion Aggregator version.
    function claimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
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
        require(
            getOldAggregator[_aggregatorVersion].isValid,
            "claimWithOldAggregator: invalid aggregator"
        );
        {
            (, bool confirmed) = ILightVerifier(
                getOldAggregator[_aggregatorVersion].aggregator
            ).submit(submissionId, _signatures);
            require(confirmed, "claimWithOldAggregator: not confirmed");
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
}
