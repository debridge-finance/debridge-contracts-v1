// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Aggregator is AccessControl {
    struct OracleInfo {
        uint128 withdrawable;
        address admin;
        address pendingAdmin;
    }

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    uint256 public minConfirmations;
    uint256 public allocatedFunds;
    uint256 public availableFunds;
    uint128 public payment;
    IERC20 public link;
    mapping(address => OracleInfo) public getRracleInfo;

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }
    modifier onlyOracle {
        require(hasRole(ORACLE_ROLE, msg.sender), "onlyOracle: bad role");
        _;
    }

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

    function setMinConfirmations(uint256 _minConfirmations) external onlyAdmin {
        minConfirmations = _minConfirmations;
    }

    function setPayment(uint128 _payment) external onlyAdmin {
        payment = _payment;
    }

    function withdrawablePayment(address _oracle)
        external
        view
        returns (uint256)
    {
        return getRracleInfo[_oracle].withdrawable;
    }

    function withdrawPayment(
        address _oracle,
        address _recipient,
        uint256 _amount
    ) external {
        require(
            getRracleInfo[_oracle].admin == msg.sender,
            "only callable by admin"
        );

        uint128 amount = uint128(_amount);
        uint128 available = getRracleInfo[_oracle].withdrawable;
        require(available >= amount, "insufficient withdrawable funds");

        getRracleInfo[_oracle].withdrawable = available - amount;
        allocatedFunds -= amount;

        assert(link.transfer(_recipient, uint256(amount)));
    }

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

    function updateAvailableFunds() public {
        availableFunds = link.balanceOf(address(this)) - allocatedFunds;
    }

    function onTokenTransfer(
        address,
        uint256,
        bytes calldata _data
    ) external {
        require(msg.sender == address(link), "onTokenTransfer: not the Link");
        // require(_data.length == 0, "transfer doesn't accept calldata");
        updateAvailableFunds();
    }

    function addOracle(address _aggregator) external {
        grantRole(ORACLE_ROLE, _aggregator);
    }

    function removeOracle(address _aggregator) external {
        revokeRole(ORACLE_ROLE, _aggregator);
    }

    function _payOracle(address _oracle) internal {
        availableFunds -= payment;
        allocatedFunds += payment;
        getRracleInfo[_oracle].withdrawable += payment;
    }
}
