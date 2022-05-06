import logo from "./logo.svg";
import React, { useEffect, useState } from "react";
import "./App.css";
import Web3 from "web3";
import euroLotto from "./abis/EuroLotto.json";

const PHASE_NOT_STARTED = 0;
const PHASE_JOIN = 1;
const PHASE_REVEAL = 2;
const PHASE_FINISHED = 3;
const RANDOM_STRING_LENGTH = 256;
const RANDOM_INT_MAX = 1000000000;

function App() {
  const [web3, setWeb3] = useState();
  const [userAddress, setUserAddress] = useState();
  const [contract, setContract] = useState();
  const [session, setSession] = useState();
  const [sessionId, setSessionId] = useState(0);
  const [isParticipating, setIsParticipating] = useState();
  const [participant, setParticipant] = useState();
  const [randomString, setRandomString] = useState();
  const [message, setMessage] = useState();
  const [commitment, setCommitment] = useState();
  const [goToNextSession, setGoToNextSession] = useState(true);
  const [winnerInfo, setWinnerInfo] = useState();

  const syncSession = async () => {
    // get the state of the lotto session
    if (contract === undefined) return;

    let curSessionId = sessionId;
    // go to the next session if the current has finished
    if (goToNextSession) {
      curSessionId = await contract.methods.currentSessionId().call();
    }

    const session = await contract.methods.idToSession(curSessionId).call();
    const isParticipating = await contract.methods
      .isParticipating(curSessionId, userAddress)
      .call();
    const participant = await contract.methods
      .getParticipantState(curSessionId, userAddress)
      .call();
    setSessionId(curSessionId);
    setSession({
      phase: parseInt(session.phase),
      startTime: session.startTime,
      participantsLength: parseInt(session.participantsLength),
      amountOfReveals: parseInt(session.amountOfReveals),
    });
    setIsParticipating(isParticipating);
    setParticipant(participant);

    if (session.phase == PHASE_FINISHED) {
      const events = await contract.getPastEvents("SessionEnded", {
        filter: { sessionId: curSessionId },
        fromBlock: 0, 
        toBlock: "latest"
      });
      const result = events[0].returnValues;
      setWinnerInfo({
        reward: web3.utils.fromWei(result.reward, "ether"),
        winner: result.winner
      });
    }
  };

  if (session === undefined) {
    syncSession();
  }

  const joinLotto = async () => {
    const randomString = generateRandomString(RANDOM_STRING_LENGTH);
    const message = getRandomInt(RANDOM_INT_MAX);
    const commitment = web3.utils.keccak256(randomString + message);
    await contract.methods.joinLotto(commitment).send({from: userAddress, value: web3.utils.toWei("1")});
    setCommitment(commitment);
    setRandomString(randomString);
    setMessage(message);
    setGoToNextSession(false);
    setWinnerInfo(undefined);
    syncSession();
  };

  const openCommitment = async () => {
    await contract.methods.openCommitment(randomString, message).send({from: userAddress});
    await syncSession();
  }

  const forceNextPhase = async () => {
    await contract.methods.forceNextPhase().send({from: userAddress});
    await syncSession();
  }

  const nextSession = async () => {
    setGoToNextSession(true);
    await syncSession();
  }

  useEffect(() => {
    const fetchData = async () => {
      const ethereum = window.ethereum;
      if (ethereum !== undefined) {
        ethereum.enable();
        const web3 = new Web3(ethereum);
        const networkId = await web3.eth.net.getId();
        const accounts = await web3.eth.getAccounts();
        if (accounts.length !== 0) {
          //load contract
          const euroLottoAddress = euroLotto.networks[networkId].address;
          const euroLottoContract = new web3.eth.Contract(
            euroLotto.abi,
            euroLottoAddress
          );
          setWeb3(web3);
          setContract(euroLottoContract);
          setUserAddress(accounts[0]);
        } else {
          alert(
            "Please login to MetaMask and connect an account before accessing this site!"
          );
        }
      } else {
        alert("This page requries MetaMask!");
      }
    };

    fetchData();
  }, []);

  let content = <h2>Loading...</h2>;
  const calculateRemainingReveals = () => {
    return session.participantsLength - session.amountOfReveals;
  };

  if (session !== undefined) {
    switch (session.phase) {
      case PHASE_NOT_STARTED:
        content = (
          <div>
            <h2>Lotto has not started</h2>
            <h3>Join to start</h3>
            <button onClick={() => joinLotto()}>Join</button>
          </div>
        );
        break;
      case PHASE_JOIN:
        if (isParticipating) {
          content = (
            <div>
              <h3>Lotto is open with {session.participantsLength} participant</h3>
              <h2>You are already participating</h2>
              <ul>
                <li>Commitment = {commitment}</li>
                <li>Message = {message}</li>
                <li className="overflow-x">Random string = {randomString}</li>
              </ul>
            </div>
          );
        } else {
          content = (
            <div>
              <h2>Lotto is open with {session.participantsLength} participant</h2>
              <h3>Join to participate</h3>
              <button onClick={() => joinLotto()}>Join</button>
            </div>
          );
        }
        break;
      case PHASE_REVEAL:
        if (isParticipating) {
          content = (
            <div>
              <h2>Lotto is in progress</h2>
              <h3>You are participating</h3>
                <p>Awaiting {calculateRemainingReveals()} reveals... </p>
                <div>
                  <p>Please open commitment now</p>
                  <button onClick={() => openCommitment()}>Open Commitment</button>
                </div>
            </div>
          );
        } else {
          content = (
            <div>
              <h2>Lotto is in progress</h2>
              <h3>You are not participating</h3>
            </div>
          );
        }
        break;
      case PHASE_FINISHED:
        let innerContent = <h3>Loading winner data...</h3>
        if (winnerInfo !== undefined) {
          const stuff = winnerInfo.winner == userAddress ? "(you)" : ""
          innerContent = 
          <div>
            <h3>The winner is: {winnerInfo.winner} {stuff}</h3>
            <h3>Reward: {winnerInfo.reward} ether</h3>
          </div>
        }
        content = (
          <div>
            <h2>Lotto has Finished</h2>
            {innerContent}
            <button onClick={() => nextSession()}>Back to current Lotto</button>
          </div>
        );
    }
  }

  return (
  <div className="center">
    {content}
    {session !== undefined && session.phase !== PHASE_NOT_STARTED ? 
      <button onClick={() => forceNextPhase()}>Force Next phase</button> : undefined
    }
    <button onClick={() => syncSession()}>Synchronize</button>
    </div>
  );
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function generateRandomString(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export default App;
