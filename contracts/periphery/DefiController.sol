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
        bool isSupported;
        bool isEnabled;
        // bool isRecoverable;
        uint16 maxReservesBps;
        address stakeToken;
        address strategyToken;
        // address rewardToken;
        // uint256 totalShares;
        uint256 totalReserves;
    }


    /* ========== STATE VARIABLES ========== */

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant DELTA_BPS = 200; // 2%
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE"); // role allowed to submit the data

    mapping(address => Strategy) public strategies;
    IDeBridgeGate public deBridgeGate;

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
        // TODO: require that Strategy.maxReservesBps > DELTA_BPS
    }

    function depositToStrategy(uint256 _amount, address _strategy) public onlyWorker{
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);

        // check that strategy uses only maxReservesBps from all avaliable for DefiController reserves
        uint256 avaliableReserves = deBridgeGate.getDefiAvaliableReserves(strategy.stakeToken);
        uint256 maxStrategyReserves = avaliableReserves * strategy.maxReservesBps / BPS_DENOMINATOR;
        require(strategy.totalReserves + _amount < maxStrategyReserves, "");

        // Get tokens from Gate
        deBridgeGate.requestReserves(strategy.stakeToken, _amount);

        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategyController.deposit(strategy.stakeToken, _amount);
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
    }


    function withdrawFromStrategy(uint256 _amount, address _strategy) public onlyWorker{
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);
        strategyController.withdraw(strategy.strategyToken, _amount);
        IERC20(strategy.stakeToken).safeApprove(address(deBridgeGate), 0);
        IERC20(strategy.stakeToken).safeApprove(address(deBridgeGate), _amount);
        // TODO: get rewards from strategy
        // Return tokens to Gate
        deBridgeGate.returnReserves(strategy.stakeToken, _amount);
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
    }

    function optimizeStrategyReserves(address _strategy) external onlyWorker {
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "strategy is not enabled");

        // avaliableReserves = 100%
        uint256 avaliableReserves = deBridgeGate.getDefiAvaliableReserves(strategy.stakeToken);
        // current strategy reserves in bps
        uint256 reservesBps =  strategy.totalReserves * BPS_DENOMINATOR / avaliableReserves;
        // optimal strategy reserves in bps - move from maxReservesBps to half of DELTA_BPS
        uint256 optimalReservesBps = strategy.maxReservesBps - DELTA_BPS / 2;
        if (reservesBps > strategy.maxReservesBps) {
            // calculate optimal amount for withdraw
            uint256 amount = (reservesBps - optimalReservesBps) * avaliableReserves / BPS_DENOMINATOR;
            withdrawFromStrategy(amount, _strategy);
        } else if (reservesBps + DELTA_BPS < strategy.maxReservesBps) {
            // calculate optimal amount for deposit
            uint256 amount = (optimalReservesBps - reservesBps) * avaliableReserves / BPS_DENOMINATOR;
            depositToStrategy(amount, _strategy);
        }
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
