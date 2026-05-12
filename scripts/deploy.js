// ============================================================
// scripts/deploy.js
// Sepolia 部署脚本
// ============================================================
//
// 用法：
//   npx hardhat run scripts/deploy.js --network sepolia
//
// 前置条件：
//   1. cp .env.example .env 并填入真实的 SEPOLIA_RPC_URL 和 PRIVATE_KEY
//   2. 钱包里有 Sepolia ETH（水龙头：alchemy.com/faucets/ethereum-sepolia）
//
// 输出：
//   - 合约地址（可粘贴到 etherscan.io 查看）
//   - 部署消耗的 gas

const hre = require("hardhat");

async function main() {
  console.log("Deploying CrossChainMessageVerifier to", hre.network.name, "...\n");

  // ============================================================
  // 模块 1：获取部署账户
  // ============================================================

  // TODO 1.1: 用 hre.ethers.getSigners() 获取 signers 数组
  // TODO 1.2: 取 signers[0] 作为 deployer
  // TODO 1.3: 打印 deployer.address 和余额
  //           余额用 hre.ethers.provider.getBalance(address) 获取
  //           用 hre.ethers.formatEther(balance) 转成 ETH 显示
  const signers=await hre.ethers.getSigners();
  const deployer=signers[0];
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("地址为：",deployer.address);
  console.log("余额为：",hre.ethers.formatEther(balance)) ;
  // ============================================================
  // 模块 2：部署合约
  // ============================================================

  // TODO 2.1: 用 hre.ethers.getContractFactory("CrossChainMessageVerifier") 获取 Factory
  // TODO 2.2: 用 Factory.deploy() 部署
  // TODO 2.3: 用 contract.waitForDeployment() 等待部署完成
  const Factory=await hre.ethers.getContractFactory("CrossChainMessageVerifier");
  const contract=await Factory.deploy();
  await contract.waitForDeployment();

  // ============================================================
  // 模块 3：打印部署结果
  // ============================================================

  // TODO 3.1: 用 contract.getAddress() 获取合约地址并打印
  // TODO 3.2: 获取部署交易和 gas
  //           const tx = contract.deploymentTransaction();  // 拿部署 tx 对象
  //           console.log("tx hash:", tx.hash);
  //           const receipt = await tx.wait();              // 等上链，receipt.gasUsed 就是消耗的 gas
  //           console.log("gas used:", receipt.gasUsed.toString());
  // TODO 3.3: 打印 Etherscan 链接
  //           https://sepolia.etherscan.io/address/<合约地址>
  const contractAddress=await contract.getAddress();
  console.log("合约地址：",contractAddress);

  const tx=contract.deploymentTransaction();
  console.log("tx hash:",tx.hash);
  const receipt =await tx.wait();
  console.log("gas used:",receipt.gasUsed.toString());

  console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);

  // ============================================================
  // 模块 4（可选）：部署后立即设一个授权签名者
  // ============================================================

  // TODO 4.1: 用 ethers.Wallet.createRandom() 生成一个随机签名者
  // TODO 4.2: 调 contract.setAuthorizedSigner(wallet.address, true)
  // TODO 4.3: 打印 "authorized signer set: <地址>"
  const signer=hre.ethers.Wallet.createRandom();
  await contract.setAuthorizedSigner(signer.address,true);
  console.log("authorized signer set: ",signer.address);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
