// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

contract EuroLotto {

    uint256 currentSessionId;

    mapping (uint256 => Session) public idToSession;
    mapping (uint256 => mapping(address => uint256)) public indexOfParticipant; // session id -> msg.sender -> index

    event RevealPhaseStarted(uint256 indexed sessionId);

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
        address user;
        bytes32 commitment;
        string message;
        bool hasRevealed;
    }

    uint256 depositAmount = 1 ether;
    enum Phase{notStarted, join, reveal}
    uint256 joinPhaseMaxDurationSeconds = 60 * 10; // ten minutes
    
    function joinLotto(string memory commitment) external payable IsNotExistingParticipant(msg.sender) returns(uint256 id) {
        Session memory curSession = idToSession[currentSessionId];
        require(curSession.phase != Phase.reveal, "Session is already running");
        require(msg.value == depositAmount, "You must deposit exactly 1 ether");

        if (curSession.phase == Phase.notStarted) {
            Participant memory p = Participant(msg.sender, bytes32(abi.encodePacked(commitment)), "", false);
            currentSessionId = currentSessionId + 1;
            sessionIdToParticipants[currentSessionId][0] = p;
            Session memory newSession = Session(1, Phase.join, block.timestamp, 0);
            indexOfParticipant[currentSessionId][msg.sender] = 0;

            idToSession[currentSessionId] = newSession;
        } 
        else if (curSession.phase == Phase.join) {
            sessionIdToParticipants[currentSessionId][curSession.participantsLength] = Participant(msg.sender, bytes32(abi.encodePacked(commitment)), "", false);
            indexOfParticipant[currentSessionId][msg.sender] = curSession.participantsLength;
            curSession.participantsLength += 1;
        }

        if (hasTimeExceeded(curSession.startTime)) {
            curSession.phase == Phase.reveal;
            emit RevealPhaseStarted(currentSessionId);
        }

        return currentSessionId;
    }

    function openCommitment(string memory randomValue, string memory message) external IsExistingParticipant(msg.sender) {
        Participant storage participant = getParticipant(currentSessionId, msg.sender);
        string memory concatedOpening = string(abi.encodePacked(randomValue, message));
        bytes32 openingHash = keccak256(abi.encodePacked(concatedOpening));

        require (idToSession[currentSessionId].phase == Phase.reveal, "The session is not in reveal phase");
        require(participant.hasRevealed == false, "You have already opened your commitment");// ensure that user has not already opened
        // the strings length for gas efficiency: https://fravoll.github.io/solidity-patterns/string_equality_comparison.html
        // compare the hashes
        require(
            bytes(concatedOpening).length == participant.commitment.length ||
            openingHash == participant.commitment, 
            "Your opening is not valid"
        );

        Session storage currentSession = idToSession[currentSessionId];
        participant.hasRevealed = true;
        currentSession.amountOfReveals += 1;

        if (currentSession.amountOfReveals == currentSession.participantsLength) {
            endSession();
        }
    }

    function endSession() internal {
        //TODO find the winner
            //Pay the winner
            //emit event
            //bump the current session id
    }

    function hasTimeExceeded(uint256 start) private view returns(bool) {
        return block.timestamp - start >= joinPhaseMaxDurationSeconds;
    }

    function getParticipant(uint256 sessionId, address user) internal view returns (Participant storage) {
        uint256 participantIndex = indexOfParticipant[sessionId][user];
        return sessionIdToParticipants[sessionId][participantIndex];
    } 
}