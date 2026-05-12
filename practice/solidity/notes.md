# Solidity 速查笔记

> 本文档覆盖 Verifier 合约需要的所有 Solidity 知识点。
> 每个概念标注了对应的练习编号，建议边练习边查阅。

## 框架总览 —— Solidity 和其他语言的根本区别

**写 Solidity 不像写 Python/JS，更接近写 C 或嵌入式固件。** 原因只有一条：代码一旦部署上链就不可更改，每一步都有 gas 成本。这导致：

| 维度 | 普通语言 | Solidity |
|------|---------|----------|
| 运行环境 | 操作系统 + 标准库 | EVM（裸机虚拟机） |
| 错误代价 | 改一行，重新部署 | 不能改，永久留在链上 |
| 执行成本 | 无感知 | 每一步都在烧钱 |
| 类型系统 | 可选 / 运行时推断 | 编译时强制，没有运行时 |
| 数据存放 | 随便（内存、磁盘、缓存） | 分三块：storage / memory / calldata |
| 升级 | 热更新 | 不可变（除非事先写了代理模式） |

**核心心智**：Solidity 的所有设计——必须声明类型、分 storage/memory/calldata、mapping 不能遍历、modifier、event——都是这六条底层约束推导出来的。把这份笔记里的每个概念往回推到这六条，就能串起来。

---

---

## 1. 数据类型速览

| 类型 | 位宽 | 示例 | 说明 |
|------|------|------|------|
| `uint256` | 256 bit | `uint256 count = 0;` | 无符号整数，默认 0 |
| `address` | 160 bit | `address owner = msg.sender;` | 以太坊地址 |
| `bytes32` | 256 bit | `bytes32 hash = 0x...;` | 定长字节数组 |
| `bool` | 8 bit | `bool done = false;` | 布尔值，默认 false |
| `string` | 动态 | `string name = "hello";` | 字符串（gas 贵，非必要不用） |
| `bytes` | 动态 | `bytes data = "0x1234";` | 动态字节数组 |

**注意：** Solidity 没有 `undefined`/`null`，所有变量都有默认值（0、false、0x0、""）。

### `delete` 关键字 —— 重置为默认值

`delete` 把任何变量重置为它的类型默认值，等价于手动赋零，但适用范围更广。

```solidity
// 基础类型
bool flag = true;
delete flag;          // flag = false（默认值）

uint256 count = 100;
delete count;         // count = 0（默认值）

address who = 0x...;
delete who;           // who = address(0)

// 映射值
delete approvedData[someHash];  // approvedData[someHash] = false

// 数组元素
delete arr[2];        // arr[2] = 0（bytes32 默认值），不是移除元素

// struct 字段
delete messages[0];   // 整个 struct 所有字段重置为各自的默认值
```

**`delete` vs `= false`：** 对 `bool` 类型效果相同（都变成 `false`），但 `delete` 的好处是**对所有类型统一语法**——`delete x` 就是"把 x 恢复出厂设置"，不管 x 是 bool、uint、address、struct 还是 mapping 里的值。

```solidity
delete approvedData[hash];   // ✅ 干净，适配任何类型
approvedData[hash] = false;  // ✅ 也对，但只对 bool 成立
```

**心态：** `delete` = 恢复出厂设置。不用记每种类型的默认值是什么，`delete` 替你搞定。

### 1.1 定长 vs 动态字节数组

| | 定长 `bytesN`（N=1~32） | 动态 `bytes` |
|---|---|---|
| 长度 | 编译时确定，不可变 | 运行时可变 |
| 存储 | 固定 slot（一个 `bytes32` 一个 slot） | 短数据压缩在一个 slot；长数据以 `keccak256(slot)` 为起始连续存放 |
| 操作 | 只能整体赋值 | `.push()` / `.pop()` / 下标访问 / `.length` |
| gas | 便宜 | 贵（需要堆分配） |
| 典型用途 | hash、selector、固定编码 | 任意长度原始数据 |

```solidity
// 定长
bytes32 public hash = keccak256(abi.encode("hello"));
bytes4  public selector = bytes4(keccak256("transfer(address,uint256)"));

// 动态
bytes public dynamicData;
function add(bytes memory _data) external {
    for (uint i = 0; i < _data.length; i++) {
        dynamicData.push(_data[i]);
    }
}
```

**选型直觉**：知道最大长度且 ≤ 32 字节 → `bytesN` 省 gas；长度不确定或需要拼接/追加 → `bytes`。

### 1.2 `bytes` vs `string`

| | `bytes` | `string` |
|---|---|---|
| 本质 | 原始字节序列 | UTF-8 编码的文本 |
| `.length` | ✅ | ❌（需 `bytes(str).length`） |
| 下标访问 | ✅ `data[i]` | ❌ |
| `.push()` | ✅ | ❌ |
| 何时用 | 编码、哈希、底层数据 | 明确表达"人类可读文本" |

```solidity
string name = "hello";
bytes memory b = bytes(name); // 转换后方可操作
uint256 len = b.length;       // 5
```

### 1.3 为什么字节数组在 Solidity 里如此重要

在其他语言中字节数组被标准库封装掉了（Python `bytes` / JS `ArrayBuffer`），日常业务代码很少直接操作。但 EVM 是**裸机级别的虚拟机**，没有操作系统和标准库，所有数据到了链上最终都是 raw bytes。字节数组在 Solidity 中高频出现，主要因为三件事：

1. **ABI 编码** — 每次调用合约函数，参数都按 ABI 规范编码成字节序列。函数选择器本身就是 `bytes4`：
   ```solidity
   bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));
   // → 0xa9059cbb
   ```

2. **哈希** — 交易 hash、区块 hash、地址、存储证明……全是 `bytes32`，无时无刻不在打交道：
   ```solidity
   bytes32 txHash = keccak256(abi.encode(msg.sender, amount, nonce));
   ```

3. **底层互操作** — `call` / `delegatecall` / `staticcall` 的输入输出都是 `bytes memory`。代理合约、ERC-4337 账户抽象等都需要手动拼装和解析 calldata：
   ```solidity
   (bool success, bytes memory returnData) = target.call(abi.encodeWithSignature(...));
   ```

| 层级 | 普通语言 | Solidity |
|---|---|---|
| 高层 | `String` / `JSON` / `Object` | `struct` / `string` / `mapping` |
| **低层** | `byte[]`（很少碰） | **`bytes` / `bytes32`（天天碰）** |

Solidity 没有 JSON 解析器、没有 HTTP 客户端、没有操作系统，离底层只隔了一层薄薄的 EVM，所以字节数组就是你的"通用数据格式"——编码用它，哈希用它，跨合约通信用它。

### 1.4 为什么 Solidity 必须声明类型

Python/JS 可以不写类型，但 Solidity 必须写。根本原因：**EVM 没有运行时的类型系统**，类型信息必须在编译期消化掉。

**三个硬约束：**

1. **存储槽分配** — EVM 的 storage 是 32 字节一个 slot 的 key-value 存储。编译器必须在编译时算出每个变量占哪个 slot、占几个 slot，才能生成正确的 `SLOAD`/`SSTORE` 指令。
   ```solidity
   uint256 a;  // slot 0，1 个 slot
   uint128 b;  // 可以挤在 slot 0（编译器优化）
   bytes32 c;  // slot 1
   bytes d;    // slot 2 存长度，数据从 keccak256(2) 开始
   ```

2. **Gas 计量** — 不同操作码 gas 差异巨大（`SSTORE` 20000 gas vs `MSTORE` 3 gas）。编译器必须根据类型选择正确的操作码序列，如果类型不确定，gas 根本无法预先计算。

3. **ABI 编码** — 函数选择器 = `keccak256(函数名 + 参数类型)` 的前 4 字节。`transfer(address,uint256)` 和 `transfer(address,uint128)` 产生完全不同的选择器。类型不声明，外部调用者不知道怎么编码 calldata。

| | Python / JS | Solidity |
|---|---|---|
| 运行时 | 解释器持有完整类型信息（PyObject 头部的 `ob_type`） | EVM 只认识 raw bytes |
| 内存管理 | GC 自动分配回收 | 编译时静态分配 slot |
| 成本模型 | 无 gas 概念 | 不同操作 gas 差异巨大 |
| 升级机制 | 热更新代码 | 字节码部署后不可变 |

**一句话**：Solidity 的类型声明不是语法品味问题，而是区块链上每一字节和每一条指令都必须预先算好——类型信息在编译时就已经全部转化为 slot 布局和操作码了。

### 1.5 Solidity 的"修饰"体系

Solidity 的修饰分三大类：

**变量 — Visibility**
| 修饰符 | 含义 |
|--------|------|
| `public` | 自动生成 getter，外部可读，合约内可写 |
| `private` | 只有合约内部可读写 |
| `internal` | 合约内部 + 子合约可读写 |

**变量 — Mutability**
| 修饰符 | 含义 | 赋值时机 | 读 gas |
|--------|------|----------|--------|
| `constant` | 编译时常量 | 声明时 | ~3 |
| `immutable` | 部署时常量 | constructor 里唯一一次 | ~3 |
| （无） | 普通 state 变量 | 任何时候 | 2100 (SLOAD) |

`immutable` 的本质：值在部署时被"焊"进合约字节码，读取时不需要 `SLOAD`。

**`constant` vs `immutable` 的本质区别 — 值确定的时机不同：**

```solidity
uint256 constant MAX = 10000;              // 编译时：写代码时就已知
address immutable owner = msg.sender;      // 部署时：交易上链那一刻才知道
uint256 immutable deployBlock = block.number;
```

- `constant`：编译器直接把值写死在字节码里，就像印刷时印在纸上的字——印之前就已经知道了。
- `immutable`：编译器留一个空位，部署时 EVM 把 `msg.sender` 等运行时值填进去——印刷时留空白，每本书盖上独一无二的章。
- 普通变量：不存字节码里，存在 storage 里（外挂本子），可随时擦写。

❌ `uint256 constant CREATOR = msg.sender;` —— 编译报错！因为编译时 `msg.sender` 还不存在。

