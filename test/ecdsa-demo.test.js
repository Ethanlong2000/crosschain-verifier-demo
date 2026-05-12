const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EcdsaDemo", function () {
  it("should recover the correct signer", async function () {
    // ---- 第 1 步：生成钱包（你 04 练习写过） ----
    // TODO: 用 ethers.Wallet.createRandom() 创建一个随机钱包
    const wallet= ethers.Wallet.createRandom();
    // ---- 第 2 步：对消息哈希（你 04 练习写过） ----
    // TODO: 用 ethers.hashMessage("hello crosschain") 对消息做哈希
    const hashmsg=ethers.hashMessage("hello crosschain");
    // ---- 第 3 步：签名消息（你 04 练习写过） ----
    // TODO: 用 wallet.signMessage("hello crosschain") 签名
    // ⚠️ 提示：signMessage 返回 Promise，但这里 it 的回调已经是 async，可以直接 await
    const sig=await wallet.signMessage("hello crosschain");
    // ---- 第 4 步：拆分签名（你 04 练习写过） ----
    // TODO: 用 ethers.Signature.from(sig) 取出 { r, s, v }
    const {r,s,v}=ethers.Signature.from(sig);
    // ---- 第 5 步：部署合约（新知识） ----
    // TODO: 参考下面两行，理解就行，不用改
      const factory = await ethers.getContractFactory("EcdsaDemo");
      const contract = await factory.deploy();
      await contract.waitForDeployment();  // 等部署完成

    // ---- 第 6 步：调用合约验证签名 ----
    // TODO: 调用 contract.recoverSigner(hash, r, s, v)
    //   拿到返回的地址，和 wallet.address 对比
    const re_address=await contract.recoverSigner(hashmsg,r,s,v);
    // ---- 第 7 步：断言 ----
    // TODO: expect(恢复的地址).to.equal(wallet.address);
    expect(re_address).to.equal(wallet.address);
  });
});
