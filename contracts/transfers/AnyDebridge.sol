// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IAnyDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IFullAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../interfaces/IWrappedAssetFactory.sol";
import "../periphery/WrappedAsset.sol";
import "../periphery/Pausable.sol";
import "./CoreDebridge.sol";

abstract contract AnyDebridge is CoreDebridge, IAnyDebridge {
    struct DebridgeInfo {
        address tokenAddress; // asset address on the current chain
        uint256 chainId; // native chain id
        uint256 maxAmount; // minimal amount to transfer
        uint256 collectedNativeFees; // total collected fees that can be used to buy LINK
        uint256 collectedAssetFees; // total collected fees that can be used to buy LINK
        uint256 balance; // total locked assets
        uint256 minReserves; // minimal hot reserves
        bool exist;
    }

    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(uint256 => ChainSupportInfo) chainSupported; // whether the chain for the asset is supported
    address wrappedAssetAdmin;
    IWrappedAssetFactory wrappedAssetFactory;

    event PairAdded(
        bytes32 indexed debridgeId,
        address indexed tokenAddress,
        uint256 indexed chainId,
        uint256 maxAmount,
        uint256 minReserves
    ); // emited when new asset is supported

    /* EXTERNAL */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ratio.
    /// @param _aggregator Submission aggregator address.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function initialize(
        uint256 _maxAmount,
        uint256 _minReserves,
        address _wrappedAssetAdmin,
        address _aggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IDefiController _defiController,
        IWrappedAssetFactory _wrappedAssetFactory
    ) public payable initializer {
        uint256 cid;
        assembly {
            cid := chainid()
        }
        chainId = cid;
        _addAsset(address(0), chainId, _maxAmount, _minReserves);
        aggregator = _aggregator;
        callProxy = _callProxy;
        wrappedAssetAdmin = _wrappedAssetAdmin;
        _updateSupportedChains(_supportedChainIds, _chainSupportInfo);
        defiController = _defiController;
        wrappedAssetFactory = _wrappedAssetFactory;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        address _tokenAddress,
        uint256 _chainId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo
    ) external payable override whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        _amount = _send(_tokenAddress, debridgeId, _amount, _chainIdTo);
        uint256 nonce = getUserNonce[_receiver];
        bytes32 sentId = getSubmisionId(
            debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        emit Sent(sentId, debridgeId, _amount, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver]++;
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature
    ) external override whenNotPaused() {
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _deadline,
            _signature
        );
        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId = getSubmisionId(
            _debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        emit Burnt(burntId, _debridgeId, _amount, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver]++;
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoSend(
        address _tokenAddress,
        uint256 _chainId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external payable whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        require(_executionFee != 0, "autoSend: fee too low");
        _amount = _send(_tokenAddress, debridgeId, _amount, _chainIdTo);
        require(_amount >= _executionFee, "autoSend: proposed fee too high");
        _amount -= _executionFee;
        uint256 nonce = getUserNonce[_receiver];
        bytes32 sentId = getAutoSubmisionId(
            debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        emit AutoSent(
            sentId,
            debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _executionFee,
            _fallbackAddress,
            _data
        );
        getUserNonce[_receiver]++;
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoBurn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint256 _deadline,
        bytes memory _signature
    ) external whenNotPaused() {
        require(_executionFee != 0, "autoBurn: fee too low");
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _deadline,
            _signature
        );
        require(_amount >= _executionFee, "autoBurn: proposed fee too high");
        _amount -= _executionFee;

        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId = getAutoSubmisionId(
            _debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        emit AutoBurnt(
            burntId,
            _debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _executionFee,
            _fallbackAddress,
            _data
        );
        getUserNonce[_receiver]++;
    }

    /* ADMIN */

    /// @dev Update asset's fees.
    function setWrappedAssetFactory(IWrappedAssetFactory _wrappedAssetFactory)
        external
        onlyAdmin()
    {
        wrappedAssetFactory = _wrappedAssetFactory;
    }

    /// @dev Update asset's fees.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _chainSupportInfo Cahin support info.
    function updateSupportedChains(
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external onlyAdmin() {
        _updateSupportedChains(_supportedChainIds, _chainSupportInfo);
    }

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ration.
    function updateAsset(
        bytes32 _debridgeId,
        uint256 _maxAmount,
        uint256 _minReserves
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.maxAmount = _maxAmount;
        debridge.minReserves = _minReserves;
    }

    /// @dev Withdraw fees.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of tokens to withdraw.
    function withdrawFee(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        bool _nativeFee
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        // require(debridge.chainId == chainId, "withdrawFee: wrong target chain");
        if (_nativeFee) {
            require(
                debridge.collectedNativeFees >= _amount,
                "withdrawFee: not enough fee"
            );
            debridge.collectedNativeFees -= _amount;
            payable(_receiver).transfer(_amount);
        } else {
            require(
                debridge.collectedAssetFees >= _amount,
                "withdrawFee: not enough fee"
            );
            debridge.collectedAssetFees -= _amount;
            if (
                debridge.chainId == chainId &&
                debridge.tokenAddress == address(0)
            ) {
                payable(_receiver).transfer(_amount);
            } else {
                _safeTransfer(
                    IERC20(debridge.tokenAddress),
                    _receiver,
                    _amount
                );
            }
        }
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to request.
    function requestReserves(address _tokenAddress, uint256 _amount)
        external
        onlyDefiController()
    {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        uint256 minReserves = (debridge.balance * debridge.minReserves) /
            DENOMINATOR;
        uint256 balance = getBalance(debridge.tokenAddress);
        require(
            minReserves + _amount > balance,
            "requestReserves: not enough reserves"
        );
        if (debridge.tokenAddress == address(0)) {
            payable(address(defiController)).transfer(_amount);
        } else {
            _safeTransfer(
                IERC20(debridge.tokenAddress),
                address(defiController),
                _amount
            );
        }
    }

    /// @dev Return the assets that were used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    function returnReserves(address _tokenAddress, uint256 _amount)
        external
        payable
        onlyDefiController()
    {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (debridge.tokenAddress != address(0)) {
            _safeTransferFrom(
                IERC20(debridge.tokenAddress),
                address(defiController),
                address(this),
                _amount
            );
        }
    }

    /* INTERNAL */

    /// @dev Add support for the asset.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _chainId Current chain id.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ration.
    function _addAsset(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _maxAmount,
        uint256 _minReserves
    ) internal {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (_chainId == chainId) {
            debridge.tokenAddress = _tokenAddress;
        } else {
            address[] memory minters = new address[](1);
            minters[0] = address(this);
            debridge.tokenAddress = wrappedAssetFactory.deploy(
                "Debridge Wrapped Asset",
                "DBRWA",
                wrappedAssetAdmin,
                minters
            );
        }
        debridge.chainId = _chainId;
        debridge.maxAmount = _maxAmount;
        debridge.minReserves = _minReserves;
        emit PairAdded(
            debridgeId,
            _tokenAddress,
            _chainId,
            _maxAmount,
            _minReserves
        );
    }

    /// @dev Update asset's fees.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _chainSupportInfo Cahin support info.
    function _updateSupportedChains(
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) internal {
        require(
            _supportedChainIds.length == _chainSupportInfo.length,
            "updateSupportedChains: wrong chain support length"
        );
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            chainSupported[_supportedChainIds[i]] = _chainSupportInfo[i];
        }
        chainIds = _supportedChainIds;
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _debridge Asset info.
    /// @param _amount Required amount of tokens.
    function _ensureReserves(DebridgeInfo storage _debridge, uint256 _amount)
        internal
    {
        uint256 minReserves = (_debridge.balance * _debridge.minReserves) /
            DENOMINATOR;
        uint256 balance = getBalance(_debridge.tokenAddress);
        uint256 requestedReserves = minReserves > _amount
            ? minReserves
            : _amount;
        if (requestedReserves > balance) {
            requestedReserves = requestedReserves - balance;
            defiController.claimReserve(
                _debridge.tokenAddress,
                requestedReserves
            );
        }
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _send(
        address _tokenAddress,
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        if (debridge.exist) {
            _addAsset(_tokenAddress, chainId, 0, DENOMINATOR);
        }
        ChainSupportInfo memory chainSupportInfo = chainSupported[_chainIdTo];
        require(chainSupportInfo.isSupported, "send: wrong targed chain");
        require(debridge.chainId == chainId, "send: not native chain");
        require(
            debridge.maxAmount == 0 || _amount <= debridge.maxAmount,
            "send: amount too high"
        );
        if (debridge.tokenAddress == address(0)) {
            require(_amount == msg.value, "send: amount mismatch");
        } else {
            _safeTransferFrom(
                IERC20(debridge.tokenAddress),
                msg.sender,
                address(this),
                _amount
            );
        }
        {
            uint256 assetFee = (_amount * chainSupportInfo.assetFee) /
                DENOMINATOR;
            if (assetFee > 0) {
                require(_amount >= assetFee, "send: amount not cover fees");
                debridge.collectedAssetFees += assetFee;
                _amount -= assetFee;
            }
        }
        {
            uint256 fixedFee = chainSupportInfo.fixedFee;
            if (fixedFee > 0) {
                if (debridge.tokenAddress == address(0)) {
                    require(_amount >= fixedFee, "send: amount not cover fees");
                    _amount -= fixedFee;
                } else {
                    require(
                        msg.value >= fixedFee,
                        "send: amount not cover fees"
                    );
                    // TODO: send the change(msg.value - fixedFee)?
                }
            }
        }
        debridge.balance += _amount;
        return _amount;
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _burn(
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        ChainSupportInfo memory chainSupportInfo = chainSupported[_chainIdTo];
        require(debridge.chainId != chainId, "burn: native asset");
        require(chainSupportInfo.isSupported, "burn: wrong targed chain");
        require(
            debridge.maxAmount == 0 || _amount <= debridge.maxAmount,
            "burn: amount too high"
        );
        IWrappedAsset wrappedAsset = IWrappedAsset(debridge.tokenAddress);
        if (_signature.length > 0) {
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
            wrappedAsset.permit(
                msg.sender,
                address(this),
                _amount,
                _deadline,
                v,
                r,
                s
            );
        }
        wrappedAsset.transferFrom(msg.sender, address(this), _amount);
        {
            uint256 assetFee = (_amount * chainSupportInfo.assetFee) /
                DENOMINATOR;
            if (assetFee > 0) {
                require(_amount >= assetFee, "send: amount not cover fees");
                debridge.collectedAssetFees += assetFee;
                _amount -= assetFee;
            }
        }
        {
            uint256 fixedFee = chainSupportInfo.fixedFee;
            if (fixedFee > 0) {
                require(msg.value >= fixedFee, "send: amount not cover fees");
                // TODO: send the change(msg.value - fixedFee)?
            }
        }
        wrappedAsset.burn(_amount);
        return _amount;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _submissionId Submission identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function _mint(
        bytes32 _submissionId,
        address _tokenAddress,
        uint256 _chainId,
        address _receiver,
        uint256 _amount,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) internal {
        require(!isSubmissionUsed[_submissionId], "mint: already used");
        require(_chainId != chainId, "mint: is native chain");
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (debridge.exist) {
            _addAsset(_tokenAddress, _chainId, 0, DENOMINATOR);
        }
        isSubmissionUsed[_submissionId] = true;
        if (_executionFee > 0) {
            IWrappedAsset(debridge.tokenAddress).mint(
                msg.sender,
                _executionFee
            );
            IWrappedAsset(debridge.tokenAddress).mint(callProxy, _amount);
            bool status = ICallProxy(callProxy).callERC20(
                debridge.tokenAddress,
                _fallbackAddress,
                _receiver,
                _data
            );
            emit AutoRequestExecuted(_submissionId, status);
        } else {
            IWrappedAsset(debridge.tokenAddress).mint(_receiver, _amount);
        }
        emit Minted(_submissionId, _amount, _receiver, debridgeId);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function _claim(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId == chainId, "claim: wrong target chain");
        require(!isSubmissionUsed[_submissionId], "claim: already used");
        isSubmissionUsed[_submissionId] = true;
        debridge.balance -= _amount;
        _ensureReserves(debridge, _amount);
        if (debridge.tokenAddress == address(0)) {
            if (_executionFee > 0) {
                payable(msg.sender).transfer(_executionFee);
                bool status = ICallProxy(callProxy).call{value: _amount}(
                    _fallbackAddress,
                    _receiver,
                    _data
                );
                emit AutoRequestExecuted(_submissionId, status);
            } else {
                payable(_receiver).transfer(_amount);
            }
        } else {
            if (_executionFee > 0) {
                _safeTransfer(
                    IERC20(debridge.tokenAddress),
                    msg.sender,
                    _executionFee
                );
                _safeTransfer(
                    IERC20(debridge.tokenAddress),
                    callProxy,
                    _amount
                );
                bool status = ICallProxy(callProxy).callERC20(
                    debridge.tokenAddress,
                    _fallbackAddress,
                    _receiver,
                    _data
                );
                emit AutoRequestExecuted(_submissionId, status);
            } else {
                _safeTransfer(
                    IERC20(debridge.tokenAddress),
                    _receiver,
                    _amount
                );
            }
        }
        emit Claimed(_submissionId, _amount, _receiver, _debridgeId);
    }

    /* VIEW */

    /// @dev Check if transfer to chain is supported.
    function getSupportedChainIds() public view returns (uint256[] memory) {
        return chainIds;
    }
    // TODO: set deployer
}
