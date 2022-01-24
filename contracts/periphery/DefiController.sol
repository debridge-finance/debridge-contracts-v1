// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IStrategy.sol";

contract DefiController is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Strategy {
        bool exists;
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
    // token address => total maxReserves for all strategies using this token in bps, should be <= BPS_DENOMINATOR
    mapping(address => uint256) public tokenTotalReservesBps;

    IDeBridgeGate public deBridgeGate;

    /* ========== EVENTS ========== */

    event AddStrategy(
        address strategy,
        bool isEnabled,
        uint16 maxReservesBps,
        address stakeToken,
        address strategyToken
    );

    event UpdateStrategy(address indexed strategy, bool isEnabled, uint16 maxReservesBps);

    event DepositToStrategy(address indexed strategy, uint256 indexed amount);

    event WithdrawFromStrategy(address indexed strategy, uint256 indexed amount);

    /* ========== ERRORS ========== */

    error WorkerBadRole();
    error AdminBadRole();
    error StrategyNotFound();
    error StrategyAlreadyExists();

    error ExceedMaxStrategyReserves();

    error InvalidMaxReservesBps();
    error InvalidTotalMaxReservesBps();
    /* ========== MODIFIERS ========== */

    modifier onlyWorker() {
        if (!hasRole(WORKER_ROLE, msg.sender)) revert WorkerBadRole();
        _;
    }

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize()
        public
        //IDeBridgeGate _deBridgeGate)
        initializer
    {
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
        uint256 maxStrategyReserves = (avaliableReserves * strategy.maxReservesBps) /
            BPS_DENOMINATOR;
        uint256 currentReserves = strategyController.updateReserves(
            address(this),
            strategy.strategyToken
        );

        if (currentReserves + _amount > maxStrategyReserves) revert ExceedMaxStrategyReserves();

        // Get tokens from Gate
        deBridgeGate.requestReserves(strategy.stakeToken, _amount);

        // Deposit tokens to strategy
        IERC20Upgradeable(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20Upgradeable(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategyController.deposit(strategy.stakeToken, _amount);

        emit DepositToStrategy(_strategy, _amount);
    }

    function withdrawFromStrategy(uint256 _amount, address _strategy) internal {
        Strategy memory strategy = strategies[_strategy];
        // already checked in rebalanceStrategy
        // require(strategy.isEnabled, " strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);

        // Withdraw tokens from strategy
        strategyController.withdraw(strategy.strategyToken, _amount);
        IERC20Upgradeable(strategy.stakeToken).safeApprove(address(deBridgeGate), 0);
        IERC20Upgradeable(strategy.stakeToken).safeApprove(address(deBridgeGate), _amount);

        // TODO: get rewards from strategy

        // Return tokens to Gate
        deBridgeGate.returnReserves(strategy.stakeToken, _amount);

        emit WithdrawFromStrategy(_strategy, _amount);
    }

    function rebalanceStrategy(address _strategy) external onlyWorker whenNotPaused {
        (uint256 deltaAmount, bool toDeposit) = isStrategyUnbalanced(_strategy);
        if (deltaAmount > 0) {
            if (toDeposit) {
                depositToStrategy(deltaAmount, _strategy);
            } else {
                withdrawFromStrategy(deltaAmount, _strategy);
            }
        }
    }

    /* ========== VIEW ========== */

    // isStrategyUnbalanced view method checks if strategy needs to be rebalanced,
    // and if so returns [deltaAmount, directionToTransfer]
    // where deltaAmount - delta between current strategy state and optimal state
    // directionToTransfer - true if deposit is needed, false if withdraw is needed
    // if strategy in optimal state it returns [0, false]
    function isStrategyUnbalanced(address _strategy)
        public
        view
        returns (uint256 _deltaAmount, bool _toDeposit)
    {
        Strategy memory strategy = strategies[_strategy];
        if (!strategy.exists) revert StrategyNotFound();

        IStrategy strategyController = IStrategy(_strategy);

        // avaliableReserves = 100%
        uint256 avaliableReserves = deBridgeGate.getDefiAvaliableReserves(strategy.stakeToken);
        uint256 currentReserves = strategyController.updateReserves(
            address(this),
            strategy.strategyToken
        );

        // if strategy disabled
        // or no reserves avaliable for stake token
        // or strategy not allowed to use gate's reserves
        if (!strategy.isEnabled || avaliableReserves == 0 || strategy.maxReservesBps == 0) {
            // withdraw current reserves if there they are
            return (currentReserves, false);
        }

        // current strategy reserves in bps
        uint256 currentReservesBps = (currentReserves * BPS_DENOMINATOR) / avaliableReserves;
        // calculate optimal value of strategy reserves in bps:
        uint256 optimalReservesBps = strategy.maxReservesBps - STRATEGY_RESERVES_DELTA_BPS / 2;

        if (currentReservesBps > strategy.maxReservesBps) {
            // strategy reserves are more than allowed value, withdraw some to keep optimal balance
            return (
                ((currentReservesBps - optimalReservesBps) * avaliableReserves) / BPS_DENOMINATOR,
                false
            );
        } else if (currentReservesBps + STRATEGY_RESERVES_DELTA_BPS < strategy.maxReservesBps) {
            // strategy reserves are less than optimal value, deposit some to keep optimal balance
            return (
                ((optimalReservesBps - currentReservesBps) * avaliableReserves) / BPS_DENOMINATOR,
                true
            );
        }
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
        if (
            _maxReservesBps != 0 &&
            (_maxReservesBps <= STRATEGY_RESERVES_DELTA_BPS || BPS_DENOMINATOR < _maxReservesBps)
        ) revert InvalidMaxReservesBps();

        // require(_maxReservesBps == 0 ||
        //     (_maxReservesBps > STRATEGY_RESERVES_DELTA_BPS && BPS_DENOMINATOR >= _maxReservesBps),
        //     "invalid maxReservesBps");

        Strategy storage strategy = strategies[_strategy];
        if (strategy.exists) revert StrategyAlreadyExists();

        if (_isEnabled) {
            if (tokenTotalReservesBps[_stakeToken] + _maxReservesBps > BPS_DENOMINATOR)
                revert InvalidTotalMaxReservesBps();
            // require(tokenTotalReservesBps[_stakeToken] + _maxReservesBps <= BPS_DENOMINATOR, "invalid total maxReservesBps");
            tokenTotalReservesBps[_stakeToken] += _maxReservesBps;
        }

        strategy.exists = true;
        strategy.isEnabled = _isEnabled;
        strategy.maxReservesBps = _maxReservesBps;
        strategy.stakeToken = _stakeToken;
        strategy.strategyToken = _strategyToken;

        emit AddStrategy(_strategy, _isEnabled, _maxReservesBps, _stakeToken, _strategyToken);
    }

    function updateStrategy(
        address _strategy,
        bool _isEnabled,
        uint16 _maxReservesBps
    ) external onlyAdmin {
        Strategy storage strategy = strategies[_strategy];
        if (!strategy.exists) revert StrategyNotFound();
        // require(strategy.exists, "strategy doesn't exist");

        if (strategy.isEnabled) {
            tokenTotalReservesBps[strategy.stakeToken] -= strategy.maxReservesBps;
        }
        if (_isEnabled) {
            if (tokenTotalReservesBps[strategy.stakeToken] + _maxReservesBps > BPS_DENOMINATOR)
                revert InvalidTotalMaxReservesBps();

            //require(tokenTotalReservesBps[strategy.stakeToken] + _maxReservesBps <= BPS_DENOMINATOR, "invalid total maxReservesBps");
            tokenTotalReservesBps[strategy.stakeToken] += _maxReservesBps;
        }

        strategy.isEnabled = _isEnabled;
        strategy.maxReservesBps = _maxReservesBps;

        emit UpdateStrategy(_strategy, _isEnabled, _maxReservesBps);
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
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 102; // 1.0.2
    }
}
