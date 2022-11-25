import {ParamType} from "ethers/lib/utils";

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
export const SUBMISSION_AUTO_PARAMS_FROM_TYPE = ParamType.from({
    type: "tuple",
        name: "SubmissionAutoParamsFrom",
    components: [
    { name: "executionFee", type: 'uint256' },
    { name: "flags", type: 'uint256' },
    { name: "fallbackAddress", type:'address' },
    { name: "data", type:'bytes' },
    { name: "nativeSender", type:'bytes' },
]});