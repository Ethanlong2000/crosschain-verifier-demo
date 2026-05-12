// ============================================================
// 06-relayer-patterns.js — 踩坑后整理的必备模式
// ============================================================
// 覆盖：
//   1. module.exports 和 require 解构
//   2. async 函数自动返回 Promise
//   3. 对象解构重命名
//   4. 数据格式转换（对象数组 → 纯值数组）
//   5. event 查询
//   6. mapping 用函数调用而非属性访问
//
// 运行：node 06-relayer-patterns.js
// ============================================================

const ethers = require("ethers");

console.log("===== 06-relayer-patterns.js =====\n");

// ----------------------------------------------------------
// Part 1: module.exports 和 require 解构
// ----------------------------------------------------------
// 场景：merkle.js 里定义了 5 个函数，relayer-demo.js 要用
// 问题：require("./merkle.js") 会执行整个文件，且变量是模块作用域拿不到
// 解法：merkle.js 用 module.exports 导出，relayer-demo.js 解构导入

// TODO 1.1：假装这是 merkle.js，导出一个对象包含两个函数
//   - add(a, b)：返回 a + b
//   - multiply(a, b)：返回 a * b
//   module.exports = { add, multiply };

// 你的代码：


// TODO 1.2：假装这是 relayer-demo.js，用解构导入上面两个函数
//   打印 add(1, 2) 和 multiply(3, 4) 的结果
//   提示：因为这是在同一个文件里模拟，直接用上面定义的函数即可

// 你的代码：


// ----------------------------------------------------------
// Part 2: async 函数自动返回 Promise
// ----------------------------------------------------------
// 场景：deployAndSetup() 是 async 函数，内部有 await
// 问题：async 函数自动把 return 值包成 Promise，调用方 await 解开就行

// TODO 2.1：写一个 async 函数 fetchData()，模拟异步操作
//   - 内部 await 一个 Promise（用 new Promise + setTimeout，1 秒后 resolve "done"）
//   - return { status: "ok", data: "done" }  ← 返回普通对象
//   - 打印 "fetchData 完成"
//   提示：setTimeout 的 Promise 写法看 02-async.js

// 你的代码：


// TODO 2.2：调用 fetchData()，await 拿到结果，打印 result
//   提示：需要包在 async 函数里（或顶层 await，但这里用 IIFE）

// 你的代码：


// ----------------------------------------------------------
// Part 3: 对象解构重命名
// ----------------------------------------------------------
// 场景：deployAndSetup() 返回 { contract, owner, signer }
//       但调用方想用 authorizedSigner 这个名字
// 解法：解构时用冒号重命名 { signer: authorizedSigner }

// TODO 3.1：定义一个对象 user = { name: "Alice", age: 25 }
//   用解构重命名把 age 变成 userAge，打印 name 和 userAge

// 你的代码：


// TODO 3.2：模拟 deployAndSetup 的返回值
//   const result = { contract: "0xContract", owner: "0xOwner", signer: "0xSigner" };
//   用解构重命名把 signer 变成 authorizedSigner，打印三个变量
//   注意：contract 和 owner 不需要重命名

// 你的代码：


// ----------------------------------------------------------
// Part 4: 数据格式转换
// ----------------------------------------------------------
// 场景：getProof() 返回 [{ sibling, isLeft }, ...]
//       但合约 verifyAndExecute 只需要 bytes32[]（纯 sibling 数组）
// 解法：proof.map(p => p.sibling)

// TODO 4.1：给定 proof = [{ sibling: "0xaaa", isLeft: false }, { sibling: "0xbbb", isLeft: true }]
//   用 .map() 提取出纯 sibling 数组 ["0xaaa", "0xbbb"]，打印结果

// 你的代码：


// TODO 4.2：给定 messages = [{ sender: "0x1", amount: 100 }, { sender: "0x2", amount: 200 }]
//   用 .map() 提取出所有 sender 地址的数组，打印结果

// 你的代码：


// ----------------------------------------------------------
// Part 5: 模拟 event 查询
// ----------------------------------------------------------
// 场景：contract.queryFilter("MessageExecuted") 返回事件历史
// 真实 API 需要 Hardhat 环境，这里用假数据模拟

// TODO 5.1：给定模拟 event 数组
//   const fakeEvents = [
//     { args: { msgId: "0x111", signer: "0xAaa" } },
//     { args: { msgId: "0x222", signer: "0xBbb" } },
//   ];
//   用 .forEach() 遍历，打印每条 event 的 msgId 和 signer
//   注意：真实场景中是 e.args.msgId，不是 e.msgId

// 你的代码：


// ----------------------------------------------------------
// Part 6: 链上 mapping 用 () 不是 []
// ----------------------------------------------------------
// 场景：Solidity 的 public mapping 在 ethers.js 里是函数，不是属性
//       ✅ contract.executedMessages(msgId)
//       ❌ contract.executedMessages[msgId]
// 解释：ethers.js 为每个 public mapping 自动生成同名 async 函数

// TODO 6.1：模拟一个合约对象，它有 executedMessages 方法（用 setTimeout 模拟异步）
//   const fakeContract = {
//     executedMessages: async (msgId) => {
//       // 模拟链上查询：已知的 msgId 返回 true，未知的返回 false
//       await new Promise(resolve => setTimeout(resolve, 100)); // 模拟网络延迟
//       const knownMessages = ["0x111", "0x222"];
//       return knownMessages.includes(msgId);
//     }
//   };
//   然后 await fakeContract.executedMessages("0x111") 打印结果
//   再用 await fakeContract.executedMessages("0x333") 打印结果

// 你的代码：


console.log("\n===== 06-relayer-patterns.js 结束 =====");
