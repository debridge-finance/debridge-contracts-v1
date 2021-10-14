pragma solidity =0.8.7;

import "../transfers/SignatureVerifier.sol";

contract MockSignatureVerifierForTesting is SignatureVerifier {

   constructor (
        uint8 _minConfirmations,
        uint8 _confirmationThreshold,
        uint8 _excessConfirmations,
        address _wrappedAssetAdmin,
        address _debridgeAddress
    ) SignatureVerifier ()
    {
        initialize(_minConfirmations, _confirmationThreshold, _excessConfirmations,_debridgeAddress);
    }



    function mock_set_oracle_valid(address oracle, bool valid) public {
        getOracleInfo[oracle].isValid=valid;
    }

    function mock_set_oracle_requires(address oracle, bool value) public {
        getOracleInfo[oracle].required = value;
    }

    function mock_set_min_confirmations(uint8 confirmations) public {
        minConfirmations = confirmations;
    }

    function mock_set_required_oracles_count(uint8 count) public {
        requiredOraclesCount = count;
    }

    function mock_set_confirmation_threshold(uint8 amount) public {
        confirmationThreshold = amount;
    }

    function mock_set_submissionsInBlock(uint40 value) public {
        submissionsInBlock = value;
    }

    function mock_set_currentBlock(uint40 value) public {
        currentBlock = value;
    }

    function mock_set_excessConfirmations(uint8 value) public {
        excessConfirmations = value;
    }

}