**函数**
| 修饰符 | 含义 |
|--------|------|
| `public` | 内外都能调 |
| `private` | 只有本合约能调 |
| `internal` | 本合约 + 子合约能调 |
| `external` | 只有外部能调 |
| `view` | 只读，不修改链上状态 |
| `pure` | 纯计算，不读也不写链上状态 |
| `payable` | 可以接收 ETH |
| `virtual` | 允许子合约 override |
| `override` | 重写了父合约的函数 |

**自定义 modifier** — 可复用的前置检查：
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;  // 这里执行被修饰的函数体
}

function withdraw() public onlyOwner { ... }
// 先跑 onlyOwner 的 require → 通过后才进函数体
```

记忆口诀：**变量四件套（可见性 + constant/immutable），函数六件套（可见性 + view/pure），payable 收钱，virtual 留给子类，自定义 modifier 管权限和参数。**

### 1.6 基础类型什么时候用 —— 选型指南

**EVM 字长是 256 bit**，操作 `uint256` 只需一条指令。更小的类型（`uint64` 等）反而会多一条掩码指令，不省 gas。所以默认全用 256。

| 场景 | 类型 | 理由 |
|------|------|------|
| 余额、计数、ID、时间戳 | `uint256` | EVM 原生字长 |
| 结构体字段需要挤 slot | `uint128/64/32/8` | 省 storage 的 SSTORE |
| 负数（极少） | `int256` | 价格差、数学库 |
| 是/否标记 | `bool` | 语义明确 |
| 大量 bool flag | `uint256` bit 位 | 一个 slot 存 256 个 flag |
| 钱包/合约身份 | `address` | 160 bit，专为此设计 |
| 哈希、Merkle 根、盐 | `bytes32` | 正好一个 slot |
| 函数选择器 | `bytes4` | keccak256 前 4 字节 |
| 任意长度原始数据 | `bytes` | 可 push/pop/下标 |
| 人读文本 | `string` | 语义明确（但非必要别用，gas 贵） |

**`address` vs `address payable`**：0.8.x 起几乎无区别——`.transfer()` / `.send()` 已不推荐（固定 2300 gas 限制），统一用 `address` + `payable(addr).call{value: n}("")`。

**一条覆盖 90% 场景的规则**：数字用 `uint256`，身份用 `address`，哈希用 `bytes32`，标记用 `bool`。

---

## 2. storage vs memory vs calldata

| 关键字 | 位置 | 持久化 | gas | 何时用 |
|--------|------|--------|-----|--------|
| `storage` | 链上状态 | ✅ 永久存储 | 贵 | state variable 自动是 storage |
| `memory` | 内存 | ❌ 函数结束释放 | 便宜 | 函数内的临时变量 |
| `calldata` | 调用数据 | ❌ 只读 | 最便宜 | 函数参数（external 函数） |

### 2.1 "state" 是哪层含义

区块链本质是一个**状态机**——每笔交易都把"世界状态"从一个快照改到下一个快照。state variable 就是这个世界状态里的一条字段，存于链上，交易改完就永久留下。

```
世界状态 #0                      世界状态 #1（交易后）
├── 合约 A 的 count = 0           ├── 合约 A 的 count = 3  ← 改了
└── 合约 B 的 balances = ...      └── 合约 B 的 balances = ...
```

**相对概念是 local variable（局部变量）**——只在函数执行期间存在内存里，函数结束就丢弃，不进入世界状态。

| | state variable | local variable |
|---|---|---|
| 存在位置 | storage（链上） | memory（内存） |
| 可见范围 | 所有函数、所有交易 | 当前函数调用内 |
| 生命周期 | 永久 | 函数结束即销毁 |
| 声明位置 | 合约体内 | 函数体内 |

```solidity
contract Demo {
    uint256 public count;  // ← state variable（世界状态的一部分）

    function calc() public pure returns (uint256) {
        uint256 temp = 1 + 2;  // ← local variable（用完就扔）
        return temp;
    }
}
```

之所以叫"state"而不是"global/persistent"，因为以太坊黄皮书和 EVM 规范本身就以**状态机**模型定义——合约的 storage、账户的 balance 都是"世界状态"的一部分。

### 选择规则

```
函数参数：      external 函数用 calldata，public 函数能用 memory
函数内临时变量：用 memory
要修改 state：  声明为 storage 指针或直接操作 state variable
```

### 什么时候必须显式写关键字

**标量类型（uint/address/bool/bytes32/enum）永远不用写**——编译器全自动判断：

```solidity
uint256 count;          // 合约体 → 自动 storage
function foo(uint256 x) public {
    uint256 temp = count;  // 函数内 → 自动 memory，不用写关键字
}
```

**引用类型（string/bytes/数组/struct）必须写**——否则编译报错：

```solidity
// ❌ 编译报错：引用类型必须指定位置
function setName(string name) public { }
// ✅
function setName(string memory name) public { }
function setName(string calldata name) external { }

// 局部变量也要写
function foo() public {
    uint256[] memory ids = new uint256[](10);  // ✅ 必须 memory
}

// 返回值也要写
function getNames() public view returns (string[] memory) { }
```

**快捷决策表：**

| 类型 | 位置 | 需要写吗 |
|------|------|---------|
| `uint`/`address`/`bool`/`bytes32` | 任何位置 | ❌ 自动（合约体→storage，函数内→memory） |
| `string`/`bytes`/数组/struct | 合约体 state variable | ❌ 自动 storage |
| `string`/`bytes`/数组/struct | 函数参数/返回值/局部变量 | ✅ 必须写 |
| `mapping` | 任何位置 | ❌ 永远 storage，不能改 |

**心态**：写简单合约（全是 uint/address/mapping）时几乎不用管。一旦用 string/bytes/struct，编译器会报错提醒你，那时候写就行。

### 为什么编译器不统一要求写位置

**核心原则：位置关键字只解决"不明确"的情况，不解决"已确定"的情况。**

```
合约体内的变量      → 还能在哪？只能是 storage               → 不用写
函数内值类型局部变量  → 还能在哪？只能是 memory                → 不用写
函数内引用类型局部变量→ 可以是 memory，也可以是 storage 指针   → 必须写，编译器不知道你要哪个
mapping              → 永远只能在 storage                    → 不用写，写了 memory 反而报错
```

所以不是因为 `uint256` 特殊，而是因为**它出现的位置已经唯一确定了它应该在哪**。`mapping` 也是同样的道理——不是值类型，但因为只能存 storage，同样不用写。

反直觉的点：`mapping` 和 `uint256` 在这个问题上归为一类——都不需要写位置——但原因不同：
- `uint256`：值类型，任何位置都自动判断
- `mapping`：引用类型，但只有一种合法位置，写了也没得选

### 经典坑

```solidity
// ❌ 错：标量类型在函数内不能声明为 storage
function foo() public {
    uint256 x;  // ✅ 默认就是 memory，不需要也不能写 storage
}

// ✅ struct/array 可以从 storage 赋值给 memory（做了一份拷贝）
Message storage msg = _messages[id];  // ✅ 右边是 storage，msg 是 storage 指针
Message memory msg = _messages[id];   // ✅ 做了一份 memory 拷贝，不会改原数据

// ✅ 标量类型（uint/address/bool/bytes32）默认 memory，无需显式 key word
// ✅ mapping 永远在 storage，不能出现在 memory 或 calldata 中
// ✅ struct/array 在函数内默认 memory，除非显式声明 storage 指针
```

### 物理类比

```
storage   = 链上硬盘 → 写 20000 gas，关机也不丢。合约体里的变量默认是这个
memory    = 内存草稿纸 → 函数结束就扔。函数内临时变量默认是这个
calldata  = 交易自带的只读便签 → 不能写。external 函数的引用类型参数用这个最省
```

### 位置关键字和变量名的关系

`memory` 不是修饰符，是**类型的一部分**——告诉编译器这个变量放哪。

```
Message  memory  msg1   = Message(sender, hash, ts);
  ↑        ↑       ↑
 类型    放哪    变量名
```

翻译：「在 memory 里创建一个 Message 变量，名叫 msg1。」

```solidity
// 同一个类型 Message，三种位置 → 三种完全不同的行为
Message memory msg1 = Message(...);   // memory 拷贝，改了不影响链上
Message storage msg2 = messages[0];   // storage 指针，改了直接写链上
// calldata 只能用于 external 函数参数，不能这样声明局部变量
```

**为什么引用类型必须写位置：** 值类型（`uint256`/`address`/`bool`）在函数内只能是 memory，没歧义，不用写。引用类型（`Message`/`string`/`bytes`/数组）在函数内可以是 memory 拷贝也可以是 storage 指针——行为完全不同——编译器强制你写。

### 为什么函数返回值不能是 storage

`public`/`external` 函数返回引用类型时，必须写 `memory`，不能写 `storage`：

```solidity
// ✅ 返回 memory 拷贝
function getMessage(uint256 id) public view returns (Message memory) {
    return messages[id];  // 从 storage 读出，拷贝到 memory，编码后传出
}

// ❌ 编译报错：public 函数不能返回 storage 引用
function getMessage(uint256 id) public view returns (Message storage) {
    return messages[id];
}
```

**原因：storage 指针不能跨合约边界。** storage 指针本质上是一个 slot 号，只有合约自己知道怎么解引用。外部调用者（前端、其他合约）没有权限访问你的 storage，返回一个 slot 号毫无意义。所以 Solidity 编译器强制你用 `memory`——把链上数据拷贝到 memory，编码后传给调用者。

```
外部调用者  ← ABI 编码的实际数据 ←  [合约边界]  ← memory 拷贝 ← storage 原数据
                                             ← storage 指针 ✗ 传不出去
