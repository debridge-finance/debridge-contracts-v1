// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../L2Base/L2Base.sol";
import "../IDeBridgeGate.sol";

contract Incrementor is L2Base {
    uint256 claimedTimes;

    function initialize(IDeBridgeGate _deBridgeGate) external initializer {
        __L2Base_init(_deBridgeGate);
        claimedTimes = 0;
    }

    function send(
        uint256 _chainIdTo,
        address _fallback,
        uint256 _executionFee,
        bytes calldata
    ) external virtual payable override whenNotPaused {
        IDeBridgeGate.SubmissionAutoParamsTo memory autoParams;
        autoParams.flags = 2**Flags.REVERT_IF_EXTERNAL_FAIL + 2**Flags.PROXY_WITH_SENDER;
        autoParams.executionFee = _executionFee;
        autoParams.fallbackAddress = abi.encodePacked(_fallback);
        autoParams.data = abi.encodeWithSignature("onBridgedMessage(bytes calldata)", "");

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

    function onBridgedMessage (
        bytes calldata
    ) external payable virtual onlyControllingAddress whenNotPaused override returns (bool){
        claimedTimes++;
        return true;
    }
}