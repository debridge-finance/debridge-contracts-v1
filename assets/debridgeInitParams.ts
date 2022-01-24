const testNetwork = {
        "deBridgeTokenAdmin": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "treasuryAddress": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
            "WETHName": "Wrapped Ether",
            "WETHSymbol": "WETH",
            "UniswapFactory": ""
        },
        "supportedChains": [
            56,
            128,
            137,
            42161
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    };

export const networks = {
    "test": testNetwork,
    "hardhat": testNetwork,
    "kovan": {
        "deBridgeTokenAdmin": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "treasuryAddress": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [
            "0x0022798ad168952c1da80157c0314d5c64f87e22",
            "0x9b4cbd1c7e82cf9c217002eddb320a1286f47738",
            "0x2b4e172043527a9435f31688fef6f3589356d1aa"
        ],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
            "WETHName": "Wrapped Ether",
            "WETHSymbol": "WETH",
            "UniswapFactory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        },
        "supportedChains": [
            97,
            256,
            421611,
            80001
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "hecotest": {
        "deBridgeTokenAdmin": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "treasuryAddress": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [
            "0x0022798ad168952c1da80157c0314d5c64f87e22",
            "0x9b4cbd1c7e82cf9c217002eddb320a1286f47738",
            "0x2b4e172043527a9435f31688fef6f3589356d1aa"
        ],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0x7af326b6351c8a9b8fb8cd205cbe11d4ac5fa836",
            "WETHName": "Wrapped HT",
            "WETHSymbol": "WHT",
            "UniswapFactory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        },
        "supportedChains": [
            97,
            42,
            421611,
            80001
        ],
        "fixedNativeFee": [
            "100000000000000000",
            "100000000000000000",
            "100000000000000000",
            "100000000000000000"
        ],
        "globalFixedNativeFee": "100000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "bsctest": {
        "deBridgeTokenAdmin": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "treasuryAddress": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [
            "0x0022798ad168952c1da80157c0314d5c64f87e22",
            "0x9b4cbd1c7e82cf9c217002eddb320a1286f47738",
            "0x2b4e172043527a9435f31688fef6f3589356d1aa"
        ],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0xae13d989dac2f0debff460ac112a837c89baa7cd",
            "WETHName": "Wrapped BNB",
            "WETHSymbol": "WBNB",
            "UniswapFactory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        },
        "supportedChains": [
            256,
            42,
            421611,
            80001
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "arethtest": {
        "deBridgeTokenAdmin": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "treasuryAddress": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [
            "0x0022798ad168952c1da80157c0314d5c64f87e22",
            "0x9b4cbd1c7e82cf9c217002eddb320a1286f47738",
            "0x2b4e172043527a9435f31688fef6f3589356d1aa"
        ],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0x21D03141aCfc7A53252c513F25C361485082Cc82",
            "WETHName": "Wrapped AETH",
            "WETHSymbol": "WAETH",
            "UniswapFactory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        },
        "supportedChains": [
            256,
            42,
            97,
            80001
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "mumbai": {
        "deBridgeTokenAdmin": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "treasuryAddress": "0x24b8d26962641ea81cb7570c1b59d955c9193f23",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [
            "0x0022798ad168952c1da80157c0314d5c64f87e22",
            "0x9b4cbd1c7e82cf9c217002eddb320a1286f47738",
            "0x2b4e172043527a9435f31688fef6f3589356d1aa"
        ],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0x21D03141aCfc7A53252c513F25C361485082Cc82",
            "WETHName": "Wrapped MATIC",
            "WETHSymbol": "WMATIC",
            "UniswapFactory": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        },
        "supportedChains": [
            256,
            42,
            97,
            421611
        ],
        "fixedNativeFee": [
            "100000000000000000",
            "100000000000000000",
            "100000000000000000",
            "100000000000000000"
        ],
        "globalFixedNativeFee": "100000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "RINKEBY": {
        "deBridgeTokenAdmin": "0x6bec1faf33183e1bc316984202ecc09d46ac92d5",
        "treasuryAddress": "0xa0d6062be29710c666ae850395ac1a2aecd14885",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0xc778417E063141139Fce010982780140Aa0cD5Ab",
            "UniswapFactory": ""
        },
        "supportedChains": [
            56,
            128,
            137,
            42161
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "ETH": {
        "deBridgeTokenAdmin": "0x6bec1faf33183e1bc316984202ecc09d46ac92d5",
        "treasuryAddress": "0xa0d6062be29710c666ae850395ac1a2aecd14885",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
            "UniswapFactory": ""
        },
        "supportedChains": [
            56,
            128,
            137,
            42161
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "BSC": {
        "deBridgeTokenAdmin": "0xa52842cd43fa8c4b6660e443194769531d45b265",
        "treasuryAddress": "0x897b41bdf47ef039484cacbbd2e07f88899f1f96",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
            "UniswapFactory": ""
        },
        "supportedChains": [
            1,
            128,
            137,
            42161
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "HECO": {
        "deBridgeTokenAdmin": "0xa52842cd43fa8c4b6660e443194769531d45b265",
        "treasuryAddress": "0x897b41bdf47ef039484cacbbd2e07f88899f1f96",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f",
            "UniswapFactory": ""
        },
        "supportedChains": [
            1,
            56,
            137,
            42161
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "MATIC": {
        "deBridgeTokenAdmin": "0xa52842cd43fa8c4b6660e443194769531d45b265",
        "treasuryAddress": "0x897b41bdf47ef039484cacbbd2e07f88899f1f96",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": true
        },
        "external": {
            "WETH": "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
            "UniswapFactory": ""
        },
        "supportedChains": [
            1,
            56,
            128,
            42161
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
    "ARBITRUM": {
        "deBridgeTokenAdmin": "0xa52842cd43fa8c4b6660e443194769531d45b265",
        "treasuryAddress": "0x897b41bdf47ef039484cacbbd2e07f88899f1f96",
        "minConfirmations": 2,
        "confirmationThreshold": 3,
        "excessConfirmations": 3,
        "oracles": [],
        "deploy": {
            "wethGate": false
        },
        "external": {
            "WETH": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "UniswapFactory": ""
        },
        "supportedChains": [
            1,
            56,
            128,
            137
        ],
        "fixedNativeFee": [
            "10000000000000000",
            "10000000000000000",
            "10000000000000000",
            "10000000000000000"
        ],
        "globalFixedNativeFee": "10000000000000000",
        "globalTransferFeeBps": "10",
        "chainSupportInfo": [
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            },
            {
                "fixedNativeFee": "0",
                "transferFeeBps": "0",
                "isSupported": true
            }
        ]
    },
}

export const isKnownNetwork = (key: string): key is keyof typeof networks => Object.keys(networks).includes(key);

const overridedTokens = [
    {
        "address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "chainId": 1
    },
    {
        "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "chainId": 56
    },
    {
        "address": "0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f",
        "chainId": 128
    },
    {
        "address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        "chainId": 137
    },
    {
        "address": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        "chainId": 42161
    }
];
const overridedTokensInfo = [
    {
        "accept": true,
        "name": "Ether",
        "symbol": "ETH"
    },
    {
        "accept": true,
        "name": "BNB",
        "symbol": "BNB"
    },
    {
        "accept": true,
        "name": "HT",
        "symbol": "HT"
    },
    {
        "accept": true,
        "name": "Matic",
        "symbol": "MATIC"
    },
    {
        "accept": true,
        "name": "Arbitrum Ether",
        "symbol": "AETH"
    }
];
const allValidators = [
    "0x185f65aee9609804de01a02b25655b02f57e8f19",
    "0x576ab9fbc66fab714e3bd376f1d07ff9b7523cc9",
    "0xd3e98dc77eda4f821a7f5dc1f779b92a3bc9435f",
    "0x9bf9a55c6bd75bf38124ea9676fcb226d4fc16fd",
    "0x1e69be715025e6bb6d8d651674ffc39cc85fb94f",
    "0xb92958ae539f32e2d03d08d27dfa93104ac9466b",
    "0x4da594b739611574663aea3edddc428e00c48fe1",
    "0x3491a1d6653ca366df83a71b9b9922b5a164118c",
    "0x030578b16457b9ed4302ddd46f1e6567986460fd",
    "0x6d275d56650316bd672e5b22359c5aceb02d6d76",
    "0x3c9e24ab4bb6236c54f229058c1ba35c561f90ae",
    "0xd82b93077dbeb0b275b66962a11592784bf8c822",
    "0x3dd1d3e3e7bf3734013494059a345f2a7ca6c39a",
];

const debridgeInitParams = {
    ...networks,
    overridedTokens,
    overridedTokensInfo,
    allValidators,
} as const;

export default debridgeInitParams;
