// SPDX-License-Identifier: MIT
// 练习 03：abi.encode vs abi.encodePacked，链上链下哈希对比
// 对照 notes.md 第 10、11 节
pragma solidity ^0.8.24;

contract HashCompare {
    // TODO 1: 写函数 encodeAndHash(uint256 a, address b, bytes32 c)
    //   - public pure returns (bytes32)
    //   - 用 keccak256(abi.encode(a, b, c)) 返回哈希
    //   提示：每个参数都会补零到 32 字节再拼接
    function encodeAndHash(uint256 a,address b,bytes32 c) public pure returns (bytes32){
        return keccak256(abi.encode(a,b,c));
    }

    // TODO 2: 写函数 packedHash(uint256 a, address b)
    //   - public pure returns (bytes32)
    //   - 用 keccak256(abi.encodePacked(a, b)) 返回哈希
    //   提示：a 和 b 都是定长类型（32 字节 + 20 字节），不存在动态类型碰撞风险
    function packedHash(uint256 a,address b) public pure returns (bytes32){
        return keccak256(abi.encodePacked(a,b));
    }

    // TODO 3: 写函数 verifyHash(
    //     uint256 a, address b, bytes32 c, bytes32 submittedHash
    // ) public pure returns (bool)
    //   - 内部用 keccak256(abi.encode(a, b, c)) 算一遍
    //   - 和 submittedHash 比较，返回 true/false
    function verifyHash(uint256 a,address b,bytes32 c,bytes32 submittedHash)public pure returns (bool){
        bytes32 internal_value=encodeAndHash(a,b,c);
        return internal_value==submittedHash;
    }

    // 思考：为什么消息哈希用 abi.encode 而不是 abi.encodePacked？
    // 思考：Merkle tree 里用 abi.encodePacked 拼接两个 bytes32，这里会不会碰撞？
    //   提示：两个固定 32 字节的值拼接，总长 64 字节，不存在变长边界歧义
}
