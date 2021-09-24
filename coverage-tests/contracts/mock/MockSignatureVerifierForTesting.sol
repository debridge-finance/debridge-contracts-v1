pragma solidity =0.8.7;

import "../transfers/SignatureVerifier.sol";

contract MockSignatureVerifierForTesting is SignatureVerifier {

   constructor (
        uint256 _minConfirmations,
        uint256 _confirmationThreshold,
        uint256 _excessConfirmations,
        address _wrappedAssetAdmin,
        address _debridgeAddress
    ) SignatureVerifier (
          _minConfirmations,
         _confirmationThreshold,
         _excessConfirmations,
         _wrappedAssetAdmin,
         _debridgeAddress)
    {}

    function mock_set_deployInfo(bytes32 debridgeId, bytes32 deployId) public {
        confirmedDeployInfo[debridgeId] = deployId;
    }

    function mock_set_wrappedAssetAddress(bytes32 debridgeId, address wraAstAddrs) public {
        getWrappedAssetAddress[debridgeId] = wraAstAddrs;
    }

    function mock_set_debridgeDeployInfoConfirmations(bytes32 deployId, uint256 confirmations) public {
        getDeployInfo[deployId].confirmations = confirmations;
    }

    function mock_set_submissionInfo(bytes32 submissionId, address oracle, uint256 _block, uint256 _confirmations, bool _hasVerified) public {
        SubmissionInfo storage info = getSubmissionInfo[submissionId];
        info.block = _block;
        info.confirmations = _confirmations;
        info.hasVerified[oracle] = _hasVerified;
    }

    ////////

    function mock_set_oracle_valid(address oracle, bool valid) public {
        getOracleInfo[oracle].isValid=valid;
    }

    function mock_set_oracle_hasVerified(bytes32 deployId, address oracle, bool valid) public {
        getDeployInfo[deployId].hasVerified[oracle] = valid;
    }

    function mock_set_oracle_requires(address oracle, bool value) public {
        getOracleInfo[oracle].required = value;
    }

    function mock_set_min_confirmations(uint256 confirmations) public {
        minConfirmations = confirmations;
    }

    function mock_set_required_oracles_count(uint256 count) public {
        requiredOraclesCount = count;
    }

    function mock_set_confirmation_threshold(uint256 amount) public {
        confirmationThreshold = amount;
    }

    function mock_set_block_confirmations(bytes32 submissionId, uint256 _block, bool value) public {
        BlockConfirmationsInfo storage _confirmations = getConfirmationsPerBlock[_block];
        _confirmations.isConfirmed[submissionId] = value;
    }




}