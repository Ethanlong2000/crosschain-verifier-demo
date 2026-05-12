# 测试计划

> 记录当前 13 个测试各自想证明的安全假设，以及覆盖了哪些攻击场景。

---

## 测试总览

| # | 测试用例 | 在测什么 | 预期结果 |
|---|---------|---------|---------|
| 1 | 正确签名恢复出正确 signer | `recoverSigner` 纯函数正确性 | 恢复地址 = 签名者地址 |
| 2 | 签名长度不对应 revert | 签名输入格式校验 | `InvalidSigLength` |
| 3 | 正确签名 + 正确 root + 授权 signer → 成功 | happy path 完整链路 | emit `MessageExecuted`，`executedMessages` = true |
| 4 | 重复提交同一消息应失败 | 防重放 | `AlreadyExecuted` |
| 5 | 错误签名应失败 | 非授权者伪造签名 | `InvalidSignature` |
| 6 | 过期 deadline 应失败 | 消息时效性 | `MessageExpired` |
| 7 | 错误 proof 应失败 | Merkle proof 伪造 | `InvalidProof` |
| 8 | 未授权 signer 应失败 | 白名单机制 | `InvalidSignature` |
| 9 | 未批准 root 应失败 | root 信任机制（owner 未背书） | `RootNotApproved` |
| 10 | 错误 targetChainId 应失败 | 域隔离（签名不能跨链重放） | `InvalidSignature` |
| 11 | 非 owner 不能 approveRoot | 权限控制——root 批准 | `NotOwner` |
| 12 | 非 owner 不能 setAuthorizedSigner | 权限控制——签名者管理 | `NotOwner` |
| 13 | ECDSA 签名端到端 | `EcdsaDemo.sol` | 签名恢复正确 |

---

## 按安全属性分类

### 一、签名验证（测试 1, 2, 5, 8）

**想证明：** 只有被授权的签名者用正确私钥签出的名才能通过验证。

- 测试 1：`recoverSigner` 本身逻辑正确——给定正确的 hash + 签名，恢复出正确地址
- 测试 2：畸形签名（长度不对）在第一关就被拦截，不会进入 ecrecover
- 测试 5：不是授权者签的名（otherSigner 签了 signer 的消息），恢复出的地址不在白名单 → `InvalidSignature`
- 测试 8：签名者根本不在白名单里，即使签名本身有效也不放过 → `InvalidSignature`

### 二、Merkle proof 验证（测试 7）

**想证明：** 消息必须确实属于已承诺的 root 集合。签名对了但 proof 不对（root 不匹配 leaf），合约拒绝。

- 测试 7：root 已批准但与 msgId 不匹配，`verifyProof` 循环后 computedHash ≠ root → `InvalidProof`

### 三、Root 管理（测试 9, 11）

**想证明：** root 不是任何人都能批准的，只有 owner 有权背书。

- 测试 9：root 没被 `approveRoot` 批准过，即使 proof 和签名都正确也拒绝 → `RootNotApproved`
- 测试 11：非 owner 调 `approveRoot` 直接拒绝 → `NotOwner`

### 四、防重放（测试 4）

**想证明：** 同一条消息（相同 msgId）只能执行一次，不能反复提交。

- 测试 4：第一次成功 → `executedMessages[msgId] = true`；第二次相同参数 → `AlreadyExecuted`

### 五、时效性（测试 6）

**想证明：** 过期的消息无法被执行，防止 relayer 无限期搁置后突然提交。

- 测试 6：deadline 设为过去时间，`block.timestamp > deadline` → `MessageExpired`

### 六、域隔离（测试 10）

**想证明：** 为链 A 签的名不能用在链 B 上。`targetChainId` 被绑进 msgId，改任何参数签名就失效。

- 测试 10：签名时 targetChainId=5，调用时传 targetChainId=999 → 合约算出不同的 msgId → 签名不匹配 → `InvalidSignature`
- 同理也保护 `sourceChainId`，因为它们用同样的机制绑在 hash 里

### 七、权限控制（测试 11, 12）

**想证明：** 只有合约 owner 能管理 root 和签名者列表。

- 测试 11：非 owner 调 `approveRoot` → `NotOwner`
- 测试 12：非 owner 调 `setAuthorizedSigner` → `NotOwner`

---

## 覆盖的攻击场景

| 攻击类型 | 如何防御 | 对应测试 |
|---------|---------|---------|
| 重放攻击（同一条消息重复提交） | `executedMessages` mapping | 4 |
| 跨链重放（A 链的签名在 B 链用） | `targetChainId` 绑定进 msgId | 10 |
| 过期消息攻击（搁置后突然提交） | `deadline` 检查 | 6 |
| 伪造签名 | `ecrecover` + `authorizedSigners` 白名单 | 5, 8 |
| 伪造 proof（声称消息属于某个 root） | `verifyProof` Merkle 验证 | 7 |
| 未批准 root（绕过 root 管理） | `approvedRoots` mapping | 9 |
| 权限绕过 | `onlyOwner` modifier | 11, 12 |

---

## 已知简化

以下为当前项目有意简化、生产环境需要增强的点：

- **单叶树**：当前测试用单条消息（root = leaf, proof = []），未覆盖多条消息的 Merkle proof 场景。relayer-demo.js 已用 8 条消息验证了多叶 proof 的正确性。
- **Root 信任假设**：root 由 owner 手动批准，生产级应用需多签或轻客户端验证。
- **Signer 管理**：由 owner 手动维护白名单，未涉及 signer 轮换或撤销机制。
