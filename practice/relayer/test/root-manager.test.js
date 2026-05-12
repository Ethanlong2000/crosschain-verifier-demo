const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RootManager — Step 1: Root 管理基础", function () {
  let contract, owner, relayer, other;

  before(async function () {
    [owner, relayer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RootManager");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  describe("submitRoot() — relayer 提交 root", function () {
    it("任何人可以提交 root", async function () {
      const root = ethers.ZeroHash;
      await contract.connect(relayer).submitRoot(root);

      const submitter = await contract.rootSubmitter(root);
      expect(submitter).to.equal(relayer.address);
    });

    it("重复提交同一个 root 会失败", async function () {
      const root = ethers.id("batch-1");
      await contract.connect(relayer).submitRoot(root);

      await expect(
        contract.connect(relayer).submitRoot(root)
      ).to.be.revertedWithCustomError(contract, "RootAlreadySubmitted");
    });

    it("提交时 emit RootSubmitted 事件", async function () {
      const root = ethers.id("batch-2");
      await expect(contract.connect(relayer).submitRoot(root))
        .to.emit(contract, "RootSubmitted")
        .withArgs(root, relayer.address);
    });
  });

  describe("approveRoot() — owner 批准 root", function () {
    it("owner 可以批准已提交的 root", async function () {
      const root = ethers.id("batch-3");
      await contract.connect(relayer).submitRoot(root);
      await contract.approveRoot(root); // owner 调

      expect(await contract.isRootApproved(root)).to.be.true;
    });

    it("非 owner 不能批准 root", async function () {
      const root = ethers.id("batch-4");
      await expect(
        contract.connect(relayer).approveRoot(root)
      ).to.be.revertedWithCustomError(contract, "OnlyOwner");
    });

    it("未提交也能直接批准（当前设计）", async function () {
      const root = ethers.id("batch-5");
      await contract.approveRoot(root);
      expect(await contract.isRootApproved(root)).to.be.true;
    });
  });

  describe("submitAndApprove() — 一步完成", function () {
    it("owner 可以一步提交+批准", async function () {
      const root = ethers.id("batch-6");
      await contract.submitAndApprove(root);
      expect(await contract.isRootApproved(root)).to.be.true;
      expect(await contract.rootSubmitter(root)).to.equal(owner.address);
    });
  });
});
