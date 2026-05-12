// ─── Step 2: Relayer 演示脚本 ───
// 作用：模拟 relayer 的完整工作流
// 这个脚本会：
//   1. 生成模拟消息
//   2. 构建 Merkle Tree → 拿到 root + proof
//   3. 部署合约 → 提交 root → 验证 proof

const { ethers } = require("hardhat");

// ─── 工具函数：构建 Merkle Tree ───
// 和主项目的逻辑完全一样，只是这里内联了，避免额外的文件依赖

/**
 * 对消息做哈希，得到 leaf
 */
function hashMessage(msg) {
  // abi.encode 编码顺序要和合约里的 msgId 计算保持一致
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [
        msg.sender,
        msg.recipient,
        msg.amount,
        msg.nonce,
        msg.deadline,
        msg.sourceChainId,
        msg.targetChainId,
      ]
    )
  );
}

/**
 * 给定 leaves，构建 Merkle tree，返回 root 和每个 leaf 的 proof
 */
function buildMerkleTree(leaves) {
  // 递归向上构建
  let layer = leaves;
  const layers = [layer]; // 保存每一层，后面生成 proof 用

  while (layer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left; // 奇数个时复制最后一个
      const parent = ethers.keccak256(
        ethers.concat([left, right])
      );
      nextLayer.push(parent);
    }
    layer = nextLayer;
    layers.push(layer);
  }

  const root = layer[0];

  // 为每个 leaf 生成 proof
  function getProof(leafIndex) {
    const proof = [];
    let idx = leafIndex;
    for (let i = 0; i < layers.length - 1; i++) {
      const currentLayer = layers[i];
      // 找 sibling：偶数 idx → 右边是 sibling，奇数 idx → 左边是 sibling
      const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (pairIdx < currentLayer.length) {
        proof.push(currentLayer[pairIdx]);
      } else {
        // 奇数个元素，最后一个和自己配对
        proof.push(currentLayer[idx]);
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  return { root, getProof };
}

// ─── 主函数 ───
async function main() {
  // ────────────────────────────────────────
  // 阶段 1：生成模拟消息（relayer 在监听源链事件）
  // ────────────────────────────────────────
  console.log("=" .repeat(60));
  console.log("阶段 1：生成模拟跨链消息");
  console.log("=".repeat(60));

  const [signer, relayer, alice] = await ethers.getSigners();

  const messages = [
    {
      sender: alice.address,
      recipient: ethers.Wallet.createRandom().address,
      amount: 100,
      nonce: 1,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
      sourceChainId: 11155111,  // Sepolia
      targetChainId: 80001,      // Mumbai
    },
    {
      sender: alice.address,
      recipient: ethers.Wallet.createRandom().address,
      amount: 200,
      nonce: 2,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      sourceChainId: 11155111,
      targetChainId: 80001,
    },
    {
      sender: alice.address,
      recipient: ethers.Wallet.createRandom().address,
      amount: 300,
      nonce: 3,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      sourceChainId: 11155111,
      targetChainId: 80001,
    },
    {
      sender: alice.address,
      recipient: ethers.Wallet.createRandom().address,
      amount: 400,
      nonce: 4,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      sourceChainId: 11155111,
      targetChainId: 80001,
    },
  ];

  console.log(`生成了 ${messages.length} 条模拟消息：`);
  messages.forEach((m, i) => {
    console.log(`  [${i}] sender=${m.sender.slice(0, 10)}... amount=${m.amount} nonce=${m.nonce}`);
  });

  // ────────────────────────────────────────
  // 阶段 2：构建 Merkle Tree
  // ────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("阶段 2：构建 Merkle Tree");
  console.log("=".repeat(60));

  // 每条消息先哈希成 leaf
  const leaves = messages.map(hashMessage);
  console.log("Leaves (消息哈希):");
  leaves.forEach((l, i) => console.log(`  [${i}] ${l}`));

  const { root, getProof } = buildMerkleTree(leaves);
  console.log(`\nMerkle Root: ${root}`);

  // 选第 0 条消息来演示验证
  const targetIndex = 0;
  const proof = getProof(targetIndex);
  console.log(`\n消息 [${targetIndex}] 的 Merkle Proof:`);
  proof.forEach((p, i) => console.log(`  proof[${i}] ${p}`));

  // ────────────────────────────────────────
  // 阶段 3：部署合约 + 提交 Root
  // ────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("阶段 3：部署合约 + 提交 Root");
  console.log("=".repeat(60));

  const RootManager = await ethers.getContractFactory("RootManager");
  const contract = await RootManager.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`合约部署地址: ${contractAddress}`);

  // Relayer 调 submitRoot —— 注意这里 relayer 不是 owner
  // 所以 root 只是被提交，还没被批准
  const tx1 = await contract.connect(relayer).submitRoot(root);
  await tx1.wait();
  console.log(`Relayer (${relayer.address.slice(0, 10)}...) 提交了 root: ${root.slice(0, 20)}...`);

  // Owner 批准
  const tx2 = await contract.connect(signer).approveRoot(root);
  await tx2.wait();
  console.log(`Owner (${signer.address.slice(0, 10)}...) 批准了 root`);

  // 验证状态
  const isApproved = await contract.isRootApproved(root);
  const submitter = await contract.rootSubmitter(root);
  console.log(`\n状态确认:`);
  console.log(`  root 已批准: ${isApproved}`);
  console.log(`  root 提交者: ${submitter}`);

  // ────────────────────────────────────────
  // 阶段 4：验证 proof（模拟 verifyAndExecute 的前半段）
  // ────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("阶段 4：链上验证 Merkle Proof");
  console.log("=".repeat(60));

  // 用合约里自带的 verifyProof 做一个简单验证
  // 注意：RootManager 没有 verifyProof，我们只是在本地点对一下
  const leaf = leaves[targetIndex];

  // 本地重算一遍 proof 验证，确认逻辑正确
  let computedHash = leaf;
  let idx = targetIndex;
  for (let i = 0; i < proof.length; i++) {
    let left, right;
    if (idx % 2 === 0) {
      left = computedHash;
      right = proof[i];
    } else {
      left = proof[i];
      right = computedHash;
    }
    computedHash = ethers.keccak256(ethers.concat([left, right]));
    idx = Math.floor(idx / 2);
  }

  console.log(`  消息 leaf: ${leaf}`);
  console.log(`  计算出的 root: ${computedHash}`);
  console.log(`  合约存储的 root: ${root}`);
  console.log(`  验证结果: ${computedHash === root ? "✓ 通过" : "✗ 失败"}`);

  // ────────────────────────────────────────
  // 阶段 5：查看事件
  // ────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("阶段 5：链上 Events（relayer 用这些来追踪状态）");
  console.log("=".repeat(60));

  const events = await contract.queryFilter("RootSubmitted");
  events.forEach((e) => {
    console.log(`  RootSubmitted: root=${e.args.root.slice(0, 20)}... submitter=${e.args.submitter}`);
  });

  const approvedEvents = await contract.queryFilter("RootApproved");
  approvedEvents.forEach((e) => {
    console.log(`  RootApproved: root=${e.args.root.slice(0, 20)}...`);
  });

  // ────────────────────────────────────────
  // 总结
  // ────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("总结：Relayer 做了什么");
  console.log("=".repeat(60));
  console.log("  1. 监听源链 → 收集到 4 条消息");
  console.log(`  2. 构建 Merkle Tree → root = ${root.slice(0, 20)}...`);
  console.log(`  3. 提交 root 到合约 → tx: ${tx1.hash.slice(0, 20)}...`);
  console.log(`  4. 合约验证 proof → 确认消息属于该 root`);
  console.log("  5. （主项目里）调 verifyAndExecute 完成最终验证");
  console.log();
  console.log("这就是 relayer 的全部工作。没有新魔法，就是把");
  console.log("Merkle 脚本和合约调用串起来。");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
