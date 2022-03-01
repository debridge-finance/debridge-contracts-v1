// Validation and parsing to typed values, you may skip this step
import * as t from "io-ts";
import reporter from "io-ts-reporters";
import "../parseDotEnvs";
import {isLeft} from "fp-ts/Either";
import logger from "./logger";
import {GENERIC_ERROR_CODE} from "../constants";

const ExpectedEnvVars = t.exact(t.type({
    DEBRIDGEGATE_ADDRESS: t.string,
    SENDER_PRIVATE_KEY: t.string,
    ROUTER_ADDRESS: t.string,
}));

const parsed = ExpectedEnvVars.decode(process.env);
const hasErrors = isLeft(parsed);
if (hasErrors){
    const errors = reporter.report(parsed);
    errors.forEach(message => logger.error(message));
    process.exit(GENERIC_ERROR_CODE);
}

export default parsed.right;
