// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Aggregator is AccessControl {
    struct OracleInfo {
        address admin; // current oracle admin
        mapping(IERC20 => uint256) balances; // balances
    }
    struct BlockConfirmationsInfo {
        uint256 count; // current oracle admin
        bool requireExtraCheck; // current oracle admin
        mapping(bytes32 => bool) isConfirmed; // submission => was confirmed
    }
    struct PaymentInfo {
        uint256 allocatedFunds; // asset's amount payed to oracles
        uint256 availableFunds; // asset's amount available to be payed to oracles
    }

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // role allowed to submit the data
    uint256 public corePayment; // payment for one submission
    uint256 public bonusPayment; // bonus reward for one submission
    uint256 public minConfirmations; // minimal required confirmations
    IERC20 public coreToken; // LINK's token address
    IERC20 public bonusToken; // DBR's token address

    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details
    mapping(IERC20 => PaymentInfo) public getPaymentInfo; // asset address => funds details

    event DeployConfirmed(bytes32 deployId, address operator); // emitted once the submission is confirmed by one oracle
    event DeployApproved(bytes32 deployId); // emitted once the submission is confirmed by min required aount of oracles

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }
    modifier onlyOracle {
        require(hasRole(ORACLE_ROLE, msg.sender), "onlyOracle: bad role");
        _;
    }

    /* PUBLIC */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    /// @param _corePayment Oracle reward.
    /// @param _bonusPayment Oracle reward.
    /// @param _coreToken Link token to pay to oracles.
    /// @param _bonusToken DBR token to pay to oracles.
    constructor(
        uint256 _minConfirmations,
        uint256 _corePayment,
        uint256 _bonusPayment,
        IERC20 _coreToken,
        IERC20 _bonusToken
    ) {
        minConfirmations = _minConfirmations;
        coreToken = _coreToken;
        bonusToken = _bonusToken;
        corePayment = _corePayment;
        bonusPayment = _bonusPayment;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, msg.sender);
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawPayment(
        address _oracle,
        address _recipient,
        IERC20 _asset,
        uint256 _amount
    ) external {
        require(
            getOracleInfo[_oracle].admin == msg.sender,
            "withdrawPayment: only callable by admin"
        );
        uint256 available = getOracleInfo[_oracle].balances[_asset];
        require(
            available >= _amount,
            "withdrawPayment: insufficient withdrawable funds"
        );
        getOracleInfo[_oracle].balances[_asset] = available - _amount;
        getPaymentInfo[_asset].allocatedFunds -= _amount;
        assert(_asset.transfer(_recipient, _amount));
    }

    /// @dev Updates oracle's admin address.
    /// @param _oracle Oracle address.
    /// @param _newOracleAdmin New oracle address.
    function updateOracleAdmin(address _oracle, address _newOracleAdmin)
        external
    {
        require(
            getOracleInfo[_oracle].admin == msg.sender,
            "updateOracleAdmin: only callable by admin"
        );
        getOracleInfo[_oracle].admin = _newOracleAdmin;
    }

    /// @dev Updates available rewards to be distributed.
    function updateAvailableFunds(IERC20 _asset) public {
        getPaymentInfo[_asset].availableFunds =
            _asset.balanceOf(address(this)) -
            getPaymentInfo[_asset].allocatedFunds;
    }

    /// @dev Updates link balance.
    /// @param _data Call data.
    function onTokenTransfer(
        address,
        uint256,
        bytes calldata _data
    ) external {
        require(_data.length == 0, "transfer doesn't accept calldata");
        updateAvailableFunds(IERC20(msg.sender));
    }

    /* ADMIN */

    /// @dev Withdraws earned LINK's.
    /// @param _recipient Reward's recepient.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(
        IERC20 _asset,
        address _recipient,
        uint256 _amount
    ) external onlyAdmin() {
        require(
            uint256(getPaymentInfo[_asset].availableFunds) >= _amount,
            "withdrawFunds: insufficient reserve funds"
        );
        require(
            _asset.transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        updateAvailableFunds(_asset);
    }

    /// @dev Sets minimal required confirmations.
    /// @param _minConfirmations Confirmation info.
    function setMinConfirmations(uint256 _minConfirmations) public onlyAdmin {
        minConfirmations = _minConfirmations;
    }

    /// @dev Sets new oracle reward.
    /// @param _corePayment Oracle reward.
    /// @param _bonusPayment Oracle reward.
    function setPayment(uint256 _corePayment, uint256 _bonusPayment)
        external
        onlyAdmin
    {
        corePayment = _corePayment;
        bonusPayment = _bonusPayment;
    }

    /// @dev Add new oracle.
    /// @param _oracle Oracle address.
    /// @param _admin Admin address.
    function addOracle(address _oracle, address _admin) external onlyAdmin {
        grantRole(ORACLE_ROLE, _oracle);
        getOracleInfo[_oracle].admin = _admin;
    }

    /// @dev Remove oracle.
    /// @param _oracle Oracle address.
    function removeOracle(address _oracle) external onlyAdmin {
        revokeRole(ORACLE_ROLE, _oracle);
    }

    /* INTERNAL */

    /// @dev Assess teh oracle rewards.
    /// @param _oracle Oracle address.
    function _payOracle(address _oracle) internal {
        getPaymentInfo[coreToken].availableFunds -= corePayment;
        getPaymentInfo[coreToken].allocatedFunds += corePayment;
        getOracleInfo[_oracle].balances[coreToken] += corePayment;
        getPaymentInfo[bonusToken].availableFunds -= bonusPayment;
        getPaymentInfo[bonusToken].allocatedFunds += bonusPayment;
        getOracleInfo[_oracle].balances[bonusToken] += bonusPayment;
    }

    /* VIEW */

    /// @dev Return's oracle reward.
    /// @param _oracle Oracle address.
    /// @return Oracle rewards.
    function getWithdrawable(IERC20 _asset, address _oracle)
        external
        view
        returns (uint256)
    {
        return getOracleInfo[_oracle].balances[_asset];
    }

    /// @dev Calculates asset identifier.
    function getDeployId(
        bytes32 _debridgeId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(_debridgeId, _name, _symbol, _decimals));
    }

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, address _tokenAddress)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }
}
