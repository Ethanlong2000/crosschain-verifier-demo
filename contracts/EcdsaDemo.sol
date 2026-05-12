// SPDX-License-Identifier: MIT
// 上面这行是版权声明，Solidity 编译器要求必须写，不写会警告

pragma solidity ^0.8.24;
// 指定编译器版本，和 hardhat.config.js 里的 solidity: "0.8.24" 保持一致

contract EcdsaDemo {
    // contract 关键字定义合约，类似 JS 的 class EcdsaDemo {}

    function recoverSigner(
        bytes32 hash,  // 消息的哈希值（32 字节）
        bytes32 r,     // 签名的 r 分量（32 字节）
        bytes32 s,     // 签名的 s 分量（32 字节）
        uint8 v        // 签名的 v 分量（1 字节，0-255）
    )
        public         // 任何人都能调用
        pure           // 不读链上存储、也不写链上存储——纯计算
        returns (address)  // 返回签名者地址。注意是 returns 有 s
    {
        // ecrecover 是以太坊内置的预编译函数，从签名恢复公钥再算出地址
        // 参数顺序：ecrecover(hash, v, r, s) —— 注意 v 在第二个位置！
        address signer = ecrecover(hash, v, r, s);

        // 如果签名无效（r,s,v 对不上 hash），ecrecover 返回 0x0 地址
        // 这里做一个安全检查
        require(signer != address(0), "EcdsaDemo: invalid signature");

        return signer;
    }
}
