// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../interfaces/IAssetDeployer.sol";
import "../periphery/WrappedAssetProxy.sol";
import "../periphery/WrappedAssetImplementation.sol";

contract AssetDeployer is
    Initializable,
    AccessControlUpgradeable,
    IAssetDeployer
{

    /* ========== STATE VARIABLES ========== */

    // address of wrapped asset implementation
    address public tokenImplementation;
    // admin for any deployed wrapped asset
    address public wrappedAssetAdmin;
    // Debridge gate address
    address public debridgeAddress;
    // debridge id => wrapped asset address
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
        address _wrappedAssetAdmin,
        address _debridgeAddress
    ) public initializer {
        tokenImplementation = _tokenImplementation;
        wrappedAssetAdmin = _wrappedAssetAdmin;
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
        returns (address wrappedAssetAddress)
    {
        if (getDeployedAssetAddress[_debridgeId] != address(0)) revert DeployedAlready();

        address[] memory minters = new address[](1);
        minters[0] = debridgeAddress;

        // Initialize args
        bytes memory initialisationArgs = abi.encodeWithSelector(
            WrappedAssetImplementation.initialize.selector,
            _name,
            _symbol,
            _decimals,
            wrappedAssetAdmin,
            minters
        );

        // initialize Proxy
        bytes memory constructorArgs = abi.encode(address(this), initialisationArgs);

        // deployment code
        bytes memory bytecode = abi.encodePacked(type(WrappedAssetProxy).creationCode, constructorArgs);

        assembly {
            // debridgeId is a salt
            wrappedAssetAddress := create2(0, add(bytecode, 0x20), mload(bytecode), _debridgeId)

            if iszero(extcodesize(wrappedAssetAddress)) {
                revert(0, 0)
            }
        }

        getDeployedAssetAddress[_debridgeId] = wrappedAssetAddress;
        emit WrappedAssetDeployed(
            wrappedAssetAddress,
            _name,
            _symbol,
            _decimals
        );
    }

    // Beacon getter for the wrapped asset contracts
    function implementation() public view returns (address) {
        return tokenImplementation;
    }


    /* ========== ADMIN ========== */

    /// @dev Set wrapped asset implementation contract address
    /// @param _impl Wrapped asset implementation contract address.
    function setTokenImplementation(address _impl) external onlyAdmin {
        if (_impl == address(0)) revert WrongArgument();
        tokenImplementation = _impl;
    }

    /// @dev Set admin for any deployed wrapped asset.
    /// @param _wrappedAssetAdmin Admin address.
    function setWrappedAssetAdmin(address _wrappedAssetAdmin) external onlyAdmin {
        if (_wrappedAssetAdmin == address(0)) revert WrongArgument();
        wrappedAssetAdmin = _wrappedAssetAdmin;
    }

    /// @dev Sets core debridge conrtact address.
    /// @param _debridgeAddress Debridge address.
    function setDebridgeAddress(address _debridgeAddress) external onlyAdmin {
        if (_debridgeAddress == address(0)) revert WrongArgument();
        debridgeAddress = _debridgeAddress;
    }

}