```

### 为什么到现在还没用到 calldata

三个位置你前两个都练过了，`calldata` 一直没出现，两个原因：

1. **你的练习函数都是 `public`，而 `calldata` 只用于 `external` 函数。** `public` 函数的引用类型参数只能用 `memory`：
   ```solidity
   function foo(string calldata s) public { }  // ❌ 编译报错
   function foo(string memory s) public { }    // ✅
   ```
   因为 public 函数可以被内部调用，内部调用时参数已在 memory 中，不能是 calldata。

2. **你的练习参数大多是值类型。** `uint256`/`address`/`bytes32` 不需要写任何位置关键字，自然也不会用到 `calldata`。

**什么时候会遇到：** Verifier 合约里写 `recoverSigner`，如果把签名参数声明为 `external`：
```solidity
function recoverSigner(bytes32 hash, bytes calldata signature) external pure returns (address) {
    // signature 在 calldata 里，只读，不占 memory，gas 最省
}
```

**三者使用场景总结：**

| | storage | memory | calldata |
|---|---|---|---|
| 读 state 变量 | ✅ | ✅ | ❌ |
| 写 state 变量 | ✅ | ❌ | ❌ |
| 函数内修改 | ✅ | ✅ | ❌ 只读 |
| gas 成本 | 最高（SLOAD/SSTORE） | 中等（MSTORE） | 最低（直接读 call data） |
| external 函数引用参数 | ❌ | 能但不省 | ✅ 最佳实践 |
| public 函数引用参数 | ❌ | ✅ | ❌ 编译报错 |
| 返回值 | ❌ 传不出合约 | ✅ | ❌ |
| 你练过吗 | ✅ | ✅ | ❌ 马上 |

**`msg.sender` 不在 calldata 里** — 它是交易元数据，EVM 在交易开始执行时自动填入，0 gas 读取。

---

## 3. mapping

### 语法

```solidity
mapping(KeyType => ValueType) visibility name;
// KeyType: 只能是 uint/address/bytes32 等值类型，不能是 string/struct/array
// ValueType: 任意类型（包括另一个 mapping）
```

### 常见模式

```solidity
mapping(address => uint256) public balances;
mapping(bytes32 => bool) public executedMessages;  // 防重放
mapping(bytes32 => bool) public approvedRoots;     // 根批准
```

### 为什么需要 mapping —— EVM 的存储模型

EVM storage 本质上是一个巨大的 key-value 数据库（每条 32 字节）。如果不通过 mapping，想把"身份/标识"和"值"关联起来：

```solidity
// ❌ 数组方案 — 不可行：用户地址是任意的，你不知道谁会来调
address[] users;        // 需要遍历才能找到某用户
uint256[] counts;       // 还要维护两个数组的同步

// ❌ 单独 slot 方案 — 不可能：有多少个地址？2^160
uint256 count_0xabc;
uint256 count_0xdef;
```

mapping 直接利用 EVM 的 keccak256 寻址——把 key 哈希映射到唯一 slot：

```
userCounts[0xabc] → storage[keccak256(0xabc, mapping自身的slot序号)]
```

不管 key 是什么值，都自动算出唯一存储位置，不需要遍历，不需要预留空间。本质上就是把以太坊的底层存储模型直接暴露给了开发者。

### 三个重要限制

- **不能遍历** — 没有 `.length`，没有迭代器。想知道所有用户？需额外维护地址数组
- **不存在的 key 返回默认值** — `balances[从未用过的地址]` 返回 `0`，不会抛异常
- **key 只能是基本值类型** — `address`、`uint256`、`bytes32` 可以；`string`、`struct`、数组不行
- `delete myMapping[key]` 重置为默认值

---

## 4. struct

### 类比

Solidity 的 struct 和其他语言一样——把相关字段打包成一个自定义类型：

| 语言 | 定义 | 创建 |
|------|------|------|
| Solidity | `struct Message { ... }` | `Message(sender, hash, ts)` |
| Python | `@dataclass class Message:` | `Message(sender, hash, ts)` |
| C/Go | `struct Message { ... }` | `Message{sender, hash, ts}` |
| JS | `{sender, hash, ts}` | 直接字面量 |

和 Python/JS 的关键区别：Solidity struct **不能包含方法**，纯粹的字段容器。

### 定义

```solidity
struct Message {
    address sender;
    bytes32 contentHash;
    uint256 timestamp;
}
```

### 创建和存取

```solidity
// 创建（两种方式，和 Python Point(1,2) vs Point(x=1, y=2) 一样）
Message memory msg1 = Message(sender, hash, block.timestamp);          // 位置参数
Message memory msg2 = Message({sender: sender, contentHash: hash,
                                timestamp: block.timestamp});         // 命名参数
// 位置参数必须按 struct 字段顺序写，同名不同类型容易写反 → 编译不报错，逻辑出 bug
// 推荐字段 3+ 时用命名参数
```

### 存到 mapping

```solidity
mapping(uint256 => Message) public messages;

function store(bytes32 hash) public {
    messages[0] = Message(msg.sender, hash, block.timestamp);  // ✅ storage
}
```

---

## 5. event + emit

### 为什么需要 event —— Solidity 的"日志系统"

区块链上的 storage 写很贵（20000+ gas），而且合约内部状态对链外不可见。event 提供了一个廉价的"广播"通道：
- 数据写到**交易收据的 logs 里**，不占 storage，gas 便宜
- 链外服务（前端、索引器）可以监听这些事件，获知合约发生了什么

**类比：** `event` ≈ 其他语言的 `console.log` / `logger.info()`，但是写到区块链交易收据里永久可查，而不是控制台。

| | event | storage |
|---|---|---|
| gas 成本 | 便宜（~375 + 375/字节） | 贵（20000 起） |
| 持久性 | 存于交易收据（历史节点可查） | 存于世界状态 |
| 可查询 | indexed 字段可过滤 | 只能通过 view 函数读 |
| 合约内可读 | ❌ 不能在合约代码里读取 | ✅ 可以 |

### 语法

```solidity
// 声明
event MessageStored(
    uint256 indexed msgId,    // indexed: 可搜索（最多 3 个 indexed）
    address indexed sender,   // indexed 参数存到 topic 中
    bytes32 contentHash       // 非 indexed: 存到 data 中
);

// 触发
emit MessageStored(msgId, msg.sender, contentHash);
```

### indexed 详解 —— 为什么需要、怎么用

**`indexed` 决定字段能不能被链下按值搜索。** EVM 日志的物理结构是：

```
logs = [topic0, topic1, topic2, topic3, data]
        ↑ 事件签名  ↑ indexed 参数（最多 3 个）       ↑ 非 indexed 参数
          keccak256("MessageStored(uint256,address,bytes32)")
```

- `topic`：32 字节定长，像数据库的索引列，筛选时直接匹配
- `data`：非 indexed 参数按 ABI 编码拼接，必须完整解码才能知道内容

**类比：** `indexed` ≈ SQL 的 `WHERE` 可过滤列，非 `indexed` ≈ 只能 `SELECT *` 再自己解析的 JSON blob。

```solidity
event MessageStored(
    uint256 indexed msgId,     // → topic[1]，可以 search by msgId
    address indexed sender,    // → topic[2]，可以 search by sender
    bytes32 contentHash        // → data，不能直接搜索
);
```

链下按 sender 筛选时：
```js
// 只拉取 sender = 0xabc 的事件，其他全跳过 —— indexed 让筛选发生在节点侧
contract.queryFilter(
    contract.filters.MessageStored(null, "0xabc", null),
    fromBlock, toBlock
);
// 如果 sender 没加 indexed，只能拉全部 MessageStored 事件然后 JS 遍历过滤
```

**三个限制：**

| 限制 | 说明 |
|------|------|
| 最多 3 个 indexed | topic 数组只有 4 槽，topic[0] 已被事件签名占用 |
| 引用类型 indexed 存哈希 | `string`/`bytes`/数组加 indexed，topic 里存的是 `keccak256(原值)`，搜也按哈希搜，找不回原文 |
| 每个 indexed 多 ~375 gas | 写 topic 比写 data 贵，只给真正需要筛选的字段加 |

**决策表：**

| 字段用途 | indexed？ | 理由 |
|----------|----------|------|
| 消息 ID / 唯一标识 | ✅ | relayer 按 ID 追踪状态 |
| 发送者 / 接收者地址 | ✅ | 前端查"某地址的所有消息" |
| 内容哈希 / payload | ❌ | 不需要按哈希筛选；若是 `bytes32`，indexed 也不丢信息，但通常不查 |
| 时间戳 | ❌ | 极少按具体秒数筛选，都在 JS 侧排序 |

JS 侧监听：
```js
const tx = await contract.storeMessage(hash);
const receipt = await tx.wait();
// 通过 receipt.logs 或 contract.on("MessageStored", ...) 获取
```

---

## 6. modifier + _;

### 为什么需要 modifier —— 可复用的前置守卫

没有 modifier 时，权限检查散落在每个函数开头，重复代码遍地：

```solidity
function withdraw() public { require(msg.sender == owner); ... }
function setConfig() public { require(msg.sender == owner); ... }
function pause()     public { require(msg.sender == owner); ... }
```

modifier 把这段检查**抽成一个命名片段**，像 Python 的装饰器或 Express.js 的中间件：

```solidity
// 旧式（require 字符串）
modifier onlyOwner() { require(msg.sender == owner); _; }

// 新式（自定义 error，推荐）
error NotOwner(address caller);
modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner(msg.sender);
    _;
}

function withdraw() public onlyOwner { ... }
```

**类比：**
| 语言 | 类似机制 |
|------|---------|
| Python | `@login_required` 装饰器 |
| Express.js | `app.use(authMiddleware)` 中间件 |
| Java | AOP `@Before` 切面 |

### 语法

```solidity
// 定义自定义 error
error NotOwner(address caller);
error ZeroValue();

// modifier 基本结构
modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner(msg.sender);
    _;  // ← 这里执行被修饰的函数体
}

modifier nonZero(bytes32 value) {
    if (value == bytes32(0)) revert ZeroValue();
    _;
}

// 组合使用
function doSomething(bytes32 data) public onlyOwner nonZero(data) {
    // 先检查 onlyOwner → 再检查 nonZero → 才执行这里
}
```

### 为什么 modifier 里用 require/revert 而不是 if

**`require`/`revert` 失败回滚整个交易，`if` 只是跳过。**

```
require/revert 失败 → 交易 revert，所有修改撤销，剩余 gas 退回
if 失败            → 不执行 _，但交易"成功"，调用者不知道没执行
```

```solidity
// ❌ 用 if 绕过 —— 不报错，调用者以为成功了
modifier onlyOwner() {
    if (msg.sender == owner) {
        _;   // 是 owner 才执行
    }
    // 不是 owner 这里悄悄结束，不 revert
}

// ✅ 旧式 require —— 不是 owner 直接回滚
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

