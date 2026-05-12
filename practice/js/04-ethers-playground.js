// ============================================================
// 04-ethers-playground.js  —  ethers.js 核心操作
// ============================================================
// 在项目中的用途：
//   Wallet.createRandom()  → 生成测试用的私钥/地址
//   wallet.signMessage()   → 离线签名消息
//   ethers.hashMessage()   → 消息哈希（链下签名前必须做的步骤）
//   ethers.keccak256()     → Solidity 的 keccak256 在 JS 侧的等价物
//   拆分签名 r/s/v          → 合约 ecrecover 需要分开传入 r、s、v
//
// 运行：node 04-ethers-playground.js
// ============================================================

// TODO 0：先用 require 引入 ethers
//   提示：const ethers = require("ethers");

// 你的代码：
const ethers = require("ethers");


console.log("===== 04-ethers-playground.js =====\n");

// ----------------------------------------------------------
// Part 1: 创建随机钱包
// ----------------------------------------------------------

// TODO 1.1：用 ethers.Wallet.createRandom() 创建一个钱包
//   打印 wallet.address 和 wallet.privateKey

// 你的代码：
const wallet= ethers.Wallet.createRandom();
console.log(wallet.address);
console.log(wallet.privateKey);


// ----------------------------------------------------------
// Part 2: 消息哈希
// ----------------------------------------------------------

// TODO 2.1：用 ethers.hashMessage("hello crosschain") 做哈希
//   打印结果，观察输出格式（是以 0x 开头的 66 字符十六进制字符串）

// 你的代码：
console.log(ethers.hashMessage("hello crosschain"));


// TODO 2.2：用 ethers.keccak256(ethers.toUtf8Bytes("hello crosschain")) 做哈希
//   打印结果，与 2.1 的输出对比 —— 是否一样？
//
// ⚠️ 关键区别：
//   hashMessage()  会在消息前加 "\x19Ethereum Signed Message:\n" 前缀（EIP-191）
//   keccak256()    只是纯粹的哈希，不加前缀
//
// 链上 ecrecover 用哪种哈希，链下就必须用一样的，不然恢复出的地址对不上！

// 你的代码：
console.log(ethers.keccak256(ethers.toUtf8Bytes("hello crosschain")));
// ----------------------------------------------------------
// Part 3: 签名消息
// ----------------------------------------------------------

// TODO 3.1：用 wallet.signMessage("hello crosschain") 签名
//   打印签名值（一个 0x 开头、132 字符的十六进制字符串）

// 你的代码：
(async ()=>{
    const signature=await wallet.signMessage("hello crosschain");
    console.log(signature);
})();

// ----------------------------------------------------------
// Part 4: 拆分签名的 r, s, v（重要！合约需要这个）
// ----------------------------------------------------------

// TODO 4.1：用 ethers.Signature.from(signature) 解析签名，提取 r, s, v
//   打印 r, s, v 三个值

// 你的代码：
(async ()=>{
    const signature=await wallet.signMessage("hello crosschain");
    const {r,s,v} = ethers.Signature.from(signature);
    console.log(r,s,v);
    console.log("v的值是：",v)
})();

// TODO 4.2：检查 v 的值是 27 还是 28？
//
// ⚠️ 如果是 27 或 28 → 可以直接用于 Solidity 的 ecrecover
//   如果是 0 或 1  → 需要 +27 才能用于 ecrecover
//   （ethers v6 的 Signature.from() 返回值可能因版本而异，这是你遇到的第一个坑）
//
//   打印 v 的值，看看你的 ethers 版本返回的是什么

// 你的代码：


// ----------------------------------------------------------
// Part 5: 验证签名恢复（链下模拟）
// ----------------------------------------------------------

// TODO 5.1：从签名恢复出签名者地址
//   提示：ethers.verifyMessage("hello crosschain", signature)
//   打印恢复的地址，与 wallet.address 对比 —— 应该完全一致

// 你的代码：
(async ()=>{
const signature=await wallet.signMessage("hello crosschain");
const recover_address=await ethers.verifyMessage("hello crosschain",signature);
console.log(recover_address);
})();

// ----------------------------------------------------------
// Part 6: 在项目中的完整流程回顾
// ----------------------------------------------------------
// 下面是你今天要走的完整链路，读一遍：
//
//   [链下 JS]                        [链上 Solidity]
//   1. 创建钱包                        -
//   2. hash = hashMessage(msg)        -
//   3. sig = wallet.signMessage(msg)  -
//   4. 传入合约 →                     5. ecrecover(hash, v, r, s) → 恢复地址
//   6. 断言恢复地址 == wallet.address
//
// 注意第 2 步的哈希方式：链下用 hashMessage（有 EIP-191 前缀），
// 合约里如果要匹配就要对同样的消息做同样的前缀处理。
// 后续我们会在合约侧处理这个对齐问题。

console.log("\n🎯 能打印钱包地址、签名、r/s/v、恢复地址，Part 1-5 就完成了！");
