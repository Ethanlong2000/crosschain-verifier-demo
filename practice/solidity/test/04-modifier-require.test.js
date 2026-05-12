// 练习 04 测试：AccessControl
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessControl", function () {
  let contract, owner, other;
  const DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("data-to-approve"));

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AccessControl");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it("部署后 owner 应为部署者", async () => {
    expect(await contract.owner()).to.equal(owner.address);
  });

  it("owner 可以 approveData", async () => {
    await contract.approveData(DATA_HASH);
    expect(await contract.approvedData(DATA_HASH)).to.equal(true);
  });

  it("非 owner 调用 approveData 应 revert", async () => {
    await expect(
      contract.connect(other).approveData(DATA_HASH)
    ).to.be.reverted;
  });

  it("重复 approve 同一数据应 revert", async () => {
    await contract.approveData(DATA_HASH);
    await expect(
      contract.approveData(DATA_HASH)
    ).to.be.reverted;
  });

  it("owner 可以 revokeData", async () => {
    await contract.approveData(DATA_HASH);
    expect(await contract.approvedData(DATA_HASH)).to.equal(true);

    await contract.revokeData(DATA_HASH);
    expect(await contract.approvedData(DATA_HASH)).to.equal(false);
  });

  it("非 owner 调用 revokeData 应 revert", async () => {
    await expect(
      contract.connect(other).revokeData(DATA_HASH)
    ).to.be.reverted;
  });
});