// ✅ 新式 revert 自定义 error —— 更省 gas
modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner(msg.sender);
    _;
}
```

`modifier` 的职责是**守卫**——不满足条件整件事就不该发生。守卫不能用悄悄跳过的方式，必须回滚。

### modifier 什么时候需要参数

**不需要参数：** 检查条件依赖的是合约全局状态（state variable），modifier 直接读取即可。

```solidity
modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner(msg.sender);  // owner 全局变量，直接读
    _;
}
```

**需要参数：** 检查条件依赖的值每次调用都不同，必须通过参数传入。

```solidity
modifier notApproved(bytes32 dataHash) {         // dataHash 每次调用不同
    if (approvedData[dataHash]) revert AlreadyApproved(dataHash);
    _;
}

function approveData(bytes32 hash) public onlyOwner notApproved(hash) {
    // onlyOwner 无参数（检查全局 owner）
    // notApproved 有参数（检查本次传入的 hash）
}
```

**判断标准：** 如果这个值在合约里是一个 state variable 且唯一不变（如 `owner`）→ 无参数。如果每次调用时值不同（如 `dataHash`、`amount`、`id`）→ 必须传参。



## 7. constructor

### 语法

```solidity
// ✅ 正确：constructor 是一个特殊关键字，不是函数
constructor() {
    owner = msg.sender;
}

constructor(uint256 _initialSupply) {
    totalSupply = _initialSupply;
}

// ❌ 错误：这是旧语法（Solidity 0.4.x），0.5+ 已经移除
function MyContract() public { ... }       // 编译报错！
function constructor() public { ... }      // 编译报错！
```

**和普通函数的区别：**
- 不能加 `function` 关键字
- 不能有可见性修饰（`public`/`internal`）——自动 internal
- 不能有返回值（`returns(...)`）
- 整个合约生命周期只执行一次——部署时

### 直觉理解 —— constructor 就是合约的"出厂设置"

把合约想象成一台自动售货机。你开了一家工厂，每造一台机器，出厂前要设置：这台机器归谁管、初始库存多少。constructor 就是这张"出厂设置清单"——机器一旦运到街上（部署上链），清单就烧掉了，再也改不了。

```solidity
contract 售货机 {
    address public immutable 老板;
    uint256 public 单价;

    constructor(uint256 _初始单价) {
        老板 = msg.sender;    // 谁出钱部署，谁就是老板
        单价 = _初始单价;      // 部署时定好价格
    }
}
```

部署时：
```
你调用 constructor(500) → 一台单价 500、老板是 0x... 的售货机永久留在链上
别人调用 constructor(300) → 一台单价 300、老板是 0x... 的售货机永久留在链上
```

同一份代码，不同的部署参数，产生不同的合约实例。蓝图一样，造出来的机器配置不同。

没有 constructor 会怎样？owner 就是默认值 `0x000...000`，等于没有主人，没人能调用 `onlyOwner` 保护的功能。constructor 给了合约一个**有意义的初始状态**。

### 类比

和其他 OOP 语言一样：部署时执行一次，负责合约的初始化。区别在于 Solidity 合约**部署后不能修改代码**，所以 constructor 是部署者唯一可以"配置"合约的机会。

| | Java/Python/JS | Solidity |
|---|---|---|
| 调用几次 | 每次 `new` 都调，可能几万次 | **一次**，部署那一刻 |
| 入参从哪来 | 代码里写 `new Foo(42)` | 部署交易自带 calldata |
| 能改吗 | 对象可以销毁重建 | 合约一旦部署**永远**不能改代码 |
| 所以 | 别的地方也可以设初值 | **这是唯一一次设置机会** |

```solidity
address public immutable owner;

constructor(uint256 _initialSupply) {
    owner = msg.sender;           // immutable 只能在 constructor 里赋值一次
    totalSupply = _initialSupply; // 普通 state variable 也可以在这里设初始值
}
```

| | 普通语言的 constructor | Solidity constructor |
|---|---|---|
| 调用时机 | 每次 `new` 创建对象 | 仅部署时一次 |
| 参数 | 任意 | 部署交易的 calldata 传入 |
| 限制 | 无特别限制 | 不能写 `function` 关键字，仅 `constructor()` |

`immutable` 为什么便宜：值在部署时焊进合约字节码，读取不需要 SLOAD（2100 gas）。详见 1.5 节。

### 踩坑记录：immutable 不加 public 无法从外部读取

```solidity
// ❌ 没有 public → 不生成 getter → 合约外部（前端/测试）读不到
address immutable owner;

// ✅ 加了 public → 编译器自动生成 owner() getter
address public immutable owner;
```

`immutable` 只管"值焊进字节码，省 gas"，不管"让外部读到"。想让外部读取还是需要加 `public`（或自己写 getter 函数）。

**教训：** `public` + `immutable` 是常见组合：部署时设定、永久不变、外部可读、不花 SLOAD。

### constructor 什么时候需要传参

**决策标准：部署时才知道、且以后不能改的值，通过参数传入。**

| 值来源 | 需要参数？ | 例子 |
|--------|----------|------|
| 链上环境（`msg.sender`、`block.number`、`block.chainid`） | ❌ 0 gas 直接读取 | `owner = msg.sender` |
| 部署者决定（初始供应量、初始白名单、初始配置） | ✅ 部署交易 calldata 传入 | `constructor(uint256 _supply)` |
| 编译时已知（常量） | ❌ 用 `constant`，不进 constructor | `uint256 constant MAX = 10000` |

```solidity
// 不需要参数 —— 值来自链上环境
constructor() {
    owner = msg.sender;
    deployBlock = block.number;
}

// 需要参数 —— 初始供应量，部署者指定，事后不能改
constructor(uint256 _initialSupply) {
    totalSupply = _initialSupply;
}

// 需要参数 —— 部署时指定初始签名者列表
constructor(address[] memory _initialSigners) {
    for (uint i = 0; i < _initialSigners.length; i++) {
        authorizedSigners[_initialSigners[i]] = true;
    }
}
```

### 常见坑：constructor 体内声明局部变量

```solidity
address public immutable owner;

// ❌ 错——在函数体内写了类型名，变成了声明新局部变量，state variable 没被赋值
constructor() {
    address owner = msg.sender;  // 局部变量，函数结束就销毁
}

// ✅ 对——不加类型，直接赋值给 state variable
constructor() {
    owner = msg.sender;
}
```

Solidity 里 `Type name = value;` 永远是声明新变量。给已存在的变量赋值不需要也不能加类型。

---

## 8. 如何写函数

一个 Solidity 函数由五部分组成，按固定顺序排列：

```solidity
function 函数名(参数列表) 可见性 读写性质 returns (返回值类型) {
    // 函数体
}
```

### 拆解

**1. `function` 关键字**

永远以 `function` 开头。只有 constructor 不加 `function`。

**2. 参数列表**

```solidity
// 值类型（uint/address/bool/bytes32）：直接写类型名
function foo(uint256 x, address who, bool flag) public { }

// 引用类型（string/bytes/数组/struct）：必须写 calldata 或 memory
function bar(string calldata name) external { }   // external 用 calldata,最省gas
function baz(string memory name) public { }       // public 用 memory
```

**3. 可见性（必填）**

| 修饰符 | 谁能调用 |
|--------|---------|
| `public` | 内外都能调 |
| `private` | 只有本合约能调 |
| `internal` | 本合约 + 子合约能调 |
| `external` | 只有外部能调（省 gas，直接从 calldata 读参数） |

**4. 读写性质（选填，不写表示会改状态）**

| 修饰符 | 含义 | 能读 state | 能写 state |
|--------|------|-----------|-----------|
| （不写） | 可能修改状态 | ✅ | ✅ |
| `view` | 只读，不改状态 | ✅ | ❌ |
| `pure` | 不读也不写，纯计算 | ❌ | ❌ |
| `payable` | 可以接收 ETH | ✅ | ✅ |

**5. 返回值**

```solidity
// 写法一：只写类型（推荐，最常用）
function getCount() public view returns (uint256) {
    return totalCount;
}

// 写法二：命名返回值（相当于在函数体开头声明了一个局部变量）
function getCount() public view returns (uint256 count) {
    count = totalCount;  // 不用再声明 uint256 count
    return count;        // 或者不写 return，自动返回 count
}

// 写法三：多返回值
function getBoth() public view returns (uint256 myCount, uint256 total) {
    return (userCounts[msg.sender], totalCount);
}
```

### 完整示例

```solidity
function increment() public {
    userCounts[msg.sender] += 1;   // 改 state，所以不加 view
    totalCount += 1;
}

function getMyCount() public view returns (uint256) {
    return userCounts[msg.sender];  // 只读，所以加 view
}

function add(uint256 a, uint256 b) public pure returns (uint256) {
    return a + b;                   // 不读也不写state，所以加 pure
}

function setNickname(string calldata nick) external {
    // calldata：external函数的引用类型参数最省gas
    nicknames[msg.sender] = nick;
}

function transfer(address to, uint256 amount) public returns (bool) {
    require(balances[msg.sender] >= amount, "Not enough");
    balances[msg.sender] -= amount;
    balances[to] += amount;
    return true;                    // 返回值可被前端/其他合约捕获
}
```

### 反直觉的点

- **Solidity 函数写在合约里，不是文件顶层。** 没有合约外面的独立函数，一切函数都是某个合约的方法。不像 Python/JS 可以在文件顶层定义函数。
- **返回值名在 returns 里声明。** 和 C/Go 一样，返回类型写在后面而不是前面。
- **参数和返回值都可以省略。** `function hello() public { }` 就是最简单的函数（不过一般至少有用才写）。
- **`public` 的函数会自动生成 getter。** 如果你写 `uint256 public totalCount;`，编译器相当于自动帮你写了一个 `function totalCount() public view returns (uint256)`。所以你不用手动给 state variable 写 getter——加 `public` 即可。

### 常见报错原因

```
// ❌ 忘了写可见性
function foo() { }               // 编译报错！

// ❌ 引用类型参数没写 calldata/memory
function bar(string name) public { }  // 编译报错！

// ❌ public 函数用 calldata（public 只能用 memory）
function baz(string calldata name) public { }  // 编译报错！

