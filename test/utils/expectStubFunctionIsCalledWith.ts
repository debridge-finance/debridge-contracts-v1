import { Stub } from "ethereum-waffle";
import { expect } from "hardhat";

export default async function expectStubFunctionIsCalledWith(
    stubFunctionExpectedToBeCalled: Stub,
    argsOfStubFunction: any[],
    callableThatShouldTriggerStubCall: () => Promise<unknown>,
):Promise<void> {
    // TODO rewrite with calledOnContractWith  when this issue is fixed 
    // https://github.com/nomiclabs/hardhat/issues/1135
    const EXPECTED_REVERT_REASON = 'EXPECTED_REVERT_REASON';
    await stubFunctionExpectedToBeCalled.withArgs(...argsOfStubFunction)
        .revertsWithReason(EXPECTED_REVERT_REASON);

    await expect( callableThatShouldTriggerStubCall() )
        .to.be.revertedWith(EXPECTED_REVERT_REASON);
}