// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IAggregatorBase.sol";

contract AggregatorBase is Initializable, AccessControlUpgradeable, IAggregatorBase {
    /* ========== STATE VARIABLES ========== */

    uint8 public minConfirmations; // minimal required confirmations
    uint8 public excessConfirmations; // minimal required confirmations in case of too many confirmations
    uint8 public requiredOraclesCount; // count of required oracles

    address[] public oracleAddresses;
    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error OracleBadRole();
    error DeBridgeGateBadRole();


    error OracleAlreadyExist();
    error OracleNotFound();

    error WrongArgument();
    error LowMinConfirmations();

    error SubmittedAlready();


    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }
    modifier onlyOracle() {
        if (!getOracleInfo[msg.sender].isValid) revert OracleBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    function initializeBase(uint8 _minConfirmations, uint8 _excessConfirmations) internal {
        if (_minConfirmations == 0 || _excessConfirmations < _minConfirmations) revert LowMinConfirmations();
        minConfirmations = _minConfirmations;
        excessConfirmations = _excessConfirmations;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== ADMIN ========== */

    /// @dev Sets minimal required confirmations.
    /// @param _minConfirmations Confirmation info.
    function setMinConfirmations(uint8 _minConfirmations) external onlyAdmin {
        if (_minConfirmations < oracleAddresses.length / 2 + 1) revert LowMinConfirmations();
        minConfirmations = _minConfirmations;
    }

    /// @dev Sets minimal required confirmations.
    /// @param _excessConfirmations new excessConfirmations count.
    function setExcessConfirmations(uint8 _excessConfirmations) external onlyAdmin {
        if (_excessConfirmations < minConfirmations) revert LowMinConfirmations();
        excessConfirmations = _excessConfirmations;
    }

    /// @dev Add oracle.
    /// @param _oracles Oracles addresses.
    /// @param _required Without this oracle, the transfer will not be confirmed
    function addOracles(
        address[] memory _oracles,
        bool[] memory _required
    ) external onlyAdmin {
        if (_oracles.length != _required.length) revert WrongArgument();
        if (minConfirmations < (oracleAddresses.length +  _oracles.length) / 2 + 1) revert LowMinConfirmations();

        for (uint256 i = 0; i < _oracles.length; i++) {
            OracleInfo storage oracleInfo = getOracleInfo[_oracles[i]];
            if (oracleInfo.exist) revert OracleAlreadyExist();

            oracleAddresses.push(_oracles[i]);

            if (_required[i]) {
                requiredOraclesCount += 1;
            }

            oracleInfo.exist = true;
            oracleInfo.isValid = true;
            oracleInfo.required = _required[i];

            emit AddOracle(_oracles[i], _required[i]);
        }
    }

    /// @dev Update oracle.
    /// @param _oracle Oracle address.
    /// @param _isValid is valid oracle
    /// @param _required Without this oracle, the transfer will not be confirmed
    function updateOracle(
        address _oracle,
        bool _isValid,
        bool _required
    ) external onlyAdmin {
        //If oracle is invalid, it must be not required
        if (!_isValid && _required) revert WrongArgument();

        OracleInfo storage oracleInfo = getOracleInfo[_oracle];
        if (!oracleInfo.exist) revert OracleNotFound();

        if (oracleInfo.required && !_required) {
            requiredOraclesCount -= 1;
        } else if (!oracleInfo.required && _required) {
            requiredOraclesCount += 1;
        }
        if (oracleInfo.isValid && !_isValid) {
            // remove oracle from oracleAddresses array without keeping an order
            for (uint256 i = 0; i < oracleAddresses.length; i++) {
                if (oracleAddresses[i] == _oracle) {
                    oracleAddresses[i] = oracleAddresses[oracleAddresses.length - 1];
                    oracleAddresses.pop();
                    break;
                }
            }
        } else if (!oracleInfo.isValid && _isValid) {
            if (minConfirmations < (oracleAddresses.length + 1) / 2 + 1) revert LowMinConfirmations();
            oracleAddresses.push(_oracle);
        }
        oracleInfo.isValid = _isValid;
        oracleInfo.required = _required;
        emit UpdateOracle(_oracle, _required, _isValid);
    }


    /* ========== VIEW ========== */

    /// @dev Calculates asset identifier.
    function getDeployId(
        bytes32 _debridgeId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_debridgeId, _name, _symbol, _decimals));
    }

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, bytes memory _tokenAddress)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }
}
