// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../periphery/WrappedAssetProxy.sol";
import "../periphery/WrappedAssetImplementation.sol";

contract AssetDeployer is Initializable, AccessControlUpgradeable {

    /* ========== STATE VARIABLES ========== */

    // address of wrapped asset implementation
    address public tokenImplementation;
    // admin for any deployed wrapped asset
    address public wrappedAssetAdmin;
    // Debridge gate address
    address public debridgeAddress;
    // debridge id => wrapped asset address
    mapping(bytes32 => address) public getWrappedAssetAddress;


    /* ========== EVENTS ========== */

    event WrappedAssetDeployed(address asset);

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
        // bytes memory _nativeTokenAddress,
        // uint256 _nativeChainId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals)
        external
        onlyDeBridgeGate
        returns (
            address wrappedAssetAddress
            // bytes memory nativeAddress,
            // uint256 nativeChainId
        )
    {
        if (getWrappedAssetAddress[_debridgeId] != address(0)) revert DeployedAlready();

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

        getWrappedAssetAddress[_debridgeId] = wrappedAssetAddress;
        emit WrappedAssetDeployed(wrappedAssetAddress);
    }

    // Beacon getter for the wrapped asset contracts
    function implementation() public view returns (address) {
        return tokenImplementation;
    }


    /* ========== ADMIN ========== */

    function setTokenImplementation(address _impl) external onlyAdmin {
        if (_impl == address(0)) revert WrongArgument();
        tokenImplementation = _impl;
    }

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
