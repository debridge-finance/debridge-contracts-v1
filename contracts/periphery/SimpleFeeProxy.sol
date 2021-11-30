// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IDeBridgeGate.sol";

contract SimpleFeeProxy is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IDeBridgeGate public debridgeGate;

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

    /// @dev Transfer tokens to native chain and then create swap to deETH
    /// and transfer reward to Ethereum network.
    function withdrawFee(address _tokenAddress) external whenNotPaused {
        if (treasury == address(0)) revert EmptyTreasuryAddress();

        (uint256 nativeChainId, bytes memory nativeAddress) = debridgeGate.getNativeTokenInfo(
            _tokenAddress
        );
        bytes32 debridgeId = getbDebridgeId(nativeChainId, nativeAddress);
        debridgeGate.withdrawFee(debridgeId);

        uint256 amount = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).safeTransfer(treasury, amount);
    }

    /// @dev Swap native tokens to deETH and then transfer reward to Ethereum network.
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

    function getDebridgeId(uint256 _chainId, address _tokenAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }

    /* ========== PRIVATE FUNCTIONS  ========== */

    /*
    * @dev transfer ETH to an address, revert if it fails.
    * @param to recipient of the transfer
    * @param value the amount to send
    */
    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        if (!success) revert EthTransferFailed();
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 102; // 1.0.2
    }
}
