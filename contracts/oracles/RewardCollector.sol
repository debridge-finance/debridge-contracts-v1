// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IPriceConsumer.sol";
import "hardhat/console.sol";
import "./DelegatedStaking.sol";


contract RewardCollector is Initializable,
                         AccessControlUpgradeable,
                         PausableUpgradeable,
                         ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    struct RewardInfo {
        uint256 totalAmount; // total rewards
        uint256 distributed; // distributed rewards
    }

    uint256 public constant BPS_DENOMINATOR = 10000; // Basis points, or bps, equal to 1/10000 used to express relative value
    mapping(address => RewardInfo) public getRewardsInfo;
    IPriceConsumer public priceConsumer;
    DelegatedStaking public delegatedStaking;

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error CollateralDisabled();
    error CollateralLimited();
    error WrongArgument();
    error AlreadyExist();
    error ZeroAmount();
    error WrongAmount();

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== Events ========== */

    event RewardsReceived(address token,  uint256 amount);
    event RewardsDistributed(address token,  uint256 amount);

    /* PUBLIC */

    /**
     * @dev Initializer that initializes the most important configurations.
     * @param _delegatedStaking delegatedStaking contract.
     * @param _priceConsumer Price consumer contract.
     */
    function initialize(DelegatedStaking _delegatedStaking, IPriceConsumer _priceConsumer
    ) public initializer {
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        delegatedStaking = _delegatedStaking;
        priceConsumer = _priceConsumer;
    }

    /**
     * @dev stake collateral to validator.
     * @param _token address of reward token
     * @param _amount Amount to stake.
     */
    function sendRewards(
        address _token,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        //delegatedStaking.getCollateral(_collateral);
        // TODO: check that collateral isEnabled,
        // Collateral storage collateral = collaterals[_collateral];
        // if (!collateral.isEnabled) revert CollateralDisabled();

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        getRewardsInfo[_token].totalAmount += _amount;

        emit RewardsReceived(_token,  _amount);

        console.log("_amount %s", _amount);
        console.log("getRewardsInfo[_token].totalAmount %s", getRewardsInfo[_token].totalAmount);
        console.log("getRewardsInfo[_token].distributed %s", getRewardsInfo[_token].distributed);
    }


    // /**
    //  * @dev Distributes rewards between validators
    //  * @param _token address of reward token
    //  */
    // function distributeRewards(address _token) external nonReentrant whenNotPaused {
    //     //TODO: can add distribution for all rewards tokens
    //     RewardInfo storage rewardInfo = getRewardsInfo[_token];
    //     uint256 rewardAmount = rewardInfo.totalAmount - rewardInfo.distributed;
    //     if (rewardAmount == 0) revert ZeroAmount();
    //     rewardInfo.distributed += rewardAmount;
    //     //TODO: optimize validatorAddresses
    //     address[] memory validatorAddresses = delegatedStaking.validatorAddresses;

    //     //TODO: neet to check is validator active
    //     for (uint256 i=0; i<validatorAddresses.length; i++) {
    //         address _validator = validatorAddresses[i];
    //         ValidatorInfo storage validator = getValidatorInfo[_validator];
    //         ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
    //         uint256 validatorAmount =  validator.rewardWeightCoefficient * _amount / weightCoefficientDenominator;
    //         uint256 delegatorsAmount = validatorAmount * validator.profitSharingBPS / BPS_DENOMINATOR;

    //         console.log("_validator %s",_validator);
    //         console.log("validatorAmount  %s", validatorAmount);
    //         console.log("delegatorsAmount %s", delegatorsAmount);

    //         validatorCollateral.accumulatedRewards += validatorAmount;
    //         validatorCollateral.rewardsForWithdrawal += validatorAmount - delegatorsAmount;
    //         // mint validatorAmount delegators[validator.admin]
    //         console.log("validatorCollateral.stakedAmount before %s", validatorCollateral.stakedAmount);
    //         _distributeDelegatorRewards(_validator, _collateral, delegatorsAmount);
    //         //after distribution
    //         // validatorCollateral.stakedAmount += delegatorsAmount;
    //         console.log("validatorCollateral.stakedAmount after increase %s", validatorCollateral.stakedAmount);
    //         emit RewardsDistributed(_validator, _collateral, _amount);
    //     }

    //     emit RewardsDistributed(_token, rewardAmount);
    // }

