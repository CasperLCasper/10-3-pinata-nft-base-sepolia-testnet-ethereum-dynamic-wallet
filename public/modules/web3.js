// ============================================ //
// WEB3 FUNCTIONS
// ============================================ //

import { VIZ_CHAINS, MINT_CHAIN, getAllRpcUrls } from './chains.js';
import { UI } from './state.js';
import { showToast, setButtonLoading, showProgress, hideProgress } from './ui.js';
import { login, getNFTPrice } from './api.js';

export async function updateChainStatus() {
  if (!window.ethereum || !UI.chainStatus) return;
  
  try {
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    const selectedChainKey = UI.chainSelect.value;
    const selectedChain = VIZ_CHAINS[selectedChainKey];
    
    // 🔥 Salīdzina HEX stringus, nevis decimālos skaitļus
    if (selectedChain && chainIdHex === selectedChain.chainIdHex) {
      UI.chainStatus.className = 'chain-status connected';
      UI.chainStatus.title = '✓ Connected to selected network';
    } else {
      UI.chainStatus.className = 'chain-status disconnected';
      UI.chainStatus.title = '⚠️ Please switch network in your wallet';
    }
  } catch (error) {
    UI.chainStatus.className = 'chain-status disconnected';
    UI.chainStatus.title = '❌ Network error';
  }
}

export async function switchToMintChain() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MINT_CHAIN.chainIdHex }]  // 🔥 HEX, nevis decimāls
    });
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: MINT_CHAIN.chainIdHex,  // 🔥 HEX
          chainName: MINT_CHAIN.name,
          nativeCurrency: { name: MINT_CHAIN.nativeCurrency, symbol: MINT_CHAIN.nativeCurrency, decimals: 18 },
          rpcUrls: getAllRpcUrls('baseSepolia'),  // 🔥 Izmanto helper no chains.js
          blockExplorerUrls: [MINT_CHAIN.blockExplorer]
        }]
      });
    } else {
      throw error;
    }
  }
}

export async function switchToVizChain(chainIdHex) {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }]  // 🔥 Parametrs jau ir HEX
    });
    await updateChainStatus();
  } catch (error) {
    if (error.code === 4902) {
      // 🔥 Meklē pēc chainIdHex, nevis decimālā chainId
      const chainConfig = Object.values(VIZ_CHAINS).find(c => c.chainIdHex === chainIdHex);
      if (chainConfig) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainConfig.chainIdHex,  // 🔥 HEX
            chainName: chainConfig.name,
            nativeCurrency: { name: chainConfig.nativeCurrency, symbol: chainConfig.nativeCurrency, decimals: 18 },
            rpcUrls: Array.isArray(chainConfig.rpc) ? chainConfig.rpc : [chainConfig.rpc],
            blockExplorerUrls: [chainConfig.blockExplorer]
          }]
        });
        await updateChainStatus();
      }
    } else {
      throw error;
    }
  }
}

export async function connectWallet(app) {
  setButtonLoading(UI.connectBtn, true);
  showProgress();
  
  try {
    if (!window.ethereum) {
      alert('Please install MetaMask, Rabby, or Enkrypt!');
      return;
    }
    
    app.currentVizChain = UI.chainSelect.value;
    const vizChainConfig = VIZ_CHAINS[app.currentVizChain];
    
    if (!vizChainConfig) {
      throw new Error('Invalid chain selected');
    }
    
    // 🔥 Nodod chainIdHex, nevis decimālo chainId
    await switchToVizChain(vizChainConfig.chainIdHex);
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const account = await signer.getAddress();
    
    app.provider = provider;
    app.signer = signer;
    app.account = account;
    
    UI.accountDisplay.textContent = `Connected account on ${vizChainConfig.name}: ${account}`;
    
    const loginSuccess = await login(signer, account);
    if (!loginSuccess) {
      console.warn("Login failed, but continuing with visualization");
    }
    
    await app.renderSnapshot(app.currentVizChain);
    
    UI.recordBtn.disabled = false;
    UI.generateNFTBtn.disabled = false;
    
    const price = await getNFTPrice();
    UI.generateNFTBtn.setAttribute('data-price', price);
    
    await updateChainStatus();
    
    const tokenCount = app.tokens.filter(t => !t.isNFT).length;
    showToast(`Connected to ${vizChainConfig.name}! Loaded ${app.tokens.length} assets (${tokenCount} tokens, ${app.nftCenters.length} NFTs)`, 'success');
    
  } catch (err) { 
    console.error(err); 
    showToast('Connection failed: ' + err.message, 'error'); 
  } finally { 
    setButtonLoading(UI.connectBtn, false); 
    hideProgress(); 
  }
}
