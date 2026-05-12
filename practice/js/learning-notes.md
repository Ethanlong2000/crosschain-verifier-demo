# 学习笔记：未掌握知识点 & 易错点

> 每完成一个练习文件后更新，记录踩到的坑和理解偏差。
> 格式：日期 + 知识点 + 错误表现 + 正确理解。

---

## 01-basics.js

<!-- 示例格式：
### const vs let- ❌ 错误：对需要修改的变量用了 const
- ✅ 正确：不会变用 const，会变用 let
- 💡 触发场景：TODO 1.3 后续如果要改 counter 必须用 let
-->

### 箭头函数语法：`function` 和 `=>` 不能混用- ❌ 错误：`function double(a) => a*2;`
- ✅ 正确：`const double = (a) => a * 2;`
- 💡 规则：用 `function` 关键字就不写 `=>`，用 `=>` 就不写 `function`。箭头函数以 `const 变量名 = (参数) =>` 开头

### 箭头函数多行写法也需要 `const`- ❌ 错误：`function greet(name) => { ... }`（混了两种，且 return 没写）
- ✅ 正确：`const greet = (name) => { let upper = name.toUpperCase(); return "Hello, " + upper; };`
- 💡 多行箭头函数：`const fn = (args) => { 多行代码; return 结果; };`

### `counter + 1` 不会修改变量值- ❌ 错误：`console.log(counter + 1);` 打印了 1 但 counter 仍然是 0
- ✅ 正确：先 `counter = counter + 1;`（或 `counter += 1` 或 `counter++`），再 `console.log(counter);`
- 💡 `+` 运算符只产生一个新值返回，不会改变参与运算的变量本身

### `const` 变量不能重新赋值- ❌ 错误：`MY_CHAIN_ID = 1;` → 运行时报错 `TypeError: Assignment to constant variable`
- ✅ 正确：`const` 声明后不能重新赋值，这就是 const 和 let 的区别
- 💡 TODO 1.4 就是让你故意触发这个报错然后理解它，之后需要把触发行注释掉才不阻塞后续代码

### 模板字符串必须用反引号 `` ` ` `` 包裹✅ 已修复
- ❌ 错误：`console.log("...${counter}")` → 输出字面量 `${counter}`，变量没有被替换
- ✅ 正确：`` console.log(`Sepolia 的 chainId 是 11155111，当前 counter 是 ${counter}`) ``
- 💡 只有反引号 `` ` `` 包裹的字符串才会解析 `${}`；普通引号 `'` 或 `"` 会把 `${}` 当纯文本

### 数组解构用 `[]`，不能用 `{}`✅ 已修复
- ❌ 错误：`const {first} = recoverResult;` → 用对象解构语法取数组元素
- ✅ 正确：`const [first] = recoverResult;`
- 💡 对象解构用 `{}`，数组解构用 `[]`——长得像谁就用谁
- ⚠️ 当前代码解构了 `first` 但没有 `console.log(first)`，无法在输出中验证值是否正确，建议补一行

### `counter + 1` 仍然未修改原变量⚠️ 第 3 次提醒
- 当前代码：`console.log(counter + 1);` 输出 `1`，但 counter 还是 `0`
- 模板字符串那行输出 `counter 是 0` 证明了这一点
- ✅ 应改为：`counter = counter + 1;` 然后再 `console.log(counter);`
- 💡 虽然这次输出碰巧看起来正确，但后续 counter 还要用作 nonce 计数器，不修改原值会导致逻辑 bug

### 数组解构用 `[]`，不能用 `{}`- ❌ 错误：`const {first} = recoverResult;` → 用对象解构语法取数组元素，拿不到值
- ✅ 正确：`const [first] = recoverResult;` 然后 `console.log(first)` → `"0xABC123..."`
- 💡 对象解构用 `{}`，数组解构用 `[]`——长得像谁就用谁

