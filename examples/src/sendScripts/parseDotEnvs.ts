import {config} from "dotenv-flow";
import path from "path";

config();
config({path: path.resolve(__dirname, '../')});