// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ILightVerifier.sol";
import "../interfaces/IDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IFullDebridge.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IFullAggregator.sol";
import "../periphery/WrappedAsset.sol";
import "./Debridge.sol";

contract FullDebridge is Debridge, IFullDebridge {
    using SafeERC20 for IERC20;

    IFeeProxy public feeProxy; // proxy to convert the collected fees into Link's
    IWETH public weth; // wrapped native token contract
    address treasury;

    event Blocked(
        bytes32 submissionId
    );

    event Unblocked(
        bytes32 submissionId
    );

    /// @dev Constructor that initializes the most important configurations.
    /// @param _ligthAggregator Aggregator address to verify signatures
    /// @param _fullAggregator Aggregator address to verify by oracles confirmations
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    /// @param _treasury Address to collect a fee
    function initialize(
        uint256 _excessConfirmations,
        address _ligthAggregator,
        address _fullAggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IWETH _weth,
        IFeeProxy _feeProxy,
        IDefiController _defiController,
        address _treasury
    ) public payable initializer {
        super._initialize(
            _excessConfirmations,
            _ligthAggregator,
            _fullAggregator,
            _callProxy,
            _supportedChainIds,
            _chainSupportInfo,
            _defiController
        );
        weth = _weth;
        feeProxy = _feeProxy;
        treasury = _treasury;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external whenNotPaused() {
        bytes32 submissionId = getAutoSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );

        _checkAndDeployAsset(_debridgeId, _signatures.length > 0 
                                           ? ligthAggregator 
                                           : fullAggregator);

        _checkConfirmations(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external whenNotPaused() {
        bytes32 submissionId = getAutoSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );

        _checkAndDeployAsset(_debridgeId, _signatures.length > 0 
                                        ? getOldLightAggregator[_aggregatorVersion].aggregator
                                        : getOldFullAggregator[_aggregatorVersion].aggregator);

        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures, 
            _aggregatorVersion);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    function mint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures
    ) external override whenNotPaused() {
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        
        _checkAndDeployAsset(_debridgeId, _signatures.length > 0 
                                         ? ligthAggregator 
                                         : fullAggregator);

        _checkConfirmations(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            ""
        );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        uint8 _aggregatorVersion
    ) external override whenNotPaused(){
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        
        _checkAndDeployAsset(_debridgeId, _signatures.length > 0 
                                        ? getOldLightAggregator[_aggregatorVersion].aggregator
                                        : getOldFullAggregator[_aggregatorVersion].aggregator);
            

        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures,
            _aggregatorVersion);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            ""
        );
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function autoClaim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external whenNotPaused() {
        bytes32 submissionId = getAutoSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );

        _checkConfirmations(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoClaimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
    ) external whenNotPaused() {
        bytes32 submissionId = getAutoSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        
        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures, 
            _aggregatorVersion);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.

    function claim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures
    ) external override whenNotPaused() {
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        
        _checkConfirmations(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            ""
        );
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _aggregatorVersion Aggregator version.
    function claimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        uint8 _aggregatorVersion
    ) external override whenNotPaused(){
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        
        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures, 
            _aggregatorVersion);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            ""
        );
    }


    /* ADMIN */

    /// @dev Fund treasury.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Submission aggregator address.
    function fundTreasury(bytes32 _debridgeId, uint256 _amount)
        external
    {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(
            debridge.collectedFees >= _amount,
            "fundTreasury: not enough fee"
        );
        debridge.collectedFees -= _amount;
        if (debridge.tokenAddress == address(0)) {
            weth.deposit{value: _amount}();
            weth.transfer(address(feeProxy), _amount);
            feeProxy.swapToLink(address(weth), treasury);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(
                address(feeProxy),
                _amount
            );
            feeProxy.swapToLink(debridge.tokenAddress, treasury);
        }
    }

    /// @dev Set fee converter proxy.
    /// @param _feeProxy Fee proxy address.
    function setFeeProxy(IFeeProxy _feeProxy) external onlyAdmin() {
        feeProxy = _feeProxy;
    }

    /// @dev Set wrapped native asset address.
    /// @param _weth Weth address.
    function setWeth(IWETH _weth) external onlyAdmin() {
        weth = _weth;
    }


    function blockSubmission(
        bytes32[] memory _submissionIds
    ) external onlyAdmin() {
        for (uint256 i = 0; i < _submissionIds.length; i++) {
           isBlockedSubmission[_submissionIds[i]] = true;
           emit Blocked(_submissionIds[i]);
        }
    }

    function unBlockSubmission(
        bytes32[] memory _submissionIds
    ) external onlyAdmin() {
        for (uint256 i = 0; i < _submissionIds.length; i++) {
           isBlockedSubmission[_submissionIds[i]] = false;
           emit Unblocked(_submissionIds[i]);
        }
    }

     /* internal */

     
    function _checkAndDeployAsset(bytes32 debridgeId, address aggregatorAddress) internal 
    {
        if(!getDebridge[debridgeId].exist)
        {
            (address wrappedAssetAddress, uint256 nativeChainId) = IFullAggregator(aggregatorAddress).deployAsset(debridgeId);
            require(
                wrappedAssetAddress != address(0),
                "mint: wrapped asset not exist"
            );
            _addAsset(debridgeId, wrappedAssetAddress, nativeChainId);
        }
    }

     function _checkConfirmations(bytes32 _submissionId, bytes32 _debridgeId, 
                                 uint256 _amount, bytes[] memory _signatures) 
        internal{
        (uint256 confirmations, bool confirmed) = 
                _signatures.length > 0 
                ? ILightVerifier(ligthAggregator).submit(_submissionId, _signatures)
                : IFullAggregator(fullAggregator).getSubmissionConfirmations(_submissionId);
        require(confirmed, "not confirmed ");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "amount not confirmed"
            );
        }
    }

    function _checkConfirmationsOldAggregator(bytes32 _submissionId, bytes32 _debridgeId, 
                                              uint256 _amount, bytes[] memory _signatures,
                                              uint8 _aggregatorVersion) 
        internal{

        AggregatorInfo memory aggregatorInfo 
                = _signatures.length > 0 
                ? getOldLightAggregator[_aggregatorVersion]
                : getOldFullAggregator[_aggregatorVersion];
        require(
            aggregatorInfo.isValid,
            "invalidAggregator"
        );
        (uint256 confirmations, bool confirmed) = 
                _signatures.length > 0 
                ? ILightVerifier(aggregatorInfo.aggregator).submit(_submissionId, _signatures)
                : IFullAggregator(aggregatorInfo.aggregator).getSubmissionConfirmations(_submissionId);
        require(confirmed, "not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(
                confirmations >= excessConfirmations,
                "amount not confirmed"
            );
        }
    }
}
