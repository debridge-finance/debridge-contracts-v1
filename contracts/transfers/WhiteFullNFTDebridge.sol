// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWhiteNFTDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWhiteFullNFTDebridge.sol";
import "../interfaces/IWhiteFullAggregator.sol";
import "../periphery/WrappedNFT.sol";
import "./WhiteNFTDebridge.sol";

contract WhiteFullNFTDebridge is WhiteNFTDebridge, IWhiteFullNFTDebridge {
    using SafeERC20 for IERC20;

    IFeeProxy public feeProxy; // proxy to convert the collected fees into Link's
    /// @dev Constructor that initializes the most important configurations.
    /// @param _aggregator Submission aggregator address.
    function initialize(
        address _aggregator,
        address _callProxy,
        address _feeToken,
        IFeeProxy _feeProxy
    ) public initializer {
        super._initialize(
            _aggregator,
            _callProxy,
            _feeToken
        );
        feeProxy = _feeProxy;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    function mint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _tokenId,
        uint256 _nonce
    ) external override whenNotPaused() {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _tokenId,
                _receiver,
                _nonce
            );
        require(
            IWhiteFullAggregator(aggregator).isSubmissionConfirmed(
                submissionId
            ),
            "mint: not confirmed"
        );
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _tokenId
            );
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _tokenId,
        uint256 _nonce,
        uint8 _aggregatorVersion
    ) external override {
        bytes32 submissionId =
            getSubmisionId(
                _debridgeId,
                _chainIdFrom,
                chainId,
                _tokenId,
                _receiver,
                _nonce
            );
        AggregatorInfo memory aggregatorInfo =
            getOldAggregator[_aggregatorVersion];
        require(
            aggregatorInfo.isValid,
            "mintWithOldAggregator: invalidAggregator"
        );
        require(
            IWhiteFullAggregator(aggregatorInfo.aggregator)
                .isSubmissionConfirmed(submissionId),
            "mint: not confirmed"
        );
        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _tokenId
        );
    }

    /* ADMIN */

    /// @dev Fund aggregator.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Submission aggregator address.
    function fundAggregator(bytes32 _debridgeId, uint256 _amount)
        external
        override
        onlyAdmin()
    {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(
            debridge.collectedFees >= _amount,
            "fundAggregator: not enough fee"
        );
        debridge.collectedFees -= _amount;
        IERC20(feeToken).transfer(address(feeProxy), _amount);
        feeProxy.swapToLink(feeToken, _amount, aggregator);
    }

    /// @dev Set fee converter proxy.
    /// @param _feeProxy Fee proxy address.
    function setFeeProxy(IFeeProxy _feeProxy) external onlyAdmin() {
        feeProxy = _feeProxy;
    }

    /// @dev Set wrapped native asset address.
    /// @param _feeToken Weth address.
    function setFeeToken(address _feeToken) external onlyAdmin() {
        feeToken = _feeToken;
    }
}