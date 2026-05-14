import { showToast } from './ui.js';

// Mainīgie, kas glabās savienojuma stāvokli
let provider = null;
let signer = null;
let userAddress = null;

/**
 * Pieslēdzas MetaMask vai citam EIP-1193 maciņam
 */
export async function connectWallet() {
    if (!window.ethereum) {
        showToast("MetaMask netika atrasts! Lūdzu, uzstādiet to.", "warning");
        return null;
    }

    try {
        // 1. Izveidojam ethers provider (v6 sintakse)
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // 2. Pieprasām kontus
        const accounts = await provider.send("eth_requestAccounts", []);
        
        // 3. Dabūjam parakstītāju (signer)
        signer = await provider.getSigner();
        userAddress = accounts[0];

        showToast(`Maciņš pievienots: ${userAddress.substring(0, 6)}...`, "success");
        return userAddress;
    } catch (error) {
        console.error("Maciņa pieslēgšanas kļūda:", error);
        showToast("Neizdevās pieslēgt maciņu", "error");
        return null;
    }
}

/**
 * NFT Mintošanas funkcija
 * @param {Object} metadataURL - Objekts ar .ipfs saiti no ipfs.js
 */
export async function mintNFT(metadataURL) {
    if (!signer) {
        showToast("Vispirms pieslēdziet maciņu!", "warning");
        return;
    }

    if (!metadataURL || !metadataURL.ipfs) {
        showToast("Trūkst metadatu saites!", "error");
        return;
    }

    try {
        showToast("Apstipriniet transakciju maciņā...", "info");

        // ŠEIT TEV JĀIEVIETO TAVA LĪGUMA ADRESE UN ABI
        const contractAddress = "TAVA_LĪGUMA_ADRESE_ŠEIT";
        const contractABI = [
            "function safeMint(address to, string uri) public"
        ];

        const contract = new ethers.Contract(contractAddress, contractABI, signer);

        // Izsaucam mintošanas funkciju (izmantojot IPFS saiti no metadatiem)
        const tx = await contract.safeMint(userAddress, metadataURL.ipfs);
        
        showToast("Transakcija nosūtīta! Gaidām apstiprinājumu...", "info");
        
        const receipt = await tx.wait();
        console.log("Transakcijas rezultāts:", receipt);
        
        showToast("NFT veiksmīgi izkalts (minted)!", "success");
        return receipt;

    } catch (error) {
        console.error("Mintošanas kļūda:", error);
        
        // Specifisku kļūdu apstrāde
        if (error.code === 'ACTION_REJECTED') {
            showToast("Lietotājs noraidīja transakciju", "warning");
        } else {
            showToast("Mintošana neizdevās. Pārbaudi konsoli.", "error");
        }
        return null;
    }
}

/**
 * Atgriež pašreizējo adresi, ja tāda ir
 */
export function getAddress() {
    return userAddress;
}
