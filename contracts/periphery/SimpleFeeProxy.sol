// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IDeBridgeGate.sol";

/// @dev Helper to withdraw fees from DeBridgeGate and transfer them to a treasury.
contract SimpleFeeProxy is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */
    /// @dev DeBridgeGate address
    IDeBridgeGate public debridgeGate;
    /// @dev Treasury address
    address public treasury;

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error EmptyTreasuryAddress();
    error EthTransferFailed();

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize(IDeBridgeGate _debridgeGate, address _treasury) public initializer {
        debridgeGate = _debridgeGate;
        treasury = _treasury;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== FUNCTIONS  ========== */

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function setDebridgeGate(IDeBridgeGate _debridgeGate) external onlyAdmin {
        debridgeGate = _debridgeGate;
    }

    function setTreasury(address _treasury) external onlyAdmin {
        treasury = _treasury;
    }

    /// @dev Transfer collected fees for a token to the treasury.
    /// @param _tokenAddress Address of a deToken on a current chain.
    function withdrawFee(address _tokenAddress) external whenNotPaused {
        if (treasury == address(0)) revert EmptyTreasuryAddress();

        (uint256 nativeChainId, bytes memory nativeAddress) = debridgeGate.getNativeInfo(
            _tokenAddress
        );
        bytes32 debridgeId = getbDebridgeId(nativeChainId, nativeAddress);
        debridgeGate.withdrawFee(debridgeId);

        uint256 amount = IERC20Upgradeable(_tokenAddress).balanceOf(address(this));
        IERC20Upgradeable(_tokenAddress).safeTransfer(treasury, amount);
    }

    /// @dev Transfer collected fees for a native token to the treasury.
    function withdrawNativeFee() external  whenNotPaused {
        if (treasury == address(0)) revert EmptyTreasuryAddress();

        bytes32 debridgeId = getDebridgeId(getChainId(), address(0));
        debridgeGate.withdrawFee(debridgeId);

        uint256 amount = address(this).balance;
         _safeTransferETH(treasury, amount);
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

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, address _tokenAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    /// @dev Get current chain id
    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }

    /* ========== PRIVATE FUNCTIONS  ========== */

    /// @dev transfer ETH to an address, revert if it fails.
    /// @param to recipient of the transfer
    /// @param value the amount to send
    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        if (!success) revert EthTransferFailed();
    }

    // ============ Version Control ============
    /// @dev Get this contract's version
    function version() external pure returns (uint256) {
        return 400; // 4.0.0
    }
}
