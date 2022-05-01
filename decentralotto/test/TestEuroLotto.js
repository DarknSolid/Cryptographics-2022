const EuroLotto = artifacts.require("./EuroLotto");
const { assert } = require("chai");
const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider);
const toBN = web3.utils.toBN;
const toWei = web3.utils.toWei;
const fromWei = web3.utils.fromWei;
const keccak256 = web3.utils.keccak256;
const helper = require("./helpers/truffleHelpers");

// It seems that you cannot get return values of a method that modifies the blockchain.
// the only way to do it is to have the method emit an event..
// Truffle How to Test a None View Function That Returns:
// https://blog.8bitzen.com/posts/11-03-2019-truffle-how-to-test-a-none-view-function-that-returns/

require("chai").use(require("chai-as-promised")).should();
let euroLottoGlobal;
const PHASE_NOT_STARTED = 0;
const PHASE_JOIN = 1;
const PHASE_REVEAL = 2;
const PHASE_FINISHED = 3;
const testHash = keccak256("commitment");

contract("EuroLotto", ([deployer, user1, user2, user3, user4]) => {
  beforeEach(async () => {
    euroLottoGlobal = await EuroLotto.new();
  });

  describe("testing joinSession", () => {
    describe("success", () => {
      it.only("join not yet started session starts a new session with the single corresponding joining participant", async () => {
        let isParticipantBefore = await euroLottoGlobal.isParticipating(1, user1);
        const result = await euroLottoGlobal.joinLotto(testHash, {
          from: user1,
          value: toWei("1"),
        });
        var participant = await euroLottoGlobal.sessionIdToParticipants(1, 0);
        var session = await euroLottoGlobal.idToSession(1);
        var participantId = await euroLottoGlobal.indexOfParticipant(1, user1);
        let isParticipantAfter = await euroLottoGlobal.isParticipating(1, user1);
        assert.isTrue(participantId == 0);
        assert.isTrue(session["phase"] == PHASE_JOIN);
        assert.isTrue(session["participantsLength"] == 1);
        assert.isTrue(participant["user"] == user1);
        assert.isTrue(participant["commitment"] == testHash);
        assert.isTrue(participant["hasRevealed"] == false);
        assert.equal(participant["message"].toString(), toBN(0).toString());
        assert.isTrue(isParticipantAfter);
        assert.isFalse(isParticipantBefore);

      });
      it("join with lacking ether reverts", async () => {
        const result = await euroLottoGlobal
          .joinLotto(testHash, {
            from: user1,
            value: toWei("2"),
          })
          .should.be.rejectedWith("You must deposit exactly 1 ether");
      });
      it("second person join gets correct index and session's participant length is 2", async () => {
        var result = await euroLottoGlobal.joinLotto(testHash, {
          from: user1,
          value: toWei("1"),
        });
        result = await euroLottoGlobal.joinLotto(testHash, {
          from: user2,
          value: toWei("1"),
        });
        // Assert participant indexes:
        var participant1 = await euroLottoGlobal.sessionIdToParticipants(1, 0);
        var participant1Id = await euroLottoGlobal.indexOfParticipant(1, user1);
        assert.isTrue(participant1Id == 0);
        assert.isTrue(participant1["user"] == user1);
        var participant2 = await euroLottoGlobal.sessionIdToParticipants(1, 1);
        var participant2Id = await euroLottoGlobal.indexOfParticipant(1, user2);
        assert.isTrue(participant2Id == 1);
        assert.isTrue(participant2["user"] == user2);
        // Assert session participant count and phase:
        var session = await euroLottoGlobal.idToSession(1);
        assert.equal(session.participantsLength, 2);
        assert.equal(session.phase, PHASE_JOIN);
      });
      it("a person can only join once", async () => {
        var result = await euroLottoGlobal.joinLotto(testHash, {
          from: user1,
          value: toWei("1"),
        });
        result = await euroLottoGlobal
          .joinLotto(testHash, {
            from: user1,
            value: toWei("1"),
          })
          .should.be.rejectedWith(
            "You are already participating in this session"
          );
      });
      it("joining an open phase after deadline automatically starts the reveal phase", async () => {
        await euroLottoGlobal.joinLotto(testHash, {
          from: user1,
          value: toWei("1"),
        });

        const seconds = 60*11; // 11 minutes
        await helper.advanceTimeAndBlock(seconds);

        const {logs} = await euroLottoGlobal.joinLotto(testHash, {
          from: user2,
          value: toWei("1"),
        });
        const newBlockTimeStamp = (await web3.eth.getBlock('latest')).timestamp;
        const eventReturnValues = logs[0].args;
        assert.equal(eventReturnValues.sessionId, 1);
        //assert phase state changed
        var session = await euroLottoGlobal.idToSession(1);
        assert.equal(session.phase, PHASE_REVEAL);
        assert.equal(session.startTime.toString(), toBN(newBlockTimeStamp).toString())
      })
    });
  });

  describe("testing openCommitment before reveal phase", () => {
    it("is not reveal phase should revert", async () => {
      await euroLottoGlobal.joinLotto(keccak256("commitment"), {
        from: user1,
        value: toWei("1"),
      });

      await euroLottoGlobal.openCommitment("random", 1, {from: user1})
        .should.be.rejectedWith("The session is not in reveal phase.");

    });
  });

  describe("testing openCommitment", () => {
    const user1Msg = 1;
    const user2Msg = 2;
    const user3Msg = 3;
    beforeEach(async () => {
      // add 3 participants and make the session enter reveal phase:
      await euroLottoGlobal.joinLotto(keccak256("commitment" + user1Msg), {
        from: user1,
        value: toWei("1"),
      });
      await euroLottoGlobal.joinLotto(keccak256("commitment" + user2Msg), {
        from: user2,
        value: toWei("1"),
      });
      const seconds = 60*11; // 11 minutes
      await helper.advanceTimeAndBlock(seconds);

      await euroLottoGlobal.joinLotto(keccak256("commitment" + user3Msg), {
        from: user3,
        value: toWei("1"),
      });
    });
    describe("success", () => {
      it("Valid opening should update session and participant", async () => {
        await euroLottoGlobal.openCommitment("commitment", 1, {from: user1})
        
        const session = await euroLottoGlobal.idToSession(1);
        const participant = await getParticipant(1, user1);
        assert.equal(session.amountOfReveals.toString(), toBN(1).toString());
        assert.equal(session.phase, PHASE_REVEAL);
        assert.equal(participant.message.toString(), toBN(1).toString());
        assert.isTrue(participant.hasRevealed);
      });
      it("Valid opening after second participant should update session and participant", async () => {
        await euroLottoGlobal.openCommitment("commitment", 1, {from: user1})
        await euroLottoGlobal.openCommitment("commitment", 2, {from: user2})
        
        const session = await euroLottoGlobal.idToSession(1);
        const participant = await getParticipant(1, user2);
        assert.equal(session.amountOfReveals.toString(), toBN(2).toString());
        assert.equal(session.phase, PHASE_REVEAL);
        assert.equal(participant.message.toString(), toBN(2).toString());
        assert.isTrue(participant.hasRevealed);
      });
      it("Valid opening after time exceeded should reset the session", async () => {
        await helper.advanceTimeAndBlock(11*60); //fast foward 11 minutes
        await euroLottoGlobal.openCommitment("commitment", user1Msg, {from: user1})
        
        const session = await euroLottoGlobal.idToSession(1);
        const participant = await getParticipant(1, user1);
        const curSessionId = await euroLottoGlobal.currentSessionId();
        assert.equal(session.amountOfReveals.toString(), toBN(1).toString());
        assert.equal(session.phase, PHASE_FINISHED);
        assert.equal(participant.message.toString(), toBN(1).toString());
        assert.isTrue(participant.hasRevealed);
        assert.equal(curSessionId.toString(), toBN(2).toString())
      });
      it("Valid opening after all reveals should reset the session", async () => {
        await euroLottoGlobal.openCommitment("commitment", user1Msg, {from: user1})
        await euroLottoGlobal.openCommitment("commitment", user2Msg, {from: user2})
        await euroLottoGlobal.openCommitment("commitment", user3Msg, {from: user3})
        
        const session = await euroLottoGlobal.idToSession(1);
        assert.equal(session.amountOfReveals.toString(), toBN(3).toString());
        assert.equal(session.phase, PHASE_FINISHED);
      });
      it("Valid opening with full reveals should pay user1 3 eth and emit event", async () => {
        await euroLottoGlobal.openCommitment("commitment", user1Msg, {from: user1});
        await euroLottoGlobal.openCommitment("commitment", user2Msg, {from: user2});

        const user1BalanceBefore = await web3.eth.getBalance(user1);
        const {logs} = await euroLottoGlobal.openCommitment("commitment", user3Msg, {from: user3});
        const user1BalanceAfter = await web3.eth.getBalance(user1);

        const eventReturnValues = logs[0].args;

        assert.equal(eventReturnValues.sessionId.toString(), toBN(1).toString());
        assert.equal(eventReturnValues.winner, user1);
        assert.equal(eventReturnValues.reward.toString(), toBN(toWei("3", "ether")).toString());
        assert.equal(toBN(user1BalanceBefore).add(toBN(toWei("3", "ether"))).toString(), toBN(user1BalanceAfter).toString());
      });
      it("Valid opening after time exceeded with 1 participant missing should pay user2 3 eth and emit event", async () => {
        await euroLottoGlobal.openCommitment("commitment", user1Msg, {from: user1});
        await helper.advanceTimeAndBlock(11*60);
        const user2BalanceBefore = await web3.eth.getBalance(user2);
        const {logs} = await euroLottoGlobal.openCommitment("commitment", user2Msg, {from: user2});
        const user2BalanceAfter = await web3.eth.getBalance(user2);

        const eventReturnValues = logs[0].args;

        const expectedBalance = fromWei(toBN(user2BalanceBefore).add(toBN(toWei("3", "ether"))).toString(), "ether");

        assert.equal(eventReturnValues.sessionId.toString(), toBN(1).toString());
        assert.equal(eventReturnValues.winner, user2);
        assert.equal(eventReturnValues.reward.toString(), toBN(toWei("3", "ether")).toString());
        assert.equal(expectedBalance.toString().slice(0,4), fromWei(toBN(user2BalanceAfter).toString(), "ether").toString().slice(0,4)); //slice to remove decimals with gass fee affections
      });
    });
    describe("failure", () => {
      it("opening with invalid hash should revert and participant should be untouhed", async () => {
        await euroLottoGlobal.openCommitment("random", 1, {from: user1})
          .should.be.rejectedWith("Your opening is not valid.");
        
        const session = await euroLottoGlobal.idToSession(1);
        const participant = await getParticipant(1, user1);
        assert.equal(session.amountOfReveals.toString(), toBN(0).toString());
        assert.equal(participant.message.toString(), toBN(0).toString());
        assert.isFalse(participant.hasRevealed);
      });
      it("user who already revealed should revert", async() => {
        await euroLottoGlobal.openCommitment("commitment", 1, {from: user1});
        await euroLottoGlobal.openCommitment("commitment", 1, {from: user1})
          .should.be.rejectedWith("You have already opened your commitment");
      });
      it("user who has not participated should revert", async() => {
        await euroLottoGlobal.openCommitment("commitment", 1, {from: user4})
          .should.be.rejectedWith("You are not participating in this session");
      });
    });
  });
});

describe("Testing Helper Functions", () => {
  it("should advance the blockchain forward a block", async () =>{
      const originalBlockHash = (await web3.eth.getBlock('latest')).hash;
      let newBlockHash = (await web3.eth.getBlock('latest')).hash;
      newBlockHash = (await helper.advanceBlock()).hash;

      assert.notEqual(originalBlockHash, newBlockHash);
  });

  it("should be able to advance time and block together", async () => {
      const advancement = 600;
      const originalBlock = await web3.eth.getBlock('latest');
      const newBlock = await helper.advanceTimeAndBlock(advancement);

      const timeDiff = newBlock.timestamp - originalBlock.timestamp;

      assert.isTrue(timeDiff >= advancement);
  });
});

async function getParticipant(sessionId, user) {
  const index = await euroLottoGlobal.indexOfParticipant(sessionId, user);
  return await euroLottoGlobal.sessionIdToParticipants(sessionId, index);
}
