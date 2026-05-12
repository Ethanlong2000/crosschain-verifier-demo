// ============================================================
// 01-basics.js  —  JS 核心语法速刷
// ============================================================
// 在项目中的用途：
//   const/let        → 声明变量，测试和脚本里到处都用
//   箭头函数          → Hardhat 测试里用 describe() 和 it() 的 callback
//   模板字符串        → 拼接错误信息、日志输出
//   对象/数组解构     → 从 ethers.js 返回的对象里提取字段
//
// 运行：node 01-basics.js
// ============================================================

console.log("===== 01-basics.js =====");

// ----------------------------------------------------------
// Part 1: const vs let
// ----------------------------------------------------------
// 规则：不会重新赋值的用 const，需要重新赋值的用 let
//    const address = "0x123...";  // 地址不会变 → const
//    let balance = 100;           // 余额会变   → let
//
// ⚠️ 注意：const 对象/数组的内容仍然可以修改，只是不能重新赋值整个变量

// TODO 1.1：声明一个 const 变量 MY_CHAIN_ID，值为 11155111（Sepolia 的 chainId）
// 把你自己的代码写在下面这行注释后面：
const MY_CHAIN_ID=11155111;

// TODO 1.2：声明一个 let 变量 counter，初始值为 0
let counter=0;
// TODO 1.3：把 counter 加 1，然后 console.log 打印它

console.log(counter+=1);


// TODO 1.4：试试把 MY_CHAIN_ID 重新赋值为 1 —— 运行会报错，把这个报错读一遍
// （写完这行后注释掉，不然后续代码跑不了）
// MY_CHAIN_ID = 1;


// ----------------------------------------------------------
// Part 2: 箭头函数 Arrow Function
// ----------------------------------------------------------
// 语法：
//   单行（省略 return）：  (a, b) => a + b
//   多行（需要 return）：  (a, b) => { return a + b; }
//   无参数：              () => "hello"
//
// 在 Hardhat 测试中你会这样写：
//   it("should pass", async () => {
//     const result = await contract.someMethod();
//   });

// TODO 2.1：用箭头函数（单行写法）写一个 double 函数，返回参数的两倍

const double= (a) => a*2;

// TODO 2.2：用箭头函数（多行写法）写一个 greet 函数
//   接收 name 参数，内部：let upper = name.toUpperCase()，然后 return "Hello, " + upper

const greet=(name)=>{
  let upper=name.toUpperCase();
  return "Hello, "+upper;
}

// TODO 2.3：调用上面两个函数，用 console.log 打印结果
console.log(double(1));
console.log(greet('claude'));

// ----------------------------------------------------------
// Part 3: 模板字符串 Template String
// ----------------------------------------------------------
// 用反引号 `` 包裹，${} 里放变量或表达式

// TODO 3.1：用模板字符串打印：
//   "Sepolia 的 chainId 是 11155111，当前 counter 是 <counter 的值>"
//   提示：counter 用了 let，所以可以重新赋值

console.log(`Sepolia 的 chainId 是 11155111,当前 counter 是 ${counter}`);

// ----------------------------------------------------------
// Part 4: 对象解构 Object Destructuring
// ----------------------------------------------------------
// 在项目中你经常需要从一个对象里提字段，比如 ethers 返回的：
//   const { address, privateKey } = ethers.Wallet.createRandom();

// TODO 4.1：下面这个 tx 对象表示一笔交易，用解构语法把 from、to、value 提取出来
//   然后分别打印

const tx = {
  from: "0xAlice",
  to: "0xBob",
  value: 100,
  gas: 21000,
  chainId: 11155111,
};

// 你的代码（用一行解构就搞定）：
const {from,to,value}=tx;
console.log(from)
console.log(to)
console.log(value)

// ----------------------------------------------------------
// Part 5: 数组解构 Array Destructuring
// ----------------------------------------------------------

// TODO 5.1：下面这个数组表示 ecrecover 的返回结果（地址, 公钥），用解构取第一个元素

const recoverResult = ["0xABC123...", "0xPublicKey..."];
// 你的代码：

const [first] =recoverResult;
console.log(first)
console.log("\n🎯 如果以上代码全部正常运行没有报错，Part 1-5 就完成了！");
