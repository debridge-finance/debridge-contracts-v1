// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DefiController is Initializable,
                           AccessControlUpgradeable {

    using SafeERC20 for IERC20;

    struct Strategy {
        //bool isSupported;
        bool isEnabled;
        // bool isRecoverable;
        address stakeToken;
        // address strategyToken;
        // address rewardToken;
        // uint256 totalShares;
        //uint256 totalReserves;
        uint256 lockedDepositBody;
    }


    /* ========== STATE VARIABLES ========== */

    IDeBridgeGate public deBridgeGate;
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE"); // role allowed to submit the data

    mapping(address => Strategy) public strategies;

     /* ========== MODIFIERS ========== */

    modifier onlyWorker {
        require(hasRole(WORKER_ROLE, msg.sender), "onlyWorker: bad role");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    /* ========== CONSTRUCTOR  ========== */


    function initialize()//IDeBridgeGate _deBridgeGate)
        public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        // deBridgeGate = _deBridgeGate;
    }

    function depositToStrategy(uint256 _amount, address _strategy) external onlyWorker{
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);
        strategy.lockedDepositBody += _amount;
        //Get tokens from Gate
        deBridgeGate.requestReserves(strategy.stakeToken, _amount);

        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategyController.deposit(strategy.stakeToken, _amount);
    }


    function withdrawFromStrategy(uint256 _amount, address _strategy) external onlyWorker{
        _withdraw(_amount,_strategy);
    }

    function withdrawAllFromStrategy(address _strategy) external onlyWorker{
        _withdraw(strategies[_strategy].lockedDepositBody,_strategy);
    }

    function _withdraw(uint256 _amount, address _strategy) internal {
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "strategy is not enabled");
        require(strategy.lockedDepositBody >= _amount, "amount is greater than the total number of tokens deposited");
        IStrategy strategyController = IStrategy(_strategy);
        (uint256 _yield, uint256 _body) = strategyController.withdraw(strategy.stakeToken, _amount);
        strategy.lockedDepositBody -= strategy.lockedDepositBody > _body ? _body : strategy.lockedDepositBody;
        IERC20(strategy.stakeToken).safeApprove(address(deBridgeGate), 0);
        IERC20(strategy.stakeToken).safeApprove(address(deBridgeGate), _body);
        // Return deposit body and yield to DeBridgeGate
        // todo: treat situations when _body and/or _yield are 0. Simplified these checks for PoC.
        deBridgeGate.returnReserves(strategy.stakeToken, _body);
        //deBridgeGate.returnYield(strategy.stakeToken, _yield);
    }

    function addDeBridgeGate(IDeBridgeGate _deBridgeGate) external onlyAdmin {
        deBridgeGate = _deBridgeGate;
    }

    function addWorker(address _worker) external onlyAdmin {
        grantRole(WORKER_ROLE, _worker);
    }

    function removeWorker(address _worker) external onlyAdmin {
        revokeRole(WORKER_ROLE, _worker);
    }
}
