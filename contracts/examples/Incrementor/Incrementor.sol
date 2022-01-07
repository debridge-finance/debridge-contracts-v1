// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../L2Base/L2Base.sol";
import "../../interfaces/IDeBridgeGate.sol";

contract Incrementor is L2Base {
    uint256 claimedTimes;

    function initialize(IDeBridgeGate _deBridgeGate) external initializer {
        __L2Base_init(_deBridgeGate);
        claimedTimes = 0;
    }

    function send(
            uint256 _chainIdTo,
            address _receiver,
            bytes calldata _data,
            address _fallback
    ) external virtual payable override whenNotPaused {
        IDeBridgeGate.SubmissionAutoParamsTo memory autoParams;
        autoParams.flags = 2**Flags.REVERT_IF_EXTERNAL_FAIL + 2**Flags.PROXY_WITH_SENDER;
        autoParams.executionFee = 1 ether;
        autoParams.fallbackAddress = abi.encodePacked(_fallback);
        autoParams.data = abi.encodeWithSignature(
            "claim(address,bytes calldata)",
            _receiver,
            ""
        );

        address bridgeAddressTo = chainIdToBridgeAddress[_chainIdTo];
        if (bridgeAddressTo == address(0)) {
            revert ChainToIsNotSupported();
        }

        deBridgeGate.send{value: msg.value}(
            address(0),
            msg.value,
            _chainIdTo,
            abi.encodePacked(bridgeAddressTo),
            "",
            false,
            0,
            abi.encode(autoParams)
        );
    }

    // TODO change name to increment?
    function claim (
        address,
        bytes calldata
    ) external payable virtual onlyControllingAddress whenNotPaused override returns (bool){
        claimedTimes++;
        return true;
    }
}