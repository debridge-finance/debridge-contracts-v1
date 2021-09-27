// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../interfaces/IDeTokenDeployer.sol";
import "../periphery/DeToken.sol";
import "../periphery/DeTokenProxy.sol";

contract DeTokenDeployer is
    Initializable,
    AccessControlUpgradeable,
    IDeTokenDeployer
{

    /* ========== STATE VARIABLES ========== */

    // address of deToken implementation
    address public tokenImplementation;
    // admin for any deployed deToken
    address public deTokenAdmin;
    // Debridge gate address
    address public debridgeAddress;
    // debridge id => deToken address
    mapping(bytes32 => address) public getDeployedAssetAddress;


    /* ========== ERRORS ========== */

    error WrongArgument();
    error DeployedAlready();

    error AdminBadRole();
    error DeBridgeGateBadRole();


    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    modifier onlyDeBridgeGate() {
        if (msg.sender != debridgeAddress) revert DeBridgeGateBadRole();
        _;
    }


    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    function initialize(
        address _tokenImplementation,
        address _deTokenAdmin,
        address _debridgeAddress
    ) public initializer {
        tokenImplementation = _tokenImplementation;
        deTokenAdmin = _deTokenAdmin;
        debridgeAddress = _debridgeAddress;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deployAsset(
        bytes32 _debridgeId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals)
        external
        override
        onlyDeBridgeGate
        returns (address deTokenAddress)
    {
        if (getDeployedAssetAddress[_debridgeId] != address(0)) revert DeployedAlready();

        address[] memory minters = new address[](1);
        minters[0] = debridgeAddress;

        // Initialize args
        bytes memory initialisationArgs = abi.encodeWithSelector(
            DeToken.initialize.selector,
            _name,
            _symbol,
            _decimals,
            deTokenAdmin,
            minters
        );

        // initialize Proxy
        bytes memory constructorArgs = abi.encode(address(this), initialisationArgs);

        // deployment code
        bytes memory bytecode = abi.encodePacked(type(DeTokenProxy).creationCode, constructorArgs);

        assembly {
            // debridgeId is a salt
            deTokenAddress := create2(0, add(bytecode, 0x20), mload(bytecode), _debridgeId)

            if iszero(extcodesize(deTokenAddress)) {
                revert(0, 0)
            }
        }

        getDeployedAssetAddress[_debridgeId] = deTokenAddress;
        emit DeTokenDeployed(
            deTokenAddress,
            _name,
            _symbol,
            _decimals
        );
    }

    // Beacon getter for the deToken contracts
    function implementation() public view returns (address) {
        return tokenImplementation;
    }


    /* ========== ADMIN ========== */

    /// @dev Set deToken implementation contract address
    /// @param _impl Wrapped asset implementation contract address.
    function setTokenImplementation(address _impl) external onlyAdmin {
        if (_impl == address(0)) revert WrongArgument();
        tokenImplementation = _impl;
    }

    /// @dev Set admin for any deployed deToken.
    /// @param _deTokenAdmin Admin address.
    function setDeTokenAdmin(address _deTokenAdmin) external onlyAdmin {
        if (_deTokenAdmin == address(0)) revert WrongArgument();
        deTokenAdmin = _deTokenAdmin;
    }

    /// @dev Sets core debridge conrtact address.
    /// @param _debridgeAddress Debridge address.
    function setDebridgeAddress(address _debridgeAddress) external onlyAdmin {
        if (_debridgeAddress == address(0)) revert WrongArgument();
        debridgeAddress = _debridgeAddress;
    }

}
