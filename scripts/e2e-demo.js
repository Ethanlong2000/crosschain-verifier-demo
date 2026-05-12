// ============================================================
// scripts/e2e-demo.js
// 端到端演示 + 数据输出
// ============================================================
//
// 用法：
//   本地：npx hardhat run scripts/e2e-demo.js
//   测试网：npx hardhat run scripts/e2e-demo.js --network sepolia
//
// 区别：
//   - 本地模式：自动部署合约，流程和 relayer-demo.js 一样
//   - 测试网模式：连已部署的合约（地址写死在 CONTRACT_ADDRESS）
//
// 跑完会在末尾输出一句汇总："N 条消息, proof 深度 D, 验证 Gas G, 重放拦截 ✓"
// 这就是你的"带数据的测试"——不需要单独的 benchmark 脚本。

const { ethers } = require("hardhat");
const {
  encodeMessage,
  hashMessage,
  createMockMessages,
  buildMerkleTree,
  getProof,
  verifyProof,
} = require("./merkle.js");

// ============================================================
// 模块 0：配置
// ============================================================

const CONTRACT_ADDRESS = ""; // 部署后填入合约地址
const SOURCE_CHAIN_ID = 11155111;
const TARGET_CHAIN_ID = 80001;
const MESSAGE_COUNT = 8;

// ============================================================
// 模块 1：获取合约实例
// ============================================================

/**
 * 本地模式：部署新合约 + 返回实例
 */
async function deployLocal() {
  const [owner] = await ethers.getSigners();
  const signer = ethers.Wallet.createRandom();
  const factory = await ethers.getContractFactory("CrossChainMessageVerifier");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  await contract.setAuthorizedSigner(signer.address, true);

  return { contract, owner, signer };
}

/**
 * 测试网模式：连已部署的合约
 *
 * TODO 1.1: 检查 CONTRACT_ADDRESS 是否为空，为空则抛错
 *            if (!CONTRACT_ADDRESS) throw new Error("请先填写 CONTRACT_ADDRESS");
 *
 * TODO 1.2: getContractFactory("CrossChainMessageVerifier")
 *
 * TODO 1.3: factory.attach(CONTRACT_ADDRESS) 获取已部署实例
 *            这是你今天要学的新 API——等价于 new ethers.Contract(address, abi, signer)
 *            和 deploy() 不同，attach() 是「连上已有的」，不做部署
 *
 * TODO 1.4: 获取 signer
 *            方式 A（推荐）：用 hre.ethers.getSigners()[0]，即你 .env 里私钥对应的账户
 *            方式 B：ethers.Wallet(process.env.PRIVATE_KEY).connect(provider)
 *            注意：测试网上的合约部署时已经设过 authorizedSigner，
 *            这里直接用 owner（部署者）签名即可，不需要再 createRandom
 *
 * TODO 1.5: return { contract, owner, signer: owner }
 */
async function connectExisting() {
  if (!CONTRACT_ADDRESS) throw new Error(' 没有contract address');
  const Factory=await ethers.getContractFactory("CrossChainMessageVerifier");
  const contract=await Factory.attach(CONTRACT_ADDRESS);
  const owner=await ethers.getSigners()[0];

	return { contract, owner, signer: owner };
}

// ============================================================
// 模块 2：辅助函数
// ============================================================

function print(label, value) {
  console.log(`${label}:`, value);
}

function divider(title) {
  console.log("\n" + "=".repeat(50));
  console.log("  " + title);
  console.log("=".repeat(50) + "\n");
}

/**
 * 把消息对象转成 verifyAndExecute 需要的参数
 * （从 relayer-demo.js 搬过来的，一样）
 */
function buildVerificationParams(msg, proof, root, index, signature) {
  return {
    proof: proof,
    root: root,
    sender: msg.sender,
    recipient: msg.recipient,
    amount: msg.amountOrPayloadHash,
    nonce: msg.nonce,
    deadline: msg.deadline,
    sourceChainId: msg.sourceChainId,
    targetChainId: msg.targetChainId,
    index: index,
    signature: signature,
  };
}

// ============================================================
// 模块 3：主流程
// ============================================================

