// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IPaymaster} from "account-abstraction/interfaces/IPaymaster.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

contract Paymaster is IPaymaster {
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256
    ) external override returns (bytes memory context, uint256 validationData) {
        context = new bytes(0);
        validationData = 0;
    }

    function postOp(
        PostOpMode,
        bytes calldata,
        uint256,
        uint256
    ) external override {}

    receive() external payable {}
}
