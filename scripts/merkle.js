// ============================================================
// scripts/merkle.js
// 消息结构定义 + Merkle Tree 生成 + Merkle Proof 验证
// ============================================================

const ethers = require("ethers");

// ============================================================
// 模块 1：消息结构定义
// ============================================================
// 7 个字段：sourceChainId, targetChainId, sender, recipient,
//           amountOrPayloadHash, nonce, deadline
// 顺序固定，后续 Solidity 合约必须和这里的顺序完全一致

/**
 * ABI 编码一条消息
 * @param {Object} msg — { sourceChainId, targetChainId, sender, recipient,
 *                         amountOrPayloadHash, nonce, deadline }
 * @returns {string} — ABI 编码后的 hex 字符串（0x 开头）
 *
 * 提示：
 *  - 类型数组：["uint256","uint256","address","address","bytes32","uint256","uint256"]
 *  - 用 ethers.AbiCoder.defaultAbiCoder().encode(types, values)
 */
function encodeMessage(msg) {
    // 顺序必须和合约 verifyAndExecute 里的 abi.encode 完全一致
    const values = [
        msg.sender,
        msg.recipient,
        msg.amountOrPayloadHash,
        msg.nonce,
        msg.deadline,
        msg.sourceChainId,
        msg.targetChainId
    ];
    const types = ["address","address","uint256","uint256","uint256","uint256","uint256"];
    const AbiString = ethers.AbiCoder.defaultAbiCoder().encode(types, values);
    return AbiString;
}

/**
 * 对消息做哈希
 * @param {Object} msg
 * @returns {string} — bytes32 hash（0x 开头的 66 字符 hex）
 *
 * 提示：
 *  - 先调 encodeMessage(msg) 拿到编码后的 bytes
 *  - 用 ethers.keccak256(...) 对编码结果做 hash
 *  - 注意 keccak256 需要 Uint8Array 输入，用 ethers.getBytes(encodedMsg) 转
 */
function hashMessage(msg) {
  const encodeMsg=encodeMessage(msg);
  const hashMsg=ethers.keccak256(ethers.getBytes(encodeMsg));
  return hashMsg;
}

/**
 * 批量生成模拟消息
 * @param {number} count — 消息数量（如 8 或 16）
 * @returns {Array<Object>}
 *
 * 提示：
 *  - 用 ethers.Wallet.createRandom().address 生成随机地址
 *  - nonce 从 1 开始递增
 *  - sourceChainId / targetChainId 用常数（如 1 和 11155111）
 *  - amountOrPayloadHash 先用 ethers.ZeroHash 占位
 *  - deadline = Math.floor(Date.now() / 1000) + 3600（一小时过期）
 */
function createMockMessages(count) {
  const msgArray=[];
  for (let i=0;i<count;i++) {
    const msg={
        sourceChainId:1,
        targetChainId:11155111,
        sender:ethers.Wallet.createRandom().address,
        recipient:ethers.Wallet.createRandom().address,
        amountOrPayloadHash:ethers.ZeroHash,
        nonce:i+1,
        deadline:Math.floor(Date.now()/1000)+3600
    };
    msgArray.push(msg);
  }
  return msgArray;
}

// ============================================================
// 模块 2：Merkle Tree
// ============================================================

/**
 * 从消息数组构建 Merkle Tree
 * @param {Array<Object>} messages
 * @returns {{ root: string, leafHashes: string[], treeLayers: string[][] }}
 *
 * 步骤提示：
 *  1. 对每条消息调 hashMessage() → leafHashes[]
 *  2. 当前层 = leafHashes
 *  3. while 当前层长度 > 1:
 *     a. 两两配对：取 i 和 i+1，hash(left, right) 得到父节点
 *        - 用 ethers.solidityPackedKeccak256(["bytes32","bytes32"], [left, right])
 *     b. 如果当前层长度是奇数 → 最后一个元素复制一份和自己配对
 *     c. 把父节点层 push 到 treeLayers
 *     d. 当前层 = 父节点层
 *  4. root = 最后一层的唯一元素
 *
 * 细节：
 *  - treeLayers[0] 是叶子层，treeLayers[last] 是根层（只有 1 个元素）
 *  - solidityPackedKeccak256 的输入两个参数都是 bytes32 类型
 */
