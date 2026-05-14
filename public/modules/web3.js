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
        // Izmantojam ethers v6 (kas ir tavā package.json)
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        userAddress = accounts[0];

        showToast(`Maciņš pievienots: ${userAddress.substring(0, 6)}...`, "success");
        return userAddress;
    } catch (error) {
        console.error("Connection error:", error);
        showToast("Neizdevās pieslēgt maciņu", "error");
        return null;
    }
}

export async function mintNFT(metadataURL, contractAddress, abi) {
    if (!signer) {
        showToast("Vispirms pieslēdziet maciņu!", "warning");
        return;
    }

    try {
        showToast("Apstipriniet mintošanu maciņā...", "info");
        
        const contract = new ethers.Contract(contractAddress, abi, signer);
        const tx = await contract.safeMint(userAddress, metadataURL.ipfs);
        
        showToast("Transakcija nosūtīta...", "info");
        return await tx.wait();
    } catch (error) {
        console.error("Mint error:", error);
        showToast("Mintošana neizdevās", "error");
        throw error;
    }
}
