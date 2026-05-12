// 练习 02 测试：MessageStruct
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MessageStruct", function () {
  let contract;

  beforeEach(async () => {
    const Factory = await ethers.getContractFactory("MessageStruct");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it("初始 messageCount 应为 0", async () => {
    expect(await contract.messageCount()).to.equal(0);
  });

  it("storeMessage 后 messageCount +1", async () => {
    const hash = ethers.ZeroHash;
    await contract.storeMessage(hash);
    expect(await contract.messageCount()).to.equal(1);
  });

  it("存入后可通过 getMessage 读取消息内容", async () => {
    const [sender] = await ethers.getSigners();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-message"));

    const tx = await contract.storeMessage(hash);
    const receipt = await tx.wait();

    const msg = await contract.getMessage(0);

    expect(msg.sender).to.equal(sender.address);
    expect(msg.contentHash).to.equal(hash);
    expect(msg.timestamp).to.be.gt(0); // block.timestamp > 0
  });

  it("emit MessageStored 事件", async () => {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("event-test"));
    await expect(contract.storeMessage(hash))
      .to.emit(contract, "MessageStored")
      .withArgs(0, (await ethers.getSigners())[0].address, hash);
  });

  it("多条消息分别存储，互不覆盖", async () => {
    const h1 = ethers.keccak256(ethers.toUtf8Bytes("msg1"));
    const h2 = ethers.keccak256(ethers.toUtf8Bytes("msg2"));

    await contract.storeMessage(h1);
    await contract.storeMessage(h2);

    expect((await contract.getMessage(0)).contentHash).to.equal(h1);
    expect((await contract.getMessage(1)).contentHash).to.equal(h2);
  });
});
