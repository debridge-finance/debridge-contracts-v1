// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

library Flags {

    /* ========== FLAGS ========== */

    // Flag to unwrap ETH
    uint256 public constant UNWRAP_ETH = 0;
    // Flag to revert if external call fails
    uint256 public constant REVERT_IF_EXTERNAL_FAIL = 1;
    // Flag to call proxy with a sender contract
    uint256 public constant PROXY_WITH_SENDER = 2;

    function getFlag(
        uint256 _packedFlags,
        uint256 _flag
    ) internal pure returns (bool) {
        uint256 flag = (_packedFlags >> _flag) & uint256(1);
        return flag == 1;
    }

    // function setFlag(
    //     uint256 _packedFlags,
    //     uint256 _flag,
    //     bool _value
    // ) internal pure returns (uint256) {
    //     if (_value)
    //         return _packedFlags | uint256(1) << _flag;
    //     else
    //         return _packedFlags & ~(uint256(1) << _flag);
    // }
}
