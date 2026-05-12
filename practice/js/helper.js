// ============================================================
// helper.js  —  被 03-modules.js 引用的辅助模块
// ============================================================
// 在项目中的用途：
//   你会把工具函数（如 encodeMessage、hashMessage）抽到单独文件，
//   然后在测试和 relayer 脚本里 require 引用。
//
// 本文件不需要你修改，配合 03-modules.js 使用即可。
// ============================================================

// 格式化链的名称（chainId → 可读名称）
function chainName(chainId) {
  const names = {
    1: "Ethereum Mainnet",
    11155111: "Sepolia",
    80001: "Mumbai",
    31337: "Hardhat Local",
  };
  return names[chainId] || "Unknown Chain";
}

// 检查地址格式是否合法（简单版：以 0x 开头且长度为 42）
function isValidAddress(addr) {
  return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}

// 构造跨链消息摘要（用于展示对象操作）
function buildMessageSummary(fromChain, toChain, sender) {
  return {
    from: chainName(fromChain),
    to: chainName(toChain),
    sender: sender,
    timestamp: Date.now(),
  };
}

// 导出
module.exports = {
  chainName,
  isValidAddress,
  buildMessageSummary,
};
