// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;

contract MockAcceptAnyCall {
    fallback() payable external {
    }
}
