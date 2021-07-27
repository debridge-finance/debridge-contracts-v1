// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IDeBridgeGate {

    /* ========== STRUCTS ========== */

    struct DebridgeInfo {
        address tokenAddress; // asset address on the current chain
        uint256 chainId; // native chain id
        uint256 maxAmount; // minimal amount to transfer
        uint256 collectedFees; // total collected fees that can be used to buy LINK
        uint256 balance; // total locked assets
        uint256 minReservesBPS; // minimal hot reserves in BPS
        mapping(uint256 => uint256) getChainFee; // whether the chain for the asset is supported
        bool exist;
    }

    struct AggregatorInfo {
        address aggregator; // aggregator address
        bool isValid; // if is still valid
    }

    struct ChainSupportInfo {
        bool isSupported; // whether the chain for the asset is supported
        uint256 fixedNativeFee; // transfer fixed fee
        uint256 transferFeeBPS; // transfer fee rate (in % of transferred amount)
    }

    /* ========== FUNCTIONS ========== */

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee
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
        bytes[] calldata _signatures
    ) external;

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
        bytes memory _signature,
        bool _useAssetFee
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
        bytes[] calldata _signatures
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
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        bool _useAssetFee
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
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
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
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint256 _deadline,
        bytes memory _signature,
        bool _useAssetFee
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
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external;

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
    ) external;

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
    ) external;

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
    ) external;

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
    ) external;

    function flash(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        bytes memory _data
    ) external;

    /* ========== EVENTS ========== */

    event Sent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
    ); // emited once the native tokens are locked to be sent to the other chain
    event AutoSent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint256 claimFee,
        address fallbackAddress,
        bytes data
    ); // emited once the native tokens are locked to be sent to the other chain
    event Minted(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId
    ); // emited once the wrapped tokens are minted on the current chain
    event Burnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
    ); // emited once the wrapped tokens are sent to the contract
    event AutoBurnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint256 claimFee,
        address fallbackAddress,
        bytes data
    ); // emited once the wrapped tokens are sent to the contract
    event Claimed(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId
    ); // emited once the tokens are withdrawn on native chain
    event PairAdded(
        bytes32 indexed debridgeId,
        address indexed tokenAddress,
        uint256 indexed chainId,
        uint256 maxAmount,
        uint256 minReserves
    ); // emited when new asset is supported
    event ChainSupportAdded(
        bytes32 indexed debridgeId,
        uint256 indexed chainId
    ); // emited when the asset is allowed to be spent on other chains
    event ChainSupportRemoved(
        bytes32 indexed debridgeId,
        uint256 indexed chainId
    ); // emited when the asset is disallowed to be spent on other chains
    event ChainsSupportUpdated(uint256[] chainIds); // emited when the supported assets are updated
    event CallProxyUpdated(address callProxy); // emited when the new call proxy set
    event AutoRequestExecuted(bytes32 submissionId, bool success); // emited when the new call proxy set
        
    event Blocked(bytes32 submissionId); //Block submission
    event Unblocked(bytes32 submissionId); //UnBlock submission

    event Flash(address sender, address tokenAddress,  address receiver, uint256 amount, uint256 paid);
}
