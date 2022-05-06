// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/utils/Strings.sol";

contract EuroLotto {

    uint256 public currentSessionId;

    mapping (uint256 => Session) public idToSession;
    mapping (uint256 => mapping(address => uint256)) public indexOfParticipant; // session id -> msg.sender -> index

    event RevealPhaseStarted(uint256 indexed sessionId);
    event SessionEnded(uint256 indexed sessionId, address indexed winner, uint256 reward);

    mapping (uint256 => mapping(uint256 => Participant)) public sessionIdToParticipants; //session id to participant index to participant

    modifier IsNotExistingParticipant(address adr) {
        uint256 id = indexOfParticipant[currentSessionId][adr];
        require(sessionIdToParticipants[currentSessionId][id].user != adr, "You are already participating in this session");
        _;
    }

    modifier IsExistingParticipant(address adr) {
        uint256 id = indexOfParticipant[currentSessionId][adr];
        require(sessionIdToParticipants[currentSessionId][id].user == adr, "You are not participating in this session");
        _;
    }

    struct Session {
        uint256 participantsLength; //the amount of participants in the "sessionIdToParticipants"
        Phase phase;
        uint256 startTime;
        uint256 amountOfReveals;
    }

    struct Participant {
        address payable user;
        bytes32 commitment;
        uint256 message;
        bool hasRevealed;
    }

    uint256 depositAmount = 1 ether;
    enum Phase{notStarted, join, reveal, finished}
    uint256 joinPhaseMaxDurationSeconds = 60 * 10;  //ten minutes
    
    function joinLotto(bytes32 commitment) external payable IsNotExistingParticipant(msg.sender) returns(uint256 id) {
        Session memory curSession = idToSession[currentSessionId];
        require(curSession.phase != Phase.reveal || curSession.phase != Phase.finished, "Session is already running");
        require(msg.value == depositAmount, "You must deposit exactly 1 ether");

        if (curSession.phase == Phase.notStarted) {
            Participant memory p = Participant(payable(msg.sender), commitment, 0, false);
            currentSessionId = currentSessionId + 1;
            sessionIdToParticipants[currentSessionId][0] = p;
            Session memory newSession = Session(1, Phase.join, block.timestamp, 0);
            indexOfParticipant[currentSessionId][msg.sender] = 0;

            idToSession[currentSessionId] = newSession;
        } 
        else if (curSession.phase == Phase.join) {
            sessionIdToParticipants[currentSessionId][curSession.participantsLength] = Participant(payable(msg.sender), commitment, 0, false);
            indexOfParticipant[currentSessionId][msg.sender] = curSession.participantsLength;
            Session storage session = idToSession[currentSessionId];
            session.participantsLength = session.participantsLength + 1;

            if (hasTimeExceeded(session.startTime)) {
                session.phase = Phase.reveal;
                session.startTime = block.timestamp;
                emit RevealPhaseStarted(currentSessionId);
            }
        }

        return currentSessionId;
    }

    function openCommitment(string memory randomValue, uint256 message) external IsExistingParticipant(msg.sender) {
        Participant storage participant = getParticipant(currentSessionId, msg.sender);
        
        string memory concatedOpening = string(abi.encodePacked(randomValue, Strings.toString(message)));
        bytes32 openingHash = keccak256(abi.encodePacked(concatedOpening));

        require (idToSession[currentSessionId].phase == Phase.reveal, "The session is not in reveal phase");
        require(participant.hasRevealed == false, "You have already opened your commitment");// ensure that user has not already opened
        
        require(openingHash == participant.commitment, "Your opening is not valid");

        Session storage currentSession = idToSession[currentSessionId];
        participant.hasRevealed = true;
        participant.message = message;
        currentSession.amountOfReveals += 1;

        if (currentSession.amountOfReveals == currentSession.participantsLength || hasTimeExceeded(currentSession.startTime)) {
            endSession(currentSession);
        }
    }

    function forceNextPhase() external {
        Session storage session = idToSession[currentSessionId];
        if (session.phase == Phase.notStarted) {
            session.phase = Phase.join;
        } else if (session.phase == Phase.join) {
            session.phase = Phase.reveal;
        } else {
            endSession(session);
        }
    }

    function endSession(Session storage session) internal {

        address payable[] memory competingParticipants = new address payable[](session.amountOfReveals); 
        uint256 winnerIndex = 0;
        for (uint256 i; i < session.participantsLength; i++) {
            Participant storage participant = getParticipant(currentSessionId, i);
            if (participant.hasRevealed) {
                competingParticipants[i] = participant.user;
             winnerIndex += participant.message % session.amountOfReveals;
             winnerIndex = winnerIndex % session.amountOfReveals;
            }
        }

        address payable winner = competingParticipants[winnerIndex];

        uint256 reward = depositAmount * session.participantsLength;
        session.phase = Phase.finished;
        winner.transfer(reward);

        emit SessionEnded(currentSessionId, winner, reward);
        currentSessionId += 1;
    }

    // ============== Helper functions ========================
    function hasTimeExceeded(uint start) private view returns(bool) {
        return block.timestamp >= start + joinPhaseMaxDurationSeconds;
    }

    function getParticipant(uint256 sessionId, address user) internal view returns (Participant storage) {
        uint256 participantIndex = indexOfParticipant[sessionId][user];
        return sessionIdToParticipants[sessionId][participantIndex];
    } 

    function getParticipantState(uint256 sessionId, address user) external view returns (Participant memory) {
        uint256 participantIndex = indexOfParticipant[sessionId][user];
        return sessionIdToParticipants[sessionId][participantIndex];
    }

    function getParticipant(uint256 sessionId, uint256 userIndex) internal view returns (Participant storage) {
        return sessionIdToParticipants[sessionId][userIndex];
    }

    function isParticipating(uint256 sessionId, address adr) public view returns(bool result) {
        uint256 id = indexOfParticipant[sessionId][adr];
        return sessionIdToParticipants[sessionId][id].user == adr;
    }
}