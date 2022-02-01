import {AbiItem} from "web3-utils";
import Web3 from "web3";
import {
    BaseContract, NonPayableTransactionObject,
} from "../../../../typechain-types-web3/types";
import BN from "bn.js";


const metaUsdZapAbiForExchange: AbiItem[] = [
    {
        "stateMutability": "nonpayable",
        "type": "function",
        "name": "exchange_underlying",
        "inputs": [
            {
                "name": "_pool",
                "type": "address"
            },
            {
                "name": "_i",
                "type": "int128"
            },
            {
                "name": "_j",
                "type": "int128"
            },
            {
                "name": "_dx",
                "type": "uint256"
            },
            {
                "name": "_min_dy",
                "type": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ]
    },
    {
        "stateMutability": "nonpayable",
        "type": "function",
        "name": "exchange_underlying",
        "inputs": [
            {
                "name": "_pool",
                "type": "address"
            },
            {
                "name": "_i",
                "type": "int128"
            },
            {
                "name": "_j",
                "type": "int128"
            },
            {
                "name": "_dx",
                "type": "uint256"
            },
            {
                "name": "_min_dy",
                "type": "uint256"
            },
            {
                "name": "_receiver",
                "type": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ]
    },
    {
        "stateMutability": "nonpayable",
        "type": "function",
        "name": "exchange_underlying",
        "inputs": [
            {
                "name": "_pool",
                "type": "address"
            },
            {
                "name": "_i",
                "type": "int128"
            },
            {
                "name": "_j",
                "type": "int128"
            },
            {
                "name": "_dx",
                "type": "uint256"
            },
            {
                "name": "_min_dy",
                "type": "uint256"
            },
            {
                "name": "_receiver",
                "type": "address"
            },
            {
                "name": "_use_underlying",
                "type": "bool"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ]
    }
];
export interface MetaUsdZap extends BaseContract {
    methods: {
        exchange_underlying(
            _pool: string,
            _i: number | string | BN,
            _j: number | string | BN,
            _dx: number | string | BN,
            _min_dy: number | string | BN,
            _receiver?: string,
            _use_underlying?: boolean,
        ): NonPayableTransactionObject<string>;
    }
}

export function getMetaUsdZap(web3: Web3, address: string): MetaUsdZap {
    return new web3.eth.Contract(
        metaUsdZapAbiForExchange,
        address
    ) as unknown as MetaUsdZap;
}
