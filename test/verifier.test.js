// CrossChainMessageVerifier 测试
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainMessageVerifier", function () {
  let contract, owner, signer, otherSigner, stranger;

  const sourceChainId = 1;
  const targetChainId = 5;
  const amount = 100;
  const nonce = 0;
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 小时后

  beforeEach(async () => {
    [owner, stranger] = await ethers.getSigners();
    // ethers v6: getSigners() 返回的 HardhatEthersSigner 不暴露 .privateKey
    // 用 Wallet 来做 ECDSA 签名 — Wallet 有 .signingKey
    signer = ethers.Wallet.createRandom().connect(ethers.provider);
    otherSigner = ethers.Wallet.createRandom().connect(ethers.provider);

    const Factory = await ethers.getContractFactory("CrossChainMessageVerifier");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // 批准一个 Merkle root（单叶树：root = leaf）
    const leaf = ethers.ZeroHash;
    const root = leaf;
    await contract.approveRoot(root);
    await contract.setAuthorizedSigner(signer.address, true);
  });

  // ========== 签名恢复 ==========

  describe("recoverSigner", function () {
    it("正确签名恢复出正确 signer", async () => {
      const msgHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [signer.address, stranger.address, amount, nonce, deadline, sourceChainId, targetChainId]
        )
      );

      const sig = signer.signingKey.sign(ethers.getBytes(msgHash));
      const recovered = await contract.recoverSigner(msgHash, sig.serialized);

      expect(recovered).to.equal(signer.address);
    });

    it("签名长度不对应 revert", async () => {
      const badSig = "0x1234"; // 太短
      await expect(
        contract.recoverSigner(ethers.ZeroHash, badSig)
      ).to.be.revertedWithCustomError(contract, "InvalidSigLength");
    });
  });

  // ========== 完整验证链路 ==========

  describe("verifyAndExecute", function () {
    let proof, root, leaf, index, msgId, signature;

    beforeEach(async () => {
      // 单条消息的 Merkle tree：leaf = keccak256(msg)，root = keccak256(leaf)
      msgId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [signer.address, stranger.address, amount, nonce, deadline, sourceChainId, targetChainId]
        )
      );
      leaf = msgId;
      root = leaf; // 单叶树：root 就是 leaf 本身
      proof = []; // 单叶树无 proof
      index = 0;

      // owner 批准 root
      await contract.approveRoot(root);

      // signer 签名消息哈希
      const sig = signer.signingKey.sign(ethers.getBytes(msgId));
      signature = sig.serialized;
    });

    it("正确签名 + 正确 root + 授权 signer → 成功执行", async () => {
      const tx = await contract.verifyAndExecute(
        proof, root,
        signer.address, stranger.address, amount, nonce, deadline,
        sourceChainId, targetChainId, index, signature
      );

      await expect(tx)
        .to.emit(contract, "MessageExecuted")
        .withArgs(msgId, signer.address);

      // executedMessages 已标记
      expect(await contract.executedMessages(msgId)).to.equal(true);
    });

    it("重复提交同一消息应失败（防重放）", async () => {
      // 第一次成功
      await contract.verifyAndExecute(
        proof, root,
        signer.address, stranger.address, amount, nonce, deadline,
        sourceChainId, targetChainId, index, signature
      );

      // 第二次相同参数应 revert
      await expect(
        contract.verifyAndExecute(
          proof, root,
          signer.address, stranger.address, amount, nonce, deadline,
          sourceChainId, targetChainId, index, signature
        )
      ).to.be.revertedWithCustomError(contract, "AlreadyExecuted");
    });

    it("错误签名应失败", async () => {
      // otherSigner 签名（未被授权）
      const strangerSig = otherSigner.signingKey.sign(ethers.getBytes(msgId));
      await expect(
        contract.verifyAndExecute(
          proof, root,
          signer.address, stranger.address, amount, nonce, deadline,
          sourceChainId, targetChainId, index, strangerSig.serialized
        )
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("过期 deadline 应失败", async () => {
      // 用过去的 deadline 重建 msgId 和签名
      const pastDeadline = Math.floor(Date.now() / 1000) - 100;
      const expiredMsgId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [signer.address, stranger.address, amount, nonce, pastDeadline, sourceChainId, targetChainId]
        )
      );
      const expiredRoot = expiredMsgId; // 单叶树：root = leaf
      await contract.approveRoot(expiredRoot);
      const expiredSig = signer.signingKey.sign(ethers.getBytes(expiredMsgId));

      await expect(
        contract.verifyAndExecute(
          [], expiredRoot,
          signer.address, stranger.address, amount, nonce, pastDeadline,
          sourceChainId, targetChainId, 0, expiredSig.serialized
        )
      ).to.be.revertedWithCustomError(contract, "MessageExpired");
    });

    it("错误 proof 应失败", async () => {
      // 批准一个与 msgId 不匹配的 root：approvedRoots 检查通过，但 verifyProof 失败
      const wrongRoot = ethers.ZeroHash; // 与 msgId 不匹配的 root
      await contract.approveRoot(wrongRoot);
      await expect(
        contract.verifyAndExecute(
          proof, wrongRoot,
          signer.address, stranger.address, amount, nonce, deadline,
          sourceChainId, targetChainId, index, signature
        )
      ).to.be.revertedWithCustomError(contract, "InvalidProof");
    });

    it("未授权 signer 应失败", async () => {
      // otherSigner 未授权
      const otherMsgId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [otherSigner.address, stranger.address, amount, nonce, deadline, sourceChainId, targetChainId]
        )
      );
      const otherRoot = otherMsgId; // 单叶树：root = leaf
      await contract.approveRoot(otherRoot);
      const otherSig = otherSigner.signingKey.sign(ethers.getBytes(otherMsgId));

      await expect(
        contract.verifyAndExecute(
          [], otherRoot,
          otherSigner.address, stranger.address, amount, nonce, deadline,
          sourceChainId, targetChainId, 0, otherSig.serialized
        )
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("未批准 root 应失败", async () => {
      // 构造合法的消息和签名，但不调 approveRoot
      const unapprovedMsgId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
          [signer.address, stranger.address, 999, nonce, deadline, sourceChainId, targetChainId]
        )
      );
      const unapprovedRoot = unapprovedMsgId;
      const unapprovedSig = signer.signingKey.sign(ethers.getBytes(unapprovedMsgId));

      await expect(
        contract.verifyAndExecute(
          [], unapprovedRoot,
          signer.address, stranger.address, 999, nonce, deadline,
          sourceChainId, targetChainId, 0, unapprovedSig.serialized
        )
      ).to.be.revertedWithCustomError(contract, "RootNotApproved");
    });

    it("错误 targetChainId 应失败（域隔离）", async () => {
      // 签的是 targetChainId=5，但传 targetChainId=999 给合约
      // 合约重算的 msgId 会不同，签名恢复出的地址不对 → InvalidSignature
      await expect(
        contract.verifyAndExecute(
          proof, root,
          signer.address, stranger.address, amount, nonce, deadline,
          sourceChainId, 999, index, signature // 签名是在 targetChainId=5 下签的
        )
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });
  });

  // ========== 管理函数 ==========

  describe("管理函数", function () {
    it("非 owner 不能 approveRoot", async () => {
      await expect(
        contract.connect(stranger).approveRoot(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("非 owner 不能 setAuthorizedSigner", async () => {
      await expect(
        contract.connect(stranger).setAuthorizedSigner(stranger.address, true)
      ).to.be.revertedWithCustomError(contract, "NotOwner");
    });
  });
});
