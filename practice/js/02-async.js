// ============================================================
// 02-async.js  —  从零理解异步（同步 → 回调 → Promise → async/await）
// ============================================================
//
// 为什么区块链开发必须理解异步？
//
//   你在 Hardhat 里写的几乎每一行代码都是异步的：
//     await contract.verifyMessage(...)   // 发送交易，等矿工确认
//     await contract.signer()             // 查询链上数据，等节点响应
//     await wallet.signMessage(...)       // 本地签名很快，但API返回Promise
//
//   这些操作都要"等"，但JS不会傻等——它先去做别的事，等结果回来了再继续。
//   这就是"异步"：不阻塞主线程，结果在未来某个时刻返回。
//
// 运行：node 02-async.js
// ============================================================

console.log("===== 02-async.js =====\n");

// ============================================================
// STEP 0：先回忆同步代码（你已经会了）
// ============================================================
console.log("--- STEP 0：同步代码，按顺序执行 ---");

console.log("1. 开始");
console.log("2. 中间");
console.log("3. 结束");
// 你一定预期输出 1 → 2 → 3，这就是同步：一件事做完再做下一件


// ============================================================
// STEP 1：认识异步——当某件事需要"等"，同步代码会怎样？
// ============================================================
// 假设去链上查余额需要 1 秒。下面用 setTimeout 模拟这个等待。
// setTimeout 是JS内置的异步函数：第一个参数是回调函数，第二个是等待毫秒数。

console.log("\n--- STEP 1：第一次见识异步 ---");

console.log("A. 开始查询余额...");

setTimeout(() => {
  console.log("C. 余额：100 ETH");
}, 1000);  // 1秒后执行回调

console.log("B. 查询已发出，继续做别的事...");
// 👆 运行后观察打印顺序：A → B → C（而不是 A → C → B）
// 这就是异步：B 不会等 C 完成，直接往下走

// TODO 1.1：现在运行 node 02-async.js，观察 A/B/C 的打印顺序
//   然后回来继续读下面的代码
//   （先不要改任何代码，运行一次就能看到效果）


// ============================================================
// STEP 2：为什么需要异步？—— 用同步思维写一遍，感受问题
// ============================================================
// 假设你在 Hardhat 里这样写（伪代码，别真跑）：
//
//   let balance;
//   setTimeout(() => { balance = 100; }, 1000);
//   console.log(balance);  // 输出 undefined！因为 setTimeout 还没执行完
//
// 这就是之前很多人困惑的：为什么打印出来是 undefined？
// 原因：console.log 在 setTimeout 回调之前就执行了
//
// TODO 2.1（思考题，不用写代码）：
//   为什么区块链操作不能是同步的？
//   → 因为网络请求、交易确认都需要时间，如果同步等待，
//     整个程序会卡死 15 秒等一笔交易上链，用户什么都不干了


// ============================================================
// STEP 3：处理异步结果的三种方式
// ============================================================
// 既然不能直接 return，怎么拿到异步操作的结果？
// JS 演变出了三种写法，你会看到它们的关系：


// ----------------------------------------------------------
// 方式一：回调函数 Callback（最原始）
// ----------------------------------------------------------
console.log("\n--- STEP 3.1：回调函数 ---");

function fetchBalanceCallback(address, onSuccess, onError) {
  console.log(`  查询 ${address}...`);
  setTimeout(() => {
    if (address.startsWith("0x")) {
      onSuccess(100);           // 成功时调用 onSuccess，把结果传进去
    } else {
      onError("无效地址");       // 失败时调用 onError
    }
  }, 1000);
}

// TODO 3.1：调用 fetchBalanceCallback，传入三个参数：
//   第1个："0xAlice"
//   第2个：(balance) => { console.log("回调方式 - 余额:", balance); }
//   第3个：(err) => { console.log("回调方式 - 错误:", err); }
//
// 提示：下面这行是你的骨架，补全 onSuccess 和 onError 两个箭头函数

// 你的代码：
fetchBalanceCallback("0xAlice",
  balance=>{
  console.log("回调方式 - 余额:", balance)
},
  err=>{
  console.log("回调方式 - 错误:", err)
  }
)


// ----------------------------------------------------------
// 方式二：Promise（回调的升级版，把嵌套变平）
// ----------------------------------------------------------
console.log("\n--- STEP 3.2：Promise + .then() ---");

