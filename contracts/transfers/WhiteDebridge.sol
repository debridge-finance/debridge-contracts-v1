// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWhiteDebridge.sol";
import "../periphery/WrappedAsset.sol";

contract WhiteDebridge is AccessControl, IWhiteDebridge {
    using SafeERC20 for IERC20;

    struct DebridgeInfo {
        address tokenAddress; // asset address on the current chain
        uint256 chainId; // native chain id
        uint256 minAmount; // minimal amount to transfer
        uint256 transferFee; // transfer fee rate
        mapping(uint256 => bool) isSupported; // wheter the chain for the asset is supported
    }

    uint256 public constant DENOMINATOR = 1e18;
    bytes32 public constant AGGREGATOR_ROLE = keccak256("AGGREGATOR_ROLE");
    uint256 public chainId;
    uint256 public collectedFees;
    uint256 public nonce;
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token

    event Sent(
        uint256 nonce,
        uint256 amount,
        address receiver,
        bytes32 debridgeId,
        uint256 chainIdTo
    );
    event Minted(uint256 amount, address receiver, bytes32 debridgeId);
    event Burnt(
        uint256 nonce,
        uint256 amount,
        address receiver,
        bytes32 debridgeId,
        uint256 chainIdTo
    );
    event Claimed(uint256 amount, address receiver, bytes32 debridgeId);

    modifier onlyAggregator {
        require(
            hasRole(AGGREGATOR_ROLE, msg.sender),
            "onlyAggregator: bad role"
        );
        _;
    }
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    constructor(
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256[] memory _supportedChainIds
    ) {
        chainId = _chainId;
        bytes32 debridgeId = keccak256(abi.encodePacked(_chainId, address(0)));
        _addAsset(
            debridgeId,
            address(0),
            chainId,
            _minAmount,
            _transferFee,
            _supportedChainIds
        );
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(AGGREGATOR_ROLE, msg.sender);
    }

    function send(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo
    ) external payable override {
        bytes32 debridgeId =
            keccak256(abi.encodePacked(chainId, _tokenAddress));
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        require(
            debridge.isSupported[_chainIdTo],
            "send: wrong targed target chain"
        );
        require(
            debridge.isSupported[chainId],
            "send: wrong targed target chain"
        );
        require(_amount > debridge.minAmount, "send: amount too low");
        if (_tokenAddress == address(0)) {
            require(_amount == msg.value, "send: amount mismatch");
        } else {
            IERC20(_tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
        }
        uint256 transferFee = (_amount * debridge.transferFee) / DENOMINATOR;
        if (transferFee > 0) {
            collectedFees += transferFee;
            _amount -= transferFee;
        }
        emit Sent(nonce, _amount, _receiver, debridgeId, _chainIdTo);
        nonce++;
    }

    function claim(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) external override onlyAggregator() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId == chainId, "send: wrong targed target chain");
        if (debridge.tokenAddress == address(0)) {
            payable(_receiver).transfer(_amount);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(_receiver, _amount);
        }
        uint256 transferFee = (_amount * debridge.transferFee) / DENOMINATOR;
        if (transferFee > 0) {
            collectedFees += transferFee;
            _amount -= transferFee;
        }
        emit Claimed(_amount, _receiver, _debridgeId);
    }

    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) external override {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId != chainId, "burn: wrong chainId");
        require(_amount > debridge.minAmount, "burn: amount too low");
        IWrappedAsset wrappedAsset = IWrappedAsset(debridge.tokenAddress);
        wrappedAsset.transferFrom(msg.sender, address(this), _amount);
        uint256 transferFee = (_amount * debridge.transferFee) / DENOMINATOR;
        if (transferFee > 0) {
            collectedFees += transferFee;
            _amount -= transferFee;
        }
        emit Burnt(nonce, _amount, _receiver, _debridgeId, debridge.chainId);
        nonce++;
    }

    function mint(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) external override onlyAggregator() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        IWrappedAsset(debridge.tokenAddress).mint(_receiver, _amount);
        uint256 transferFee = (_amount * debridge.transferFee) / DENOMINATOR;
        if (transferFee > 0) {
            collectedFees += transferFee;
            _amount -= transferFee;
        }
        emit Minted(_amount, _receiver, _debridgeId);
    }

    function addNativelAsset(
        address _tokenAddress,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256[] memory _supportedChainIds
    ) external override onlyAdmin() {
        bytes32 debridgeId =
            keccak256(abi.encodePacked(chainId, _tokenAddress));
        _addAsset(
            debridgeId,
            _tokenAddress,
            chainId,
            _minAmount,
            _transferFee,
            _supportedChainIds
        );
    }

    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external override onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.isSupported[_chainId] = _isSupported;
    }

    function addExternalAsset(
        bytes32 _debridgeId,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256[] memory _supportedChainIds,
        string memory _name,
        string memory _symbol
    ) external override onlyAdmin() {
        address tokenAddress = address(new WrappedAsset(_name, _symbol));
        _addAsset(
            _debridgeId,
            tokenAddress,
            _chainId,
            _minAmount,
            _transferFee,
            _supportedChainIds
        );
    }

    function addAggregator(address _aggregator) external onlyAdmin() {
        grantRole(AGGREGATOR_ROLE, _aggregator);
    }

    function removeAggregator(address _aggregator) external onlyAdmin() {
        revokeRole(AGGREGATOR_ROLE, _aggregator);
    }

    function _addAsset(
        bytes32 _debridgeId,
        address _tokenAddress,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256[] memory _supportedChainIds
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _chainId;
        debridge.minAmount = _minAmount;
        debridge.transferFee = _transferFee;
        debridge.isSupported[chainId] = true;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            debridge.isSupported[_supportedChainIds[i]] = true;
        }
    }
}
