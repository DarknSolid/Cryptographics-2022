// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

contract EuroLotto {

    uint256 currentSessionId;

    mapping (uint256 => Session) public idToSession;
    mapping (uint256 => mapping(address => uint256)) public participantId; // session id -> msg.sender -> index

    event RevealPhaseStarted(uint256 indexed sessionId);

    mapping (uint256 => mapping(uint256 => Participant)) public sessionIdToParticipants; //session id to participant index to participant

    modifier IsNotExistingParticipant(address adr) {
        uint256 id = participantId[currentSessionId][adr];
        require(sessionIdToParticipants[currentSessionId][id].user != adr, "You are already participating in this session");
        _;
    }

    modifier IsExistingParticipant(address adr) {
        uint256 id = participantId[currentSessionId][adr];
        require(sessionIdToParticipants[currentSessionId][id].user == adr, "You are not participating in this session");
        _;
    }

    struct Session {
        uint256 participantsLength; //the amount of participants in the "sessionIdToParticipants"
        Phase phase;
        uint256 startTime;
    }

    struct Participant {
        address user;
        string commitment;
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
            Participant memory p = Participant(msg.sender, commitment, "", false);
            currentSessionId = currentSessionId + 1;
            sessionIdToParticipants[currentSessionId][0] = p;
            Session memory newSession = Session(1, Phase.join, block.timestamp);
            participantId[currentSessionId][msg.sender] = 0;

            idToSession[currentSessionId] = newSession;
        } 
        else if (curSession.phase == Phase.join) {
            sessionIdToParticipants[currentSessionId][curSession.participantsLength] = Participant(msg.sender, commitment, "", false);
            participantId[currentSessionId][msg.sender] = curSession.participantsLength;
            curSession.participantsLength += 1;
        }

        if (hasTimeExceeded(curSession.startTime)) {
            curSession.phase == Phase.reveal;
            emit RevealPhaseStarted(currentSessionId);
        }

        return currentSessionId;
    }

    // function openCommitment(string memory message, string memory randomValue) external IsExistingParticipant(msg.sender) {
    //     require (idToSession[currentSessionId].phase == Phase.reveal, "The session is not in reveal phase");
    //     // sender must be a participant
    //     // sender must not have revealed
    //     // TODO what if the sender sends an invalid opening?
    // }

    function hasTimeExceeded(uint256 start) private view returns(bool) {
        return block.timestamp - start >= joinPhaseMaxDurationSeconds;
    }
}