// ❌ external 函数用 memory（能用但不省gas，应该用 calldata）
function qux(string memory name) external { }  // 能编译但 gas 贵
```

### 快速决策口诀

**写一个函数时，按这个顺序过一遍：**

```
1. 谁调它？  → 选 public / external / private / internal
2. 它碰 state 吗？ → 选 view / pure / 不写
3. 参数里有 string/bytes/struct/数组吗？ → 加 calldata 或 memory
4. 要返回东西吗？ → 加 returns (类型)
```

### 可见性 —— 两步决策

第一步：这个函数**外部**需要调用吗？

```
外部需要调（前端/其他合约）
├─ 内部也可能调  → public
└─ 只给外部调    → external（更省 gas）

外部不需要调
├─ 子合约可能用  → internal
└─ 仅本合约用    → private
```

**经验比例：** 一个典型合约里，`external` 最多（用户操作入口），`public` 其次（view 查询），`internal` 偶尔（内部逻辑拆分），`private` 很少。

### 读写性质 —— 一眼判断

**唯一判断标准：有没有碰 state variable？**

```
读 state ？    写 state ？
  ❌            ❌    → pure（纯计算，a+b 这种）
  ✅            ❌    → view（查询，getter 这种）
  ✅ / ❌        ✅    → 不写（改状态，transfer/increment 这种）
```

**一眼判断法：** 函数体里出现了合约级别的变量名（如 `totalCount`、`userCounts`），且不是赋值给它 → `view`；赋值了 → 不写。

- `pure` 最严格——参数进，结果出，不碰任何合约状态，甚至不能读
- `view` 中间级——能读合约状态，但不能改
- 不写最宽松——什么都能做
- `payable` 是额外叠加的——和上面三个独立，表示"能收 ETH"

### 实例拆解：为什么 increment() 不能加 pure

```solidity
function increment() public {
    userCounts[msg.sender] += 1;  // 写了 state variable
    totalCount += 1;              // 写了 state variable
}
```

逐条对照 `pure` 的禁令：

| 禁令 | `increment()` 的行为 | 违反？ |
|------|---------------------|--------|
| 不能读 state variable | 读了 `userCounts[msg.sender]` 的原值才能 +1 | ✅ 违反 |
| 不能写 state variable | 写了 `userCounts[msg.sender]` 和 `totalCount` | ✅ 违反 |
| 不能读 `msg.*` / `block.*` / `tx.*` | 读了 `msg.sender` | ✅ 违反 |

三重违反，编译器直接报错：`Function declared as pure, but this expression reads from the state or from msg.sender`。

**`pure` 的精确边界**——以下全部禁止：

```
❌ msg.sender, msg.value, msg.data, msg.sig
❌ block.timestamp, block.number, block.chainid
❌ tx.origin, tx.gasprice
❌ 读取任何 state variable（包括 mapping）
❌ 写任何 state variable
✅ 只能读函数参数和局部变量
✅ 纯计算（算术、哈希、编码等）
```

**`view` 的精确边界**：

```
✅ msg.*, block.*, tx.* 都可以读
✅ 可以读 state variable
❌ 不能写 state variable
❌ 不能 emit event（event 也算写）
```

**一个函数该加什么？30 秒判断法：**

```
1. 函数里出现了 = xxx 给 state variable 赋值？ → 什么都不加（不是 pure，也不是 view）
2. 函数里没有赋值，但读了 state variable 或 msg.sender？ → view
3. 函数里既没读也没写 state，也没用 msg/block/tx？ → pure
```

### 组合速查表

最常见的六种组合，覆盖 90% 场景：

| 签名 | 用途 |
|------|------|
| `function foo() external` | 用户操作入口（mint、transfer、投票） |
| `function foo() external view returns (...)` | 外部查询（但 view 函数更习惯用 public） |
| `function foo() public view returns (...)` | 查询、getter，前端和其他合约都调 |
| `function foo() public pure returns (...)` | 工具函数、数学计算 |
| `function foo() internal` | 内部共享逻辑，子类可 override |
| `function foo() external payable` | 收 ETH 的入口 |

**不需要记的：** `private view`、`internal pure`、`public payable` 这类组合合法但极少出现，遇到了再查就行。

---

## 9. require / revert / assert

### 前置概念 —— 什么是回滚（revert）

区块链上每笔交易是**原子操作**——要么全部成功，要么全部不发生。回滚就是"全不发生的机制"。

```
交易开始
  totalCount += 1;              ← 修改 1（已写入 storage）
  userCounts[msg.sender] += 1;  ← 修改 2（已写入 storage）
  require(false, "boom");       ← 这里失败！触发回滚
   → 修改 1 和修改 2 全部撤销
   → 合约状态回到这笔交易开始前
交易结束（失败），已消耗的 gas 不退
```

**类比：** 银行转账——从 A 扣了 100 块，准备往 B 加 100 块时系统崩了。没有回滚 → A 的钱凭空消失。有回滚 → A 的 100 退回，世界恢复原样。

**关键：回滚是 EVM 自动的**——你不需要写"如果失败就还原 xxx"，`require`/`revert` 一旦触发，EVM 会撤销本次交易内所有 `SSTORE`、转账等操作。你只管判断"条件不对就报错"，回滚是 EVM 兜底。

### 三种机制一句话概括

| 机制 | 作用 | 类比 |
|------|------|------|
| `require(条件, "错误信息")` | 条件不满足就回滚 | Python `assert` / JS `if (!cond) throw` |
| `revert("错误信息")` | 无条件回滚 | Python `raise ValueError()` |
| `assert(条件)` | 内部不变量检查，不通过消耗全部 gas | C `assert()`，绝不该失败的检查 |

### 语法详解

**`require` — 前置条件校验（最常用）**

```solidity
// 基本语法：require(条件, "失败时的错误信息");
require(msg.sender == owner, "Not owner");
require(balances[msg.sender] >= amount, "Insufficient balance");
require(block.timestamp <= deadline, "Expired");
require(!executedMessages[msgId], "Already executed");

// require 在函数开头出现，校验输入和状态
function transfer(address to, uint256 amount) public {
    require(balances[msg.sender] >= amount, "Not enough");
    // 通过后执行
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
```

**`revert` — 无条件回滚 + 自定义错误**

```solidity
// 方式 1：revert("字符串") —— 和 require(false, "msg") 等价
if (msg.sender != owner) {
    revert("Not owner");
}

// 方式 2：revert CustomError() —— 更省 gas（推荐）
// 先定义错误（合约顶层，和 event 并列）
error NotOwner(address caller);
error AlreadyApproved(bytes32 dataHash);
error InvalidSignature(address signer);

// 再使用
if (msg.sender != owner) {
    revert NotOwner(msg.sender);  // 只传 4 字节 selector，不传长字符串
}
```

**`assert` — 内部不变量检查（极少用）**

```solidity
// 只用于"理论上绝不可能发生"的情况
assert(totalCount >= userCount);  // 数学不变量
assert(address(this).balance >= 0);  // 余额不能为负

// 如果 assert 失败 → 消耗全部 gas → Panic error 0x01
// 和 require/revert 不同：不返还剩余 gas，说明代码有 bug
```

### 类比

Solidity 的异常机制和普通语言的 throw/exception 不同——它必须**显式地**调用 `require` / `revert` 来中止执行并回滚交易。

| Solidity | Python | JS |
|----------|--------|-----|
| `require(cond, "msg")` | `if not cond: raise ValueError("msg")` | `if (!cond) throw new Error("msg")` |
| `revert CustomError()` | `raise CustomException()` | `throw new CustomError()` |
| `assert(cond)` | `assert cond`（但 Python assert 可被关闭） | `console.assert(cond)` |

### 为什么 revert 是默认选择，assert 极少用

**所有 `require`/`revert` 都返还剩余 gas**——交易失败但不会吞掉用户的 gas limit。只有 `assert` 会消耗全部 gas，所以只在**"这件事理论上绝不可能发生"**时用（比如数学溢出、内部不变量被破坏）。实际开发中 99% 的场景用 `require` 或 `revert`。

| 机制 | gas 返还 | 何时用 |
|------|----------|--------|
| `require(cond, "msg")` | 返还剩余 gas | 用户输入校验、权限检查 |
| `if (!cond) revert("msg")` | 返还剩余 gas | 同上，更灵活 |
| `if (!cond) revert CustomError()` | 返还剩余 gas，省 calldata | **推荐**：自定义错误 |
| `assert(cond)` | 消耗全部 gas | 内部不变量检查（极少用） |

### 推荐写法演进

```solidity
// 旧式
require(msg.sender == owner, "Not owner");

// 新式（更省 gas——错误信息不占 calldata，4 字节 selector 替代长字符串）
error NotOwner(address caller);

if (msg.sender != owner) revert NotOwner(msg.sender);
```

### 自定义 error 详解

**是什么：** 自定义 error 是一个**类型定义**——声明「有这样一种错误，携带这些参数」。和 `event` 结构几乎相同，只是关键字不同。它替代 `require("长字符串")` 用 4 字节 selector 代替任意长度字符串。

**逐字段拆解：**

```solidity
error   NotOwner   (address caller) ;
  ↑        ↑            ↑          ↑
 关键字   错误名      参数列表     分号

// 参数写法和函数参数一样：类型 + 参数名
error AlreadyApproved(bytes32 dataHash);
error TransferFailed(address from, address to, uint256 amount);
error ZeroAddress();  // 也可以没有参数
```

**和 event 对比——结构一样，职责不同：**

```solidity
event MessageStored(uint256 indexed msgId, address indexed sender);  // 向外广播
error NotOwner(address caller);                                       // 向内回滚
```

**定义 vs 使用——是两个动作：**

```solidity
// 定义（合约顶层）——声明"有这样一种错误类型"
error NotOwner(address caller);

// 使用（函数/modifier 内部）——触发错误，回滚交易
if (msg.sender != owner) revert NotOwner(msg.sender);
```

**`revert NotOwner(msg.sender)` 做了什么：** 算出 `NotOwner` 的 selector（`keccak256("NotOwner(address)")` 的前 4 字节），和 `msg.sender` 的 ABI 编码一起写入 returndata，回滚交易。ethers.js 能解码显示 `NotOwner(0xabc...)` 而不是一串看不懂的 bytes。

**定义位置：** 合约顶层，和 `event`、`struct`、state variable 并列，不在函数内部。习惯放在 state variable 前面，统一就好：

```solidity
contract AccessControl {
    // 错误定义（合约顶层）
    error NotOwner(address caller);
    error AlreadyApproved(bytes32 dataHash);
    error ZeroAddress();

    // state variables...
    // constructor...
    // functions...
}
```

**使用方式：** 必须配合 `if (!cond) revert Error();`，不能像 `require` 那样内联条件。

```solidity
// require 风格 —— 条件 + 回滚写在一起
require(msg.sender == owner, "Not owner");

// 自定义 error 风格 —— 条件判断和回滚分开写
if (msg.sender != owner) revert NotOwner(msg.sender);
```

**为什么省 gas：** `require("Not owner")` 把字符串 `"Not owner"` 完整存入 calldata，字符串越长 gas 越贵。自定义 error 只传 4 字节 selector（如 `0xabcdef01`），参数（如 `msg.sender`）编码进 returndata，总体比存长字符串省很多。

```
require("Not owner")
→ calldata 存 "Not owner"（10 字节 × 68 gas/字节 = 680 gas，非零字节）
→ revert 时返回 Error(string) selector + ABI 编码的字符串

revert NotOwner(msg.sender)
→ calldata 只存 NotOwner 的 4 字节 selector
→ revert 时返回 selector + ABI 编码的 caller 地址
→ 省掉了字符串存储和编码
```

**参数可以有，也可以没有：**

```solidity
error ZeroAddress();                        // 无参数
error NotOwner(address caller);             // 一个参数
error TransferFailed(address from, address to, uint256 amount);  // 多个参数
```

**练习 04 建议写法：**

```solidity
error NotOwner(address caller);
error AlreadyApproved(bytes32 dataHash);

modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner(msg.sender);
    _;
}