### 「对象解构」和「数组解构」的原理解构的本质是**按模式匹配批量取值**，一行顶多行赋值：
- **对象解构**：按**属性名**匹配
  ```js
  const tx = { from: "0xA", to: "0xB", value: 100 };
  const { from, to, value } = tx;
  // 等价于：
  // const from = tx.from;
  // const to = tx.to;
  // const value = tx.value;
  ```
  名字必须和对象属性名一致，顺序无所谓。如果想改名：`const { from: sender } = tx;`
- **数组解构**：按**位置**匹配
  ```js
  const arr = ["0xABC", "0xPubKey"];
  const [address, pubkey] = arr;
  // 等价于：
  // const address = arr[0];
  // const pubkey = arr[1];
  ```
  名字可以随便起，位置决定取哪个元素。只要第一个就 `const [first] = arr;`
- 💡 项目中典型场景：`const { address, privateKey } = ethers.Wallet.createRandom();` 返回对象，用对象解构

---

## 02-async.js

### 运行结果反馈- ✅ 逐行推演了执行顺序，三种写法（回调、Promise、async/await）全部正确
- ✅ `try/catch` 成功捕获错误地址，错误信息格式正确
- ✅ `relayFlow` 三个查询依次执行（输出末尾的 `查询 0xBob...` 和 `查询 0xCharlie...` 证明了每个 await 真的等了 1 秒）
- ⚠️ 小建议 1：`.then(result => { console.log(result) })` 输出只有裸数字 `100`，补上标签更清晰
- ⚠️ 小建议 2：`relayFlow` 每个 `await` 之后没有打印结果，导致看起来"只有查询没有结果返回"，加 `console.log` 会更直观

### 为什么输出看起来"乱"？—— 异步并发执行顺序这不是乱，是正确的异步行为。当你同时注册多个异步操作（这里 6 个 setTimeout 全在 1 秒后触发），它们按**注册顺序**依次执行回调：

```
同步阶段（瞬间）：
  → 打印所有章节标题
  → 注册 6 个定时器（都在 1 秒后触发）

1 秒后（回调按注册顺序集中执行）：
  ① STEP 1 的 C.余额    （最先注册）
  ② 回调方式 - 余额       （第二）
  ③ 100 的 .then()       （第三）
  ④ async/await 方式      （第四）
  ⑤ 捕获到错误            （第五）
  ⑥ 查询 0xBob...        （relayFlow 续执行 → 发起第二个查询 → 又注册一个 1s 定时器）

再 1 秒后：
  ⑦ 查询 0xCharlie...     （第二个查询的定时器触发 → relayFlow 续执行 → 发起第三个查询）
```

**关键洞察：** `relayFlow` 的三个 `await` 是顺序的，但「发起查询」的 `console.log("查询...")` 是同步代码，在 `await` 之前就执行了。所以第一条 `查询 0xAlice...` 出现在同步阶段，第二、三条分别出现在后续的异步回调中——这恰恰证明了 async/await 的"暂停-恢复"机制在正常工作。

### 什么是回调函数 Callback？
**一句话定义：** 回调就是一个函数被当作参数传给另一个函数，等对方在"合适的时机"调回去执行。

**用现实类比：**
你去餐厅吃饭，服务员说"排号，等有位了叫你们"。
- 你留下手机号 → **传递回调函数**
- 服务员有空位时打你电话 → **在合适的时机调用回调**
- 你不用一直站在门口等 → **不阻塞主线程**

**代码对照：**
```js
// 你定义了一个"等会再执行"的函数
const whenTableReady = () => { console.log("有座了，去吃饭！"); };

// 把这个函数传给服务员（setTimeout 模拟等待）
setTimeout(whenTableReady, 2000);  // 2秒后"回调"whenTableReady

console.log("先去逛商场");  // 不会傻等，继续往下执行
```
输出顺序：`先去逛商场` → 2秒后 → `有座了，去吃饭！`

