import {ParamType} from "ethers/lib/utils";
import {BigNumberish, utils} from "ethers";

export const SUBMISSION_AUTO_PARAMS_TO_TYPE = ParamType.from({
    type: "tuple",
    name: "SubmissionAutoParamsTo",
    components: [
        { name: "executionFee", type: 'uint256' },
        { name: "flags", type: 'uint256' },
        { name: "fallbackAddress", type:'bytes' },
        { name: "data", type:'bytes' },
    ]
});

export type submissionAutoParamsToValues = {
    executionFee: BigNumberish,
    flags: BigNumberish,
    fallbackAddress: string,
    data: string,
};

export const encodeSubmissionAutoParamsTo = (values: submissionAutoParamsToValues) => {
    return utils.defaultAbiCoder.encode([SUBMISSION_AUTO_PARAMS_TO_TYPE], [values]);
}