async function main() {
  const isLocal = hre.network.name === "hardhat";

  // ── 收集数据的对象，末尾汇总用 ──
  const summary = {};

  // ==========================================================
  // Phase 1: 获取合约
  // ==========================================================
  divider("Phase 1: 获取合约实例");

  // TODO 3.1: 根据 isLocal 选择 deployLocal() 还是 connectExisting()
  //   let contract, owner, signer;
  //   if (isLocal) {
  //     ({ contract, owner, signer } = await deployLocal());
  //   } else {
  //     ({ contract, owner, signer } = await connectExisting());
  //   }

  let contract, owner, signer;
  // TODO: 取消下面两行的注释，并注释掉临时的空赋值
  if (isLocal) {
    ({ contract, owner, signer } = await deployLocal());
  } else {
    ({ contract, owner, signer } = await connectExisting());
  }

  summary.network = hre.network.name;
  summary.contractAddress = await contract.getAddress();

  // ==========================================================
  // Phase 2: 生成消息 + Merkle Tree
  // ==========================================================
  divider("Phase 2: 生成消息 & Merkle Tree");

  const messages = createMockMessages(MESSAGE_COUNT);
  const { root, leafHashes, treeLayers } = buildMerkleTree(messages);
  const proof = getProof(0, treeLayers);

  print("root", root);
  print("leaf index", 0);
  print("leaf hash", leafHashes[0]);
  proof.forEach((p, i) => {
    console.log(`  proof[${i}]: sibling=${p.sibling}, isLeft=${p.isLeft}`);
  });

  summary.messageCount = MESSAGE_COUNT;
  summary.proofDepth = proof.length;
  summary.proofSize = proof.length * 32 + " bytes";

  // ==========================================================
  // Phase 3: 批准 Root
  // ==========================================================
  divider("Phase 3: 批准 Merkle Root");

  // 测试网模式下如果 root 之前已批准过会 revert，用 try/catch 兜底
  try {
    await contract.approveRoot(root);
    console.log("root 已提交批准");
  } catch (e) {
    console.log("root 可能已批准过，跳过:", e.message?.slice(0, 60));
  }
  const isApproved = await contract.approvedRoots(root);
  print("approvedRoots[root]", isApproved);

  // ==========================================================
  // Phase 4: 链下签名
  // ==========================================================
  divider("Phase 4: 链下签名");

  const sig = signer.signingKey.sign(ethers.getBytes(leafHashes[0]));
  const signature = sig.serialized;
  print("signature", signature.slice(0, 42) + "...");

  // ==========================================================
  // Phase 5: 提交验证
  // ==========================================================
  divider("Phase 5: 提交验证");

  const msg = messages[0];
  const proofBytes32 = proof.map((p) => p.sibling);
  const params = buildVerificationParams(msg, proofBytes32, root, 0, signature);

  const tx = await contract.verifyAndExecute(
    params.proof, params.root,
    params.sender, params.recipient, params.amount, params.nonce, params.deadline,
    params.sourceChainId, params.targetChainId, params.index, params.signature
  );
  const receipt = await tx.wait();

  print("tx hash", tx.hash);
  print("gas used", receipt.gasUsed.toString());

  summary.verificationGas = receipt.gasUsed.toString();
  summary.txHash = tx.hash;

  // 确认链上状态
  const msgId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [msg.sender, msg.recipient, msg.amountOrPayloadHash, msg.nonce, msg.deadline, msg.sourceChainId, msg.targetChainId]
    )
  );
  print("executedMessages[msgId]", await contract.executedMessages(msgId));

  // ==========================================================
  // Phase 6: 查 Event
  // ==========================================================
  divider("Phase 6: 链上事件");

  const events = await contract.queryFilter("MessageExecuted");
  events.forEach((e) => {
    console.log("  msgId:", e.args.msgId);
    console.log("  signer:", e.args.signer);
  });

  // ==========================================================
  // Phase 7: 安全拦截验证
  // ==========================================================
  divider("Phase 7: 安全拦截验证");

  // 7.1 重放拦截
  try {
    await contract.verifyAndExecute(
      params.proof, params.root,
      params.sender, params.recipient, params.amount, params.nonce, params.deadline,
      params.sourceChainId, params.targetChainId, params.index, params.signature
    );
    console.log("重放拦截 ✗（未被拦截）");
    summary.replayProtection = "✗";
  } catch (e) {
    console.log("重放拦截 ✓ (" + (e.errorName || e.message?.slice(0, 40)) + ")");
    summary.replayProtection = "✓";
  }

  // 7.2 过期拦截
  // TODO 3.21: 构造一条 deadline 在过去的消息，验证被拦截
  //   1. 用 createMockMessages(1) 生成 1 条消息
  //   2. 把它的 deadline 改成过去：Math.floor(Date.now()/1000) - 100
  //   3. 重新 buildMerkleTree + getProof + 签名
  //   4. approveRoot（单条消息 root=leaf）
  //   5. 提交 verifyAndExecute，预期 revert MessageExpired
  const expiredMsgs = createMockMessages(1);
  expiredMsgs[0].deadline = Math.floor(Date.now() / 1000) - 100;
  const { root: expiredRoot, leafHashes: expiredLeaves, treeLayers: expiredLayers } = buildMerkleTree(expiredMsgs);
  const expiredProof = getProof(0, expiredLayers).map(p => p.sibling);
  const expiredSig = signer.signingKey.sign(ethers.getBytes(expiredLeaves[0])).serialized;
  try { await contract.approveRoot(expiredRoot); } catch (e) {}
  try {
    const expiredParams = buildVerificationParams(expiredMsgs[0], expiredProof, expiredRoot, 0, expiredSig);
    await contract.verifyAndExecute(
      expiredParams.proof, expiredParams.root,
      expiredParams.sender, expiredParams.recipient, expiredParams.amount, expiredParams.nonce, expiredParams.deadline,
      expiredParams.sourceChainId, expiredParams.targetChainId, expiredParams.index, expiredParams.signature
    );
    console.log("过期拦截 ✗（未被拦截）");
    summary.expiredProtection = "✗";
  } catch (e) {
    console.log("过期拦截 ✓ (" + (e.errorName || e.message?.slice(0, 40)) + ")");
    summary.expiredProtection = "✓";
  }

  // 7.3 错误证明拦截
  // TODO 3.22: 用空 proof 或假 sibling 提交，验证被拦截
  //   1. 用同一个 msg + root + signature
  //   2. 把 proof 换成 []（或改一个 sibling）
  //   3. 提交 verifyAndExecute，预期 revert InvalidProof
  try {
    const fakeProof = [ethers.ZeroHash];
    const badProofParams = buildVerificationParams(msg, fakeProof, root, 0, signature);
    await contract.verifyAndExecute(
      badProofParams.proof, badProofParams.root,
      badProofParams.sender, badProofParams.recipient, badProofParams.amount, badProofParams.nonce, badProofParams.deadline,
      badProofParams.sourceChainId, badProofParams.targetChainId, badProofParams.index, badProofParams.signature
    );
    console.log("错误证明拦截 ✗（未被拦截）");
    summary.invalidProofProtection = "✗";
  } catch (e) {
    console.log("错误证明拦截 ✓ (" + (e.errorName || e.message?.slice(0, 40)) + ")");
    summary.invalidProofProtection = "✓";
  }

  // ==========================================================
  // 汇总
  // ==========================================================
  divider("汇总");

  console.log(`network:             ${summary.network}`);
  console.log(`contract:            ${summary.contractAddress}`);
  console.log(`messageCount:        ${summary.messageCount}`);
  console.log(`proofDepth:          ${summary.proofDepth}`);
  console.log(`proofSize:           ${summary.proofSize}`);
  console.log(`verificationGas:     ${summary.verificationGas}`);
  console.log(`txHash:              ${summary.txHash}`);
  console.log(`replayProtection:    ${summary.replayProtection}`);
  console.log(`expiredProtection:   ${summary.expiredProtection}`);
  console.log(`invalidProofProtection: ${summary.invalidProofProtection}`);

  console.log("\n以上数据来自真实运行");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
