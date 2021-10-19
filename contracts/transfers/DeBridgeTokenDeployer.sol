// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../interfaces/IDeBridgeTokenDeployer.sol";
import "../periphery/DeBridgeToken.sol";
import "../periphery/DeBridgeTokenProxy.sol";

contract DeBridgeTokenDeployer is
    Initializable,
    AccessControlUpgradeable,
    IDeBridgeTokenDeployer
{

    /* ========== STATE VARIABLES ========== */

    // address of deBridgeToken implementation
    address public tokenImplementation;
    // admin for any deployed deBridgeToken
    address public deBridgeTokenAdmin;
    // Debridge gate address
    address public debridgeAddress;
    // debridge id => deBridgeToken address
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
        address _deBridgeTokenAdmin,
        address _debridgeAddress
    ) public initializer {
        tokenImplementation = _tokenImplementation;
        deBridgeTokenAdmin = _deBridgeTokenAdmin;
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
        returns (address deBridgeTokenAddress)
    {
        if (getDeployedAssetAddress[_debridgeId] != address(0)) revert DeployedAlready();

        address[] memory minters = new address[](1);
        minters[0] = debridgeAddress;

        // Initialize args
        bytes memory initialisationArgs = abi.encodeWithSelector(
            DeBridgeToken.initialize.selector,
            _name,
            _symbol,
            _decimals,
            deBridgeTokenAdmin,
            minters
        );

        // initialize Proxy
        bytes memory constructorArgs = abi.encode(address(this), initialisationArgs);

        // deployment code
        bytes memory bytecode = abi.encodePacked(type(DeBridgeTokenProxy).creationCode, constructorArgs);

        assembly {
            // debridgeId is a salt
            deBridgeTokenAddress := create2(0, add(bytecode, 0x20), mload(bytecode), _debridgeId)

            if iszero(extcodesize(deBridgeTokenAddress)) {
                revert(0, 0)
            }
        }

        getDeployedAssetAddress[_debridgeId] = deBridgeTokenAddress;
        emit DeBridgeTokenDeployed(
            deBridgeTokenAddress,
            _name,
            _symbol,
            _decimals
        );
    }

    // Beacon getter for the deBridgeToken contracts
    function implementation() public view returns (address) {
        return tokenImplementation;
    }


    /* ========== ADMIN ========== */

    /// @dev Set deBridgeToken implementation contract address
    /// @param _impl Wrapped asset implementation contract address.
    function setTokenImplementation(address _impl) external onlyAdmin {
        if (_impl == address(0)) revert WrongArgument();
        tokenImplementation = _impl;
    }

    /// @dev Set admin for any deployed deBridgeToken.
    /// @param _deBridgeTokenAdmin Admin address.
    function setDeBridgeTokenAdmin(address _deBridgeTokenAdmin) external onlyAdmin {
        if (_deBridgeTokenAdmin == address(0)) revert WrongArgument();
        deBridgeTokenAdmin = _deBridgeTokenAdmin;
    }

    /// @dev Sets core debridge conrtact address.
    /// @param _debridgeAddress Debridge address.
    function setDebridgeAddress(address _debridgeAddress) external onlyAdmin {
        if (_debridgeAddress == address(0)) revert WrongArgument();
        debridgeAddress = _debridgeAddress;
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
