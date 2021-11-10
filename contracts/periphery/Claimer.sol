// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IDeBridgeGate.sol";

contract Claimer is
    Initializable,
    AccessControlUpgradeable
{
    /* ========== STATE VARIABLES ========== */

    IDeBridgeGate public deBridgeGate; // wrapped native token contract

    /* ========== ERRORS ========== */

    error AdminBadRole();

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== Struct ========== */

    struct ClaimInfo {
        bytes32 debridgeId;
        uint256 amount;
        uint256 chainIdFrom;
        address receiver;
        uint256 nonce;
        bytes signatures;
        bytes autoParams;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize(
        IDeBridgeGate _deBridgeGate
    ) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        deBridgeGate = _deBridgeGate;
    }

    function batchClaim(
        ClaimInfo[] calldata _claims
    ) external  {
        uint256 claimsCount = _claims.length;
        for (uint256 i = 0; i < claimsCount; i++) {
            ClaimInfo memory claim = _claims[i];
            try deBridgeGate.claim(
                    claim.debridgeId,
                    claim.amount,
                    claim.chainIdFrom,
                    claim.receiver,
                    claim.nonce,
                    claim.signatures,
                    claim.autoParams)
            { }
            catch {}
        }
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
