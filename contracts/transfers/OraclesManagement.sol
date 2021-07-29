// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract OraclesManagement is AccessControl {

    /* ========== STRUCTS ========== */

    struct OracleInfo {
        bool exist; // exist oracle
        bool isValid; // is valid oracle
        bool required; // without this oracle (DSRM), the transfer will not be confirmed
    }

    /* ========== STATE VARIABLES ========== */

    address[] public oracleAddresses;
    mapping(address => OracleInfo) public oracles; // all active oracles
    uint256 public requiredOraclesCount; // count of required oracles

    /* ========== EVENTS ========== */

    event UpdateOracle(address oracle, bool required, bool isValid); // update oracle by admin

     /* ========== MODIFIERS ========== */

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    /* ========== FUNCTIONS ========== */

    /// @dev Update oracle.
    /// @param _oracle Oracle address.
    /// @param _required Without this oracle, the transfer will not be confirmed
    /// @param _isValid is valid oracle
    function updateOracle(address _oracle, bool _required, bool _isValid) external onlyAdmin {
        OracleInfo storage oracleInfo = oracles[_oracle];
        oracleInfo.isValid = _isValid;

        if(!oracleInfo.exist){
            oracleAddresses.push(_oracle);
        }
        
        if(oracleInfo.required && !_required){
            requiredOraclesCount -= 1;
        }
        else if (!oracleInfo.required && _required){
            requiredOraclesCount += 1;
        }
        oracleInfo.required = _required;

        emit UpdateOracle(_oracle, _required, _isValid);
    }
}
