# Project Scope — Cross-Chain Message Verifier

## 项目是什么

一个面向跨链互操作场景的**消息验证原型**，演示 ECDSA 签名验证、Merkle proof 验证、relayer 中继流程、防重放设计等核心机制。

不做生产级跨链桥，聚焦「验证逻辑 + 安全性 + 演示完整性」。

## 做什么

- 源链侧生成消息并记录事件
- 离线脚本构造签名、nonce、Merkle proof
- 目标链侧合约验证签名与 proof，拒绝非法消息
- 防重放保护（nonce、deadline、chain domain separation）
- 完整的测试体系（正常路径 + 安全场景）
- Benchmark（gas 消耗、验证延迟）

## 不做什么

- 不做真正的跨链桥（资产锁定/铸造/销毁）
- 不做前端 UI
- 不做中继器网络经济模型
- 不做生产级部署

## 技术边界

这是一个研究型 demo，目的不是替代现有跨链协议，而是：
1. 展示跨链消息验证的核心技术链路
2. 证明签名验证 + Merkle proof + 防重放的最小可行组合
3. 为后续扩展（如真正跨链桥、interoperable execution）提供基础

## 技术栈

- Solidity（合约）
- Hardhat + ethers.js v6（编译、测试、部署）
- OpenZeppelin Contracts（安全合约库）
- Sepolia / Mumbai 测试网
