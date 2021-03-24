// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Aggregator is AccessControl {
    struct OracleInfo {
        uint256 withdrawable; // amount of withdrawable LINKs
        address admin; // current oracle admin
    }

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // role allowed to submit the data
    uint256 public minConfirmations; // minimal required confimations
    uint256 public allocatedFunds; // LINK's amount payed to oracles
    uint256 public availableFunds; // LINK's amount available to be payed to oracles
    uint256 public payment; // payment for one submission
    IERC20 public link; // LINK's token address
    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details

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
    /// @param _minConfirmations Minimal required confirmations.
    /// @param _payment Oracle reward.
    /// @param _link Link token to pay to oracles.
    constructor(
        uint256 _minConfirmations,
        uint128 _payment,
        IERC20 _link
    ) {
        minConfirmations = _minConfirmations;
        payment = _payment;
        link = _link;
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
        uint256 _amount
    ) external {
        require(
            getOracleInfo[_oracle].admin == msg.sender,
            "withdrawPayment: only callable by admin"
        );
        uint256 available = getOracleInfo[_oracle].withdrawable;
        require(
            available >= _amount,
            "withdrawPayment: insufficient withdrawable funds"
        );
        getOracleInfo[_oracle].withdrawable = available - _amount;
        allocatedFunds -= _amount;
        assert(link.transfer(_recipient, _amount));
    }

    /// @dev Updates available rewards to be distributed.
    function updateAvailableFunds() public {
        availableFunds = link.balanceOf(address(this)) - allocatedFunds;
    }

    function onTokenTransfer(
        address,
        uint256,
        bytes calldata _data
    ) external {
        require(msg.sender == address(link), "onTokenTransfer: not the Link");
        require(_data.length == 0, "transfer doesn't accept calldata");
        updateAvailableFunds();
    }

    /* ADMIN */

    /// @dev Withdraws available LINK's.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, uint256 _amount)
        external
        onlyAdmin()
    {
        require(
            uint256(availableFunds) >= _amount,
            "insufficient reserve funds"
        );
        require(
            link.transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        updateAvailableFunds();
    }

    /// @dev Sets minimal required confirmations.
    /// @param _minConfirmations Minimal required confirmations.
    function setMinConfirmations(uint256 _minConfirmations) external onlyAdmin {
        minConfirmations = _minConfirmations;
    }

    /// @dev Sets new oracle reward.
    /// @param _payment Oracle reward.
    function setPayment(uint128 _payment) external onlyAdmin {
        payment = _payment;
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
        availableFunds -= payment;
        allocatedFunds += payment;
        getOracleInfo[_oracle].withdrawable += payment;
    }

    /* VIEW */

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @return Oracle rewards.
    function withdrawablePayment(address _oracle)
        external
        view
        returns (uint256)
    {
        return getOracleInfo[_oracle].withdrawable;
    }
}
