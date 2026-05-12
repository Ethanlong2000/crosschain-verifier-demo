# JS 练习代码

## 前置条件

```bash
cd practice/js
npm install   # 已执行过，装好了 ethers
```

## 文件说明与运行顺序

| 序号 | 文件 | 覆盖知识点 | 运行命令 |
|------|------|-----------|----------|
| 1 | `01-basics.js` | const/let、箭头函数、模板字符串、对象/数组解构 | `node 01-basics.js` |
| 2 | `02-async.js` | Promise、async/await、try/catch | `node 02-async.js` |
| 3 | `03-modules.js` | require / module.exports（CommonJS） | `node 03-modules.js` |
| 4 | `04-ethers-playground.js` | ethers.js：钱包、签名、哈希、r/s/v 拆分 | `node 04-ethers-playground.js` |

> 文件 1-3 之间没有依赖，可以任意顺序做。文件 4 需要前面的 JS 基础，建议最后做。

## 使用方式

1. 在 IDE 中打开文件
2. 找到所有 `// TODO x.x：` 标记
3. 在标记下方写入你的代码
4. 终端运行 `node <文件名>` 看输出是否正确

## 遇到问题？

直接问 Claude。描述你做了什么、期望什么结果、实际看到了什么报错。