**回调的两个角色：**
| 角色 | 谁 | 做什么 |
|------|-----|--------|
| **定义者** | 你 | 写一个函数，描述"结果回来后要做什么" |
| **调用者** | 系统/库 | 在异步操作完成时调用你写的函数 |

**在本项目中的实际例子：**
```js
// Hardhat 的 it() 就是一个接收回调的函数
it("测试描述", async () => {    // ← 这个箭头函数就是回调
  // it() 会在运行测试时调用你的回调
  const result = await contract.verify();
});
```

### 回调的痛点：回调地狱 Callback Hell
当多个异步操作有依赖关系时（A 完成 → 做 B → 做 C），回调会层层嵌套：

```js
// 场景：查地址 → 查余额 → 发交易（每步依赖上一步结果）
fetchAddress(userId, (address) => {
  fetchBalance(address, (balance) => {
    sendTransaction(balance, (txHash) => {
      console.log("交易已发送:", txHash);
      // 如果还要再加一步...再缩进一层 😱
    });
  });
});
```

这就是**回调地狱**：代码向右无限倾斜，读起来跳来跳去。

**解决方案就是 Promise**——把嵌套变成链式调用，这页知识已经在你重写的 `02-async.js` 的 STEP 3.1 → 3.2 → 3.3 里一步步展示了。

### 你必须了解的异步相关概念清单
| 概念 | 一句话解释 | 在本项目中的位置 |
|------|-----------|-----------------|
| **回调函数 Callback** | 函数作为参数，等时机到了被调用 | `setTimeout(() => {...}, 1000)` 里的箭头函数就是回调 |
| **Promise** | 一个"未来会返回结果"的容器，三种状态：pending（等待）/ fulfilled（成功）/ rejected（失败） | `fetchBalancePromise()` 返回的就是 Promise |
| **`.then()` / `.catch()`** | Promise 的成功处理器和失败处理器 | `fetchBalancePromise("0xA").then(res => ...).catch(err => ...)` |
| **`async` 函数** | 标记一个函数内部可以使用 `await`，返回值自动包装成 Promise | `async function checkBob() { ... }` |
| **`await`** | 暂停 async 函数，等 Promise 完成并取出结果值 | `const balance = await fetchBalancePromise("0xBob");` |
| **`try/catch`** | 捕获 await 时 Promise 被 reject 抛出的错误 | `try { await xxx } catch(err) { ... }` |
| **事件循环 Event Loop** | JS 引擎的运行机制：同步代码先跑完，再处理异步回调队列 | 解释了你看到的 A→B→C 而不是 A→C→B |
| **微任务 vs 宏任务** | Promise.then 是微任务（优先级高），setTimeout 是宏任务（优先级低） | 暂时不用深究，但要知道 Promise 比 setTimeout 先执行 |

**最后一张图帮你记住关系：**
```
同步代码全部执行完
    ↓
微任务队列（Promise.then / catch）
    ↓
宏任务队列（setTimeout / setInterval）
    ↓
（每次宏任务之后又会清空微任务队列，循环往复 → 事件循环）
```

### 异步基础概念
**什么是异步？**
- **同步**：一行执行完才执行下一行，代码按书写顺序从上到下
- **异步**：发起一个耗时操作后，不原地等结果，继续执行后续代码；等结果回来了再通过回调/Promise/await 拿到结果

**为什么区块链开发全是异步？**
- 查链上数据 → 向节点发 RPC 请求，网络往返需要时间
- 发送交易 → 等矿工打包确认，可能需要 15 秒到几分钟
- 如果同步等待，页面/脚本会直接卡死，用户什么都做不了
- 所以 ethers.js 几乎所有方法都返回 Promise，必须用 await

