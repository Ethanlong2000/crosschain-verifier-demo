// SPDX-License-Identifier: MIT
// 练习 02：struct、event、emit
// 对照 notes.md 第 4、5、8 节
pragma solidity ^0.8.24;

contract MessageStruct {
    // TODO 1: 定义一个 struct 叫 Message，包含三个字段：
    //   - sender (address)
    //   - contentHash (bytes32)
    //   - timestamp (uint256)

    struct Message {
        address sender;
        bytes32 contentHash;
        uint256 timestamp;
    }

    // TODO 2: 定义一个 event 叫 MessageStored：
    //   - uint256 indexed msgId
    //   - address indexed sender
    //   - bytes32 contentHash
    //   （timestamp 不需要放到 event 里，因为不在链上索引）

    event MessageStored(
        uint256 indexed msgId,
        address indexed sender,
        bytes32 contentHash
    );

    // TODO 3: 定义一个 state variable：
    //   - uint256 public messageCount（计数器，初始 0）
    //   - mapping(uint256 => Message) public messages（存储所有消息）

    uint256 public messageCount;
    mapping(uint256=>Message) public messages;

    // TODO 4: 写函数 storeMessage(bytes32 contentHash)
    //   - public
    //   - 创建 Message memory 变量（用 msg.sender, contentHash, block.timestamp）
    //   - 把 Message 存到 messages[messageCount]
    //   - emit MessageStored(messageCount, msg.sender, contentHash)
    //   - messageCount + 1
    //   注意：两个创建 struct 的方式——
    //     Message(sender, hash, timestamp)  按字段顺序
    //     Message({sender: s, contentHash: h, timestamp: t})  按字段名

    function storeMessage(bytes32 contentHash) public {
        Message memory msg1 =Message(msg.sender,contentHash,block.timestamp);
        messages[messageCount]=msg1;
        emit MessageStored(messageCount,msg.sender,contentHash);
        messageCount+=1;
    }

    // TODO 5: 写函数 getMessage(uint256 id) public view returns (Message memory)
    //   - 返回 messages[id]
    //   思考：这里返回 Message memory 还是 Message storage？为什么？
    //   提示：view 函数不能返回 storage 引用给外部调用者

    function getMessage(uint256 id) public view returns (Message memory){
        return messages[id];
    }


    // 思考：如果 storeMessage 里面写 Message storage m = messages[messageCount];
    //   m.contentHash = xxx; 这样修改的是 storage 的原始值还是拷贝？
}
