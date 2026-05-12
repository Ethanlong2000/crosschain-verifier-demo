// ============================================================
// scripts/relayer-demo.js
// Root 管理 + Relayer 流程演示
// ============================================================
//
// 这个脚本把 merkle.js 和合约串联起来，
// 模拟 relayer 的完整工作流：
//
//   消息列表 → Merkle Tree(root+proof) → 签名 → 提交root
//   → 批准root → verifyAndExecute → 查看event
//
// 依赖：
//   - scripts/merkle.js  中的 encodeMessage / hashMessage / createMockMessages
//                          buildMerkleTree / getProof / verifyProof
//   - contracts/CrossChainMessageVerifier.sol
//
// 运行：npx hardhat run scripts/relayer-demo.js

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
// 模块 1：配置
// ============================================================

// TODO: 定义链 ID 常量
//   SOURCE_CHAIN_ID = 11155111  (Sepolia)
//   TARGET_CHAIN_ID = 80001      (Mumbai)

// TODO: 定义消息数量
//   MESSAGE_COUNT = 8

const SOURCE_CHAIN_ID=11155111;
const TARGET_CHAIN_ID=80001;
const MESSAGE_COUNT=8;

// ============================================================
// 模块 2：签名生成
// ============================================================

/**
 * 对消息哈希签名
 * @param {string} msgHash — 消息的 keccak256 哈希（bytes32）
 * @param {ethers.Wallet} signer — 签名用的 Wallet 对象
 * @returns {string} — 序列化后的签名（flat signature, 65 bytes）
 *
 * TODO: 用 signer.signingKey.sign(ethers.getBytes(msgHash)) 签名
 *       返回 sig.serialized
 */
async function signMessage(msgHash, signer) {
  const sig=await signer.signingKey.sign(ethers.getBytes(msgHash));
  return sig.serialized;
}

// ============================================================
// 模块 3：合约交互
// ============================================================

/**
 * 部署合约并做初始设置
 * @returns {Promise<{contract: Contract, owner: Signer, authorizedSigner: Wallet}>}
 *
 * 步骤：
 *   TODO 1: 获取 Hardhat signers（owner, relayer 等）
 *   TODO 2: ethers.Wallet.createRandom() 创建一个随机签名者
 *   TODO 3: getContractFactory("CrossChainMessageVerifier") 部署合约
 *   TODO 4: contract.setAuthorizedSigner(wallet.address, true) 授权签名者
 *
 * 注意：owner 是 Hardhat 默认账户，wallet 是需要被授权的签名者
 */
async function deployAndSetup() {
  const [owner,relayer]=await ethers.getSigners();

  const signer = await ethers.Wallet.createRandom();
  const factory = await ethers.getContractFactory("CrossChainMessageVerifier");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  await contract.setAuthorizedSigner(signer.address,true);

  return {contract,owner,signer};
}
/**
 * 批准 Merkle root
 * @param {Contract} contract — 已部署的 CrossChainMessageVerifier
 * @param {string} root — Merkle root（bytes32）
 *
 * TODO: 调 contract.approveRoot(root)，只有 owner 能调
 */
async function approveRoot(contract, root) {
  await contract.approveRoot(root);
}
/**
 * 提交单条消息的验证请求
 * @param {Contract} contract
 * @param {Object} params — { proof, root, sender, recipient, amount, nonce,
 *                            deadline, sourceChainId, targetChainId, index, signature }
 * TODO: 调 contract.verifyAndExecute(...) 传入所有参数
 *       参数顺序要和合约里 verifyAndExecute 的定义一致
 */
async function submitVerification(contract, params) {
  await contract.verifyAndExecute(
    params.proof,
    params.root,
    params.sender,
    params.recipient,
    params.amount,
    params.nonce,
    params.deadline,
    params.sourceChainId,
    params.targetChainId,
    params.index,
    params.signature
  )
}
/**
 * 查询并打印链上 events
 * @param {Contract} contract
 *
 * TODO: 用 contract.queryFilter("MessageExecuted") 查询历史事件
 *       打印每个 event 的 msgId 和 signer
 */
async function queryEvents(contract) {
  const events=await contract.queryFilter("MessageExecuted");
  events.forEach(e => {
    console.log("msgId:", e.args.msgId);
    console.log("signer:", e.args.signer);
  });
}

// ============================================================
// 模块 4：辅助函数
// ============================================================