**三种写法的演进关系：**
```
回调 Callback           Promise .then()        async/await（推荐）
─────────────     →     ─────────────     →     ──────────────
doA((err, res) =>       doA()                  try {
  doB(res, (err, r)     .then(res => doB(r))     const a = await doA();
    => doC(r, ...)      .then(r => doC(r))       const b = await doB(a);
  )                     .catch(handleErr)        const c = await doC(b);
)                                             } catch(err) { ... }
嵌套越来越深 ❌         链式调用，扁平 ✅          看起来像同步代码 ✅✅
```

**`async` 和 `await` 的规则：**
1. `await` 只能写在 `async function` 内部
2. `await` 后面放一个 Promise，它会"暂停"直到 Promise 完成
3. 如果 Promise resolve → `await` 返回结果值
4. 如果 Promise reject → `await` 抛出错误（用 try/catch 接住）

**`try/catch` 在异步中的作用：**
- `try` 块里放可能出错的操作（如合约调用、地址校验）
- `catch` 块里处理错误（打印日志、返回默认值、重试等）
- 不加 try/catch 的话，一个 reject 就会让整个脚本崩溃

**在 Hardhat 项目中的典型用法：**
```js
it("should verify message", async () => {    // it 的回调是 async
  try {
    const result = await contract.verifyMessage(...);  // await 合约调用
    expect(result).to.be.true;
  } catch (err) {
    // 测试中通常不 catch，让测试框架显示错误
  }
});
```

---

## 03-modules.js

### 模块系统背景知识
**为什么需要模块系统？**

没有模块系统时，所有 JS 代码写在一个文件里：
```js
// 一万行代码纠缠在一起
// 变量互相覆盖，函数名冲突，改一个地方影响全局
```

模块系统让你把代码拆成多个文件，每个文件只暴露需要对外使用的部分，隐藏内部实现。

**JS 世界的两套模块系统：**

| | CommonJS | ES Module |
|---|---|---|
| **出现时间** | 2009（Node.js 诞生时就带） | 2015（ES6 标准化） |
| **语法** | `require()` / `module.exports` | `import` / `export` |
| **加载时机** | 运行时动态加载 | 编译时静态分析 |
| **主战场** | Node.js 默认 | 浏览器 + 新版 Node |
| **本项目用不用** | ✅ 用，Hardhat 就是 CommonJS | ❌ 不用，但要知道它的存在 |

**CommonJS 的核心规则（本项目必须掌握）：**

1. **导出**：一个文件通过 `module.exports` 决定"对外暴露什么"
   ```js
   // helper.js
   function add(a, b) { return a + b; }
   module.exports = { add };  // 别人 require 这个文件时拿到 { add }
   ```

2. **导入**：通过 `require("./路径")` 拿到对方导出的内容
   ```js
   const { add } = require("./helper");  // 解构取出 add
   // 或
   const helper = require("./helper");   // 拿到整个对象，用 helper.add()
   ```

3. **`.js` 可以省略**：`require("./helper")` 等价于 `require("./helper.js")`

4. **`./` 表示当前目录**：不加路径前缀（如 `require("ethers")`）表示从 `node_modules` 里找

**常见错误（提前知道，少踩坑）：**

- ❌ 在 `package.json` 里加了 `"type": "module"` → Hardhat 的 `hardhat.config.js` 会报错，因为 Hardhat 用的是 CommonJS
- ❌ `import { add } from "./helper.js"` 写在 Hardhat 脚本里 → 语法错误，要用 `require`
- ❌ `module.exports = add` 和 `module.exports = { add }` 混用 → 前者导出函数本身，后者导出包含函数的对象，解构方式不同

**和本项目的直接关系：**
```
hardhat.config.js   → require("@nomicfoundation/hardhat-toolbox")  ← 从 node_modules 引入
scripts/deploy.js   → require("hardhat")                            ← 从 node_modules 引入
test/*.test.js      → require("../scripts/utils")                   ← 从项目内引入
```

---