function fetchBalancePromise(address) {
  // Promise 接收一个函数，这个函数接收 resolve 和 reject 两个参数
  // resolve(结果) = 成功  /  reject(原因) = 失败
  return new Promise((resolve, reject) => {
    console.log(`  查询 ${address}...`);
    setTimeout(() => {
      if (address.startsWith("0x")) {
        resolve(100);
      } else {
        reject(new Error("无效地址: " + address));
      }
    }, 1000);
  });
}

// TODO 3.2：用 .then().catch() 调用 fetchBalancePromise("0xBob")
//   提示：fetchBalancePromise返回Promise，Promise有.then()和.catch()方法
//   .then(result => { ... })   处理成功
//   .catch(error => { ... })   处理失败

// 你的代码：
fetchBalancePromise("0xBob").then(result=>{console.log(result)}).catch(error=>{console.log(error)})


// 为什么 Promise 比回调好？
//   回调：嵌套地狱 → doA(() => { doB(() => { doC(() => { ... }) }) })
//   Promise：链式调用 → doA().then(doB).then(doC).catch(handleErr)


// ----------------------------------------------------------
// 方式三：async/await（Promise 的语法糖，看起来像同步代码）
// ----------------------------------------------------------
console.log("\n--- STEP 3.3：async/await（推荐写法） ---");

// async 标记一个函数为异步函数
// await 暂停当前函数，等待 Promise 完成，然后直接取出结果
//
// 规则（先读一遍再写）：
//   1. await 只能用在 async 函数内部
//   2. await 后面跟一个 Promise
//   3. await 会"等"Promise 完成，然后返回 resolve 的值
//   4. 如果 Promise 被 reject，await 会抛出错误（用 try/catch 捕获）

// TODO 3.3：写一个 async 函数 checkBob，内部：
//   const balance = await fetchBalancePromise("0xBob");
//   console.log("async/await 方式 - 余额:", balance);
//   然后调用 checkBob();
//
// 提示骨架：
//   async function checkBob() {
//     // 你的 await 代码
//   }
//   checkBob();

// 你的代码：
async function checkBob(){
      const balance=await fetchBalancePromise("0xBob") ;
      console.log("async/await 方式 - 余额:", balance);
}
checkBob()



// ----------------------------------------------------------
// STEP 4：错误处理 —— try/catch
// ----------------------------------------------------------
console.log("\n--- STEP 4：try/catch 捕获错误 ---");

// 正常查询没问题，但查询一个非法地址会怎样？
// 如果不加 try/catch，程序会直接崩溃

// TODO 4.1：写一个 async 函数 checkBadAddress，内部：
//   1. 用 try { } 包裹
//   2. try 里：await fetchBalancePromise("badAddress")（注意不以 0x 开头）
//   3. catch(err) { console.log("捕获到错误:", err.message); }
//   4. 调用 checkBadAddress();

// 你的代码：
async function checkBadAddress(){
  try {
    await fetchBalancePromise("badAddress")
  } catch (err) {
    console.log("捕获到错误：",err.message)
  }
}
checkBadAddress();

// ----------------------------------------------------------
// STEP 5：多个异步操作顺序执行（模拟 relay 流程）
// ----------------------------------------------------------
console.log("\n--- STEP 5：顺序查询多个地址（模拟 relay 流程） ---");

// 场景：Relayer 需要先查 A 链的交易，再查 B 链的接收，最后提交验证
// 每一步都依赖上一步的结果，所以必须顺序执行

// TODO 5.1：写一个 async 函数 relayFlow，用 await 依次查询三个地址
//   await fetchBalancePromise("0xAlice");
//   await fetchBalancePromise("0xBob");
//   await fetchBalancePromise("0xCharlie");
//   观察输出：每个查询间隔 1 秒依次出现（不是同时出现）
//   然后调用 relayFlow();

// 你的代码：
async function relayFlow() {
  await fetchBalancePromise("0xAlice");
  await fetchBalancePromise("0xBob");
  await fetchBalancePromise("0xCharlie");
}
relayFlow();


console.log("\n🎯 观察输出中正常查询和错误捕获同时存在，就全过了！");
console.log("🎯 重点感受：同步(STEP0) vs 异步(STEP1) 的执行顺序差异");
