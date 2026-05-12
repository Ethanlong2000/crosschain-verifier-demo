// 练习 03 测试：HashCompare —— 链上链下哈希一致性
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HashCompare", function () {
  let contract;

  beforeEach(async () => {
    const Factory = await ethers.getContractFactory("HashCompare");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it("abi.encode 哈希：合约与 JS 侧结果一致", async () => {
    const a = 42;
    const b = ethers.Wallet.createRandom().address;
    const c = ethers.keccak256(ethers.toUtf8Bytes("payload"));

    // JS 侧：模拟 solidity 的 keccak256(abi.encode(a, b, c))
    const jsEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "bytes32"],
      [a, b, c]
    );
    const jsHash = ethers.keccak256(ethers.getBytes(jsEncoded));

    // 合约侧
    const contractHash = await contract.encodeAndHash(a, b, c);

    expect(contractHash).to.equal(jsHash);
  });

  it("abi.encodePacked 哈希：合约与 JS 侧结果一致", async () => {
    const a = 99;
    const b = ethers.Wallet.createRandom().address;

    // JS 侧：模拟 solidity 的 keccak256(abi.encodePacked(a, b))
    const jsPacked = ethers.solidityPackedKeccak256(
      ["uint256", "address"],
      [a, b]
    );

    // 合约侧
    const contractPacked = await contract.packedHash(a, b);

    expect(contractPacked).to.equal(jsPacked);
  });

  it("verifyHash：提交正确 hash 返回 true", async () => {
    const a = 7;
    const b = ethers.Wallet.createRandom().address;
    const c = ethers.ZeroHash;

    const jsEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "bytes32"],
      [a, b, c]
    );
    const correctHash = ethers.keccak256(ethers.getBytes(jsEncoded));

    expect(await contract.verifyHash(a, b, c, correctHash)).to.equal(true);
  });

  it("verifyHash：提交错误 hash 返回 false", async () => {
    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
    expect(
      await contract.verifyHash(42, ethers.ZeroAddress, ethers.ZeroHash, wrongHash)
    ).to.equal(false);
  });
});
