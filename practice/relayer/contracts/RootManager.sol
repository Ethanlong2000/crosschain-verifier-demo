// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Step 1 合约：纯 root 管理，不涉及签名和验证
// 目的：先理解 root 的"提交 vs 批准"两个动作分别是什么
contract RootManager {
    // owner 就是部署合约的人
    address public immutable owner;
    

    // 记录哪些 root 已被批准（和主项目一样的 mapping）
    mapping(bytes32 => bool) public approvedRoots;

    // 可选：记录 root 是谁提交的（relayer 地址）
    mapping(bytes32 => address) public rootSubmitter;

    // 事件：链下脚本靠监听这些事件来知道发生了什么
    event RootSubmitted(bytes32 indexed root, address indexed submitter);
    event RootApproved(bytes32 indexed root);
    event RootRejected(bytes32 indexed root);

    error OnlyOwner();
    error RootAlreadySubmitted(bytes32 root);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─── 核心概念 #1：relayer 提交 root ───
    // relayer 生成 Merkle root 后，调这个函数告诉合约"这批消息准备好了"
    // 这时候 root 还没有被批准，只是被记录
    function submitRoot(bytes32 root) public {
        // 防止同一个 root 被覆盖提交
        if (rootSubmitter[root] != address(0))
            revert RootAlreadySubmitted(root);

        rootSubmitter[root] = msg.sender;
        emit RootSubmitted(root, msg.sender);
    }

    // ─── 核心概念 #2：owner 批准 root ───
    // 和主项目的 approveRoot 一样
    // 区别：现在合约区分了 "已提交" 和 "已批准" 两个状态
    // 主项目里 approveRoot 不需要先 submitRoot，这里是展示一个更完整的两步流程
    function approveRoot(bytes32 root) public onlyOwner {
        approvedRoots[root] = true;
        emit RootApproved(root);
    }

    // ─── 核心概念 #3：一步提交+批准（简化模式） ───
    // 如果你的场景不需要分离提交和批准两步，
    // 可以直接让 relayer 提交的同时就批准
    // 这就是你主项目当前的模式（只有 approveRoot）
    function submitAndApprove(bytes32 root) public onlyOwner {
        if (rootSubmitter[root] == address(0)) {
            rootSubmitter[root] = msg.sender;
        }
        approvedRoots[root] = true;
        emit RootSubmitted(root, msg.sender);
        emit RootApproved(root);
    }

    // ─── 辅助查询：root 是否可用 ───
    function isRootApproved(bytes32 root) public view returns (bool) {
        return approvedRoots[root];
    }
}