## 补充知识：npm vs npx
**一句话区别：**
- `npm` — 包管理器，安装/卸载/管理依赖
- `npx` — 包执行器，运行某个包里的命令（不用全局安装）

**场景对照：**

| 你想做的事 | 用 npm | 用 npx |
|-----------|--------|--------|
| 安装 Hardhat 到项目 | `npm install hardhat` | ❌ |
| 运行 Hardhat 编译 | ❌ 得写 `./node_modules/.bin/hardhat compile` | `npx hardhat compile` |

**`npx` 做了什么：**
- 去 `node_modules/.bin/` 下找对应的可执行文件并运行
- 找不到就临时下载运行（用完即删）

**为什么项目里用 `npx hardhat`：**
- Hardhat 装在项目的 `node_modules` 里（本地安装），不是全局安装
- 直接敲 `hardhat compile` → 终端不认识
- `npx hardhat compile` → npx 帮你找到 `./node_modules/.bin/hardhat`

**`package.json` 的 scripts 里为什么不需要 npx：**
```json
"scripts": {
  "compile": "hardhat compile",   // npm run compile — npm 自动查找
  "test": "hardhat test"
}
```
`npm run` 会自动把 `node_modules/.bin` 加入 PATH，所以 scripts 里不用写 `npx`。但终端直接敲必须要 `npx`。

---

## 04-ethers-playground.js

### 运行结果反馈（第三轮 ✅ 全部通过）
- ✅ 钱包地址 + 私钥正常打印（`privateKey` 大小写修复正确）
- ✅ `hashMessage` 和 `keccak256` 对同一消息产生不同哈希值（验证了 EIP-191 前缀差异）
- ✅ 签名 + r/s/v 拆分正确（`Signature.from` 返回对象，用 `{}` 解构正确）
- ✅ v = 27 — ethers v6 直接返回 27/28，不需要 +27，可以直接给合约 `ecrecover` 用
- ✅ `verifyMessage` 恢复地址与 `wallet.address` 完全一致（`0x8D24F41bF94573b0eCB1B150ac5D64bcAb51857a`）
- ✅ 完整 ECDSA 链路验证成功：创建钱包 → 签名 → 拆分 r/s/v → 恢复地址（地址匹配）

### 运行结果反馈（第二轮）

**错误 1：IIFE 缺少 `()` —— 导致 JS 把两个 IIFE 错误拼接**
- ❌ 行 79-83 的 IIFE 结尾是 `})`，没有 `()` 和分号
- ❌ JS 看到 `})` 后面紧接着行 105 的 `(async () => {...})()`，就把两段错误地拼接成：
  `(asyncFunc1)(asyncFunc2)()` → `(返回的Promise对象)()` → Promise 不是函数 → 报错 `is not a function`
- ✅ 修复：行 83 加 `();` —— `})();`
- 💡 核心原因：JS 自动分号插入 ASI 的规则——如果下一行以 `(` 开头，JS 认为上一行还没结束，会尝试拼接调用。**写 IIFE 时前面加分号防御**：
  ```js
  ;(async () => { ... })()   // 前面的 ; 防止和前一行拼接
  ```

**错误 2：Part 4 打印 `r, s, v` 但 TODO 4.2 是独立的**
- 当前 Part 4 一次性 `console.log(r, s, v)` 三个值
- TODO 4.2 要求"打印 v 的值，看看是 27/28 还是 0/1"——需要单独 `console.log(v)` 方便观察
- 💡 建议：先修正 Part 4 调用后，额外加一行 `console.log("v 的值是:", v);`

**错误 3：`signature` / `recover_address` 变量没有声明**
- ❌ `signature = await ...` 和 `recover_address = ...` — 缺少 `const`/`let`
- 这导致变量泄漏到全局作用域（意外地让 Part 5 能用 Part 3 的 signature）
- ✅ 加 `const`：`const signature = await wallet.signMessage(...)`

---

### 运行结果反馈（第一轮）

