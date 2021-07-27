// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IAggregatorBase.sol";

contract AggregatorBase is AccessControl, IAggregatorBase {

    /* ========== STATE VARIABLES ========== */

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // role allowed to submit the data
    uint256 public minConfirmations; // minimal required confirmations

    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }
    modifier onlyOracle {
        require(hasRole(ORACLE_ROLE, msg.sender), "onlyOracle: bad role");
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    constructor(
        uint256 _minConfirmations
    ) {
        minConfirmations = _minConfirmations;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, msg.sender);
    }

    /* ========== ORACLES  ========== */

    /// @dev Updates oracle's admin address.
    /// @param _oracle Oracle address.
    /// @param _newOracleAdmin New oracle address.
    function updateOracleAdmin(address _oracle, address _newOracleAdmin)
        external
    {
        require(getOracleInfo[_oracle].admin == msg.sender, "only callable by admin");
        getOracleInfo[_oracle].admin = _newOracleAdmin;
    }

    /* ========== ADMIN ========== */

    /// @dev Sets minimal required confirmations.
    /// @param _minConfirmations Confirmation info.
    function setMinConfirmations(uint256 _minConfirmations) public onlyAdmin {
        require(_minConfirmations > 0, "Must be greater than zero");
        minConfirmations = _minConfirmations;
    }

    /// @dev Add new oracle.
    /// @param _oracle Oracle address.
    /// @param _admin Admin address.
    function addOracle(address _oracle, address _admin) external onlyAdmin {
        grantRole(ORACLE_ROLE, _oracle);
        getOracleInfo[_oracle].admin = _admin;
    }

    /// @dev Remove oracle.
    /// @param _oracle Oracle address.
    function removeOracle(address _oracle) external onlyAdmin {
        revokeRole(ORACLE_ROLE, _oracle);
    }

    /* ========== VIEW ========== */

    /// @dev Calculates asset identifier.
    function getDeployId(
        bytes32 _debridgeId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(_debridgeId, _name, _symbol, _decimals));
    }

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, address _tokenAddress)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }
}
