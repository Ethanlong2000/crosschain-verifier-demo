// SPDX-License-Identifier: MIT
// 练习 04：modifier、require、revert、自定义 error
// 对照 notes.md 第 6、8、9 节
pragma solidity ^0.8.24;

contract AccessControl {
    // TODO 1: 定义 state variables
    //   - address public immutable owner
    //   - mapping(bytes32 => bool) public approvedData

    address public immutable owner;
    mapping(bytes32=>bool)public approvedData;

    // TODO 2: 定义自定义 error
    //   - error NotOwner(address caller);
    //   - error AlreadyApproved(bytes32 dataHash);
    //   提示：Solidity 0.8.4+ 支持自定义 error，比 require("string") 更省 gas

    error NotOwner(address caller);
    error AlreadyApproved(bytes32 dataHash);

    // TODO 3: 写 constructor
    //   - owner = msg.sender
    
     constructor(){
        owner=msg.sender;
     }

    // TODO 4: 写 modifier onlyOwner
    //   - 如果 msg.sender != owner，revert NotOwner(msg.sender)
    //   - 否则继续执行（_;）
    //   提示：modifier 内部用 if (!cond) revert Error(); 比 require 更现代

    modifier onlyOwner(){
        if(msg.sender!=owner)revert NotOwner(msg.sender);
        _;
    }

    // TODO 5: 写 modifier notApproved(bytes32 dataHash)
    //   - 如果 approvedData[dataHash] 已经是 true，revert AlreadyApproved(dataHash)
    //   - 否则继续执行

    modifier notApproved(bytes32 dataHash){
        if(approvedData[dataHash]==true) revert AlreadyApproved(dataHash);
        _;
    }

    // TODO 6: 写函数 approveData(bytes32 dataHash)
    //   - public
    //   - 使用 onlyOwner 和 notApproved(dataHash) 两个 modifier
    //   - 把 approvedData[dataHash] 设为 true
    //   提示：多个 modifier 按从左到右顺序执行

    function approveData(bytes32 dataHash) public onlyOwner notApproved(dataHash){
        approvedData[dataHash]=true;
    }

    // TODO 7: 写函数 revokeData(bytes32 dataHash)
    //   - public
    //   - 使用 onlyOwner modifier
    //   - 把 approvedData[dataHash] 设为 false（或 delete approvedData[dataHash]）
    //   提示：delete 和设为 false 对 bool 类型等价，但 delete 通用性更好

    function revokeData(bytes32 dataHash) public onlyOwner{

        delete approvedData[dataHash];

    }

    // 思考：modifier 里用 require 和用 revert 有什么区别？
    //   提示：gas 消耗不同，revert 还能传自定义 error 方便调试
}
