import { showToast } from './ui.js';

let provider = null;
let signer = null;
let userAddress = null;

export async function connectWallet() {
    if (!window.ethereum) {
        showToast("MetaMask netika atrasts!", "warning");
        return null;
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        userAddress = accounts[0];
        showToast("Maciņš pieslēgts!", "success");
        return userAddress;
    } catch (error) {
        showToast("Pieslēgšanās kļūda", "error");
        return null;
    }
}

export async function mintNFT(metadataURL) {
    if (!signer) return showToast("Pieslēdz maciņu!", "warning");

    try {
        // Paņemam līguma datus no servera (no .env)
        const configRes = await fetch('/api/getUploadToken', { method: 'POST' });
        const { contractAddress } = await configRes.json();
        
        const abi = ["function safeMint(address to, string uri) public"];
        const contract = new ethers.Contract(contractAddress, abi, signer);
        
        const tx = await contract.safeMint(userAddress, metadataURL.ipfs);
        showToast("Transakcija parakstīta!", "info");
        return await tx.wait();
    } catch (error) {
        showToast("Mintošana neizdevās", "error");
        throw error;
    }
}
