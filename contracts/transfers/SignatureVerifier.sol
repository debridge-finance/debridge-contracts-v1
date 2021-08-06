// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./AggregatorBase.sol";
import "../interfaces/ISignatureVerifier.sol";
import "../periphery/WrappedAsset.sol";
import "../libraries/SignatureUtil.sol";

contract SignatureVerifier is AggregatorBase, ISignatureVerifier {

    using SignatureUtil for bytes;
    using SignatureUtil for bytes32;

    /* ========== STATE VARIABLES ========== */

    uint8 public confirmationThreshold; // required confirmations per block before extra check enabled
    uint8 public excessConfirmations; // minimal required confirmations in case of too many confirmations
    address public wrappedAssetAdmin; // admin for any deployed wrapped asset
    address public debridgeAddress; // Debridge gate address

    mapping(uint256 => BlockConfirmationsInfo) public getConfirmationsPerBlock; // block => confirmations
    mapping(bytes32 => bytes32) public confirmedDeployInfo; // debridge Id => deploy Id
    mapping(bytes32 => DebridgeDeployInfo) public getDeployInfo; // mint id => debridge info
    mapping(bytes32 => address) public override getWrappedAssetAddress; // debridge id => wrapped asset address
    mapping(bytes32 => SubmissionInfo) public getSubmissionInfo; // submission id => submission info


    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    /// @param _confirmationThreshold Confirmations per block before extra check enabled.
    /// @param _excessConfirmations Confirmations count in case of excess activity.
    function initialize(
        uint8 _minConfirmations,
        uint8 _confirmationThreshold,
        uint8 _excessConfirmations,
        address _wrappedAssetAdmin,
        address _debridgeAddress
    ) public initializer {
        AggregatorBase.initializeBase(_minConfirmations);
        confirmationThreshold = _confirmationThreshold;
        excessConfirmations = _excessConfirmations;
        wrappedAssetAdmin = _wrappedAssetAdmin;
        debridgeAddress = _debridgeAddress;
    }

    /// @dev Confirms the transfer request.
    function confirmNewAsset(
        address _tokenAddress,
        uint256 _chainId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        bytes[] memory _signatures
    ) external {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 deployId = getDeployId(debridgeId, _name, _symbol, _decimals);
        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        require(
            getWrappedAssetAddress[debridgeId] == address(0),
            "deployAsset: deployed already"
        );
        debridgeInfo.name = _name;
        debridgeInfo.symbol = _symbol;
        debridgeInfo.nativeAddress = _tokenAddress;
        debridgeInfo.chainId = _chainId;
        debridgeInfo.decimals = _decimals;
        //Count of required(DSRM) oracles confirmation
        uint256 currentRequiredOraclesCount;

        for (uint256 i = 0; i < _signatures.length; i++) {
            (bytes32 r, bytes32 s, uint8 v) = _signatures[i].splitSignature();
            bytes32 unsignedMsg = deployId.getUnsignedMsg();
            address oracle = ecrecover(unsignedMsg, v, r, s);
            if(getOracleInfo[oracle].isValid) {
                require(
                    !debridgeInfo.hasVerified[oracle],
                    "deployAsset: submitted already"
                );
                debridgeInfo.hasVerified[oracle] = true;
                emit DeployConfirmed(deployId, oracle);
                debridgeInfo.confirmations += 1;
                if(getOracleInfo[oracle].required) {
                    currentRequiredOraclesCount += 1;
                }
            }
        }

        require(debridgeInfo.confirmations >= minConfirmations, "not confirmed");
        require(currentRequiredOraclesCount == requiredOraclesCount, "Not confirmed by required oracles");

        confirmedDeployInfo[debridgeId] = deployId;

        //TODO: add deployAsset
    }

    /// @dev Confirms the mint request.
    /// @param _submissionId Submission identifier.
    /// @param _signatures Array of signatures by oracles.
    function submit(bytes32 _submissionId, bytes[] memory _signatures)
        external override
        returns (uint8 _confirmations, bool _blockConfirmationPassed)
    {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[_submissionId];
        //Count of required(DSRM) oracles confirmation
        uint256 currentRequiredOraclesCount;

        for (uint256 i = 0; i < _signatures.length; i++) {
            (bytes32 r, bytes32 s, uint8 v) = _signatures[i].splitSignature();
            bytes32 unsignedMsg = _submissionId.getUnsignedMsg();
            address oracle = ecrecover(unsignedMsg, v, r, s);
            if(getOracleInfo[oracle].isValid) {
                require(!submissionInfo.hasVerified[oracle], "submit: submitted already");
                submissionInfo.confirmations += 1;
                submissionInfo.hasVerified[oracle] = true;
                emit Confirmed(_submissionId, oracle);
                if (submissionInfo.confirmations >= minConfirmations) {
                    BlockConfirmationsInfo storage _blockConfirmationsInfo = getConfirmationsPerBlock[block.number];
                    if (!_blockConfirmationsInfo.isConfirmed[_submissionId]) {
                        _blockConfirmationsInfo.count += 1;
                        _blockConfirmationsInfo.isConfirmed[_submissionId] = true;
                        if (
                            _blockConfirmationsInfo.count >= confirmationThreshold
                        ) {
                            _blockConfirmationsInfo.requireExtraCheck = true;
                        }
                    }
                    submissionInfo.block = block.number;
                    emit SubmissionApproved(_submissionId);
                }
                if(getOracleInfo[oracle].required) {
                    currentRequiredOraclesCount += 1;
                }
            }
        }

        require(currentRequiredOraclesCount == requiredOraclesCount, "Not confirmed by required oracles" );

        return (
            submissionInfo.confirmations,
            submissionInfo.confirmations >=
                (
                    (getConfirmationsPerBlock[block.number].requireExtraCheck)
                        ? excessConfirmations
                        : minConfirmations
                )
        );
    }

    /* ========== deployAsset ========== */

    /// @dev deploy wrapped token, called by DeBridgeGate.
    function deployAsset(bytes32 _debridgeId)
            external override
            returns (address wrappedAssetAddress, address nativeAddress, uint256 nativeChainId){
        require(debridgeAddress == msg.sender, "deployAsset: bad role");
        bytes32 deployId = confirmedDeployInfo[_debridgeId];

        require(deployId != "", "deployAsset: not found deployId");

        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        require(getWrappedAssetAddress[_debridgeId] == address(0), "deployAsset: deployed already");
        //TODO: can be removed, we already checked in confirmedDeployInfo
        require(debridgeInfo.confirmations >= minConfirmations, "deployAsset: not confirmed");
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

    /// @dev Set admin for any deployed wrapped asset.
    /// @param _wrappedAssetAdmin Admin address.
    function setWrappedAssetAdmin(address _wrappedAssetAdmin) public onlyAdmin {
        wrappedAssetAdmin = _wrappedAssetAdmin;
    }

    /// @dev Sets core debridge conrtact address.
    /// @param _debridgeAddress Debridge address.
    function setDebridgeAddress(address _debridgeAddress) public onlyAdmin {
        debridgeAddress = _debridgeAddress;
    }
}
