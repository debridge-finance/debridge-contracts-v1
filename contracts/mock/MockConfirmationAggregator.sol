pragma solidity =0.8.7;

import "../transfers/ConfirmationAggregator.sol";

contract MockConfirmationAggregator is ConfirmationAggregator {

     constructor(
        uint8 _minConfirmations,
        uint8 _confirmationThreshold,
        uint8 _excessConfirmations
    )ConfirmationAggregator(){
        initialize(_minConfirmations, _confirmationThreshold, _excessConfirmations);//, _wrappedAssetAdmin, _debridgeAddress);
    }
    

    function mock_set_oracle_exist(address oracle, bool exist) public {
        getOracleInfo[oracle].exist = exist;
    }

    function mock_set_confirmationThreashold(uint8 amount) public {
        confirmationThreshold = amount;
    }


    function mock_set_debridgeInfoHasVerrified(bytes32 deployId, address setter, bool value) public {
        getDeployInfo[deployId].hasVerified[setter] = value;
    }

    function mock_setConfirmedDeployInfo(bytes32 a, bytes32 b) public {
        confirmedDeployInfo[a]=b;
    }

    function mock_set_oracle_required(address oracle, bool value) public {
        getOracleInfo[oracle].required = value;
    }

    function mock_set_oracle_isValid(address oracle, bool value) public {
        getOracleInfo[oracle].isValid = value;
    }

    function call_internal_submit(bytes32 submissionId) public {
        _submit(submissionId);
    }

    function mock_set_minConfirmations(uint8 amount) public {
        minConfirmations = amount;
    }

    function mock_set_requiredOraclesCount(uint8 amount) public {
        requiredOraclesCount = amount;
    }

    function mock_set_submmisionInfo(bytes32 submissionId, address sender, uint8 confirmations, bool hasVerified, bool isConfirmed, uint8 requiredConfirmations) public {
       SubmissionInfo storage info = getSubmissionInfo[submissionId];
       info.requiredConfirmations = requiredConfirmations;
       info.hasVerified[sender] = hasVerified;
       info.isConfirmed = isConfirmed;
       info.confirmations = confirmations;
    }

    function mock_set_blockConfirmationsInfoIsConfirmed(bytes32 submissionId, uint256 blockNumber, bool value) public {
       // BlockConfirmationsInfo storage _block = getConfirmationsPerBlock[blockNumber];
      //  _block.isConfirmed[submissionId] = value;
    }

    function mock_set_currentBlock(uint40 _curBlock) public {
        currentBlock = _curBlock;
    }

    function mock_set_submissionsInBlock(uint40 value) public {
        submissionsInBlock = value;
    }

    function mock_call_internal_initialize_base(uint8 _minConfirmations, uint8 _excessConfirmations) public {
        initializeBase(_minConfirmations, _excessConfirmations);
    }

}