# Q&A 记录

> 本文档用于记录项目推进过程中遇到的问题及解答，方便日后查阅。

---

## 目录

- [环境与工具](#环境与工具)
- [Solidity / 智能合约](#solidity--智能合约)
- [Hardhat](#hardhat)
- [跨链相关](#跨链相关)
- [部署与测试](#部署与测试)
- [其他](#其他)

---

## 环境与工具

### 项目初始化各文件/目录的作用是什么？
**Q:** 初始化的项目为什么要设置那些东西，它们的作用和必要性是什么？
**A:**

- **package.json**：项目的身份证，定义名称、脚本命令和依赖。`scripts` 让你用 `npm run compile` 替代 `npx hardhat compile`。`devDependencies`（开发工具，如 Hardhat）与 `dependencies`（运行时需要的库，如 OpenZeppelin 安全合约模板）分开管理，生产环境不装开发工具。
- **hardhat.config.js**：整个 Hardhat 项目的总控台。指定 Solidity 编译器版本（锁定版本防止环境差异），配置网络（本地 hardhat 网 + Sepolia/Mumbai 两条测试网用于跨链），配置 Etherscan API Key 用于开源验证合约源码。
- **contracts/**：存放 `.sol` 智能合约源码。目前是占位状态。
- **scripts/deploy.js**：部署脚本，Hardhat 将配置注入到 `hre` 对象，在 `main()` 中写部署逻辑。
- **test/**：测试目录。合约部署后不可修改，bug 会直接造成资金损失，测试不是可选的而是必须的。
- **relayer/**：跨链中继器目录。两条链之间没有直接网络连接，中继器监听 A 链事件，构造交易提交到 B 链。
- **node_modules/**：`npm install` 自动下载的依赖代码，不要手动改，不要提交到 git。
- **package-lock.json**：锁定每个依赖的确切版本，保证团队环境一致。

---

## Solidity / 智能合约

---

## Hardhat

---

## 跨链相关

### 合约和 JS 的消息编码顺序为什么必须一致？
**Q:** 为什么改动了 merkle.js 的 `encodeMessage` 字段顺序后签名验证才通过？
**A:** 合约 `verifyAndExecute` 内部重算 `msgId`，和 JS 侧的 leaf hash 必须是**完全相同的输入**：

```solidity
// 合约侧
bytes32 msgId = keccak256(abi.encode(
    sender, recipient, amount, nonce, deadline, sourceChainId, targetChainId
));
```

```js
// JS 侧（merkle.js encodeMessage）
const values = [sender, recipient, amountOrPayloadHash, nonce, deadline, sourceChainId, targetChainId];
```

任何差异——字段顺序不同、多一个少一个字段、类型不匹配——都会导致两个 hash 完全不同。`ecrecover` 用合约重算的 hash 去恢复签名者，如果和 JS 签名时用的 hash 不一样，恢复出的地址就对不上 → `InvalidSignature`。

**教训：** 链上链下编码是"协议"，改一边必须改另一边。建议把编码顺序写在注释里，告诉未来的自己不要改。

### `getProof()` 返回 `{sibling, isLeft}` 为什么不能直接传合约？
**Q:** merkle.js 的 `getProof()` 返回的对象数组为什么不能直接传给合约的 `verifyAndExecute`？
**A:** 合约接收的是 `bytes32[] memory proof`——纯哈希数组。但 JS 侧 `getProof()` 返回的是 `[{sibling, isLeft}, ...]` 对象数组，因为 JS 验证 proof 时需要知道左右顺序。传给合约前需要用 `.map(p => p.sibling)` 提取纯 sibling 数组。`isLeft` 信息通过 `index` 参数隐含传递——合约在循环中根据当前 index 的奇偶判断左右。

---
## 跨链相关

### 测试脚本中 await 需要包在 async 函数里吗？
**Q:** 测试脚本中的 await 需要使用无头函数（IIFE）吗？
**A:** 不需要。Hardhat 测试框架的 `it("...", async () => { ... })` 回调已经是 async 函数，直接在里面 `await` 就行。这和 04 独立脚本不同——独立脚本顶层不是 async，才需要 IIFE 包裹。

### ethers.js 所有操作都需要 await 吗？
**Q:** ethers 所有操作都需要 await 吗？
**A:** 不是全部，区分规则：

| 不需要 await（同步）                        | 需要 await（异步）                                             |
| ------------------------------------------- | -------------------------------------------------------------- |
| `Wallet.createRandom()` — 本地生成随机数 | `wallet.signMessage()` — 虽然是本地运算，但 v6 返回 Promise |
| `ethers.hashMessage()` — 纯哈希计算      | `contract.xxx()` — 调合约方法（读/写链上数据）              |
| `ethers.keccak256()` — 纯哈希计算        | `factory.deploy()` — 部署合约                               |
| `ethers.Signature.from()` — 拆分签名     | `contract.waitForDeployment()` — 等部署确认                 |
| `ethers.verifyMessage()` — v6 中是同步   | `provider.getBalance()` — 查链上余额                        |

**判断方法：** 看文档或打印返回值——如果返回值是 `Promise { ... }`，就需要 await。涉及网络请求或交易确认的几乎都要 await，纯数学/内存计算的一般不需要。

### await 只处理成功，失败了怎么办？
**Q:** Promise 有 resolve 和 reject 两种结果，`await` 只能拿到 resolve 的值，reject 怎么处理？
**A:** `await` 遇到 Promise 被 reject 时会**直接抛出错误**，需要用 `try/catch` 接住。这和用 `try/catch` 捕获异步函数中错误地址的原理一样。

**在项目中三种场景的处理方式不同：**

| 场景                       | 策略                                                 | 示例                                                               |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| **测试——正常路径** | 不 catch，让测试失败就是我们要的结果                 | `const result = await contract.verify(...)`                      |
| **测试——预期失败** | 用 Chai 的 `.to.be.reverted`，不用自己写 try/catch | `await expect(contract.verify(badSig)).to.be.reverted`           |
| **脚本——需要容错** | 用 try/catch，失败时打日志、重试、或优雅退出         | `try { await contract.verify(...) } catch(e) { console.log(e) }` |

**一句话：** 测试里让错误直接炸（炸了等于测试失败，正是你要验证的），脚本里用 try/catch 兜底。

### Merkle tree 在跨链项目中的作用是什么
**Q:** Merkle tree 在跨链项目里要解决什么问题？
**A:** Merkle tree 解决的是「消息归属证明」，和 ECDSA 签名的「身份授权证明」是两层不同的保护：

| 机制         | 回答的问题                       |
| ------------ | -------------------------------- |
| ECDSA 签名   | 这条消息是 sender 本人发的吗？   |
| Merkle proof | 这条消息属于已承诺的那批消息吗？ |

**流程：** 源链上产生一批消息（比如 16 条），relayer 把这些消息串起来算一个 Merkle root。relayer 到目标链只提交 1 条消息 + 它的 Merkle proof + 预先存好的 root。合约拿着 (root, hashMessage(msg), proof) 验证消息确实属于那批承诺过的集合。

**为什么不能全部提交到链上？** gas 爆炸。100 条消息全存链上很贵，只存一个 32 字节的 root 是 O(1) 存储。

**两者缺一不可：** 签名对了但消息不在集合里 → 拒绝；消息在集合里但签名是假的 → 拒绝。

### 目标链合约怎么存 root？如何确定 root 是真实的？**Q:** 目标链合约是怎么存的 root？如何确定是真实的？
**A:** 这是简化版设计里最核心的**信任假设**。三种方案：

| 方案 | 怎么做 | 信任假设 |
|---|---|---|
| **管理员提交**（本项目采用） | 合约 owner 调 `approveRoot(root)` 存进 mapping | 信任 owner 不会提交假 root |
| **多签 / 共识** | N 个 relayer 各自签名，凑够 M 个才认可 | 信任 M 个 relayer 中多数诚实 |
| **轻客户端 / SPV 证明**（生产级） | 目标链验证源链区块头，从 event/receipt 提取 root | 不信任任何人，只信任源链共识 |

本项目选第一种——核心展示合约内部的验证链路（签名 + Merkle proof + 防重放），root 怎么来的作为另一层问题简化处理。文档注明此信任假设即可。

### relayer 为什么只需要提交 1 条消息而不是全部？**Q:** 「relayer 到目标链只提交 1 条消息 + 它的 Merkle proof + 预先存好的 root」——这 1 条消息是什么？为什么只需要 1 条？
**A:** 这 1 条消息就是 relayer **当前要执行的那一条**。relayer 不需要一次性把整批消息搬到目标链，可以逐条处理。

**为什么只需要 1 条：** Merkle root 是一次性承诺了全部消息的指纹。当 relayer 提交 msg1 + msg1 的 proof，目标链合约手里有 root，验证「msg1 + proof → 算出来的 root == 存的 root？」如果成立，就说明 msg1 确实属于当初承诺的那批。其他消息不需要出现——root 已经替它们担保了。

**一句话：** root = 一批消息的集体承诺，proof = 单条消息的出生证明。验 proof 通过就等价于验了整批。

### 消息结构的 7 个字段是什么？和整个项目有什么关联？
**Q:** 消息结构的 7 个字段是什么？它们各自的作用？为什么这些字段一个都不能少？
**A:**

| 字段                    | 类型        | 作用                                               |
| ----------------------- | ----------- | -------------------------------------------------- |
| `sourceChainId`       | `uint256` | 消息从哪条链发出（以太坊主网=1，Sepolia=11155111） |
| `targetChainId`       | `uint256` | 消息发往哪条链                                     |
| `sender`              | `address` | 谁在源链上发起了这条消息                           |
| `recipient`           | `address` | 目标链上谁接收／执行这条消息                       |
| `amountOrPayloadHash` | `bytes32` | 消息携带的数据，可能是金额或 payload 的 hash       |
| `nonce`               | `uint256` | 序号，每条消息唯一，用来防重放                     |
| `deadline`            | `uint256` | 过期时间戳，超时的消息不接受                       |

**关联整个项目：** 这 7 个字段全部打包在一起 hash，然后签名也签在这个 hash 上。改其中任何一个字段，签名就失效。

- **`sourceChainId` / `targetChainId`**：防止把 Sepolia 上的有效签名拿到另一条链上重放（域隔离）。签名里绑死了方向，例如只能在 Sepolia→Goerli 用。
- **`nonce`**：防止同一条链上同一个人重复发同一条消息（防重放）。每次发消息 nonce+1，合约记录已用过的 nonce，重复就拒绝。
- **`deadline`**：防止消息被无限期搁置后突然提交（时效性）。比如 relayer 拖了三天才交，你的意图可能早变了。
- **`sender` / `recipient`**：谁发给谁，权限控制的基础。
- **`amountOrPayloadHash`**：消息的实际内容。如果 payload 很大，链上只存 hash 不放完整数据。

**总结：** 这 7 个字段就是消息协议。JS 端定义 → 合约按它验证 → relayer 按它打包。后面所有东西都围绕这个结构转。

### 生产环境中 Merkle proof 是如何生成的？**Q:** 真正的生产环境中 Merkle proof 是如何生成的？

**A:** 两种主要模式：

**模式 1：Relayer 链下生成（Optimistic / 侧链桥）**
- 源链合约 emit 事件 → relayer 监听 → 攒一批事件 → 建 Merkle tree → 提交 root 到目标链 → 逐条生成 proof 并 submit
- 本质和你写的一样，区别是数据来自链上事件而非硬编码
- 例子：Arbitrum、Optimism 的跨链桥

**模式 2：链上直接验证（SPV / Light Client）**
- 目标链合约验证源链区块头，从 state root / receipt root 出发，用 Merkle Patricia proof 证明某事件确实在源链某区块里
- 不需要信任 relayer
- 例子：以太坊 PoS light client bridge

本项目的 relayer 是模式 1 的简化版，后续可接入合约事件。

### JS 和 Solidity 变量数据结构对比：为什么不一样？如何互相转换？**Q:** JS 和 Solidity 的变量数据结构有什么不同？为什么要转化？怎么转？

**A:** JS 跑在 V8 引擎，Solidity 跑在 EVM——两个运行时对底层表示完全不同。ABI 编码是约定好的公共序列化格式。

**核心类型对比：**

| 概念 | JS 原生 | Solidity 原生 | ABI 编码后 |
|---|---|---|---|
| 整数 | `number`（64 位浮点） | `uint256`（32 字节） | 左补零到 32 字节 |
| 地址 | `string`（`"0x..."`） | `address`（20 字节） | 左补零到 32 字节 |
| 哈希 | `string`（66 字符） | `bytes32`（32 字节） | 原样 32 字节 |
| 字节数组 | `Uint8Array` | `bytes`（动态） | 长度前缀 + 数据 |

**转化发生在两步：**
1. 语言原生类型 → ABI 标准 bytes（JS 用 `AbiCoder.encode()`，Solidity 用 `abi.encode()`）
2. bytes → keccak256 hash（两边算法相同）

只要字段顺序、类型、值都一致，hash 就一致。

**ethers.js v6 速查：**
| 操作 | API |
|---|---|
| JS 值 → ABI bytes | `AbiCoder.defaultAbiCoder().encode(types, values)` |
| ABI bytes → keccak256 | `ethers.keccak256(ethers.getBytes(abiBytes))` |
| 两个 bytes32 拼接 hash | `ethers.solidityPackedKeccak256(["bytes32","bytes32"], [a, b])` |
| hex → Uint8Array | `ethers.getBytes("0x...")` |
| Uint8Array → hex | `ethers.hexlify(uint8array)` |

### `ethers.getBytes()` 是干什么的？什么时候需要用？**Q:** `ethers.keccak256(ethers.getBytes(abiBytes))` 中的 `getBytes` 是什么意思？什么时候需要用到？
**A:** `getBytes` 把 hex 字符串（`"0x..."`）转成 `Uint8Array`（字节数组）。`keccak256` 需要的是原始字节而不是文本表示，`AbiCoder.encode()` 返回的是 hex 字符串，不转会出错或 hash 出错误结果。

**什么时候需要：**
| 场景 | 需要？ |
|------|--------|
| `AbiCoder.encode()` 返回值 → `keccak256` | ✅ |
| 已经是 Uint8Array | ❌ |
| `solidityPackedKeccak256` 参数 | ❌ 内部自己处理 |
| 手动拼接的 hex 字符串 | ✅ |

**一句话：** hex 字符串是给人看的，Uint8Array 是给 hash 函数吃的。

### forEach 回调参数踩坑：`(element, index)` 不会自动解构**踩坑：** 写了 `proof.forEach((sibling, isLeft) => {...})`，以为 forEach 会自动把 `{ sibling, isLeft }` 解构出来。
**原因：** `forEach` 的回调签名是 `(element, index, array)`，第一个参数是完整的数组元素（这里就是整个 `{ sibling, isLeft }` 对象），第二个参数是索引数字。不会自动解构。

**正确写法：**
```js
proof.forEach((item) => {
  if (item.isLeft) {
    // 用 item.sibling, computedHash
  } else {
    // 用 computedHash, item.sibling
  }
});
```
或者用解构语法：`proof.forEach(({ sibling, isLeft }) => {...})`。

### 什么是 ABI 编码？有什么用？**Q:** 什么是 ABI 编码？有什么作用？
**A:** ABI 编码是一套**数据打包规则**——把各种类型（uint256、address、bytes32 等）按固定格式拼成一串 bytes。

**为什么要用：** JS 脚本和 Solidity 合约需要算出完全相同的 hash。但两者内部数据表示完全不同（JS 数字是浮点 8 字节，Solidity 是 uint256 32 字节；JS 地址是字符串，Solidity 是 20 字节 address）。ABI 编码制定了一套共同序列化协议：

- JS 侧：`AbiCoder.encode(types, values)` → bytes → `keccak256` → hash
- Solidity 侧：`keccak256(abi.encode(field1, field2, ...))` → hash

两个 keccak256 的输入完全一样，输出就一样——这就是链上链下编码一致性的基础。

**一句话：** ABI 编码就是 Solidity 和 JS 之间约定好的数据序列化协议。

### encodeMessage 踩坑：AbiCoder.encode 第二个参数要数组不是对象**踩坑：** `ethers.AbiCoder.defaultAbiCoder().encode(types, msg)` 传入的是对象，报错。
**原因：** `AbiCoder.encode(types, values)` 的第二个参数需要按 types 顺序排列的**数组**，不是对象。对象 key 的顺序不可靠，所以 ethers 强制要求数组。

**正确写法：**
```js
const values = [
  msg.sourceChainId,
  msg.targetChainId,
  msg.sender,
  msg.recipient,
  msg.amountOrPayloadHash,
  msg.nonce,
  msg.deadline,
];
AbiCoder.encode(types, values);
```

**补充：为什么不能用 `Object.values(msg)`？** JS 对象的 key 顺序是插入顺序，和 ABI 编码要求的固定类型顺序是两回事。万一创建消息时 key 顺序不同，编码就乱了。建议用显式数组映射，一目了然。

### hashMessage 和 signMessage 各有什么用？为什么两个都要？
**Q:** 有了 `signMessage` 签名，为什么还要 `hashMessage` 单独算哈希？只签名不行吗？
**A:** 合约 `ecrecover` 需要 4 个参数：`ecrecover(hash, v, r, s)`。签名只提供 r/s/v，不提供 hash——因为 hash 是签名**对什么**的签名对象，不是签名的一部分。所以两条线缺一不可：

- `hashMessage`（Step 2）→ 产出 `hash` → 告诉合约「签了什么」
- `signMessage`（Step 3）→ 拆成 `r, s, v` → 告诉合约「怎么签的」
  合约拿 hash + r + s + v 反推出签名者地址。

---

## 部署与测试

---

## 其他

### 签名的「两个角色」：签名者和验证者
**Q:** `setAuthorizedSigner` 授权签名者，是不是因为发送消息和做验证是两个"角色"？
**A:** 对。签名者（signer）在链下用私钥签名消息，合约在链上没有私钥，只能通过 `ecrecover` 恢复地址后检查白名单。`setAuthorizedSigner` 就是在合约里登记「这个地址说的话算数」，没有被授权的人即使签名正确也会被拒绝（`InvalidSignature`）。

- signer → 链下签署人，有私钥
- 合约 → 链上验证者，看白名单
- `authorizedSigners` mapping → 白名单本身

### async 函数返回 Promise 要怎么写？
**Q:** 返回 Promise 对象要怎么做到，直接写 await 就行吗？
**A:** `async` 函数自动把 `return` 值包成 Promise，不需要手动构造：

```js
async function deployAndSetup() {
  const [owner] = await ethers.getSigners();  // 内部用 await
  return { contract, owner, authorizedSigner }; // return 普通对象
}
const result = await deployAndSetup(); // 调用方 await 解开 Promise
```

JSDoc 的 `@returns {Promise<{...}>}` 只是类型提示，不影响运行。

### Wallet 对象的本质是什么？
**Q:** Wallet 对象的本质是什么？
**A:** Wallet = 私钥的包装器，一个对象装了三样东西：

```
Wallet 对象
  ├── 私钥（privateKey） → 不能泄露，用于签名
  ├── 公钥（publicKey）  → 从私钥算出
  └── 地址（address）    → 从公钥算出，0x... 格式
```

`ethers.Wallet.createRandom()` 就是随机生成一个私钥，自动派生地址。`getSigners()` 返回的也是同类对象，只是私钥是 Hardhat 预设的。有私钥就能 `signingKey.sign(hash)` 签名。

### owner 和 signer 是什么关系？
**Q:** owner 和 signer 是什么关系？
**A:** 两条控制链，互不重叠：

| | owner（管理员） | signer（签名者） |
|---|---|---|
| 管什么 | 合约配置 | 消息授权 |
| 能调的函数 | `approveRoot`, `setAuthorizedSigner` | 无（链下签名） |
| 合约里的作用 | `onlyOwner` 修饰器保护 | `authorizedSigners` mapping 白名单 |

owner 通过 `setAuthorizedSigner(signer, true)` 把 signer 加入白名单——相当于委托 ta 去签名消息。owner 可以不是 signer，signer 也调不了 `approveRoot`。

### `getSigners()` 和 `Wallet.createRandom()` 的区别？
**Q:** `ethers.getSigners()` 和 `ethers.Wallet.createRandom()` 的区别？
**A:**

| | `getSigners()` | `Wallet.createRandom()` |
|---|---|---|
| 私钥来源 | Hardhat 预设（固定 20 个） | 随机生成（每次不同） |
| 余额 | 10000 ETH | 0 ETH |
| 能发交易 | 能（有 gas） | 不能（没钱付 gas） |
| 能签名 | 能 | 能 |
| 本项目用法 | owner、relayer | authorizedSigner |

**核心区别：需不需要花钱。** owner/relayer 要发交易（部署合约、提交验证），需要 ETH 付 gas；signer 只签名不做链上操作，不需要余额。

### `sig` 和 `signature` 的区别？
**Q:** `sig` 和 `signature` 有什么区别？
**A:** `sig` 是结构对象，`signature`（`sig.serialized`）是压扁后的 65 字节 hex 字符串：

```js
const sig = signer.signingKey.sign(ethers.getBytes(msgHash));
// sig = { r: "0x...", s: "0x...", v: 27 }   ← 三个字段分开

const signature = sig.serialized;
// signature = "0x..."                         ← r+s+v 拼成 65 字节
```

合约 `verifyAndExecute` 接收的是 `bytes memory signature`（flat），所以传 `sig.serialized`。合约内 `recoverSigner` 再用 assembly 拆回 r、s、v。

### 怎么在脚本里捕获 `MessageExecuted` event？
**Q:** 捕获 MessageExecuted event 怎么写？
**A:** 两种方式：

```js
// 方式一：从交易 receipt 拿（当前交易刚 emit 的）
const tx = await contract.verifyAndExecute(...);
const receipt = await tx.wait();
const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });

// 方式二：从链上历史搜（所有曾经 emit 的）
const events = await contract.queryFilter("MessageExecuted");
events.forEach(e => console.log(e.args.msgId, e.args.signer));
```

**Q:** `@returns {Promise<{contract: Contract, owner: Signer, authorizedSigner: Wallet}>}` 到底是返回什么？
**A:** 就是一个普通对象 `{ contract, owner, authorizedSigner }`，外面自动包了 Promise（因为函数是 async）。那串标注是给人看的类型提示，不影响运行：

- `contract` → ethers.js Contract 对象，可调合约方法
- `owner` → Hardhat 预设账户，能发交易
- `authorizedSigner` → `Wallet.createRandom()` 生成的随机钱包，用来签名

调用方 `const result = await deployAndSetup()` 自动去掉 Promise 壳，拿到 `{ contract, owner, authorizedSigner }`。

### JS 每行需要加分号吗？
**Q:** JS 每行需要加 `;` 吗？项目中有些加了有些没加，应该统一吗？
**A:** JS 分号在语法上是可选的（ASI 自动分号插入），但以下 5 种行首不加分号会导致 ASI 误判：

- `[` — 被当成上一行的下标访问
- `(` — 被当成函数调用
- `` ` `` — 被当成 tagged template
- `/` — 被当成除法
- `+` / `-` — 被当成上一行的加减法

**建议统一加分号。** 本项目 `verifier.test.js` 已经有加分号的习惯，`merkle.js` 风格不一致。没有 linter 的情况下，写顺手加 `;` 最安全，且和其他 JS 项目惯例一致。

### 部署合约的语法在哪？
**Q:** 部署合约的语法在哪？
**A:** 标准三行模板，两个测试文件里都有：

```js
// test/ecdsa-demo.test.js:21-23  首次使用
// test/verifier.test.js:21-23   再次使用
const Factory = await ethers.getContractFactory("ContractName");
const contract = await Factory.deploy();
await contract.waitForDeployment();
```

三步：`getContractFactory` → `deploy` → `waitForDeployment`。填 `relayer-demo.js` 的 `deployAndSetup()` 时直接复用即可。

### 部署合约三行代码详解
**Q:** 部署合约的代码是什么意思？
**A:**

```js
const Factory = await ethers.getContractFactory("CrossChainMessageVerifier");
const contract = await Factory.deploy();
await contract.waitForDeployment();
```

- **第 1 行 `getContractFactory`**：纯本地操作。Hardhat 去 `artifacts/` 目录找编译好的 JSON（bytecode + ABI），返回一个 Factory 工厂对象。参数名要和 `contracts/` 里的 `.sol` 文件名 + `contract` 关键字后的名字一致。
- **第 2 行 `Factory.deploy()`**：链上操作。构造部署交易，广播到网络，返回合约对象。此时交易可能还没确认，合约地址还是空的。
- **第 3 行 `waitForDeployment()`**：等待确认。等矿工打包后，合约地址确定，之后才能调 `contract.xxx()` 方法。

来源：`test/ecdsa-demo.test.js:21-23` 和 `test/verifier.test.js:21-23`。

### `ethers.getSigners()` 是什么？
**Q:** `// TODO 1: 获取 Hardhat signers（owner, relayer 等）` 是什么意思？
**A:** 一行代码取 Hardhat 本地网络的 20 个预设账户：

```js
const [owner, relayer] = await ethers.getSigners();
```

Hardhat 启动时自动创建 20 个账户，每个预充 10000 ETH。`getSigners()` 把它们取出来，按数组顺序解构：

- `[0]` → owner（部署合约、批准 root）
- `[1]` → relayer（提交 root、提交验证）
- `[2]` → 陌生人 等

已在 `test/verifier.test.js:15` 使用过：`[owner, stranger] = await ethers.getSigners();`

**与 `Wallet.createRandom()` 的区别：**

| | `getSigners()` | `Wallet.createRandom()` |
|---|---|---|
| 地址 | Hardhat 预设 | 随机生成 |
| 余额 | 10000 ETH | 0 ETH |
| 用途 | owner、relayer 等需要 gas 的角色 | 签名者（只需签名，不需要余额） |