modifier notApproved(bytes32 dataHash) {
    if (approvedData[dataHash]) revert AlreadyApproved(dataHash);
    _;
}
```

**require vs 自定义 error 的选型：**

| | `require(cond, "msg")` | `revert CustomError()` |
|---|---|---|
| 写法 | 一行 | 两行（`if` + `revert`） |
| gas | 稍贵（存字符串） | 省 gas |
| 可读性 | 字符串直接可读 | 需要查合约源码 |
| 适用 | 简单校验、prototype | 生产合约、高频调用 |

---

## 10. keccak256 与内置全局函数

### Solidity 有哪些内置函数

Solidity 没有 `import` 语句引入标准库——所有内置函数都是**全局可用**的，直接在代码里调用。这和 Python `import hashlib` 或 JS `require('crypto')` 完全不同。

**记住：没有 `import`，没有 `using`，没有路径。就是裸调用。**

### 完整清单（按使用频率排）

**哈希类**

| 函数 | 签名 | 说明 |
|------|------|------|
| `keccak256` | `(bytes memory) → bytes32` | 输入必须是 `bytes`，返回 32 字节哈希 |
| `sha256` | `(bytes memory) → bytes32` | SHA-256，用于比特币跨链验证 |

**ABI 编码类**

| 函数 | 说明 |
|------|------|
| `abi.encode(...)` | 补零到 32 字节对齐，可解码 |
| `abi.encodePacked(...)` | 紧密打包，省 gas，但有碰撞风险 |
| `abi.encodeWithSelector(bytes4, ...)` | 编码函数调用，拼接 selector + 参数 |
| `abi.encodeWithSignature(string, ...)` | 同上，先算 selector |
| `abi.decode(bytes, (...))` | 解码 calldata / returndata |

### 什么是 selector（选择器）

**selector = 函数/错误/事件签名的 keccak256 哈希的前 4 字节。** 它是函数名的数字 ID，EVM 用它代替完整的函数名字符串来节省空间。

```solidity
// 计算 selector
bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));
//             = 0xa9059cbb
//
// keccak256("transfer(address,uint256)") 完整输出：
//   0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b
//   ^^^^^^^^ 前 4 字节就是 selector
```

**所有东西都有 selector：**

```solidity
// 函数 selector → calldata 前 4 字节
bytes4 fnSel = bytes4(keccak256("transfer(address,uint256)"));
// → 0xa9059cbb → 告诉 EVM 要调哪个函数

// 错误 selector → revert 时写入 returndata
error NotOwner(address caller);
// keccak256("NotOwner(address)") 的前 4 字节 → 告诉链下这是 NotOwner 错误

// 事件 selector → 存入 topic[0]
event MessageStored(uint256 indexed id, address indexed sender, bytes32 hash);
// keccak256("MessageStored(uint256,address,bytes32)") → topic[0]
```

**为什么省 gas：** 4 字节 selector 是固定长度，不随函数/错误名字变长而变大。

```
require("Not owner")              → 存 "Not owner"（10 字节 × 68 gas = 680 gas）
revert NotOwner(msg.sender)       → 存 4 字节 selector + ABI 编码的参数
```

名字 "NotOwnerIsVeryVeryLongLong" 再长，selector 永远是 4 字节。

**区块和交易信息（全局变量，不是函数，但同样零成本读取）**

| 变量 | 类型 | 说明 |
|------|------|------|
| `block.timestamp` | `uint256` | 区块时间戳（秒） |
| `block.number` | `uint256` | 当前区块号 |
| `block.chainid` | `uint256` | 链 ID |
| `msg.sender` | `address` | 调用者地址 |
| `msg.value` | `uint256` | 携带的 ETH（wei） |
| `msg.data` | `bytes calldata` | 完整的 calldata |
| `tx.origin` | `address` | 交易发起者（慎用，钓鱼风险） |
| `tx.gasprice` | `uint256` | 交易的 gas price |

### `msg` 全局消息对象 — 理解执行上下文

`msg` 不是单个变量，而是一个**全局消息对象**（类似 HTTP 的 `req` 对象），每笔交易由 EVM 自动注入。所有函数内都能直接访问，0 gas 读取。

```
msg.sender   → 谁在调这个函数（address，最常用）
msg.value    → 调用时带的 ETH（uint256，单位 wei）
msg.data     → 完整的函数调用 calldata（bytes，底层操作）
msg.sig      → 函数选择器 = msg.data 的前 4 字节（bytes4）
```

关键：`msg.sender` 是**直接调用者**，不是原始发起者。

```
A --调--> B --调--> C
  msg.sender=A    msg.sender=B    ← 在 C 里 msg.sender 是 B，不是 A
```

`tx.origin` 才返回 A（原始交易发起者），但**不推荐用于权限检查**——攻击者可以诱骗你调用恶意合约，在恶意合约里 `tx.origin` 仍然是你，但 `msg.sender` 是恶意合约。钓鱼合约利用这个骗过 `tx.origin` 检查。99% 的场景用 `msg.sender` 就对了。

**地址方法**

| 方法 | 说明 |
|------|------|
| `addr.balance` | 该地址的 ETH 余额 |
| `addr.code` / `addr.codehash` | 该地址的字节码 / 字节码哈希 |
| `addr.call{value: n}(data)` | 低级调用，发送 ETH + calldata |
| `payable(addr).transfer(n)` | 发送 ETH（固定 2300 gas，不推荐） |

**数学和工具**

| 函数 | 说明 |
|------|------|
| `type(T).min` / `type(T).max` | 类型的范围 |
| `gasleft()` | 剩余 gas |
| `blockhash(blockNumber)` | 最近 256 个区块的 hash（超了就返回 0） |
| `string.concat(...)` | 字符串拼接（0.8.12+） |
| `bytes.concat(...)` | 字节拼接（0.8.4+） |

### keccak256 的使用模式

```solidity
// keccak256 只接受一个参数，类型是 bytes。所以必须先把数据编码成 bytes：

// ❌ 错误——参数太多了
keccak256(a, b, c);           // 编译报错！

// ✅ 正确——先编码再哈希
keccak256(abi.encode(a, b, c));

// ✅ 紧密打包版
keccak256(abi.encodePacked(a, b));

// ✅ literal 字符串也可以（编译器会自动转 bytes）
keccak256("transfer(address,uint256)");
```

**核心模式：** `keccak256(abi.encode(参数...))`——先用 abi.encode 把参数序列化成 bytes，再用 keccak256 算哈希。

### 对比 Python

```python
# Python — 需要 import
from eth_hash.auto import keccak
from eth_abi import encode
result = keccak(encode(['uint256', 'address'], [a, b]))

# Solidity — 全局可用，直接调用
bytes32 result = keccak256(abi.encode(a, b));
```

---

## 11. abi.encode vs abi.encodePacked

### 类比

| | `abi.encode` | `abi.encodePacked` |
|---|---|---|
| 类比 | `JSON.stringify` — 每个字段补零对齐到 32 字节，结构化 | 字符串拼接 `"" + a + b` — 紧密挤在一起 |
| 结果 | 始终可解码还原（知道每个参数边界） | 无法可靠解码（不知道哪是哪） |

### 为什么需要两种

普通语言序列化只有一种方案（如 `JSON.stringify`），Solidity 分两种是因为 **gas 成本**：补零多占空间多花钱，在 Merkle 树等需要反复 hash 的场景，用 `abi.encodePacked` 能省不少 gas。但**错误使用会出安全漏洞**——看碰撞。

| | `abi.encode` | `abi.encodePacked` |
|---|---|---|
| 编码方式 | 每个参数补零到 32 字节 | 紧密打包，不补零 |
| 碰撞风险 | 无 | **有**（不同输入可能打包成相同 bytes） |
| 何时用 | **消息哈希、签名验证** | 需要匹配旧合约、节约 gas 的特殊场合 |
| 示例 | `keccak256(abi.encode(a, b))` | `keccak256(abi.encodePacked(a, b))` |

### 碰撞示例

```solidity
abi.encodePacked("ab", "c")  → "0x616263"
abi.encodePacked("a", "bc")  → "0x616263"  // 一样！碰撞！
```

### 为什么动态类型会碰撞，定长不会

**encodePacked 就是把字节首尾相接拼起来，不记边界。** 就像把两段绳子系成一根——事后看不出来接头在哪。

```
encode  = 每个参数占满 32 字节，有固定边界
          [-----"ab"------][------"c"------]  清清楚楚

packed  = 紧密拼接，边界消失
          [ab][c] = 0x616263                   分不清哪是哪
          [a][bc] = 0x616263                   一样的字节序列！