**错误 1：`privatekey` 属性名大小写错误**
- ❌ `wallet.privatekey` → 打印 `undefined`
- ✅ `wallet.privateKey`（K 大写）→ 打印私钥
- 💡 ethers.js 的 Wallet 对象属性是驼峰命名：`privateKey`、`publicKey`、`signingKey`

**错误 2：`wallet.signMessage()` 返回的是 Promise —— 这是根因**
- ❌ `signature = wallet.signMessage("hello crosschain")` → `signature` 是一个 Promise 对象，不是签名
- 📌 输出中那行 `Promise { '0x8d...' }` 就是证据
- ✅ 需要 `await wallet.signMessage(...)` 或在 `.then()` 里拿结果
- 💡 这就是 02-async.js 学的——ethers 几乎所有方法都返回 Promise，哪怕签名是本地运算也不例外

**错误 3：`Signature.from()` 报错 —— 错误 2 的连锁反应**
- ❌ `ethers.Signature.from(signature)` — `signature` 是 Promise 对象不是字符串，所以 `Signature.from()` 报 `missing r`
- ✅ 先 `await` 拿到签名字符串，再传给 `Signature.from()`

**错误 4：`Signature.from()` 返回的是对象，不是数组**
- ❌ `const [r,s,v] = ethers.Signature.from(...)` → 用数组解构去取对象属性
- ✅ `const { r, s, v } = ethers.Signature.from(sigString)` → 对象解构
- 💡 返回对象用 `{}`，返回数组用 `[]`——03 刚学过

**错误 5：`consol.log` 打字错误**
- ❌ `consol.log(v)` → ReferenceError: consol is not defined
- ✅ `console.log(v)`

**补充知识：async IIFE —— 在没有 async 环境的地方临时创造 async 环境**

`await` 只能写在 `async function` 里面。但 `.js` 脚本文件的顶层不是任何函数，直接写 `await` 会报错：

```js
// ❌ 顶层不能直接 await（CommonJS 模式下）
const sig = await wallet.signMessage("hello crosschain");
// SyntaxError: await is only valid in async functions
```

解决方案：**临时造一个 async 函数，立刻调用它。** 这叫 IIFE（Immediately Invoked Function Expression，立即调用函数表达式）。

拆解这个语法：
```js
(async () => {          // ← 定义一个匿名 async 箭头函数
  const sig = await wallet.signMessage("hello crosschain");  // ✅ 函数内部可以 await
  console.log(sig);
})();                   // ← 最后的 () 表示"立即调用这个函数"
```

用你熟悉的写法等价于：
```js
async function main() {           // 定义一个 async 函数
  const sig = await wallet.signMessage("hello crosschain");
  console.log(sig);
}
main();                           // 调用它
```
IIFE 就是把上面两段合成一段：定义 + 调用写在一起。

**为什么要学这个？** Hardhat 测试文件里，`describe` 和 `it` 已经帮你建好了 async 环境，不需要 IIFE：
```js
describe("Verifier", () => {
  it("should work", async () => {   // ← it() 的回调已经是 async
    const sig = await wallet.signMessage("hello");  // 直接用 await
  });
});
```
但独立的 `.js` 脚本（如 `04-ethers-playground.js`、`scripts/deploy.js`）顶层不是 async，偶尔就需要 IIFE 来临时容纳 `await`。

**如何修复（整体方案）：**

这个文件顶层不是 async 函数，所以不能直接用 `await`。你有两种选择：

方案 A：把所有用到 `await` 的代码包在一个 async IIFE 里
```js
(async () => {
  const sig = await wallet.signMessage("hello crosschain");
  console.log(sig);  // 现在拿到的是真正的签名字符串
  const { r, s, v } = ethers.Signature.from(sig);
  console.log(r, s, v);
})();
```

