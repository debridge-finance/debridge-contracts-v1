import log4js from "log4js";
import {log4jsConfig} from "../constants";

export default log4js.configure(log4jsConfig).getLogger('multiSend');
