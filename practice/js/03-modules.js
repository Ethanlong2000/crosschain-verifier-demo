// ============================================================
// 03-modules.js  —  require / module.exports（CommonJS）
// ============================================================
// 在项目中的用途：
//   Hardhat 使用 CommonJS（require），不是 ES Module（import）
//   你的合约测试：   const { expect } = require("chai");
//   你的部署脚本：   const hre = require("hardhat");
//   你的工具函数：   const { hashMessage } = require("./utils");
//
// 运行：node 03-modules.js
// ============================================================

console.log("===== 03-modules.js =====\n");

// ----------------------------------------------------------
// Part 1: 引入 helper.js
// ----------------------------------------------------------

// TODO 1.1：用 require 引入 ./helper.js，用解构取出三个函数
//   提示：require("./helper") 返回的是 module.exports 对象

// 你的代码：
const {  chainName,isValidAddress,buildMessageSummary} = require("./helper");


// TODO 1.2：调用 chainName(11155111)，打印返回值，应该输出 "Sepolia"

// 你的代码：
console.log(chainName(11155111));


// TODO 1.3：调用 isValidAddress("0x1234")，打印结果（应为 false，太短了）

// 你的代码：
console.log(isValidAddress("0x1234"));


// TODO 1.4：调用 isValidAddress("0xAbC1234567890123456789012345678901234567")
//   打印结果（应为 true，42 个字符）

// 你的代码：

console.log(isValidAddress("0xAbC1234567890123456789012345678901234567"));

// ----------------------------------------------------------
// Part 2: 调用 buildMessageSummary
// ----------------------------------------------------------

// TODO 2.1：调用 buildMessageSummary(11155111, 80001, "0xAlice")，打印返回值
//   观察返回的对象结构——这就是后续项目中消息的雏形

// 你的代码：

console.log(buildMessageSummary(11155111, 80001, "0xAlice"));

// ----------------------------------------------------------
// Part 3（理解题，不用写）: require vs import
// ----------------------------------------------------------
// CommonJS（Hardhat 默认）:
//   const hre = require("hardhat");
//   module.exports = { ... };
//
// ES Module（新项目趋势）:
//   import hre from "hardhat";
//   export default { ... };
//
// 本项目用 require，因为 Hardhat 配置文件本身就是 CommonJS。
// 如果你在 package.json 里加了 "type": "module"，Hardhat 会报错——记住这个坑。

console.log("\n🎯 require 能正常引入、三个函数都调用成功，Part 1-2 就完成了");
