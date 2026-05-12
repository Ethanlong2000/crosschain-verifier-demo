# 消息结构定义

> 本文档固定跨链消息的数据结构，后续合约开发、relayer 开发均以此为准。
> 修改本文件前需同步更新合约和 `scripts/merkle.js` 中的编码逻辑。

---

## 字段定义

| 序号 | 字段名                  | Solidity 类型 | 说明                                                                        |
| ---- | ----------------------- | ------------- | --------------------------------------------------------------------------- |
| 1    | `sourceChainId`       | `uint256`   | 源链 ID（以太坊主网=1，Sepolia=11155111，Goerli=5）                         |
| 2    | `targetChainId`       | `uint256`   | 目标链 ID                                                                   |
| 3    | `sender`              | `address`   | 源链消息发送者地址                                                          |
| 4    | `recipient`           | `address`   | 目标链消息接收者地址                                                        |
| 5    | `amountOrPayloadHash` | `bytes32`   | 消息携带的数据，目前用 `bytes32(0)` 占位，后续可替换为金额或 payload hash |
| 6    | `nonce`               | `uint256`   | 发送者消息序号，从 0 或 1 开始递增，用于防重放                              |
| 7    | `deadline`            | `uint256`   | 消息过期 Unix 时间戳，超时后合约拒绝执行                                    |

---

## 编码规则

### ABI 编码

按字段序号顺序，使用 Solidity 标准 ABI 编码：

```
abi.encode(sourceChainId, targetChainId, sender, recipient, amountOrPayloadHash, nonce, deadline)
```

### 消息哈希

```
messageHash = keccak256(abi.encode(...7个字段...))
```

### JS 侧实现

```js
const types = ["uint256","uint256","address","address","bytes32","uint256","uint256"];
const values = [msg.sourceChainId, msg.targetChainId, msg.sender, msg.recipient,
                msg.amountOrPayloadHash, msg.nonce, msg.deadline];
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, values);
const hash = ethers.keccak256(ethers.getBytes(encoded));
```

### Solidity 侧实现

```solidity
bytes32 messageHash = keccak256(
    abi.encode(sourceChainId, targetChainId, sender, recipient, amountOrPayloadHash, nonce, deadline)
);
```

---

## 为什么这些字段一个都不能少？

| 去掉哪个                              | 后果                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| `sourceChainId` / `targetChainId` | 同一签名可跨链重放——Sepolia 上的有效签名被拿到 Goerli 上用 |
| `sender`                            | 任何人可以伪造消息来源                                       |
| `recipient`                         | 消息可以被重定向到任意地址                                   |
| `amountOrPayloadHash`               | 无法区分不同内容的同签名消息                                 |
| `nonce`                             | 同一条消息可被 relayer 无限次重复提交                        |
| `deadline`                          | 消息可被无限期搁置后突然提交，sender 的意图早已改变          |

**核心原则：** 签名签的是这 7 个字段的 hash。改任意一个值，hash 就变，签名就失效。所以攻击者无法在不破坏签名的前提下篡改、重放、或重定向消息。

---

## 模拟消息约定

本地开发和测试期间，消息按以下规则生成（见 `scripts/merkle.js`）：

- `sourceChainId` = 1（模拟以太坊主网）
- `targetChainId` = 11155111（Sepolia）
- `sender` / `recipient` = `ethers.Wallet.createRandom().address` 生成随机地址
- `amountOrPayloadHash` = `ethers.ZeroHash`
- `nonce` = 从 0 开始递增
- `deadline` = `Math.floor(Date.now() / 1000) + 3600`（生成时刻起 1 小时）

---

## 变更记录

| 日期       | 变更             | 原因               |
| ---------- | ---------------- | ------------------ |
| - | 初版，7 字段固定 | 消息结构设计 |
