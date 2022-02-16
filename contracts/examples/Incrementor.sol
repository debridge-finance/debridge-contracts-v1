// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./BridgeAppBase.sol";
import "./forkedInterfaces/IDeBridgeGate.sol";

/// @dev Example contract to show how to send a simple message to another chain using deBridgeGate
contract Incrementor is BridgeAppBase {
    uint256 public claimedTimes;
    using Flags for uint256;

    function initialize(IDeBridgeGate _deBridgeGate) external initializer {
        __BridgeAppBase_init(_deBridgeGate);
        claimedTimes = 0;
    }

    /// @param _chainIdTo Receiving chain id
    /// @param _fallback Address to call in case call to _receiver reverts and to send deTokens
    /// @param _executionFee Fee to pay (in native token)
    function send(
        uint256 _chainIdTo,
        address _fallback,
        uint256 _executionFee
    ) external virtual payable whenNotPaused {
        IDeBridgeGate.SubmissionAutoParamsTo memory autoParams;
        autoParams.flags = autoParams.flags.setFlag(Flags.REVERT_IF_EXTERNAL_FAIL, true);
        autoParams.flags = autoParams.flags.setFlag(Flags.PROXY_WITH_SENDER, true);
        autoParams.executionFee = _executionFee;
        autoParams.fallbackAddress = abi.encodePacked(_fallback);
        autoParams.data = abi.encodeWithSignature("onBridgedMessage()");

        address contractAddressTo = chainIdToContractAddress[_chainIdTo];
        if (contractAddressTo == address(0)) {
            revert ChainToIsNotSupported();
        }

        deBridgeGate.send{value: msg.value}(
            address(0),
            msg.value,
            _chainIdTo,
            abi.encodePacked(contractAddressTo),
            "",
            false,
            0,
            abi.encode(autoParams)
        );
    }

    function onBridgedMessage() external virtual onlyControllingAddress whenNotPaused returns (bool){
        claimedTimes++;
        return true;
    }
}