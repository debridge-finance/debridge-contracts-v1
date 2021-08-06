// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./AggregatorBase.sol";
import "../interfaces/ISignatureAggregator.sol";
import "../periphery/WrappedAsset.sol";
import "../libraries/SignatureUtil.sol";

contract SignatureAggregator is AggregatorBase, ISignatureAggregator {

    using SignatureUtil for bytes;
    using SignatureUtil for bytes32;

    /* ========== STATE VARIABLES ========== */

    mapping(bytes32 => DebridgeDeployInfo) public getDeployInfo; // mint id => debridge info
    mapping(bytes32 => SubmissionInfo) public getSubmissionInfo; // mint id => submission info

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    function initialize(uint8 _minConfirmations)
        public initializer
    {
        AggregatorBase.initializeBase(_minConfirmations);
    }

    /* ========== ORACLES  ========== */

    /// @dev Confirms the transfer request.
    function confirmNewAsset(
        address _tokenAddress,
        uint256 _chainId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        bytes memory _signature
    ) external onlyOracle {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 deployId = getDeployId(debridgeId, _name, _symbol, _decimals);
        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        require(!debridgeInfo.approved, "deployAsset: submitted already");
        require(!debridgeInfo.hasVerified[msg.sender], "deployAsset: submitted already");
        (bytes32 r, bytes32 s, uint8 v) = _signature.splitSignature();
        bytes32 unsignedMsg = deployId.getUnsignedMsg();
        address oracle = ecrecover(unsignedMsg, v, r, s);
        require(msg.sender == oracle, "onlyOracle: bad role");
        debridgeInfo.confirmations += 1;
        debridgeInfo.nativeAddress = _tokenAddress;
        debridgeInfo.chainId = _chainId;
        debridgeInfo.name = _name;
        debridgeInfo.symbol = _symbol;
        debridgeInfo.decimals = _decimals;
        debridgeInfo.signatures.push(_signature);
        debridgeInfo.hasVerified[msg.sender] = true;
        if (debridgeInfo.confirmations >= minConfirmations) {
            debridgeInfo.approved = true;
            emit DeployApproved(deployId);
        }
        emit DeployConfirmed(deployId, msg.sender, _signature);
    }

    /// @dev Confirms few transfer requests.
    /// @param _submissionIds Submission identifiers.
    /// @param _signatures Oracles signature.
    function submitMany(bytes32[] memory _submissionIds, bytes[] memory _signatures) external override onlyOracle {
        require(_submissionIds.length == _signatures.length, "signatures and submission count mismatch");
        for (uint256 i; i < _submissionIds.length; i++) {
            _submit(_submissionIds[i], _signatures[i]);
        }
    }

    /// @dev Confirms the transfer request.
    /// @param _submissionId Submission identifier.
    /// @param _signature Oracle's signature.
    function submit(bytes32 _submissionId, bytes memory _signature) external override onlyOracle {
        _submit(_submissionId, _signature);
    }

    /// @dev Confirms single transfer request.
    /// @param _submissionId Submission identifier.
    /// @param _signature Oracle's signature.
    function _submit(bytes32 _submissionId, bytes memory _signature) internal {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[
            _submissionId
        ];
        require(!submissionInfo.hasVerified[msg.sender], "submit: submitted already");
        (bytes32 r, bytes32 s, uint8 v) = _signature.splitSignature();
        bytes32 unsignedMsg = _submissionId.getUnsignedMsg();
        address oracle = ecrecover(unsignedMsg, v, r, s);
        require(msg.sender == oracle, "onlyOracle: bad role");
        submissionInfo.confirmations += 1;
        submissionInfo.signatures.push(_signature);
        submissionInfo.hasVerified[msg.sender] = true;
        emit Confirmed(_submissionId, msg.sender, _signature);
    }

    /* ========== VIEW ========== */

    /// @dev Returns whether transfer request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return _confirmations number of confirmation.
    /// @return _confirmed Whether transfer request is confirmed.
    function getSubmissionConfirmations(bytes32 _submissionId)
        external view override returns (uint8 _confirmations, bool _confirmed)
    {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[
            _submissionId
        ];
        _confirmations = submissionInfo.confirmations;
        return (_confirmations, _confirmations >= minConfirmations);
    }

    /// @dev Returns whether transfer request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return Oracles signatures.
    function getSubmissionSignatures(bytes32 _submissionId)
        external view returns (bytes[] memory)
    {
        return getSubmissionInfo[_submissionId].signatures;
    }
}
