// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/ISwapProxy.sol";

import "hardhat/console.sol";

contract SwapProxy  is Initializable, AccessControlUpgradeable, PausableUpgradeable, ISwapProxy{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    bytes32 public constant SYSTEM_ROLE = keccak256("SYSTEM_ROLE");

    IUniswapV2Factory public uniswapFactory;

     /* ========== ERRORS ========== */

    error AdminBadRole();
    error SystemBadRole();

    /* ========== MODIFIERS ========== */

    modifier onlySystem() {
        if (!hasRole(SYSTEM_ROLE, msg.sender)) revert SystemBadRole();
        _;
    }

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

   /* ========== CONSTRUCTOR  ========== */

    function initialize(IUniswapV2Factory _uniswapFactory) public initializer {
        uniswapFactory = _uniswapFactory;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== FUNCTIONS  ========== */

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function setUniswapFactory(IUniswapV2Factory _uniswapFactory) external onlyAdmin {
        uniswapFactory = _uniswapFactory;
    }

    function swap(
        address _fromToken,
        address _toToken,
        address _receiver
    ) external override onlySystem whenNotPaused returns(uint256 amountOut) {
        console.log("swap _fromToken %s _toToken %s",  _fromToken,_toToken);
        uint256 amount = IERC20Upgradeable(_fromToken).balanceOf(address(this));
        console.log("_receiver %s _amount %s", _receiver,  amount);
        amountOut = _swapExact(_fromToken, _toToken, _receiver, amount);
        return amountOut;
    }

    /* ========== PRIVATE FUNCTIONS  ========== */

    function _swapExact(
        address _fromToken,
        address _toToken,
        address _receiver,
        uint256 _amount
    ) private returns(uint256 amountOut) {
        IERC20Upgradeable erc20 = IERC20Upgradeable(_fromToken);
        IUniswapV2Pair uniswapPair = IUniswapV2Pair(uniswapFactory.getPair(_toToken, _fromToken));
        erc20.safeTransfer(address(uniswapPair), _amount);

        bool toFirst = _toToken < _fromToken;

        (uint256 reserve0, uint256 reserve1, ) = uniswapPair.getReserves();
        if (toFirst) {
            amountOut = getAmountOut(_amount, reserve1, reserve0);
            uniswapPair.swap(amountOut, 0, _receiver, "");
        } else {
            amountOut = getAmountOut(_amount, reserve0, reserve1);
            uniswapPair.swap(0, amountOut, _receiver, "");
        }
        return amountOut;
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "insuffient amount");
        require(reserveIn > 0 && reserveOut > 0, "insuffient liquidity");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }


    // ============ Version Control ============

    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
