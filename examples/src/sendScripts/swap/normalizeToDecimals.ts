import BN from "bn.js";
import {ether} from "../constants";

export default function normalizeToDecimals(bnInWei: BN, decimalsMultiplierForSentToken: BN): BN {
    return bnInWei.mul(decimalsMultiplierForSentToken).div(ether);
}