```

**根本原因：** `"ab"` 和 `"c"` 是动态类型（长度可变），打包后接收方无从知道原始边界在哪——`0x616263` 到底是 `("ab", "c")` 还是 `("a", "bc")` 还是 `("abc", "")`？

**定长类型为什么安全：** `uint256` 永远是 32 字节，`bytes32` 永远是 32 字节。两个 32 字节拼起来总长 64 字节，前 32 字节一定是第一个参数，后 32 字节一定是第二个——边界永远不会模糊。

```
abi.encodePacked(uint256(1), uint256(2))
→ [000...001][000...002]  长度64字节，前32=1，后32=2，不混淆
```

**一句话：** 定长类型用 `encodePacked` 安全（Merkle 树两个 `bytes32`），只要参数列表里出现一个 `string` / `bytes` / 动态数组，就必须用 `encode`。

### 为什么哈希了还是不能防碰撞

直觉上可能觉得"反正最后都要 keccak256，哈希会掩盖掉歧义"。但恰好相反——keccak256 是确定性函数，相同输入永远产出相同输出。碰撞发生在**编码阶段**，哈希只是忠实地记录了这个错：

```
Alice 签名 hash("ab", "c")
                    ↓
         packed: 0x616263
                    ↓
         keccak256: 0xd3f...

攻击者声称 hash("a", "bc")
                    ↓
         packed: 0x616263     ← 和上面一样！（碰撞发生在这里）
                    ↓
         keccak256: 0xd3f...  ← 哈希自然也相同
```

攻击者不需要破解 keccak256，只需要构造另一组参数使其 packed 结果相同即可。**用 `abi.encode` 就不会：**

```
hash("ab", "c"):  encode → [00...61626300][00...6300] → 0xa1b...
hash("a", "bc"):  encode → [00...6100][00...626300]    → 0x9e2...  ≠
```

**核心：碰撞不是 keccak256 的问题，是 encodePacked 让不同的输入在进哈希之前就变成了一样的东西。**

### 全定长参数为什么要用 encode

一个直觉反驳：`uint256`、`address`、`bytes32` 全是定长，用 `encodePacked` 技术上不会碰撞。那为什么消息哈希还是用 `encode`？

**原因：链下一致。** 你的 JS 前端 / ethers.js 默认用的是标准 ABI 编码：

```js
const hash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "bytes32"], [a, b, c]
    )
);
```

前端 `AbiCoder.encode` 走的是 `abi.encode`（每个参数补零到 32 字节）。链上用 `encodePacked`，两边算出来的哈希不一样，签名验证就永远对不上。

| 场景 | 用哪个 | 理由 |
|------|--------|------|
| 哈希需要和链下匹配（签名验证、前端提交证明） | `abi.encode` | 和 JS/ethers 默认行为一致 |
| 纯链上内部使用（Merkle 树拼接两个 bytes32） | `abi.encodePacked` | 省 gas，且定长类型无碰撞风险 |

**所以"消息哈希一律用 encode"有两层原因：防碰撞是外层（动态类型场景），链下兼容是里层（全定长场景）。**

**本项目原则：消息哈希一律用 `abi.encode`，Merkle 树内部用 `abi.encodePacked`（两个定长 bytes32 不会碰撞）。**

---

## 12. ecrecover 签名格式

### 是什么

`ecrecover` 是以太坊的**签名恢复算法**——给定一条消息的 hash 和某人的签名 `(v, r, s)`，反推出签名者地址。类比：现实中的笔迹鉴定——看到签名就能判断是谁签的。

### 工作原理

```
签名者用私钥签名 → 产生 (v, r, s)
任何人拿到 (消息, v, r, s) → ecrecover 算出签名者地址 → 核对是否匹配
```

这就是链下签名 / 链上验证（gasless meta-tx、permit 等）的底层原语。

### 代码

```solidity
// Solidity 要求 v = 27 或 28（以太坊标准）
// ethers.js v6 的 Signature.from() 默认返回 v = 27/28
// 但 ethers v5 和某些库可能返回 v = 0/1，需手动 +27

address signer = ecrecover(messageHash, v, r, s);
require(signer != address(0), "Invalid signature");
```

**本项目已验证 ethers v6 返回 v=27/28，两边一致。**

### 签名拆分 —— 从 bytes memory 到 r/s/v

ethers.js 产出的签名是一个 65 字节的 `bytes`：`r`（32 字节）+ `s`（32 字节）+ `v`（1 字节）。Solidity 的 `ecrecover` 需要拆开的三分量，所以必须拆分。

**方法一：abi.decode（推荐，干净）**

```solidity
function recoverSigner(bytes32 hash, bytes memory signature)
    public pure returns (address)
{
    // ethers.js v6 flat signature: r(32) + s(32) + v(1) = 65 bytes
    require(signature.length == 65, "Invalid sig length");
    
    bytes32 r;
    bytes32 s;
    uint8 v;
    
    // abi.decode 从 signature 头部依次解码
    // 注意：abi.decode 的 offset 从 0 开始，但 signature 前 32 字节存了长度
    // 所以实际数据从第 32 字节开始
    assembly {
        r := mload(add(signature, 32))
        s := mload(add(signature, 64))
        v := byte(0, mload(add(signature, 96)))
    }
    
    // ethers.js v6 返回 v=27/28，如果遇到 0/1 加 27
    if (v < 27) {
        v += 27;
    }
    
    return ecrecover(hash, v, r, s);
}
```

**方法二：纯 abi.decode（仅当签名格式是 ABI 编码的 tuple）**

```solidity
// 如果链下用 abi.encode(r, s, v) 打包
(bytes32 r, bytes32 s, uint8 v) = abi.decode(signature, (bytes32, bytes32, uint8));
```

实际开发中方法一更通用，因为 ethers.js 的 `signature` 字段默认是 flat bytes。

**记忆：** r 和 s 各 32 字节，v 是最后 1 字节。拆分就是把 65 字节切成这三段。

---

## 13. 数组与 for 循环

### 数组类型

Solidity 数组分定长和动态两种：

```solidity
// 定长数组 —— 长度编译时确定
bytes32[10] fixedProof;                  // 正好 10 个 bytes32

// 动态数组 —— 长度运行时可变
bytes32[] dynamicProof;                  // 存储用
bytes32[] memory proof = new bytes32[](5); // 内存中用 new 关键字创建
```

**Merkle proof 永远用动态数组**——因为不同层的树的 proof 长度不同（16 条消息的树 proof 为 4 个元素，8 条消息为 3 个元素）。

### 数组操作

```solidity
bytes32[] memory arr = new bytes32[](3);
arr[0] = 0x...;         // 下标赋值
uint256 len = arr.length; // 读长度（memory 数组不可改长度）
arr.push(0x...);         // 追加（仅 storage 动态数组可用）
arr.pop();               // 删除最后一个（仅 storage 动态数组可用）
delete arr[0];           // 重置为默认值 0x00...00
```

### for 循环

和 C/JS 一样的语法，但注意 gas：

```solidity
// 基础 for 循环
for (uint256 i = 0; i < arr.length; i++) {
    // arr[i] ...
}

// Merkle proof 验证的典型 for 循环
for (uint256 i = 0; i < proof.length; i++) {
    // 每层计算一次哈希
}
```

**gas 提醒：** for 循环的每次迭代都有 gas 开销。Merkle proof 验证的迭代次数 = proof 长度 = log₂(叶子数)，通常 ≤ 10 次，gas 完全可接受。

### 常见坑

```solidity
// ❌ storage 数组在 memory 中不能用 push
bytes32[] memory memArr;
memArr.push(0x...);  // 编译报错！memory 数组没有 push

// ✅ 在 storage 中可以用 push
bytes32[] public storageArr;
function add(bytes32 val) public {
    storageArr.push(val);  // ✅
}

// ❌ 越界访问
bytes32[] memory arr = new bytes32[](3);
arr[5] = 0x...;  // runtime revert！

// ✅ 用 .length 做边界保护
require(i < arr.length, "Out of bounds");
```

### 对比 JS

| | JS | Solidity |
|---|---|---|
| 定长数组 | `new Array(10)` | `bytes32[10]` |
| 动态数组 | `[]` | `bytes32[]` |
| 创建内存数组 | `new Array(n).fill(0)` | `new bytes32[](n)` |
| `.length` | ✅ | ✅ |
| `.push()` / `.pop()` | ✅ | ✅（仅 storage） |
| `.map()` / `.filter()` | ✅ | ❌ |
| `for...of` | ✅ | ❌，只有 `for(;;)` |

---

## 14. Merkle Proof 链上验证

### 算法

Merkle proof 验证的核心：**从 leaf 出发，按 proof 数组逐层哈希，最终得到 root，比对**。

```
每层操作：
  if (在左) hash(leaf, proof[i])
  if (在右) hash(proof[i], leaf)
  leaf = 上述结果
最后一层处理后，leaf === root → 验证通过
```

### 完整实现

```solidity
function verifyProof(
    bytes32[] memory proof,   // proof 元素数组（兄弟节点）
    bytes32 root,             // 已批准的 Merkle root
    bytes32 leaf,             // 待验证的叶子（通常是消息的 keccak256）
    uint256 index             // 叶子在树中的位置（用于判断左右）
) public pure returns (bool) {
    bytes32 computedHash = leaf;
    
    for (uint256 i = 0; i < proof.length; i++) {
        bytes32 proofElement = proof[i];
        
        // 当前节点在左 → hash(computedHash, proofElement)
        // 当前节点在右 → hash(proofElement, computedHash)
        if (index % 2 == 0) {
            computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
        } else {
            computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
        }
        index = index / 2;  // 上移一层
    }
    
    return computedHash == root;
}
```

### 为什么这里用 abi.encodePacked 是安全的

proof 里每个元素和当前 computedHash 都是 `bytes32`（定长 32 字节），两个定长值拼接总长 64 字节，永不碰撞。详见第 11 节。

### 调用方代码

```solidity
function verifyAndExecute(
    bytes32[] memory proof,
    bytes32 root,
    bytes32 msgId,      // keccak256(abi.encode(sender, recipient, amount, nonce, deadline, chainIds...))
    uint256 index,
    bytes memory signature
) public {
    // 1. 验证消息属于已批准 root
    require(verifyProof(proof, root, msgId, index), "Invalid proof");
    
    // 2. 恢复签名者
    address signer = recoverSigner(msgId, signature);
    
    // 3. ... 后续检查
}
```

### 内存分配提醒

`verifyProof` 的参数 `bytes32[] memory proof` 会让调用者把整个 proof 数组传入内存。单次调用的 proof 通常 3-10 个元素，每个 32 字节，几十到几百字节，gas 开销很小。

---

## 15. 校验链路设计模式

### 核心思想

Verifier 合约的核心是一个**流水线校验函数**——每一步验证一件事，任何一步失败都立即 revert（剩余 gas 退回）：

```
原始输入（relayer 提供的所有参数）
  proof, root, sender, recipient, amount, nonce, deadline, chainIds, index, signature
         ↓
  重建消息哈希 → 恢复签名者 → 检查签名者授权
         → 验证 Merkle proof → 检查 nonce（防重放）
         → 检查 deadline → 执行（修改状态 + emit event）
