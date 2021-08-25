// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IWETH.sol";

contract FeeProxy is Initializable, AccessControlUpgradeable, PausableUpgradeable, IFeeProxy {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    uint256 public constant BPS_DENOMINATOR = 10000;
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE"); // role allowed to withdraw fee

    IWETH public weth; // wrapped native token contract

    IDeBridgeGate public debridgeGate;
    IUniswapV2Factory public uniswapFactory;

    mapping(uint256 => bytes) public feeProxyAddresses; //Addresses of fee proxy addresses in each chain
    mapping(uint256 => bytes) public treasuryAddresses;

    uint256 public constant ETH_CHAINID = 1; //Ethereum chainId
    address public deEthToken; //address of deETH token

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error WorkerBadRole();
    error EmptyFeeProxyAddress(uint256 chainId);
    error EmptyTreasuryAddress(uint256 chainId);

    error InsuffientAmountIn();
    error InsuffientLiquidity();

    error CantConvertAddress();
    error WrongArgument();

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

    function initialize(IUniswapV2Factory _uniswapFactory, IWETH _weth) public initializer {
        uniswapFactory = _uniswapFactory;
        weth = _weth;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== FUNCTIONS  ========== */

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin whenPaused {
        _unpause();
    }

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

    function setFeeProxyAddress(uint256 _chainId, bytes memory _address) external onlyAdmin {
        feeProxyAddresses[_chainId] = _address;
    }

    /// @dev Transfer tokens to native chain and then create swap to deETH
    /// and transfer reward to Ethereum network.
    function withdrawFee(address _tokenAddress) external payable override onlyWorker whenNotPaused {
        (uint256 nativeChain, bytes memory nativeAddress) = debridgeGate.getNativeTokenInfo(
            _tokenAddress
        );
        bytes32 debridgeId = getbDebridgeId(nativeChain, nativeAddress);

        uint256 chainId = getChainId();
        if (feeProxyAddresses[nativeChain].length == 0) revert EmptyFeeProxyAddress(nativeChain);
        if (treasuryAddresses[chainId].length == 0) revert EmptyTreasuryAddress(chainId);

        address currentTreaseryAddress = toAddress(treasuryAddresses[chainId]);

        debridgeGate.withdrawFee(debridgeId);
        uint256 amount = IERC20(_tokenAddress).balanceOf(address(this));
        // original token chain is the same as contract chain
        if (chainId == nativeChain) {
            //Reward is token (DBR, LINK, WETH, deDBT, deLINK, deETH)
            //If token is deETH
            if (_tokenAddress == deEthToken) {
                //Create transfer to Ehereum netrowk ETH
                _burnTransfer(debridgeId, _tokenAddress, amount, nativeChain, msg.value);
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
                    _burnTransfer(debridgeId, deEthToken, deEthAmount, ETH_CHAINID, msg.value);
                }
            }
        }
        //create transfer if different chains
        else {
            _burnTransfer(debridgeId, _tokenAddress, amount, nativeChain, msg.value);
        }
    }

    /// @dev Swap native tokens to deETH and then transfer reward to Ethereum network.
    function withdrawNativeFee() external payable override onlyWorker whenNotPaused {
        uint256 chainId = getChainId();
        //DebridgeId of weth in ethereum network
        //TODO: can be set as contstant
        (, bytes memory nativeAddress) = debridgeGate.getNativeTokenInfo(deEthToken);
        bytes32 wethEthNetworkDebridgeId = getbDebridgeId(ETH_CHAINID, nativeAddress);
        if (feeProxyAddresses[chainId].length == 0) revert EmptyFeeProxyAddress(chainId);

        // TODO: treasuryAddresses can keep only for ETH network
        // if (treasuryAddresses[chainId].length == 0) revert EmptyTreasuryAddress(chainId);

        // address currentTreaseryAddress = toAddress(treasuryAddresses[chainId]);
        debridgeGate.withdrawFee(getDebridgeId(chainId, address(0)));
        uint256 amount = address(this).balance - msg.value;

        //reward is native token (ETH/BNB/HT)
        //If we are in Ethereum chain
        if (chainId == ETH_CHAINID) {
            if (treasuryAddresses[chainId].length == 0) revert EmptyTreasuryAddress(chainId);
            address currentTreaseryAddress = toAddress(treasuryAddresses[chainId]);
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
            _burnTransfer(
                wethEthNetworkDebridgeId,
                deEthToken,
                deEthBalance,
                ETH_CHAINID,
                msg.value
            );
        }
    }

    // accept ETH
    receive() external payable {}

    /* ========== VIEW FUNCTIONS  ========== */

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getbDebridgeId(uint256 _chainId, bytes memory _tokenAddress)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    function getDebridgeId(uint256 _chainId, address _tokenAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    /* ========== PRIVATE FUNCTIONS  ========== */

    /// @dev Create auto burn transfer with data that will call Transfer fee method in the target network
    function _burnTransfer(
        bytes32 _debridgeId,
        address _erc20Token,
        uint256 _amount,
        uint256 _nativeChain,
        uint256 _nativeFixFee
    ) private {
        IERC20(_erc20Token).safeApprove(address(debridgeGate), _amount);
        debridgeGate.burn{value: _nativeFixFee}(
            _debridgeId,
            feeProxyAddresses[_nativeChain], //_receiver,
            _amount,
            _nativeChain, //_chainIdTo,
            "", //_deadline + _signature,
            false, //_useAssetFee,
            0 //_referralCode
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
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function toAddress(bytes memory _bytes) internal pure returns (address result) {
        if (_bytes.length != 20) revert CantConvertAddress();
        // if address was packed using abi.encodedPacked then it's needed
        // to pad left to get the correct bytes back div by 0x1.... is like doing >> 96
        assembly {
            result := div(mload(add(_bytes, 0x20)), 0x1000000000000000000000000)
        }
    }

    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }
}
