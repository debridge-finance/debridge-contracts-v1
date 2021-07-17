// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Aggregator.sol";
import "../interfaces/IFullAggregator.sol";
import "../periphery/WrappedAsset.sol";

contract FullAggregator is Aggregator, IFullAggregator {
    struct SubmissionInfo {
        uint256 block; // confirmation block
        uint256 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    struct DebridgeDeployInfo {
        address tokenAddress;
        uint256 chainId;
        string name;
        string symbol;
        uint8 decimals;
        uint256 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    uint256 public confirmationThreshold; // bonus reward for one submission
    uint256 public excessConfirmations; // minimal required confirmations in case of too many confirmations
    address public wrappedAssetAdmin;
    address public debridgeAddress;

    mapping(bytes32 => bytes32) public confirmedDeployInfo; // debridge Id => deploy Id
    mapping(bytes32 => DebridgeDeployInfo) public getDeployInfo; // mint id => debridge info
    mapping(bytes32 => address) public override getWrappedAssetAddress; // debridge id => wrapped asset address
    mapping(bytes32 => SubmissionInfo) public getSubmissionInfo; // mint id => submission info
    mapping(uint256 => BlockConfirmationsInfo) public getConfirmationsPerBlock; // block => confirmations

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed by one oracle
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed by min required aount of oracles

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    /// @param _confirmationThreshold Confirmations per block before extra check enabled.
    /// @param _excessConfirmations Confirmations count in case of excess activity.
    constructor(
        uint256 _minConfirmations,
        uint256 _confirmationThreshold,
        uint256 _excessConfirmations,
        address _wrappedAssetAdmin,
        address _debridgeAddress
    )
        Aggregator(
            _minConfirmations
        )
    {
        confirmationThreshold = _confirmationThreshold;
        excessConfirmations = _excessConfirmations;
        wrappedAssetAdmin = _wrappedAssetAdmin;
        debridgeAddress = _debridgeAddress;
    }

    /// @dev Confirms few transfer requests.
    /// @param _submissionIds Submission identifiers.
    function submitMany(bytes32[] memory _submissionIds)
        external
        override
        onlyOracle
    {
        for (uint256 i; i < _submissionIds.length; i++) {
            _submit(_submissionIds[i]);
        }
    }

    /// @dev Confirms the transfer request.
    function confirmNewAsset(
        address _tokenAddress,
        uint256 _chainId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOracle {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        bytes32 deployId = getDeployId(debridgeId, _name, _symbol, _decimals);
        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        require(
            getWrappedAssetAddress[debridgeId] == address(0),
            "deployAsset: deployed already"
        );
        require(
            !debridgeInfo.hasVerified[msg.sender],
            "deployAsset: submitted already"
        );
        debridgeInfo.name = _name;
        debridgeInfo.symbol = _symbol;
        debridgeInfo.tokenAddress = _tokenAddress;
        debridgeInfo.chainId = _chainId;
        debridgeInfo.decimals = _decimals;
        debridgeInfo.confirmations += 1;
        debridgeInfo.hasVerified[msg.sender] = true;
        //TODO: will be a problem if we will reduce minConfirmations and old deployInfo will not be in confirmedDeployInfo
        if( debridgeInfo.confirmations >= minConfirmations){
            confirmedDeployInfo[debridgeId] = deployId;
        }

        emit DeployConfirmed(deployId, msg.sender);
    }

    /// @dev Confirms the transfer request.
    function deployAsset(bytes32 _debridgeId) 
            external override
            returns (address wrappedAssetAddress, uint256 nativeChainId){
        require(debridgeAddress == msg.sender, "deployAsset: bad role");

        bytes32 deployId = confirmedDeployInfo[_debridgeId];
        //TODO: check 0x
        require(
            deployId != "0x",
            "deployAsset: not found deployId"
        );

        DebridgeDeployInfo storage debridgeInfo = getDeployInfo[deployId];
        require(
            getWrappedAssetAddress[_debridgeId] == address(0),
            "deployAsset: deployed already"
        );
        //TODO: can be removed, we already checked in confirmedDeployInfo
        require(
            debridgeInfo.confirmations >= minConfirmations,
            "deployAsset: not confirmed"
        );
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
        return (address(wrappedAsset), debridgeInfo.chainId);
    }

    /// @dev Confirms the transfer request.
    /// @param _submissionId Submission identifier.
    function submit(bytes32 _submissionId) external override onlyOracle {
        _submit(_submissionId);
    }

    /// @dev Confirms single transfer request.
    /// @param _submissionId Submission identifier.
    function _submit(bytes32 _submissionId) internal {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[
            _submissionId
        ];
        require(
            !submissionInfo.hasVerified[msg.sender],
            "submit: submitted already"
        );
        submissionInfo.confirmations += 1;
        submissionInfo.hasVerified[msg.sender] = true;
        if (submissionInfo.confirmations >= minConfirmations) {

                BlockConfirmationsInfo storage _blockConfirmationsInfo
             = getConfirmationsPerBlock[block.number];
            if (!_blockConfirmationsInfo.isConfirmed[_submissionId]) {
                _blockConfirmationsInfo.count += 1;
                _blockConfirmationsInfo.isConfirmed[_submissionId] = true;
                if (_blockConfirmationsInfo.count >= confirmationThreshold) {
                    _blockConfirmationsInfo.requireExtraCheck = true;
                }
            }
            submissionInfo.block = block.number;
            emit SubmissionApproved(_submissionId);
        }
        emit Confirmed(_submissionId, msg.sender);
    }

    /// @dev Sets minimal required confirmations.
    /// @param _excessConfirmations Confirmation info.
    function setExcessConfirmations(uint256 _excessConfirmations)
        public
        onlyAdmin
    {
        excessConfirmations = _excessConfirmations;
    }

    /// @dev Sets minimal required confirmations.
    /// @param _confirmationThreshold Confirmation info.
    function setThreshold(uint256 _confirmationThreshold) public onlyAdmin {
        confirmationThreshold = _confirmationThreshold;
    }

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

    /// @dev Returns whether transfer request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return _confirmations number of confirmation.
    /// @return _blockConfirmationPassed Whether transfer request is confirmed.
    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        override
        returns (uint256 _confirmations, bool _blockConfirmationPassed)
    {
        SubmissionInfo storage submissionInfo = getSubmissionInfo[
            _submissionId
        ];


            BlockConfirmationsInfo storage _blockConfirmationsInfo
         = getConfirmationsPerBlock[submissionInfo.block];
        _confirmations = submissionInfo.confirmations;
        return (
            _confirmations,
            _confirmations >=
                (
                    (_blockConfirmationsInfo.requireExtraCheck)
                        ? excessConfirmations
                        : minConfirmations
                )
        );
    }
}
