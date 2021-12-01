
Library for managing
https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
types.

Sets have the following properties:

- Elements are added, removed, and checked for existence in constant time
(O(1)).
- Elements are enumerated in O(n). No guarantees are made on the ordering.

```
contract Example {
    // Add the library methods
    using EnumerableSet for EnumerableSet.AddressSet;

    // Declare a set state variable
    EnumerableSet.AddressSet private mySet;
}
```

As of v3.3.0, sets of type `bytes32` (`Bytes32Set`), `address` (`AddressSet`)
and `uint256` (`UintSet`) are supported.

## Functions
### add
```solidity
  function add(
  ) internal returns (bool)
```

Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present.


### remove
```solidity
  function remove(
  ) internal returns (bool)
```

Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present.


### contains
```solidity
  function contains(
  ) internal returns (bool)
```

Returns true if the value is in the set. O(1).


### length
```solidity
  function length(
  ) internal returns (uint256)
```

Returns the number of values in the set. O(1).


### at
```solidity
  function at(
  ) internal returns (bytes32)
```

Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}.


### values
```solidity
  function values(
  ) internal returns (bytes32[])
```

Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.


### add
```solidity
  function add(
  ) internal returns (bool)
```

Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present.


### remove
```solidity
  function remove(
  ) internal returns (bool)
```

Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present.


### contains
```solidity
  function contains(
  ) internal returns (bool)
```

Returns true if the value is in the set. O(1).


### length
```solidity
  function length(
  ) internal returns (uint256)
```

Returns the number of values in the set. O(1).


### at
```solidity
  function at(
  ) internal returns (address)
```

Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}.


### values
```solidity
  function values(
  ) internal returns (address[])
```

Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.


### add
```solidity
  function add(
  ) internal returns (bool)
```

Add a value to a set. O(1).

Returns true if the value was added to the set, that is if it was not
already present.


### remove
```solidity
  function remove(
  ) internal returns (bool)
```

Removes a value from a set. O(1).

Returns true if the value was removed from the set, that is if it was
present.


### contains
```solidity
  function contains(
  ) internal returns (bool)
```

Returns true if the value is in the set. O(1).


### length
```solidity
  function length(
  ) internal returns (uint256)
```

Returns the number of values on the set. O(1).


### at
```solidity
  function at(
  ) internal returns (uint256)
```

Returns the value stored at position `index` in the set. O(1).

Note that there are no guarantees on the ordering of values inside the
array, and it may change when more values are added or removed.

Requirements:

- `index` must be strictly less than {length}.


### values
```solidity
  function values(
  ) internal returns (uint256[])
```

Return the entire set in an array

WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
this function has an unbounded cost, and using it as part of a state-changing function may render the function
uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.


