# 开发笔记：踩坑记录 & 纠错

> 主项目推进过程中遇到的问题、错误、纠正，按日期和模块记录。

---

## Solidity / 合约

### Solidity 最小基础——够写 EcdsaDemo 就行
**Solidity 是什么：** 运行在以太坊上的智能合约语言，语法长得像 JS/C++，但有很多链上特有的限制。

**合约结构（你只需要这个模板）：**
```solidity
// SPDX-License-Identifier: MIT      // 版权声明，必须写，不写编译器会警告
pragma solidity ^0.8.24;             // 编译器版本，和 hardhat.config.js 保持一致

contract EcdsaDemo {                 // contract 关键字，像 class
    // 函数写在这里
}
```

**函数声明语法（对照 JS）：**
```js
// JS
function add(a, b) { return a + b; }

// Solidity
function add(uint256 a, uint256 b) public pure returns (uint256) {
    return a + b;
}
```
区别：Solidity 每个参数必须带类型，函数后面要声明 `public`/`private` + `pure`/`view` + `returns (返回类型)`。

**你必须认识的几个关键字：**

| 关键字 | 意思 | 什么时候用 |
|--------|------|-----------|
| `public` | 谁都能调用（外部账户、其他合约） | 你的 `recoverSigner` 就是 public |
| `private` | 只有合约内部能调 | 内部辅助函数 |
| `pure` | 不读链上存储，也不写链上存储 | 纯计算如 `ecrecover` |
| `view` | 读链上存储但不写 | 查询类函数 |
| 什么都不写 | 可能读写存储 | 交易类函数 |
| `returns (type)` | 声明返回类型 | 注意有个 `s`，不是 `return` |
| `address` | 地址类型（0x开头42字符） | 钱包地址、合约地址 |
| `bytes32` | 固定 32 字节（64 字符 hex） | 哈希值、签名的 r 和 s |
| `uint8` | 8 位无符号整数（0~255） | 签名的 v 值 |
| `uint256` | 256 位无符号整数（最常用） | 金额、计数等 |

**`ecrecover` 内建函数：**
```solidity
ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address)
```
- 这是以太坊预编译合约提供的函数，直接从签名恢复公钥再算出地址
- 参数顺序记住：**hash 第一，v 第二**，r 和 s 第三第四
- 返回签名者的地址

**现在你要写的函数：**

```solidity
function recoverSigner(bytes32 hash, bytes32 r, bytes32 s, uint8 v)
    public
    pure
    returns (address)
{
    // 调 ecrecover，return 它的返回值
}
```
注意几点：
1. `public pure` 可以写在同一行也可以分两行，格式无所谓
2. `returns (address)` 不是 `return (address)`
3. 函数体里调 `ecrecover(hash, v, r, s)` 然后 `return` 它的结果

---

### `signMessage` 传了哈希值而不是消息字符串- ❌ 错误：`const sig = await wallet.signMessage(hashmsg);` — 把已经算好的 hash 传给了 `signMessage`
- 后果：`signMessage` 把 hash 当成普通字符串再做一次 EIP-191 哈希 → 签的是"二阶哈希" → `ecrecover` 用一阶哈希恢复地址 → 地址对不上
- ✅ 正确：`const sig = await wallet.signMessage("hello crosschain");` — 传原始消息字符串，`signMessage` 内部帮你做 EIP-191 哈希
- 💡 `wallet.signMessage(原始消息)` 会内部做哈希，`ethers.hashMessage(原始消息)` 只是算出这个哈希。两者对同一消息使用相同的 EIP-191 算法，所以签出来的签名和算出来的 hash 是配套的。**不要给 signMessage 预哈希过的值。**

---

## Solidity / 合约

---

## Hardhat / 编译部署

---

## ethers.js / JS 交互

### 原始 ECDSA 签名模板
relayer 脚本中对消息哈希签名，使用 `signingKey.sign()` 而非 `wallet.signMessage()`：

```js
const sig = signer.signingKey.sign(ethers.getBytes(msgHash));
const signature = sig.serialized; // 65 字节 flat sig（r+s+v）
```

- `signer` — `Wallet.createRandom()` 生成的钱包，或被 `setAuthorizedSigner` 授权的地址
- `msgHash` — 消息的 keccak256 哈希（leaf hash）
- **不要用 `wallet.signMessage()`**——那个加 EIP-191 前缀，合约的 `recoverSigner` 不认

来源：`test/verifier.test.js:79`

---

## 测试

---

## 跨链 / Relayer

### relayer 脚本调试：5 个编码一致性坑
写 `relayer-demo.js` 时遇到的坑，按排查顺序排列。根因几乎都是「链上链下编码不一致」。

**坑 1：require 引入脚本时执行了整份文件**

`require("./merkle.js")` 会执行 merkle.js 全文（包括底部的 `main()`），且 `const` 变量是模块作用域，外部拿不到。正确做法：

```js
// merkle.js 底部
if (require.main === module) {
  main();  // 只有直接 node merkle.js 时才跑，被 require 时不跑
}
module.exports = { encodeMessage, hashMessage, createMockMessages, buildMerkleTree, getProof, verifyProof };

// relayer-demo.js 顶部
const { createMockMessages, buildMerkleTree, getProof } = require("./merkle.js");
```

**坑 2：解构变量名和返回值属性名不匹配**

```js
// deployAndSetup 返回 { contract, owner, signer }
return { contract, owner, signer };

// ❌ 解构时写错名字 → undefined
const { contract, owner, authorizedSigner } = await deployAndSetup();

// ✅ 重命名解构
const { contract, owner, signer: authorizedSigner } = await deployAndSetup();
```

**坑 3：合约编码顺序 ≠ merkle.js 编码顺序**

合约 `verifyAndExecute` 的 `abi.encode` 顺序是 `(sender, recipient, amount, nonce, deadline, sourceChainId, targetChainId)`，但 merkle.js 原版是 `(sourceChainId, targetChainId, sender, ...)`。任何一方的顺序改动必须同步到另一方，否则签名恢复出的地址错误 → `InvalidSignature`。

**坑 4：`getProof()` 返回对象数组，合约要 `bytes32[]`**

```js
// merkle.js getProof 返回: [{ sibling: "0x...", isLeft: true }, ...]
// 合约 verifyAndExecute 需要: ["0x...", "0x...", ...]
const proofBytes32 = proof.map(p => p.sibling);
```

**坑 5：辅助函数覆盖了消息原有的 chain ID**

`buildVerificationParams` 用常量 `SOURCE_CHAIN_ID` / `TARGET_CHAIN_ID` 覆盖了消息对象的 `msg.sourceChainId` / `msg.targetChainId`，导致合约重算的 msgId 和 merkle tree 的 leaf hash 用的 chain ID 不同。**参数构建函数应该从消息对象取值，不要用常量覆盖。**

### merkle.js 模块导出模板
```js
// merkle.js 底部
if (require.main === module) {
  main();  // 直接运行时执行，被 require 时跳过
}

module.exports = {
  encodeMessage,
  hashMessage,
  createMockMessages,
  buildMerkleTree,
  getProof,
  verifyProof,
};
```

### 查询 mapping 用函数调用而非属性访问
Solidity 的 `public mapping` 在 ethers.js 中自动生成同名函数，要用 `()` 调用：

```js
// ❌ contract.executedMessages[msgId]
// ✅
const isExecuted = await contract.executedMessages(msgId);
const isApproved = await contract.approvedRoots(root);
```

---

## 其他