/**
 * 把消息对象转成 verifyAndExecute 需要的参数格式
 * @param {Object} msg — 原始消息对象
 * @param {Array} proof — Merkle proof
 * @param {string} root — Merkle root
 * @param {number} index — 消息在叶子数组中的索引
 * @param {string} signature — 序列化签名
 * @returns {Object} — { proof, root, sender, recipient, amount, nonce,
 *                        deadline, sourceChainId, targetChainId, index, signature }
 *
 * TODO: 把 msg 的字段拆出来，拼成合约方法需要的参数结构
 */
function buildVerificationParams(msg, proof, root, index, signature) {
  const paramForContract = {
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
    signature: signature
  };

  return paramForContract;
}

/**
 * 打印分隔线
 * @param {string} title — 阶段标题
 *
 * TODO: 打印带标题的分隔线，让控制台输出更清晰
 */
function printPhase(title) {
  console.log("\n"+"=".repeat(60));
  console.log(title);
  console.log("\n"+"=".repeat(60));
}

// ============================================================
// 模块 5：主流程
// ============================================================

async function main() {
  // ── 阶段 1：生成模拟消息 ──
  printPhase("阶段一：生成模拟数据")
  //   TODO: 调 createMockMessages(N) 生成 N 条消息
  //   TODO: 打印每条消息的关键字段（sender, nonce, amount）
  const messages = createMockMessages(MESSAGE_COUNT);
  messages.forEach(element => {
      console.log("sender: ", element.sender);
      console.log("nonce: ", element.nonce);
      console.log("amountOrPayloadHash: ", element.amountOrPayloadHash);
   });

  // ── 阶段 2：构建 Merkle Tree ──
  printPhase("阶段二：构建merkle tree")
  //   TODO: 调 buildMerkleTree(messages) 拿到 { root, leafHashes, treeLayers }
  //   TODO: 选一条消息（如第 0 条），调 getProof(index, treeLayers) 生成 proof
  //   TODO: 打印 leaf hash、root、proof 内容
  const {root,leafHashes,treeLayers} = buildMerkleTree(messages);
  const proof = getProof(0,treeLayers);
  console.log("leaf hash: ",leafHashes[0]);
  console.log("root: ",root);
  console.log("proof: ",proof);
  
  // ── 阶段 3：部署合约 + 批准 Root ──
  printPhase("阶段三：部署合约，批准root")
  //   TODO: 调 deployAndSetup() 拿到 { contract, owner, authorizedSigner }
  //   TODO: 调 approveRoot(contract, root)
  //   TODO: 确认 approvedRoots[root] == true
  const { contract, owner, signer: authorizedSigner } = await deployAndSetup();
  await approveRoot(contract, root);
  const ifApproved = await contract.approvedRoots(root);
  console.log("root 已批准：",ifApproved);

  // ── 阶段 4：链下签名 ──
  printPhase("阶段四：链下签名")
  //   TODO: 用 authorizedSigner 对选中的消息哈希签名
  //   TODO: 打印签名内容
  const sig=authorizedSigner.signingKey.sign(ethers.getBytes(leafHashes[0]));
  const signature=sig.serialized;
  console.log("signature:",signature)

  // ── 阶段 5：提交验证 ──
  printPhase("阶段五：提交验证")
  //   TODO: 用 buildVerificationParams() 拼出参数
  //   TODO: 调 submitVerification(contract, params)
  //   TODO: 确认 executedMessages[msgId] == true
  const msg = messages[0];
  const proofBytes32 = proof.map(p => p.sibling); // getProof 返回 {sibling, isLeft}，合约只要 sibling
  const params = buildVerificationParams(msg, proofBytes32, root, 0, signature);
  await submitVerification(contract, params);
  const msgId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [msg.sender, msg.recipient, msg.amountOrPayloadHash, msg.nonce, msg.deadline, msg.sourceChainId, msg.targetChainId]
    )
  );
  const ifExecuted = await contract.executedMessages(msgId);
  console.log("消息已处理：",ifExecuted);

  // ── 阶段 6：重复提交测试（防重放） ──
  printPhase("阶段六：重复提交测试")
  //   TODO: 用相同的参数再调一次 verifyAndExecute
  //   TODO: 预期 revert AlreadyExecuted
  try {
      await submitVerification(contract,params);
  } catch (error) {
    console.log(error);
  }


  // ── 阶段 7：查看链上 Events ──
  printPhase("阶段七：查看链上事件")
  //   TODO: 调 queryEvents(contract) 打印所有历史事件
  await queryEvents(contract);
  // ── 总结 ──
  //   TODO: 打印完整流程回顾
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
