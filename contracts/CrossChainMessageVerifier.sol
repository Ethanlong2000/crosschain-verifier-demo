// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;
contract CrossChainMessageVerifier{
address public immutable owner;
mapping(address=>bool) public authorizedSigners;
mapping(bytes32=>bool) public approvedRoots;
mapping(bytes32=>bool) public executedMessages;

error NotOwner(address caller);
error InvalidSigLength(uint256 length);
error InvalidSignature();
error RootNotApproved(bytes32 root);
error InvalidProof(bytes32 msgId);
error MessageExpired(uint256 deadline);
error AlreadyExecuted(bytes32 msgId);


constructor(){
    owner=msg.sender;
    }
modifier onlyOwner(){
    if(msg.sender!=owner)revert NotOwner(msg.sender);
    _;
}
event MessageExecuted(bytes32 indexed msgId,address indexed signer);

function recoverSigner(bytes32 hash,bytes memory signature)public pure returns (address signer){
    // ethers.js v6 flat signature: r(32) + s(32) + v(1) = 65 bytes
    if(signature.length != 65) revert InvalidSigLength(signature.length);
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly{
        r:=mload(add(signature,32))
        s:=mload(add(signature,64))
        v:=byte(0,mload(add(signature,96)))
    }
    if(v<27){
        v+=27;
    }
    return ecrecover(hash,v,r,s);
} 
function setAuthorizedSigner(address signer, bool authorized) public onlyOwner {
    authorizedSigners[signer] = authorized;
}
function approveRoot(bytes32 root) public onlyOwner {
    approvedRoots[root] = true;
}
function verifyProof(
    bytes32[] memory proof,   
    bytes32 root,             
    bytes32 leaf,             
    uint256 index             
 ) public pure returns (bool) {
    bytes32 computedHash = leaf;
  
    for (uint256 i = 0; i < proof.length; i++) {
        bytes32 proofElement = proof[i];

        if (index % 2 == 0) {
            computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
        } else {
            computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
        }
        index = index / 2; 
    }
  
    return computedHash == root;
}


function verifyAndExecute(
    bytes32[] memory proof,
    bytes32 root,
    address sender,
    address recipient,
    uint256 amount,
    uint256 nonce,
    uint256 deadline,
    uint256 sourceChainId,
    uint256 targetChainId,
    uint256 index,
    bytes memory signature
 )public {
    //重建哈希消息
    bytes32 msgId=keccak256(abi.encode(
        sender,recipient,amount,nonce,deadline,
        sourceChainId,targetChainId
        ));

    //恢复签名者
    address signer=recoverSigner(msgId,signature);
    if(signer==address(0)) revert InvalidSignature();

    //检查签名授权(消息发送者是否是签名者)
    if(!authorizedSigners[signer]) revert InvalidSignature();

    //验证merkle proof
    if(!approvedRoots[root]) revert RootNotApproved(root);
    if(!verifyProof(proof,root,msgId,index)) revert InvalidProof(msgId);

    //检查deadline
    if(block.timestamp > deadline) revert MessageExpired(deadline);

    //检查nonce
    if (executedMessages[msgId]) revert AlreadyExecuted(msgId);

    //通过检查
    executedMessages[msgId]=true;
    emit MessageExecuted(msgId,signer);
}


}