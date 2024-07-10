# The lifecycle

The lifecycle of an order is defined as follows:

* getting a quote
* requesting a transaction that places (creates) the limit order on-chain
* submitting a transaction to the source chain
* tracking the status of the order on the destination chain
* (optional) requesting a transaction that cancels the limit order on the destination chain

This guide gives a brief step-by-step overview of how to manage limit orders using DLN API endpoints.
