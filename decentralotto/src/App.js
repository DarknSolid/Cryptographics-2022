import logo from './logo.svg';
import React, { useEffect, useState } from "react";
import './App.css';
import Web3 from 'web3';
import euroLotto from './abis/EuroLotto.json';

function App() {
  const [context, setContext] = useState();
  useEffect(() => {
    const fetchData = async () => {
        const ethereum = window.ethereum;
        let variables = {}
        if (ethereum !== undefined) {
            ethereum.enable();
            const web3 = new Web3(ethereum);
            const networkId = await web3.eth.net.getId();
            const accounts = await web3.eth.getAccounts();
            console.log(accounts)
            if (accounts.length !== 0) {
                const balance = await web3.eth.getBalance(accounts[0]);
        
                //load contracts
                const euroLottoAddress = euroLotto.networks[networkId].address;
                const euroLottoContract = new web3.eth.Contract(euroLotto.abi, euroLottoAddress);
                variables = {
                    web3: web3,
                    euroLottoAddress: euroLottoAddress,
                    euroLottoContract: euroLottoContract,
                    accountAddress: accounts[0]
                }
            }
            else {
                alert("Please login to MetaMask and connect an account before accessing this site!")
            }
        } else {
            alert("This page requries MetaMask!")
        }
        setContext(variables);
    };
    
    fetchData();
  }, []);

  return (
    context != undefined ?
      <div>Hello {context.accountAddress}!</div>
      :
      <div>Oh no</div>
  );
}

export default App;
