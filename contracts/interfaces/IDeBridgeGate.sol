// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IDeBridgeGate {
    /* ========== STRUCTS ========== */

    struct TokenInfo {
        uint256 chainId;
        bytes nativeAddress;
    }

    struct DebridgeInfo {
        uint256 chainId; // native chain id
        uint256 maxAmount; // maximum amount to transfer
        uint256 balance; // total locked assets
        uint256 lockedInStrategies; // total locked assets in strategy (AAVE, Compound, etc)
        address tokenAddress; // asset address on the current chain
        uint16 minReservesBps; // minimal hot reserves in basis points (1/10000)
        bool exist;
    }

    struct DebridgeFeeInfo {
        uint256 collectedFees; // total collected fees
        uint256 withdrawnFees; // fees that already withdrawn
        mapping(uint256 => uint256) getChainFee; // whether the chain for the asset is supported
    }

    struct AggregatorInfo {
        address aggregator; // aggregator address
        bool isValid; // if is still valid
    }

    struct ChainSupportInfo {
        uint256 fixedNativeFee; // transfer fixed fee
        bool isSupported; // whether the chain for the asset is supported
        uint16 transferFeeBps; // transfer fee rate nominated in basis points (1/10000) of transferred amount
    }

    struct DiscountInfo {
        uint16 discountFixBps; // fix discount in BPS
        uint16 discountTransferBps; // transfer % discount in BPS
    }

    /* ========== FUNCTIONS ========== */

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        address _tokenAddress,
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee,
        uint32 _referralCode
    ) external payable;

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
        bytes memory _signatures
    ) external;

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function burn(
        bytes32 _debridgeId,
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _permit,
        bool _useAssetFee,
        uint32 _referralCode
    ) external payable;

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
        bytes memory _signatures
    ) external;

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoSend(
        address _tokenAddress,
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        bool _useAssetFee,
        uint8 _reservedFlag,
        uint32 _referralCode
    ) external payable;

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
        bytes memory _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _reservedFlag,
        bytes memory _nativeSender
    ) external;

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
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        bytes memory _permit,
        bool _useAssetFee,
        uint8 _reservedFlag,
        uint32 _referralCode
    ) external payable;

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
        bytes memory _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _reservedFlag,
        bytes memory _nativeSender
    ) external;

    function flash(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        bytes memory _data
    ) external;

    function getDefiAvaliableReserves(address _tokenAddress) external view returns (uint256);

    /// @dev Request the assets to be used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to request.
    function requestReserves(address _tokenAddress, uint256 _amount) external;

    /// @dev Return the assets that were used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    function returnReserves(address _tokenAddress, uint256 _amount) external;

    /// @dev Withdraw fees.
    /// @param _debridgeId Asset identifier.
    function withdrawFee(bytes32 _debridgeId) external;

    /// @dev Withdraw native fees.
    function withdrawNativeFee() external;

    function getNativeTokenInfo(address currentTokenAddress)
        external view
        returns (uint256 chainId, bytes memory nativeAddress);

    /* ========== EVENTS ========== */

    event Sent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        bytes receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint32 referralCode
    ); // emited once the native tokens are locked to be sent to the other chain

   event AutoSent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        bytes receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint256 claimFee,
        bytes fallbackAddress,
        bytes data,
        uint32 referralCode,
        uint8 reservedFlag,
        address nativeSender
    );

    event Minted(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId); // emited once the wrapped tokens are minted on the current chain

    event AutoMinted(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId,
        uint256 claimFee,
        address fallbackAddress,
        bytes data
    ); // emited once the wrapped tokens are minted on the current chain

    event Burnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        bytes receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint32 referralCode
    ); // emited once the wrapped tokens are sent to the contract

    event AutoBurnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        bytes receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint256 claimFee,
        bytes fallbackAddress,
        bytes data,
        uint32 referralCode,
        uint8 reservedFlag,
        address nativeSender
    ); // emited once the wrapped tokens are sent to the contract

    event Claimed(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId); // emited once the tokens are withdrawn on native chain

    event AutoClaimed(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId,
        uint256 claimFee,
        address fallbackAddress,
        bytes data
    ); // emited once the tokens are withdrawn on native chain

    event PairAdded(
        bytes32 indexed debridgeId,
        address indexed tokenAddress,
        uint256 indexed chainId,
        uint256 maxAmount,
        uint16 minReservesBps
    ); // emited when new asset is supported
    event ChainSupportUpdated(uint256 chainId, bool isSupported); // Emits when the asset is allowed/disallowed to be transferred to the chain.
    event ChainsSupportUpdated(uint256[] chainIds); // emited when the supported assets are updated
    event CallProxyUpdated(uint256 version, address callProxy); // emited when the new call proxy set
    event AutoRequestExecuted(bytes32 submissionId, bool success); // emited when the new call proxy set

    event Blocked(bytes32 submissionId); //Block submission
    event Unblocked(bytes32 submissionId); //UnBlock submission

    event Flash(
        address sender,
        address tokenAddress,
        address receiver,
        uint256 amount,
        uint256 paid
    );

    event CollectedFee(bytes32 debridgeId, uint32 referralCode, uint256 fee);
    event WithdrawnFee(bytes32 debridgeId, uint256 fee);
}