```

**「原始输入」是什么：** 合约自己没有数据来源，全部依赖调用者（relayer）传入。relayer 链下监听到源链事件后，提取消息字段，生成 Merkle proof，然后把所有东西打包成一次函数调用传给合约。合约的职责不是"知道发生了什么"，而是**验证别人说的事是不是真的**。所以全部数据都从函数参数来，没有从 storage 猜测。

### 为什么必须按这个顺序

Step 4-6（proof / nonce / deadline）都消耗 storage 读（2100 gas 一次），而 step 2（ecrecover）消耗计算但无 storage 访问。**把便宜的校验放前面，失败早退出，省的 gas 多。** 但 ecrecover 本身消耗 ~3000 gas，所以把最可能失败的检查放最前：

1. 重建哈希（pure，最便宜，无 storage）→ 失败则无需继续
2. 签名恢复（ecrecover，纯计算）→ 签名不对后面的都没意义
3. 签名者授权检查（可能查 mapping）→ 无授权的签名无意义
4. Merkle proof 验证（for 循环 hash，纯计算）→ proof 不对无需动 storage
5. nonce/重放检查（storage 读 `executedMessages[msgId]`）→ 最贵的放在后面
6. deadline 检查（`block.timestamp`，0 gas）→ 几乎免费

### 完整骨架

```solidity
contract CrossChainMessageVerifier {
    mapping(bytes32 => bool) public executedMessages;  // 防重放
    mapping(bytes32 => bool) public approvedRoots;     // 已批准 root
    mapping(address => bool) public authorizedSigners;  // 授权签名者
    address public immutable owner;

    // === 自定义 error ===
    error InvalidSignature();
    error SignerNotAuthorized(address signer);
    error RootNotApproved(bytes32 root);
    error InvalidProof(bytes32 msgId);
    error MessageExpired(uint256 deadline);
    error AlreadyExecuted(bytes32 msgId);
    error NotOwner(address caller);

    event MessageExecuted(bytes32 indexed msgId, address indexed signer);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    function verifyAndExecute(
        bytes32[] memory proof,
        bytes32 root,
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 index,
        bytes memory signature
    ) public {
        // Step 1: 重建消息哈希（pure，最便宜）
        bytes32 msgId = keccak256(abi.encode(
            sender, recipient, amount, nonce, deadline,
            sourceChainId, targetChainId
        ));

        // Step 2: 恢复签名者（ecrecover，纯计算）
        address signer = recoverSigner(msgId, signature);
        if (signer == address(0)) revert InvalidSignature();

        // Step 3: 检查签名者授权
        if (!authorizedSigners[signer]) revert SignerNotAuthorized(signer);

        // Step 4: 验证 Merkle proof（for 循环，纯计算）
        if (!approvedRoots[root]) revert RootNotApproved(root);
        if (!verifyProof(proof, root, msgId, index)) revert InvalidProof(msgId);

        // Step 5: 检查 deadline（0 gas 读）
        if (block.timestamp > deadline) revert MessageExpired(deadline);

        // Step 6: 检查 nonce / 防重放（storage 读）
        if (executedMessages[msgId]) revert AlreadyExecuted(msgId);

        // 所有检查通过 → 写 storage + emit event
        executedMessages[msgId] = true;
        emit MessageExecuted(msgId, signer);
    }

    // --- 管理函数 ---

    function approveRoot(bytes32 root) public onlyOwner {
        approvedRoots[root] = true;
    }

    function setAuthorizedSigner(address signer, bool authorized) public onlyOwner {
        authorizedSigners[signer] = authorized;
    }

    // recoverSigner 和 verifyProof 见第 12 节和第 14 节
}
```

### 设计要点

- **所有外部输入都在参数列表里**——不从 storage 猜测，不隐式依赖状态。proof、root、signature、所有消息字段都由调用者（relayer）提供。
- **失败即 revert**——统一使用 `if (!cond) revert Error()` 自定义 error 模式。剩余 gas 退回，无效交易不留痕迹。链下能解码具体错误类型，方便调试。
- **成功即写 storage**——`executedMessages[msgId] = true` 必须是最后一个操作，前面全部校验通过才执行。
- **msgId 包含所有语义字段**——sourceChainId、targetChainId、nonce、deadline 全部参与哈希，任何字段被篡改都会导致 msgId 不匹配。

---

## 16. 练习梳理 —— 四份练习如何拼成 Verifier

### 你写了什么，各自对应 Verifier 的哪部分

```
                     ┌─────────────────────────────────────┐
                     │        Verifier 合约                 │
                     │                                      │
  01 StatePlayground │  state variables                    │
    ├─ uint256       │  ├─ mapping(bytes32=>bool) executed  │ ← 03 的 bytes32
    ├─ mapping       │  ├─ mapping(bytes32=>bool) approved  │ ← 03 的 bytes32
    ├─ constructor   │  └─ constructor() { owner=msg.sender }│
    └─ public getter │                                      │
                     │  verifyAndExecute()                  │
  02 MessageStruct   │  ├─ 重建 msgId (keccak256+abi.encode)│ ← 03 的逻辑
    ├─ struct        │  ├─ recoverSigner (ecrecover)        │ ← 扩展：签名拆分
    ├─ event         │  ├─ 检查 authorizedSigners           │ ← 04 的 modifier 思维
    ├─ emit          │  ├─ 检查 approvedRoots[root]         │ ← 04 的 require 逻辑
    └─ store+get     │  ├─ verifyProof (Merkle)             │ ← 新：for 循环+数组
                     │  ├─ require 防重放/防过期/deadline   │ ← 04 的 require
  03 HashCompare     │  ├─ executedMessages[msgId]=true      │ ← 写 storage
    ├─ keccak256     │  └─ emit MessageExecuted             │ ← 02 的 event
    └─ abi.encode    │                                      │
                     │  approveRoot(bytes32 root)           │
  04 AccessControl   │  ├─ onlyOwner modifier               │ ← 04 的核心
    ├─ modifier      │  └─ approvedRoots[root]=true         │
    ├─ custom error  │                                      │
    └─ require/revert│  setAuthorizedSigner                 │
                     │  └─ onlyOwner modifier               │ ← 04 的核心
                     └─────────────────────────────────────┘
```

### 逐练习对照

**01 StatePlayground — 合约骨架**

| 你练的 | Verifier 里对应 |
|--------|----------------|
| `uint256 public totalCount` | `mapping(bytes32 => bool) public executedMessages` — 都是 state variable |
| `mapping(address => uint256)` | 两个 mapping：`executedMessages` + `approvedRoots` |
| `constructor() { owner = msg.sender }` | 一模一样，Verifier 也有 owner |
| `increment()` 写 state | `executedMessages[msgId] = true` 写 state |
| `getMyCount()` view 查询 | 没有直接对应，但 view 概念贯穿所有查询函数 |

**02 MessageStruct — 结构化数据 + 日志**

| 你练的 | Verifier 里对应 |
|--------|----------------|
| `struct Message { sender, contentHash, timestamp }` | 消息字段拆成函数参数而非 struct，但概念相同 |
| `event MessageStored(...)` | `event MessageExecuted(bytes32 indexed msgId, address indexed signer)` |
| `emit MessageStored(...)` | 校验通过后 `emit MessageExecuted(msgId, signer)` |
| `messages[messageCount] = msg1` 写入 storage | `executedMessages[msgId] = true` 写入 storage |

**03 HashCompare — 哈希与编码**

| 你练的 | Verifier 里对应 |
|--------|----------------|
| `keccak256(abi.encode(a, b, c))` | `keccak256(abi.encode(sender, recipient, ..., chainIds))` — 重建消息哈希 |
| `verifyHash(..., submittedHash)` | 整个 Verifier 就是 verifyHash 的放大版——多加了签名/Merkle/防重放 |
| `abi.encode` vs `abi.encodePacked` 选择 | 消息哈希用 `encode`，Merkle proof 内部用 `encodePacked` |
| 链上链下哈希一致性 | relayer 链下算 hash → 合约链上算 hash → 必须一致 |

**04 AccessControl — 权限 + 校验**

| 你练的 | Verifier 里对应 |
|--------|----------------|
| `modifier onlyOwner` | `approveRoot()` 和 `setAuthorizedSigner()` 用 onlyOwner |
| `modifier notApproved(dataHash)` | Verifier 没有同名 modifier，但 `require(!executedMessages[msgId])` 是相同思维 |
| `error NotOwner(address caller)` | 一模一样，Verifier 也定义自定义 error |
| `revert NotOwner(msg.sender)` | 校验失败时 revert，不悄悄跳过 |
| `approvedData[hash] = true` | `executedMessages[msgId] = true` → 记录已执行，防重放 |

### 汇总：Verifier 需要的全部技能

```
01 提供了：state variable、mapping、constructor、public getter
02 提供了：struct（消息字段设计）、event（执行日志）、emit
03 提供了：keccak256 + abi.encode（消息哈希）、链上链下一致性
04 提供了：modifier（权限守卫）、custom error（省 gas 报错）、require/revert
12 提供了：ecrecover 签名恢复 + 签名拆分
13 提供了：bytes32[] 动态数组 + for 循环
14 提供了：Merkle proof 链上验证算法
15 提供了：完整的校验链路骨架（6 步顺序）
```

**你已经覆盖了 90% 的 Verifier 代码需要的技能。** 剩下没练过的是 ecrecover 和 for 循环——这两个没有单独的练习，直接在第 15 节骨架里写。
