pragma solidity =0.8.7;

import "../transfers/ConfirmationAggregator.sol";
import "hardhat/console.sol";

contract MockConfirmationAggregator is ConfirmationAggregator {

     constructor(
        uint256 _minConfirmations,
        uint256 _confirmationThreshold,
        uint256 _excessConfirmations,
        address _wrappedAssetAdmin,
        address _debridgeAddress
    )ConfirmationAggregator(
        _minConfirmations,
         _confirmationThreshold,
         _excessConfirmations,
         _wrappedAssetAdmin,
         _debridgeAddress
    ){}
    

    function mock_set_oracle_exist(address oracle, bool exist) public {
        getOracleInfo[oracle].exist = exist;
    }

    function mock_set_confirmationThreashold(uint256 amount) public {
        confirmationThreshold = amount;
    }

    function mock_setWrappedAssetAddress(bytes32  id, address addressToSet) public {
        getWrappedAssetAddress[id]=addressToSet;
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

    function call_internal_submit(bytes32 submissionId) public {
        _submit(submissionId);
    }

    function mock_set_minConfirmations(uint256 amount) public {
        minConfirmations = amount;
    }

    function mock_set_requiredOraclesCount(uint256 amount) public {
        requiredOraclesCount = amount;
    }

    function mock_set_submmisionInfo(bytes32 submissionId, address sender, uint256 _block, uint256 confirmations, bool hasVerified, bool isConfirmed, uint256 requiredConfirmations) public {
        SubmissionInfo storage info = getSubmissionInfo[submissionId];
        info.block = _block;
        info.confirmations = confirmations;
        info.hasVerified[sender] = hasVerified;
        info.isConfirmed = isConfirmed;
        info.requiredConfirmations = requiredConfirmations;
    }

    function mock_set_blockConfirmationsInfoIsConfirmed(bytes32 submissionId, uint256 blockNumber, bool value) public {
        BlockConfirmationsInfo storage _block = getConfirmationsPerBlock[blockNumber];
        _block.isConfirmed[submissionId] = value;
    }

}