// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../periphery/CallProxy.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IWETH.sol";

contract FeeProxy is CallProxy, AccessControl, IFeeProxy{
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */
    //                                       donateFees(bytes32 _debridgeId, uint256 _amount)
    bytes4 public constant DONATEFEES_SELECTOR = bytes4(keccak256("donateFees(bytes32,uint256)"));

    IWETH public weth; // wrapped native token contract

    IDeBridgeGate public debridgeGate;
    IUniswapV2Factory public uniswapFactory;

    mapping(uint256 => address) public debridgeGateAddresses; //Addresses of gates in each chain

    uint256 public constant ETH_CHAINID = 1; //Ethereum chainId
    uint256 public chainId; // current chain id
    address public treasury; //address of treasury
    address public deEthToken; //address of deETH token

    /* ========== MODIFIERS ========== */

    modifier onlyDeBridgeGate {
        require(address(debridgeGate) == msg.sender, "onlyDeBridgeGate: bad role");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    constructor(
        IUniswapV2Factory _uniswapFactory,
        IWETH _weth,
        address _treasury
        )
    {
        uint256 cid;
        assembly {
            cid := chainid()
        }
        chainId = cid;

        uniswapFactory = _uniswapFactory;
        weth = _weth;
        treasury = _treasury;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== FUNCTIONS  ========== */

    function setUniswapFactory(IUniswapV2Factory _uniswapFactory) external onlyAdmin() {
        uniswapFactory = _uniswapFactory;
    }

    function setDebridgeGate(IDeBridgeGate _debridgeGate) external onlyAdmin() {
        debridgeGate = _debridgeGate;
    }

    function setTreasury(address _treasury) external onlyAdmin() {
        treasury = _treasury;
    }

    function setDeEthToken(address _deEthToken) external onlyAdmin() {
        deEthToken = _deEthToken;
    }

    function setDebridgeGateAddresses(uint256 _chainId, address _debridgeGateAddresses) external onlyAdmin() {
        debridgeGateAddresses[_chainId] = _debridgeGateAddresses;
    }

    /// @dev Create swap and transfer reward to Ethereum network.
    // /// @param _erc20Token token for transfer
    // /// @param _nativeChain token's native chain
    /// @param _nativeFixFee paid native fixed fee by worker
    function transferToTreasury(
        bytes32 _debridgeId,
        uint256 _nativeFixFee
    ) external payable override // onlyDeBridgeGate
    {
        (address _tokenAddress, uint256 _nativeChain, bool _exist) = debridgeGate.getDebridgeInfo(_debridgeId);
        require(_exist, "debridge not exist");
        require(debridgeGateAddresses[_nativeChain] != address(0), "No Debridge gate Addresses");

        uint256 amount = _tokenAddress == address(0)
                ? msg.value - _nativeFixFee
                : IERC20(_tokenAddress).balanceOf(address(this));

        // original token chain is the same as contract chain
        if (chainId == _nativeChain) {
            //If reward is native token (ETH/BNB/HT)
            if(_tokenAddress == address(0)) {
                //If we are in Ethereum chain
                if(chainId == ETH_CHAINID) {
                    //TODO: send 50% reward to slashing contract
                    payable(treasury).transfer(amount);
                }
                //If we are not in Ethereum chain
                else {
                    //Wrap native token
                    weth.deposit{value: amount}();
                    //create swap (BNB/HT) to deETH
                    _swap(address(weth), deEthToken, address(this));
                    uint256 deEthBalance = IERC20(deEthToken).balanceOf(address(this));
                    //transfer deETH to Ethereum
                    _autoBurnWithTransfer(_debridgeId, deEthToken, deEthBalance, ETH_CHAINID, _nativeFixFee);
                }
            }
            //If reward is token (DBR, LINK, deDBT, deLINK, deETH)
            else {
                //If token is deETH
                if(_tokenAddress == deEthToken) {
                    //Create transfer to Ehereum netrowk ETH
                    _autoBurnWithTransfer(_debridgeId, _tokenAddress, amount, _nativeChain, _nativeFixFee);
                }
                //For others tokens
                else {
                    // create swap to weth
                    _swap(_tokenAddress, address(weth), address(this));

                    if(chainId == ETH_CHAINID) {
                        //TODO: send 50% reward to slashing contract
                        weth.withdraw(weth.balanceOf(address(this)));
                        payable(treasury).transfer(address(this).balance);
                    }
                    else
                    {
                        //create swap from Native token to deETH
                        _swap(address(weth), deEthToken, address(this));
                        //transfer deETH to Ethereum
                        uint256 deEthAmount = IERC20(deEthToken).balanceOf(address(this));
                        _autoBurnWithTransfer(_debridgeId, deEthToken, deEthAmount, ETH_CHAINID, _nativeFixFee);
                    }
                }
            }
        }
        //create transfer if different chains
        else {
           _autoBurnWithTransfer(_debridgeId, _tokenAddress, amount, _nativeChain, _nativeFixFee);
        }
    }

    //Used when weth.withdraw
    fallback() external payable {}

    /* ========== PRIVATE FUNCTIONS  ========== */

    /// @dev Create auto burn transfer with data that will call Transfer fee method in the target network
    function _autoBurnWithTransfer(
        bytes32 _debridgeId,
        address _erc20Token,
        uint256 _amount,
        uint256 _nativeChain,
        uint256 _nativeFixFee
    ) private {
        IERC20(_erc20Token).safeApprove(address(debridgeGate), _amount);
        debridgeGate.autoBurn{value: _nativeFixFee}
            (_debridgeId,
            debridgeGateAddresses[_nativeChain], //_receiver,
            _amount,
            _nativeChain, //_chainIdTo,
            treasury, //_fallbackAddress,
            0, //_executionFee,
            abi.encodeWithSelector(DONATEFEES_SELECTOR, _debridgeId, _amount), //_data,
            0, //_deadline,
            "", //_signature,
            false //_useAssetFee
            );
    }

    function _swap(
        address _fromToken,
        address _toToken,
        address _receiver
    ) private {
        IERC20 erc20 = IERC20(_fromToken);
        uint256 _amount = erc20.balanceOf(address(this));
        IUniswapV2Pair uniswapPair =
            IUniswapV2Pair(uniswapFactory.getPair(_toToken, _fromToken));
        erc20.transfer(address(uniswapPair), _amount);

        //TODO: old version check toFirst
        // bool toFirst = _toToken < _fromToken;
        //new implementation
        bool fromFirst = _fromToken == uniswapPair.token0();
        (uint256 reserve0, uint256 reserve1, ) = uniswapPair.getReserves();
        if (fromFirst) {
            uint256 amountOut = getAmountOut(_amount, reserve0, reserve1);
            uniswapPair.swap(0, amountOut, _receiver, "");
        } else {
            uint256 amountOut = getAmountOut(_amount, reserve1, reserve0);
            uniswapPair.swap(amountOut, 0, _receiver, "");
        }
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) private pure returns (uint256 amountOut) {
        require(amountIn > 0, "insuffient amount");
        require(reserveIn > 0 && reserveOut > 0, "insuffient liquidity");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
