// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./AggregatorBase.sol";
import "../interfaces/IConfirmationAggregator.sol";
import "../periphery/WrappedAsset.sol";

contract ConfirmationAggregator is AggregatorBase, IConfirmationAggregator {
    /* ========== STATE VARIABLES ========== */

    uint8 public confirmationThreshold; // required confirmations per block after extra check enabled
    address public wrappedAssetAdmin; // admin for any deployed wrapped asset
    address public debridgeAddress; // Debridge gate address

    mapping(bytes32 => bytes32) public confirmedDeployInfo; // debridge Id => deploy Id
    mapping(bytes32 => DebridgeDeployInfo) public getDeployInfo; // mint id => debridge info
    mapping(bytes32 => address) public override getWrappedAssetAddress; // debridge id => wrapped asset address
    mapping(bytes32 => SubmissionInfo) public getSubmissionInfo; // mint id => submission info

    uint40 public submissionsInBlock; //submissions count in current block
    uint40 public currentBlock; //Current block

    /* ========== MODIFIERS ========== */

    modifier onlyDeBridgeGate() {
        if (msg.sender != debridgeAddress) revert DeBridgeGateBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    /// @param _confirmationThreshold Confirmations per block after extra check enabled.
    /// @param _excessConfirmations Confirmations count in case of excess activity.
    function initialize(
        uint8 _minConfirmations,
        uint8 _confirmationThreshold,
        uint8 _excessConfirmations,
        address _wrappedAssetAdmin,
        address _debridgeAddress
    ) public initializer {
        AggregatorBase.initializeBase(_minConfirmations, _excessConfirmations);
        confirmationThreshold = _confirmationThreshold;
        wrappedAssetAdmin = _wrappedAssetAdmin;
        debridgeAddress = _debridgeAddress;
    }

    /* ========== ORACLES  ========== */

    /// @dev Confirms few transfer requests.
    /// @param _submissionIds Submission identifiers.
    function submitMany(bytes32[] memory _submissionIds) external override onlyOracle {
        for (uint256 i; i < _submissionIds.length; i++) {
            _submit(_submissionIds[i]);
        }
    }

    /// @dev Confirms the transfer request.
    function confirmNewAsset(
        bytes memory _tokenAddress,
        uint256 _chainId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOracle {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        if (getWrappedAssetAddress[debridgeId] != address(0)) revert DeployedAlready();

        bytes32 deployId = getDeployId(debridgeId, _name, _symbol, _decimals);
        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        if (debridgeInfo.hasVerified[msg.sender]) revert SubmittedAlready();

        debridgeInfo.name = _name;
        debridgeInfo.symbol = _symbol;
        debridgeInfo.nativeAddress = _tokenAddress;
        debridgeInfo.chainId = _chainId;
        debridgeInfo.decimals = _decimals;
        debridgeInfo.confirmations += 1;
        if (getOracleInfo[msg.sender].required) {
            debridgeInfo.requiredConfirmations += 1;
        }
        debridgeInfo.hasVerified[msg.sender] = true;

        if (debridgeInfo.confirmations >= minConfirmations) {
            confirmedDeployInfo[debridgeId] = deployId;
        }

        emit DeployConfirmed(deployId, msg.sender);
    }

    /// @dev Confirms the transfer request.
    /// @param _submissionId Submission identifier.
    function submit(bytes32 _submissionId) external override onlyOracle {
        _submit(_submissionId);
    }

    /// @dev Confirms single transfer request.
    /// @param _submissionId Submission identifier.
    function _submit(bytes32 _submissionId) internal {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[_submissionId];
        if (submissionInfo.hasVerified[msg.sender]) revert SubmittedAlready();

        submissionInfo.confirmations += 1;
        if (getOracleInfo[msg.sender].required) {
            submissionInfo.requiredConfirmations += 1;
        }
        submissionInfo.hasVerified[msg.sender] = true;
        if (submissionInfo.confirmations >= minConfirmations) {
            if (currentBlock != uint40(block.number)) {
                currentBlock = uint40(block.number);
                submissionsInBlock = 0;
            }
            bool requireExtraCheck = submissionsInBlock >= confirmationThreshold;

            if (
                submissionInfo.requiredConfirmations >= requiredOraclesCount &&
                !submissionInfo.isConfirmed &&
                (!requireExtraCheck ||
                    (requireExtraCheck && submissionInfo.confirmations >= excessConfirmations))
            ) {
                submissionsInBlock += 1;
                submissionInfo.isConfirmed = true;
                emit SubmissionApproved(_submissionId);
            }
        }
        emit Confirmed(_submissionId, msg.sender);
    }

    /* ========== deployAsset ========== */

    /// @dev deploy wrapped token, called by DeBridgeGate.
    function deployAsset(bytes32 _debridgeId)
        external
        override
        onlyDeBridgeGate
        returns (
            address wrappedAssetAddress,
            bytes memory nativeAddress,
            uint256 nativeChainId
        )
    {
        if (getWrappedAssetAddress[_debridgeId] != address(0)) revert DeployedAlready();
        bytes32 deployId = confirmedDeployInfo[_debridgeId];
        if (deployId == "") revert DeployNotFound();

        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        address[] memory minters = new address[](1);
        minters[0] = debridgeAddress;
        WrappedAsset wrappedAsset = new WrappedAsset(
            debridgeInfo.name,
            debridgeInfo.symbol,
            debridgeInfo.decimals,
            wrappedAssetAdmin,
            minters
        );
        getWrappedAssetAddress[_debridgeId] = address(wrappedAsset);
        emit DeployApproved(deployId);
        return (address(wrappedAsset), debridgeInfo.nativeAddress, debridgeInfo.chainId);
    }

    /* ========== ADMIN ========== */

    /// @dev Sets minimal required confirmations.
    /// @param _confirmationThreshold Confirmation info.
    function setThreshold(uint8 _confirmationThreshold) external onlyAdmin {
        if (_confirmationThreshold == 0) revert WrongArgument();
        confirmationThreshold = _confirmationThreshold;
    }

    /// @dev Set admin for any deployed wrapped asset.
    /// @param _wrappedAssetAdmin Admin address.
    function setWrappedAssetAdmin(address _wrappedAssetAdmin) external onlyAdmin {
        if (_wrappedAssetAdmin == address(0)) revert WrongArgument();
        wrappedAssetAdmin = _wrappedAssetAdmin;
    }

    /// @dev Sets core debridge conrtact address.
    /// @param _debridgeAddress Debridge address.
    function setDebridgeAddress(address _debridgeAddress) external onlyAdmin {
        debridgeAddress = _debridgeAddress;
    }

    /* ========== VIEW ========== */

    /// @dev Returns whether transfer request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return confirmations number of confirmation.
    /// @return isConfirmed is confirmed sumbission.
    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        override
        returns (uint8 confirmations, bool isConfirmed)
    {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[_submissionId];

        return (submissionInfo.confirmations, submissionInfo.isConfirmed);
    }
}
