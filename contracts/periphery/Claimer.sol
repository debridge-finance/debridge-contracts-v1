// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../transfers/DeBridgeGate.sol";

contract Claimer is
    Initializable,
    AccessControlUpgradeable
{
    /* ========== STATE VARIABLES ========== */

    DeBridgeGate public deBridgeGate; // debridge gate address

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

    struct AssetDeployInfo {
        bytes nativeTokenAddress;
        uint256 nativeChainId;
        string name;
        string symbol;
        uint8 decimals;
        bytes signatures;
    }

    /* ========== EVENTS ========== */

    event BatchError(
        uint256 index
    );


    /* ========== CONSTRUCTOR  ========== */

    function initialize(
        DeBridgeGate _deBridgeGate
    ) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        deBridgeGate = _deBridgeGate;
    }

    function batchClaim(
        ClaimInfo[] calldata _claims
    ) external {
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
            catch {
                emit BatchError(i);
            }
        }
    }

    function batchAssetsDeploy(
        AssetDeployInfo[] calldata _deploys
    ) external {
        uint256 count = _deploys.length;
        for (uint256 i = 0; i < count; i++) {
            AssetDeployInfo memory deploy = _deploys[i];
            try deBridgeGate.deployNewAsset(
                deploy.nativeTokenAddress,
                deploy.nativeChainId,
                deploy.name,
                deploy.symbol,
                deploy.decimals,
                deploy.signatures)
            { }
            catch {
                emit BatchError(i);
            }
        }
    }


    /* VIEW */

    function isSubmissionsUsed(
        bytes32[] calldata _submissionIds
    ) external view returns (bool[] memory result) {
        uint256 count = _submissionIds.length;
        result = new bool[](count);
        for (uint256 i = 0; i < count; i++) {
           result[i] = deBridgeGate.isSubmissionUsed(_submissionIds[i]);
        }
    }

    function isDebridgesExists(
        bytes32[] calldata _debridgeIds
    ) external view returns (bool[] memory result) {
        uint256 count = _debridgeIds.length;
        result = new bool[](count);
        for (uint256 i = 0; i < count; i++) {
            (
                , //uint256 chainId,
                , //uint256 maxAmount,
                , //uint256 balance,
                , //uint256 lockedInStrategies,
                , //address tokenAddress,
                , //uint16 minReservesBps,
                bool exist
            ) = deBridgeGate.getDebridge(_debridgeIds[i]);
            result[i] = exist;
        }
    }

    /* ========== ADMIN ========== */

    function withdrawFee(address[] memory _tokenAddresses) external onlyAdmin {
        uint256 lenght =_tokenAddresses.length;
        for (uint i = 0; i < lenght; i ++) {
            IERC20(_tokenAddresses[i]).transfer(
                msg.sender,
                IERC20(_tokenAddresses[i]).balanceOf(address(this))
            );
        }
    }

    function withdrawSingleFee(address  _tokenAddresses) external onlyAdmin {
        IERC20(_tokenAddresses).transfer(
            msg.sender,
            IERC20(_tokenAddresses).balanceOf(address(this))
        );
    }

    function setDeBridgeGate(DeBridgeGate _deBridgeGate) external onlyAdmin {
        deBridgeGate = _deBridgeGate;
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 110; // 1.1.0
    }
}
