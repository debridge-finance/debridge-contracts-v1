#!/bin/sh

cp -f ../../contracts/interfaces/{\
ICallProxy.sol,\
IDeBridgeGate.sol,\
IDeBridgeGateExtended.sol\
} contracts/interfaces


cp -f ../../contracts/libraries/Flags.sol contracts/libraries