function buildMerkleTree(messages) {
  const leafHashes=[];
  const treeLayers=[];

  messages.forEach(element => {
    leafHashes.push(hashMessage(element));
  });
  treeLayers.push(leafHashes);

  let currentLayer=structuredClone(leafHashes);
  while(currentLayer.length>1){
    const parentLayer=[];
    for (let index = 0; index < currentLayer.length; index+=2) {
        if (index+1==currentLayer.length) {
            const tail=ethers.solidityPackedKeccak256(["bytes32","bytes32"],[currentLayer[index],currentLayer[index]]);
            parentLayer.push(tail);
            break;
        }
        const element = ethers.solidityPackedKeccak256(["bytes32","bytes32"],[currentLayer[index],currentLayer[index+1]]);
        parentLayer.push(element);
    }
    treeLayers.push(parentLayer);
    currentLayer=structuredClone(parentLayer);
  } 
  const root=currentLayer[0];
  return {root,leafHashes,treeLayers};
}

/**
 * 为单个叶子节点生成 Merkle Proof
 * @param {number} leafIndex — 叶子在 leafHashes 中的索引
 * @param {string[][]} treeLayers — buildMerkleTree 返回的 treeLayers
 * @returns {Array<{ sibling: string, isLeft: boolean }>}
 *
 * 提示：
 *  - 从叶子层（treeLayers[0]）开始往上爬到倒数第二层
 *  - 每层：
 *    - 如果 leafIndex 是偶数 → 兄弟在右边 (index + 1), isLeft = false
 *    - 如果 leafIndex 是奇数 → 兄弟在左边 (index - 1), isLeft = true
 *    - 下层的 leafIndex = Math.floor(leafIndex / 2)（父节点在本层的索引）
 *  - 也可以用 leafIndex ^ 1 取兄弟索引
 */
function getProof(leafIndex, treeLayers) {
    const proofArray=[];
    for (let index = 0; index < treeLayers.length-1; index++) {
        const proof={};
        if (leafIndex%2==0) {
            proof.sibling=treeLayers[index][leafIndex+1];
            proof.isLeft=false;
        } else {
            proof.sibling=treeLayers[index][leafIndex-1];
            proof.isLeft=true;
        }
        proofArray.push(proof);
        leafIndex=Math.floor(leafIndex/2);
    }
    return proofArray;
}

/**
 * 链下验证 Merkle Proof（模拟合约验证逻辑）
 * @param {string} leafHash — 叶子的哈希值
 * @param {Array<{ sibling: string, isLeft: boolean }>} proof
 * @param {string} root — 预期的 Merkle root
 * @returns {boolean}
 *
 * 提示：
 *  - computedHash = leafHash
 *  - for each { sibling, isLeft } in proof:
 *    - 如果 isLeft 为 true  → computedHash = hash(sibling, computedHash)
 *    - 如果 isLeft 为 false → computedHash = hash(computedHash, sibling)
 *    - 用 ethers.solidityPackedKeccak256(["bytes32","bytes32"], [left, right])
 *  - 最后 return computedHash === root
 *
 * 注意：这里的左右顺序必须和 buildMerkleTree 里的拼接顺序一致！
 */
function verifyProof(leafHash, proof, root) {
  let computedHash=leafHash;
  proof.forEach(({sibling,isLeft}) => {
    if (isLeft) {
        computedHash=ethers.solidityPackedKeccak256(["bytes32","bytes32"],[sibling,computedHash]);
    } else {
        computedHash=ethers.solidityPackedKeccak256(["bytes32","bytes32"],[computedHash,sibling]);
    }
  });
  return computedHash===root;
}

// ============================================================
// 模块 3：主流程
// ============================================================

function main() {
  // 1. 生成 8 条模拟消息
     const messages = createMockMessages(8);
    // console.log("消息 0：",messages[0]);
    // console.log("编码：",encodeMessage(messages[0]));
    // console.log("哈希：",hashMessage(messages[0]))
  // 2. 构建 Merkle Tree
     const { root, leafHashes, treeLayers } = buildMerkleTree(messages)

  // 3. 选一条消息（如第 0 条），生成 proof
     const leafIndex = 5
     const proof = getProof(leafIndex, treeLayers)

  // 4. 验证 proof
     const leafHash = leafHashes[leafIndex]
     const isValid = verifyProof(leafHash, proof, root)

  // 5. 打印结果
  //    - 消息内容
  //    - leaf hash
  //    - root
  //    - proof 内容（每个兄弟节点的 hash 和位置）
  //    - 验证是否通过
    console.log("message: ",messages[leafIndex]);
    console.log("leaf hash: ",leafHash);
    console.log("root: ",root);
    console.log("proof: \n",proof);
    console.log("is valid: ",isValid);
}

// 直接运行脚本时执行 main，被 require 时不执行
if (require.main === module) {
  main();
}

module.exports = {
  encodeMessage,
  hashMessage,
  createMockMessages,
  buildMerkleTree,
  getProof,
  verifyProof,
};
