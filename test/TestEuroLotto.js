const EuroLotto = artifacts.require("./EuroLotto");
const { assert } = require("chai");
const web3 = require("web3");
const toBN = web3.utils.toBN;
const toWei = web3.utils.toWei;

// It seems that you cannot get return values of a method that modifies the blockchain.
// the only way to do it is to have the method emit an event..
// Truffle How to Test a None View Function That Returns:
// https://blog.8bitzen.com/posts/11-03-2019-truffle-how-to-test-a-none-view-function-that-returns/

require("chai").use(require("chai-as-promised")).should();
let euroLottoGlobal;
const PHASE_NOT_STARTED= 0;
const PHASE_JOIN = 1;
const PHASE_REVEAL = 2;

contract("EuroLotto", ([deployer, user1, user2, user3]) => {
  beforeEach(async () => {
    euroLottoGlobal = await EuroLotto.new();
  });

  describe("testing joinSession", () => {
    describe("success", () => {
      it("join not yet started session starts a new session with the single corresponding joining participant", async () => {
        const result = await euroLottoGlobal.joinLotto(
          "commitment",
          {
            from: user1,
            value: toWei("1"),
          }
        );
        var participant = await euroLottoGlobal.sessionIdToParticipants(1,0);
        var session = await euroLottoGlobal.idToSession(1);
        assert.isTrue(session["phase"] == PHASE_JOIN)
        assert.isTrue(session["participantsLength"] == 1)
        assert.isTrue(participant["user"] == user1);
        assert.isTrue(participant["commitment"] == "commitment");
        assert.isTrue(participant["hasRevealed"] == false);
        assert.isTrue(participant["message"] == "");
      });
      
      it("join with lacking ether reverts", async () => {
        const result = await euroLottoGlobal.joinLotto("commitment",
          {
            from: user1,
            value: toWei("2"),
          }
        )
        .should.be.rejectedWith(
                      "You must deposit exactly 1 ether"
                    );;
      });
    });
  });
});

// let deathRollBasicsGlobal;
// const GAMESTATE_OPEN = 0;

// contract("DeathRollBasics", ([deployer, user, user2, user3]) => {
//   beforeEach(async () => {
//     deathRollBasicsGlobal = await DeathRollBasics.new();
//   });

//   describe("testing createGameSession", () => {
//     describe("success", () => {
//       it("given arguments creates emits game created event with id 0 and creater as the player", async () => {
//         const { logs } = await createGameSession(4, 1, user, 1);

//         const eventReturnValues = logs[0].args;
//         assert.equal(eventReturnValues.id, 0);
//         assert.equal(eventReturnValues.creator, user);
//         assert.equal(await deathRollBasicsGlobal.betOfParticipantInGameSession(user, 0), toWei("1", "ether"));
//       });

//       it("given arguments creates updates the mapping", async () => {
//         await createGameSession(4, 1, user, 1);
//         assert.equal(await deathRollBasicsGlobal.betOfParticipantInGameSession(user, 0), toWei("1", "ether"));
//       });

//       it("given min bet amount of 1 ether should create game session with min bet amount of 1 ether", async () => {
//         await createGameSession(4, 1, user, 1);
//         const game = await deathRollBasicsGlobal.gameSessions(0);
//         assert.equal(game.minBetAmount, toWei("1", "ether"));
//       });

//       it("given participant size of 4 should create game session of participant size 4 with the 1. participant being the creator", async () => {
//         /*
//           This test had to use the getOpenGames function, as a call to a public field for
//           some reason does not return its nested structs, such as the array of participants
//         */
//         await createGameSession(4, 1, user, 1);
//         const game = await deathRollBasicsGlobal.getOpenGames({ from: user });
//         assert.equal(game[0].participants.length, 4);
//         assert.equal(game[0].participants[0], user);
//       });
//     });

//     describe("failure", () => {
//       it("eth sent on creation less than minimum eth to participate", async () => {
//         await createGameSession(4, 2, user, 1).should.be.rejectedWith(
//           "Your best must not be less than the minimum bet."
//         );
//       });

//       it("max participants less than required size", async () => {
//         await createGameSession(1, 1, user, 2).should.be.rejectedWith(
//           "The maximum number of participants must be greater than 1."
//         );
//       });

//       it("min bet must be greater than 0", async () => {
//         await createGameSession(1, 0, user, 1).should.be.rejectedWith(
//           "The minnimum bet must be greater than 0."
//         );
//       });
//     });
//   });

//   describe("testing getOpenGames", () => {
//     describe("success", () => {
//       it("exists two open games returns two open games", async () => {
//         await createMultipleGameSessions(2, user);
//         const games = await deathRollBasicsGlobal.getOpenGames({ from: user });
//         assert.equal(games.length, 2);
//         assert.equal(games[0].gameState, GAMESTATE_OPEN);
//         assert.equal(games[1].gameState, GAMESTATE_OPEN);
//       });
//     });

//     describe("failure", () => {
//       it("TODO exists two non open games returns no games", async () => {
//         //TODO
//         assert.isTrue(false);
//       });
//     });
//   });

//   describe("testing joinGameSession", () => {
//     describe("success", () => {
//       it("join a new open game with valid bet and available slot joins adds player to participant list", async () => {
//         await createGameSession(2, 1, user, 1);
//         const result = await deathRollBasicsGlobal.joinGameSession(0, {
//           from: user2,
//           value: toWei("1"),
//         });
//         const games = await deathRollBasicsGlobal.getOpenGames({ from: user2 });
//         assert.isTrue(result.receipt.status);
//         assert.equal(games[0].participants[1], user2);
//       });

//       it("join a new open game updates player bet in mapping", async () => {
//         await createGameSession(2, 1, user, 1);
//         const result = await deathRollBasicsGlobal.joinGameSession(0, {
//           from: user2,
//           value: toWei("1"),
//         });
//         await deathRollBasicsGlobal.getOpenGames({ from: user2 });
//         assert.isTrue(result.receipt.status);
//         assert.equal(await deathRollBasicsGlobal.betOfParticipantInGameSession(user2, 0), toWei("1", "ether"));
//       });
//     });

//     describe("failure", () => {
//       it("join a new open game with invalid bet should revert", async () => {
//         await createGameSession(2, 1, user, 1);
//         await deathRollBasicsGlobal
//           .joinGameSession(0, { from: user2, value: toWei("0") })
//           .should.be.rejectedWith("Bet is less than the entry fee.");
//       });
//       it("join a non existing game session id should reject", async () => {
//         await deathRollBasicsGlobal
//           .joinGameSession(0, { from: user2, value: toWei("1") })
//           .should.be.rejectedWith("Invalid gamesession id.");
//       });
//       it("joining a game session which the user is already participating in should reject", async () => {
//         await createGameSession(2, 1, user, 1);
//         await deathRollBasicsGlobal
//           .joinGameSession(0, { from: user, value: toWei("1") })
//           .should.be.rejectedWith("Already in this game session.");
//       });
//       it("TODO join a game session that is not open should reject", async () => {
//         // TODO
//         assert.isTrue(false);
//       });
//     });
//   });
// });

// const createMultipleGameSessions = async (amount, from) => {
//   for (let i = 0; i < amount; i++) {
//     await createValidGameSession(from);
//   }
// };

// const createValidGameSession = async (from) => {
//   return await createGameSession(4, 1, from, 1);
// };

// const createGameSession = async (minParticipants, minEther, from, value) => {
//   return await deathRollBasicsGlobal.createGameSession(
//     minParticipants,
//     toWei(minEther.toString(), "ether"),
//     { from: from, value: toWei(value.toString(), "ether") }
//   );
// };