//  /**
//      * @dev Distributes validator rewards to delegators
//      * @param _validator address of validator
//      * @param _collateral address of collateral
//      * @param _delegatorsAmount amount of token
//      */
//     function _distributeDelegatorRewards(address _validator, address _collateral, uint256 _delegatorsAmount) internal {
//         ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
//         // All colaterals of the validator valued in usd
//         uint256 totalUSDAmount = getTotalUSDAmount(_validator);
//         console.log("_distributeDelegatorRewards  _validator %s collateral %s delegatorsAmount %s",_validator, _collateral, _delegatorsAmount);
//         for (uint256 i = 0; i < collateralAddresses.length; i++) {
//             address currentCollateral = collateralAddresses[i];
//             //LINK pool | USDT pool
//             //1.6 link  |  0.4
//             // How many rewards each collateral receives
//             console.log("currentCollateral %s", currentCollateral);
//             uint256 accTokens = _delegatorsAmount *
//                 getPoolUSDAmount(_validator, currentCollateral) /
//                 totalUSDAmount;
//             console.log("getPoolUSDAmount %s", getPoolUSDAmount(_validator, currentCollateral));
//             console.log("totalUSDAmount %s", totalUSDAmount);
//             console.log("accTokens %s",accTokens);

//             // 0.04 link per link share | 0.004

//             if(currentCollateral==_collateral){
//                 console.log("poolShares %s", validatorCollateral.shares);
//                 uint256 accTokensPerShare = validatorCollateral.shares > 0
//                     ? accTokens * 1e18 / validatorCollateral.shares //TODO: can be rollback 1e18 in current changes
//                     : 0;
//                 console.log("accTokensPerShare+ %s", accTokensPerShare);
//                 //Increase accumulated rewards per share
//                 validatorCollateral.accTokensPerShare += accTokensPerShare; //+0.04
//                 console.log("validatorCollateral.accTokensPerShare= %s", validatorCollateral.accTokensPerShare);
//             } else {
//                 uint256 poolShares = getValidatorInfo[_validator].collateralPools[currentCollateral].shares;
//                 uint256 accTokensPerShare = poolShares > 0
//                     ? accTokens * 1e18 / poolShares //TODO: we need to increase 1e18 to 1e30 accTokensPerShare is low for pair link - USDT reward
//                                                     // we have 1e6*1e18/1e18 it's soo low to precision +accTokensPerShare 9758
//                     : 0;
//                 console.log("poolShares %s", poolShares);
//                 console.log("accTokensPerShare+ %s", accTokensPerShare);
//                 //Add a reward pool dependency
//                 validatorCollateral.dependsAccTokensPerShare[currentCollateral] += accTokensPerShare; // + 0.004
//                 console.log("dependsAccTokensPerShare= %s", validatorCollateral.dependsAccTokensPerShare[currentCollateral]);
//             }
//         }
//     }


    /**
     * @dev Set Price Consumer
     * @param _priceConsumer address of price consumer
     */
    function setPriceConsumer(IPriceConsumer _priceConsumer) external onlyAdmin {
        priceConsumer = _priceConsumer;
    }

    /* internal & views */

    // /**
    //  * @dev Get USD amount of validator collateral
    //  * @param _validator Address of validator
    //  * @param _collateral Address of collateral
    //  * @return USD amount with decimals 18
    //  */
    // function getPoolUSDAmount(address _validator, address _collateral) public view returns(uint256) {
    //     uint256 collateralPrice;
    //     //TODO: optimize can get from getPriceOfToken if stable
    //     (, , , bool isUSDStable) = validatorCollateral.getCollateralInfo[_collateral];
    //     if (isUSDStable)
    //         collateralPrice = 1e18;
    //     // TODO: check what's decimals reuturn priceConsumer (ETH/USD has 8 decimals!!!)
    //     else collateralPrice = priceConsumer.getPriceOfToken(_collateral);

    //     (uint256 stakedAmount,,,,,) = validatorCollateral.getValidatorCollateral(_validator, _collateral);
    //     return stakedAmount * collateralPrice / (10 ** collateral.decimals);
    // }

    // /**
    //  * @dev Get total USD amount of validator collateral
    //  * @param _validator Address of validator
    //  */
    // function getTotalUSDAmount(address _validator) public view returns(uint256) {
    //     uint256 totalUSDAmount = 0;
    //     //TODO: optimize collateralAddresses keep in this contract
    //     address[] memory collateralAddresses = delegatedStaking.collateralAddresses;
    //     for (uint256 i = 0; i < collateralAddresses.length; i++) {
    //         totalUSDAmount += getPoolUSDAmount(_validator, collateralAddresses[i]);
    //     }
    //     console.log("getTotalUSDAmount %s totalUSDAmount: %s", _validator, totalUSDAmount);
    //     return totalUSDAmount;
    // }
}
