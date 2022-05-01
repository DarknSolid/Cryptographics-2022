const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider);

advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();

    return Promise.resolve(web3.eth.getBlock('latest'));
}

advanceTime = (time) => {
    // time is in seconds
    return new Promise((resolve, reject) => {
        Web3.givenProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
}

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        Web3.givenProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlock = web3.eth.getBlock('latest');
            
            return resolve(newBlock)
        });
    });
}

module.exports = {
    advanceTime,
    advanceBlock,
    advanceTimeAndBlock
}