// SPDX-License-Identifier: MIT
// 练习 01：storage 变量、mapping、constructor
// 对照 notes.md 第 2、3、7、8 节
pragma solidity ^0.8.24;

contract StatePlayground {
    // TODO 1: 定义一个 uint256 state variable 叫 totalCount（初始值自动为 0）
    uint256 public totalCount;
    
    // TODO 2: 定义一个 address state variable 叫 owner，用 immutable 修饰
    address public immutable owner;

    // TODO 3: 定义一个 mapping(address => uint256) 叫 userCounts，记录每个地址的调用次数
    mapping(address => uint256) userCounts;

    // TODO 4: 写 constructor，把 owner 设为 msg.sender
    //   注意：constructor 只能用 constructor() {} 语法，不能加 function 关键字
    constructor(){
        owner=msg.sender;
    }
    // TODO 5: 写函数 increment()
    //   - public，不需要 returns
    //   - 把自己的 userCounts[msg.sender] + 1
    //   - 把 totalCount + 1
    function increment() public{
        userCounts[msg.sender]+=1;
        totalCount+=1;
    } 

    // TODO 6: 写函数 getMyCount() public view returns (uint256)
    //   - 返回调用者的 userCounts[msg.sender]
    function getMyCount() public view returns (uint256){
        return userCounts[msg.sender];
    }

    // TODO 7: 写函数 getTotalCount() public view returns (uint256)
    //   - 返回 totalCount
    function getTotalCount() public view returns (uint256){
        return totalCount;
    }

    // 思考：userCounts 和 totalCount 为什么不需要显式声明 storage？
    // 思考：如果函数内部写 uint256 temp = totalCount; temp 在 storage 还是 memory？
}
