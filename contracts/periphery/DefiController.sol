// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DefiController is Initializable,
                           AccessControlUpgradeable,
                           PausableUpgradeable {

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
        // uint256 totalReserves;
    }


    /* ========== STATE VARIABLES ========== */

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant STRATEGY_RESERVES_DELTA_BPS = 200; // 2%
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE"); // role allowed to submit the data

    mapping(address => Strategy) public strategies;
    IDeBridgeGate public deBridgeGate;

    /* ========== EVENTS ========== */

    event AddStrategy(
        address strategy,
        bool isEnabled,
        uint16 maxReservesBps,
        address stakeToken,
        address strategyToken
    );

    event UpdateStrategy(
        address strategy,
        bool isEnabled,
        uint16 maxReservesBps
    );

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

    function depositToStrategy(uint256 _amount, address _strategy) internal {
        Strategy memory strategy = strategies[_strategy];
        // already checked in rebalanceStrategy
        // require(strategy.isEnabled, "strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);

        // Check that strategy will use only allowed % of all avaliable for DefiController reserves
        uint256 avaliableReserves = deBridgeGate.getDefiAvaliableReserves(strategy.stakeToken);
        uint256 maxStrategyReserves = avaliableReserves * strategy.maxReservesBps / BPS_DENOMINATOR;
        uint256 currentReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        require(currentReserves + _amount < maxStrategyReserves, "");

        // Get tokens from Gate
        deBridgeGate.requestReserves(strategy.stakeToken, _amount);

        // Deposit tokens to strategy
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategyController.deposit(strategy.stakeToken, _amount);
    }

    function withdrawFromStrategy(uint256 _amount, address _strategy) internal {
        Strategy memory strategy = strategies[_strategy];
        // already checked in rebalanceStrategy
        // require(strategy.isEnabled, " strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);

        // Withdraw tokens from strategy
        strategyController.withdraw(strategy.strategyToken, _amount);
        IERC20(strategy.stakeToken).safeApprove(address(deBridgeGate), 0);
        IERC20(strategy.stakeToken).safeApprove(address(deBridgeGate), _amount);

        // TODO: get rewards from strategy

        // Return tokens to Gate
        deBridgeGate.returnReserves(strategy.stakeToken, _amount);
    }

    function rebalanceStrategy(address _strategy) external onlyWorker whenNotPaused returns (bool) {
        Strategy memory strategy = strategies[_strategy];
        require(strategy.isEnabled, "strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);

        // avaliableReserves = 100%
        uint256 avaliableReserves = deBridgeGate.getDefiAvaliableReserves(strategy.stakeToken);
        uint256 currentReserves = strategyController.updateReserves(address(this), strategy.strategyToken);

        // no reserves avaliable for stake token
        if (avaliableReserves == 0) {
            // prevent division by zero
            if (currentReserves > 0) {
                // debridge.minReservesBps was changed to 100%
                withdrawFromStrategy(currentReserves, _strategy);
                return true;
            }
            return false;
        }

        // strategy not allowed to use gate's reserves
        if (strategy.maxReservesBps == 0) {
            if (currentReserves > 0) {
                // withdraw all current reserves from strategy
                withdrawFromStrategy(currentReserves, _strategy);
                return true;
            }
            return false;
        }

        // current strategy reserves in bps
        uint256 currentReservesBps = currentReserves * BPS_DENOMINATOR / avaliableReserves;
        // calculate optimal value of strategy reserves in bps:
        uint256 optimalReservesBps = strategy.maxReservesBps - STRATEGY_RESERVES_DELTA_BPS / 2;

        if (currentReservesBps > strategy.maxReservesBps) {
            // strategy reserves are more than allowed value, withdraw some to keep optimal balance
            uint256 amount = (currentReservesBps - optimalReservesBps) * avaliableReserves / BPS_DENOMINATOR;
            withdrawFromStrategy(amount, _strategy);
            return true;
        } else if (currentReservesBps + STRATEGY_RESERVES_DELTA_BPS < strategy.maxReservesBps) {
            // strategy reserves are less than optimal value, deposit some to keep optimal balance
            uint256 amount = (optimalReservesBps - currentReservesBps) * avaliableReserves / BPS_DENOMINATOR;
            depositToStrategy(amount, _strategy);
            return true;
        }
        return false;
    }

    /* ========== ADMIN ========== */


    /// @dev add new strategy
    function addStrategy(
        address _strategy,
        bool _isEnabled,
        uint16 _maxReservesBps,
        address _stakeToken,
        address _strategyToken
    ) external onlyAdmin {

        require(_maxReservesBps == 0 ||
            (_maxReservesBps > STRATEGY_RESERVES_DELTA_BPS && BPS_DENOMINATOR > _maxReservesBps),
            "invalid maxReservesBps");
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isSupported, "strategy already exists");
        strategy.isSupported = true;
        strategy.isEnabled = _isEnabled;
        strategy.maxReservesBps = _maxReservesBps;
        strategy.stakeToken = _stakeToken;
        strategy.strategyToken = _strategyToken;

        emit AddStrategy(
            _strategy,
            _isEnabled,
            _maxReservesBps,
            _stakeToken,
            _strategyToken);
    }

    function updateStrategy(
        address _strategy,
        bool _isEnabled,
        uint16 _maxReservesBps
    ) external onlyAdmin {
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isSupported, "strategy not found");
        strategy.isEnabled = _isEnabled;
        strategy.maxReservesBps = _maxReservesBps;

        emit UpdateStrategy(
            _strategy,
            _isEnabled,
            _maxReservesBps);
    }

    function setDeBridgeGate(IDeBridgeGate _deBridgeGate) external onlyAdmin {
        deBridgeGate = _deBridgeGate;
    }

    function addWorker(address _worker) external onlyAdmin {
        grantRole(WORKER_ROLE, _worker);
    }

    function removeWorker(address _worker) external onlyAdmin {
        revokeRole(WORKER_ROLE, _worker);
    }

    /// @dev Disable strategies rebalancing for workers
    function pause() external onlyAdmin whenNotPaused {
        _pause();
    }

    /// @dev Allow strategies rebalancing for workers
    function unpause() external onlyAdmin whenPaused {
        _unpause();
    }

}
