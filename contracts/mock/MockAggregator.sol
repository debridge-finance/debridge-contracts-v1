// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    int256 public answer;

    function setAnswer(int256 _answer) public {
        answer = _answer;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, answer, 0, 0, 0);
    }

    function decimals() external view override returns (uint8) {}

    function description() external view override returns (string memory) {}

    function version() external view override returns (uint256) {}

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {}
}
