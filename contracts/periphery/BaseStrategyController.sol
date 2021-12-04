// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

abstract contract BaseStrategyController is IStrategy {
    struct Delegator {
        uint256 sShares;
        uint256 lockedShares;
        uint256 lockedReserves;
    }

    struct Strategy {
        address strategyToken;
        address rewardToken;
        uint256 sShares;
        mapping(address => Delegator) delegators;
        bool isEnabled;
        bool exists;
        bool isRecoverable;
    }

    event EmergencyWithdrawnFromStrategy(uint256 amount, address strategy, address collateral);

    mapping(address => Strategy) public strategies; // collateral => Strategy

    address public constant VALIDATOR;
    address public constant DELEGATED_STAKING;
    uint256 public denominator = 10e18;

    /* ========== EVENTS ========== */

    event StrategyReset(address _strategy, address collateral);

    /* ========== ERRORS ========== */

    error StrategyDisabled();
    error AlreadyExists();
    error MethodNotImplemented();
    error WrongAmount();
    error AccessDenied();

    /* ========== MODIFIERS ========== */

    modifier onlyDelegatedStaking() {
        if (msg.sender != DELEGATED_STAKING) revert AccessDenied();
        _;
    }

    constructor(address _delegatedStaking) {
        DELEGATED_STAKING = _delegatedStaking;
    }

    /* ========== METHODS TO BE IMPLEMENTED BY INHERITED STRATEGIES CONTROLLERS ========== */

    function strategyToken(address _collateral) public view virtual returns (address) {
        revert MethodNotImplemented();
    }

    function _ensureBalancesWithdrawal(address _collateral, uint256 amountToBePaid) internal {
        revert MethodNotImplemented();
    }

    function _totalReserves(address _collateral) internal view virtual returns (uint256) {
        revert MethodNotImplemented();
    }

    function _deposit(address _collateral, uint256 _amount) internal virtual {
        revert MethodNotImplemented();
    }

    function _withdrawFromUnderlyingProtocol(address _collateral, uint256 _amount)
        internal
        virtual
    {
        revert MethodNotImplemented();
    }

    /* ========== EXTERNAL ========== */

    function getValidator() external view override returns (address) {
        return VALIDATOR;
    }

    function delegatorShares(address _collateral, address _delegator)
        external
        view
        override
        returns (uint256)
    {
        return _delegatorShares(_collateral, _delegator);
    }

    function totalShares(address _collateral) external view override returns (uint256) {
        return strategies[_collateral].sShares;
    }

    function totalReserves(address _collateral) external view override returns (uint256) {
        return _totalReserves(_collateral);
    }

    function strategyInfo(address _collateral) external view override returns (bool, bool) {
        return (strategies[_collateral].isEnabled, strategies[_collateral].isRecoverable);
    }

    function updateStrategyEnabled(address _collateral, bool _isEnabled)
        external
        override
        onlyDelegatedStaking
    {
        strategies[_collateral].isEnabled = _isEnabled;
    }

    function updateStrategyRecoverable(address _collateral, bool _isRecoverable)
        external
        override
        onlyDelegatedStaking
    {
        strategies[_collateral].isRecoverable = _isRecoverable;
    }

    // TODO: fix tests which using this
    function resetStrategy(address _collateral) external override onlyDelegatedStaking {
        Strategy storage strategy = strategies[_collateral];
        if (!strategy.isEnabled) revert StrategyDisabled();
        strategy.totalReserves = 0;
        strategy.sShares = 0;
        strategy.isEnabled = true;
        strategy.isRecoverable = false;
        emit StrategyReset(address(this), _collateral);
    }

    function addStrategy(address _collateral, address _rewardToken)
        external
        override
        onlyDelegatedStaking
    {
        Strategy storage strategy = strategies[_collateral];
        if (strategy.exists) revert AlreadyExists();
        strategy.strategyToken = strategyToken(_collateral);
        strategy.rewardToken = _rewardToken;
        strategy.isEnabled = true;
        strategy.exists = true;
    }

    function slashValidatorDeposits(address _collateral, uint256 _slashingFraction)
        external
        override
        onlyDelegatedStaking
        returns (uint256)
    {
        return slashDelegatorDeposits(VALIDATOR, _collateral, _slashingFraction);
    }

    function slashDelegatorDeposits(
        address _delegator,
        address _collateral,
        uint256 _slashingFraction
    ) external override onlyDelegatedStaking returns (uint256) {
        uint256 _shares = _delegatorShares(_collateral, _delegator) * _slashingFraction;
        strategies[_collateral].delegators[_delegator].sShares -= _shares;
        strategies[_collateral].sShares -= _shares;
        // TODO: complete
        return _shares;
    }

    function deposit(
        address _collateral,
        address _recipient,
        uint256 _shares,
        uint256 _amount
    ) external override onlyDelegatedStaking {
        //TODO: transferFrom
        _deposit(_collateral, _amount);
        uint256 _sShares = _calculateShares(_collateral, _amount);
        Strategy storage strategy = strategies[_collateral];
        Delegator storage delegator = strategy.delegators[_recipient];
        delegator.sShares += _sShares;
        delegator.lockedShares += _shares;
        delegator.lockedReserves += _amount;

        strategy.sShares += _sShares;
        strategy.totalReserves += _amount;
    }

    function withdraw(
        address _collateral,
        address _recipient,
        uint256 _shares
    ) external override onlyDelegatedStaking returns (bool, uint256) {
        Strategy storage strategy = strategies[_collateral];
        Delegator storage delegator = strategy.delegators[_recipient];
        if (shares > delegator.lockedShares) revert WrongAmount();

        uint256 percentageToWithdraw = (_shares * denominator) / delegator.lockedShares;
        uint256 _sShares = (percentageToWithdraw * delegator.sShares) / denominator;

        uint256 amountToBePaid = _calculateFromShares(_collateral, _sShares);
        _ensureBalancesWithdrawal(_collateral, amountToBePaid);
        IERC20(_collateral).safeTranfer(DELEGATED_STAKING, amountToBePaid);
        uint256 amountToBeUnlocked = (percentageToWithdraw * delegator.lockedReserves) /
            denominator;

        delegator.sShares -= _sShares;
        delegator.lockedShares -= _shares;
        delegator.lockedReserves -= amountToBeUnlocked;

        strategy.sShares -= _sShares;
        strategy.totalReserves -= amountToBePaid;

        if (amountToBePaid > amountToBeUnlocked) {
            // strategy profits
            return (true, amountToBePaid - amountToBeUnlocked);
        } else {
            // strategy losses
            return (false, amountToBeUnlocked - amountToBePaid);
        }
    }

    /* ========== INTERNAL ========== */

    function _calculateShares(address _collateral, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        uint256 totalReserves = _totalReserves(_collateral);
        if (totalReserves > 0) {
            return (_amount * strategies[_collateral].sShares) / totalReserves;
        } else {
            return _amount;
        }
    }

    function _calculateFromShares(address _collateral, uint256 _shares)
        internal
        view
        returns (uint256)
    {
        uint256 totalShares = strategies[_collateral].sShares;
        if (totalShares == 0) {
            return 0;
        }
        return (_shares * _totalReserves(_collateral)) / totalShares;
    }

    function _delegatorShares(address _collateral, address _delegator)
        internal
        view
        returns (uint256)
    {
        return strategies[_collateral].delegators[_delegator].sShares;
    }

    // TODO:
    // withdrawAll functio to update state
    // revert if strategy is disabled
    // strategyController.updateStrategyEnabled(_stakeToken, false);
    // strategyController.updateStrategyRecoverable(_stakeToken, true);
    // emit EmergencyWithdrawnFromStrategy
}
