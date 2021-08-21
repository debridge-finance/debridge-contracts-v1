// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../periphery/CallProxy.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IWETH.sol";

contract FeeProxy is CallProxy, AccessControl, IFeeProxy {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */
    //                                       donateFees(bytes32 _debridgeId, uint256 _amount)
    bytes4 public constant DONATEFEES_SELECTOR = bytes4(keccak256("donateFees(bytes32,uint256)"));

    IWETH public weth; // wrapped native token contract

    IDeBridgeGate public debridgeGate;
    IUniswapV2Factory public uniswapFactory;

    mapping(uint256 => bytes) public debridgeGateAddresses; //Addresses of gates in each chain
    mapping(uint256 => bytes) public treasuryAddresses;

    uint256 public constant ETH_CHAINID = 1; //Ethereum chainId
    address public deEthToken; //address of deETH token

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error DeBridgeGateBadRole();
    error EmptyDeBridgeGateAddress();
    error EmptyTreasuryAddress(uint256 chainId);

    error InsuffientAmountIn();
    error InsuffientLiquidity();

    error CantConvertAddress();

    /* ========== MODIFIERS ========== */

    modifier onlyDeBridgeGate() {
        if (msg.sender != address(debridgeGate)) revert DeBridgeGateBadRole();
        _;
    }

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    constructor(IUniswapV2Factory _uniswapFactory, IWETH _weth) {
        uniswapFactory = _uniswapFactory;
        weth = _weth;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== FUNCTIONS  ========== */

    function setUniswapFactory(IUniswapV2Factory _uniswapFactory) external onlyAdmin {
        uniswapFactory = _uniswapFactory;
    }

    function setDebridgeGate(IDeBridgeGate _debridgeGate) external onlyAdmin {
        debridgeGate = _debridgeGate;
    }

    function setTreasury(uint256 _chainId, bytes memory _treasuryAddress) external onlyAdmin {
        treasuryAddresses[_chainId] = _treasuryAddress;
    }

    function setDeEthToken(address _deEthToken) external onlyAdmin {
        deEthToken = _deEthToken;
    }

    function setDebridgeGateAddresses(uint256 _chainId, bytes memory _debridgeGateAddresses)
        external
        onlyAdmin
    {
        debridgeGateAddresses[_chainId] = _debridgeGateAddresses;
    }

    /// @dev Transfer tokens to native chain and then create swap to deETH
    /// and transfer reward to Ethereum network.
    function transferToTreasury(
        bytes32 _debridgeId,
        address _tokenAddress,
        uint256 _nativeChain
    ) external payable override onlyDeBridgeGate {
        uint256 chainId = getChainId();
        if (debridgeGateAddresses[_nativeChain].length == 0) revert EmptyDeBridgeGateAddress();
        if (treasuryAddresses[chainId].length == 0) revert EmptyTreasuryAddress(chainId);

        // require(debridgeGateAddresses[_nativeChain].length > 0, "no debridge gate addresses");
        // require(treasuryAddresses[chainId].length > 0, "no treasury addresses");

        address currentTreaseryAddress = toAddress(treasuryAddresses[chainId]);

        uint256 amount = IERC20(_tokenAddress).balanceOf(address(this));

        // original token chain is the same as contract chain
        if (chainId == _nativeChain) {
            //Reward is token (DBR, LINK, WETH, deDBT, deLINK, deETH)
            //If token is deETH
            if (_tokenAddress == deEthToken) {
                //Create transfer to Ehereum netrowk ETH
                _autoBurnWithTransfer(_debridgeId, _tokenAddress, amount, _nativeChain, msg.value);
            }
            //For others tokens
            else {
                // create swap to weth
                if (_tokenAddress != address(weth)) {
                    _swap(_tokenAddress, address(weth), address(this));
                }
                //If we are in Ethereum chain transfer to Treasery
                if (chainId == ETH_CHAINID) {
                    IERC20(address(weth)).safeTransfer(
                        address(currentTreaseryAddress),
                        weth.balanceOf(address(this))
                    );
                } else {
                    //create swap from Native token to deETH
                    _swap(address(weth), deEthToken, address(this));
                    //transfer deETH to Ethereum
                    uint256 deEthAmount = IERC20(deEthToken).balanceOf(address(this));
                    _autoBurnWithTransfer(
                        _debridgeId,
                        deEthToken,
                        deEthAmount,
                        ETH_CHAINID,
                        msg.value
                    );
                }
            }
        }
        //create transfer if different chains
        else {
            _autoBurnWithTransfer(_debridgeId, _tokenAddress, amount, _nativeChain, msg.value);
        }
    }

    /// @dev Swap native tokens to deETH and then transfer reward to Ethereum network.
    function transferNativeToTreasury(bytes32 _wethDebridgeId, uint256 _nativeFixFee)
        external
        payable
        override
        onlyDeBridgeGate
    {
        uint256 chainId = getChainId();

        if (debridgeGateAddresses[chainId].length == 0) revert EmptyDeBridgeGateAddress();
        if (treasuryAddresses[chainId].length == 0) revert EmptyTreasuryAddress(chainId);
        // require(debridgeGateAddresses[chainId].length > 0, "no debridge gate addresses");
        // require(treasuryAddresses[chainId].length > 0, "no treasury addresses");

        address currentTreaseryAddress = toAddress(treasuryAddresses[chainId]);

        uint256 amount = msg.value - _nativeFixFee;

        //reward is native token (ETH/BNB/HT)
        //If we are in Ethereum chain
        if (chainId == ETH_CHAINID) {
            //TODO: send 50% reward to slashing contract
            payable(currentTreaseryAddress).transfer(amount);
        }
        //If we are not in Ethereum chain
        else {
            //Wrap native token
            weth.deposit{value: amount}();
            //create swap (BNB/HT) to deETH
            _swap(address(weth), deEthToken, address(this));
            uint256 deEthBalance = IERC20(deEthToken).balanceOf(address(this));
            //transfer deETH to Ethereum
            _autoBurnWithTransfer(
                _wethDebridgeId,
                deEthToken,
                deEthBalance,
                ETH_CHAINID,
                _nativeFixFee
            );
        }
    }

    // we need to accept ETH sends to unwrap WETH
    receive() external payable {
        assert(msg.sender == address(weth)); // only accept ETH via fallback from the WETH contract
    }

    /* ========== PRIVATE FUNCTIONS  ========== */

    /// @dev Create auto burn transfer with data that will call Transfer fee method in the target network
    function _autoBurnWithTransfer(
        bytes32 _debridgeId,
        address _erc20Token,
        uint256 _amount,
        uint256 _nativeChain,
        uint256 _nativeFixFee
    ) private {
        if (treasuryAddresses[_nativeChain].length == 0) revert EmptyTreasuryAddress(_nativeChain);

        // require(treasuryAddresses[_nativeChain].length > 0, "no treasury addresses");
        IERC20(_erc20Token).safeApprove(address(debridgeGate), _amount);
        debridgeGate.autoBurn{value: _nativeFixFee}(
            _debridgeId,
            debridgeGateAddresses[_nativeChain], //_receiver,
            _amount,
            _nativeChain, //_chainIdTo,
            treasuryAddresses[_nativeChain], //_fallbackAddress,
            0, //_executionFee,
            abi.encodeWithSelector(DONATEFEES_SELECTOR, _debridgeId, _amount), //_data,
            0, //_deadline,
            "", //_signature,
            false, //_useAssetFee,
            0
        );
    }

    function _swap(
        address _fromToken,
        address _toToken,
        address _receiver
    ) private {
        IERC20 erc20 = IERC20(_fromToken);
        uint256 _amount = erc20.balanceOf(address(this));
        IUniswapV2Pair uniswapPair = IUniswapV2Pair(uniswapFactory.getPair(_toToken, _fromToken));
        erc20.safeTransfer(address(uniswapPair), _amount);

        bool toFirst = _toToken < _fromToken;

        (uint256 reserve0, uint256 reserve1, ) = uniswapPair.getReserves();
        if (toFirst) {
            uint256 amountOut = getAmountOut(_amount, reserve1, reserve0);
            uniswapPair.swap(amountOut, 0, _receiver, "");
        } else {
            uint256 amountOut = getAmountOut(_amount, reserve0, reserve1);
            uniswapPair.swap(0, amountOut, _receiver, "");
        }
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) private pure returns (uint256 amountOut) {
        if (amountIn == 0) revert InsuffientAmountIn();
        if (reserveIn == 0 || reserveOut == 0) revert InsuffientLiquidity();
        // require(amountIn > 0, "insuffient amount");
        // require(reserveIn > 0 && reserveOut > 0, "insuffient liquidity");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function toAddress(bytes memory _bytes) internal pure returns (address) {
        if (_bytes.length != 20) revert CantConvertAddress();
        // require(_bytes.length >= 20, "toAddress_outOfBounds");
        address tempAddress;

        assembly {
            tempAddress := div(mload(add(_bytes, 0x20)), 0x1000000000000000000000000)
        }

        return tempAddress;
    }

    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }
}
