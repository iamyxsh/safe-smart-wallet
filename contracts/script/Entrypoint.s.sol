// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";

contract DeployEntrypoint is Script {
    function setUp() public {}

    function run() public {
        vm.broadcast();
        EntryPoint ep = new EntryPoint();
        console2.log(address(ep));
    }
}