方案 B：用 .then() 链式处理
```js
wallet.signMessage("hello crosschain").then(sig => {
  console.log(sig);
  const { r, s, v } = ethers.Signature.from(sig);
  console.log(r, s, v);
});
```

推荐方案 A，因为写 Hardhat 测试时，`it("...", async () => { ... })` 已经提供了 async 环境，写法一致更容易适应。

**ethers.js 是什么？**

ethers.js 是 JavaScript 与以太坊交互的标准库。你的 Hardhat 项目里，**所有链下操作都通过 ethers.js 完成**：
- 创建钱包 / 导入私钥
- 消息哈希与签名
- 连接合约、调用合约方法
- 发送交易、查询链上数据

你和链上合约之间的每一行 JS 代码，几乎都会经过 ethers.js。

**本项目的核心链路（必须先理解再写代码）：**

```
[链下 JS / ethers.js]                    [链上 Solidity]
─────────────────────────                ────────────────
                                         
1. const wallet = Wallet.createRandom()  
   → 生成私钥和地址                       
                                         
2. const hash = hashMessage(msg)         
   → 对消息做哈希（加 EIP-191 前缀）       
                                         
3. const sig = wallet.signMessage(msg)   
   → 用私钥签名，返回 65 字节签名          
                                         
4. const { r, s, v } = Signature.from(sig)
   → 拆分签名为 r/s/v                     
                                         
5. 把 hash, r, s, v 传给合约  ───────→   6. ecrecover(hash, v, r, s)
                                            → 恢复出签名者地址
                                         
7. 断言：恢复地址 == wallet.address      
   → 证明"这个签名确实是 wallet 签的"      
```

**你需要掌握的核心 API（按使用频率排序）：**

| API | 作用 | 返回值 |
|-----|------|--------|
| `ethers.Wallet.createRandom()` | 创建随机钱包 | `{ address, privateKey, ... }` |
| `wallet.signMessage(msg)` | 对消息签名（EIP-191 标准） | 132 字符的十六进制签名 |
| `ethers.hashMessage(msg)` | EIP-191 标准哈希 | 66 字符的 bytes32 |
| `ethers.keccak256(data)` | 纯 keccak256 哈希（无前缀） | 66 字符的 bytes32 |
| `ethers.Signature.from(sig)` | 解析签名为 r/s/v | `{ r, s, v, ... }` |
| `ethers.verifyMessage(msg, sig)` | 从签名恢复地址并验证 | 签名者的 address |

**`hashMessage` vs `keccak256` —— 最大的坑：**

这是 web3 新手最容易犯的错，直接导致合约 `ecrecover` 恢复出错误地址：

```
hashMessage("hello")  → 先加前缀 "\x19Ethereum Signed Message:\n5hello"，再 keccak256
keccak256("hello")    → 直接对 "hello" 做 keccak256，不加前缀
```

两个函数对同一个输入会产生**完全不同的哈希**。规则很简单：
- **链下签名用 `hashMessage` / `signMessage`** → 带 EIP-191 前缀
- **合约里 `ecrecover` 接收的 hash** → 必须和链下一致
- **Merkle proof 的叶子哈希** → 用 `keccak256`（纯哈希，不加前缀）

**签名格式差异（另一个经典坑）：**

Solidity 的 `ecrecover` 要求 `v = 27 或 28`，但 ethers.js 的 `Signature.from()` 返回的 `v` 可能是 `0 或 1`。如果不对齐，恢复出的地址就是错的。04 练习文件的 TODO 4.2 专门让你检查这个差异。

**ethers v5 vs v6（你装的是 v6）：**

你的项目装的是 ethers v6（最新版），语法和 v5 略有不同。注意：
- v5: `ethers.utils.keccak256(...)` → v6: `ethers.keccak256(...)`
- v5: `ethers.utils.hashMessage(...)` → v6: `ethers.hashMessage(...)`
- v6 的 `Signature.from()` 返回的 v 值可能已经是 27/28，自己验证一下
