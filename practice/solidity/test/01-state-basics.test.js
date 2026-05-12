// 练习 01 测试：StatePlayground
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StatePlayground", function () {
  let contract, owner, other;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("StatePlayground");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it("部署后 totalCount 应为 0", async () => {
    expect(await contract.getTotalCount()).to.equal(0);
  });

  it("owner 应为部署者地址", async () => {
    expect(await contract.owner()).to.equal(owner.address);
  });

  it("初次调用 getMyCount 应返回 0（mapping 默认值）", async () => {
    expect(await contract.getMyCount()).to.equal(0);
  });

  it("increment 后自己的 count 和 totalCount 都应 +1", async () => {
    await contract.increment();
    expect(await contract.getMyCount()).to.equal(1);
    expect(await contract.getTotalCount()).to.equal(1);
  });

  it("不同用户各自计数互不影响", async () => {
    await contract.increment();                          // owner +1
    await contract.connect(other).increment();           // other +1
    await contract.connect(other).increment();           // other +1

    expect(await contract.getMyCount()).to.equal(1);     // owner 仍是 1
    expect(await contract.connect(other).getMyCount()).to.equal(2);  // other 是 2
    expect(await contract.getTotalCount()).to.equal(3);  // 总次数 3
  });
});
