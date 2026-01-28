let address = localStorage.getItem("inj_address") || "";

// Variabili
let displayedPrice = 0, targetPrice = 0;
let price24hOpen = 1, price24hLow = 1, price24hHigh = 1; // inizializzate a 1
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let aprValue = 0;

// Flag dati caricati
let dataLoaded = false;

// Elementi DOM
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const priceArrowEl = document.getElementById("priceArrow");
const price24hEl = document.getElementById("price24h");
const priceBarEl = document.getElementById("priceBar");
const priceLineEl = document.getElementById("priceLine");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");
const priceOpenEl = document.getElementById("priceOpen");

const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");

const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");

const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const rewardBarEl = document.getElementById("rewardBar");
const rewardPercentEl = document.getElementById("rewardPercent");

const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");

let arrowTimeout;

// Helper fetch
const fetchJSON = async url => { 
  try { 
    const res = await fetch(url); 
    return await res.json(); 
  } catch(e) { 
    console.error("Fetch error:", url, e); 
    return {}; 
  }
};

// Input
addressInput.value = address;
addressInput.onchange = e => { 
  address = e.target.value.trim(); 
  localStorage.setItem("inj_address", address); 
  loadData(); 
};

// Load data Injective
async function loadData(){
  if(!address) return;
  try{
    const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balanceRes.balances?.find(b => b.denom==="inj");
    availableInj = injBalance ? Number(injBalance.amount)/1e18 : 0;

    const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeRes.delegation_responses?.reduce((sum,d)=>sum+Number(d.balance.amount||0),0)/1e18||0;

    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;

    const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded = Number(poolRes.pool?.bonded_tokens||0);
    const notBonded = Number(poolRes.pool?.not_bonded_tokens||0);
    aprValue = (inflationRes.inflation*(bonded+notBonded)/bonded)*100;

    dataLoaded = true; // segnala che i dati reali sono presenti
  } catch(e){ console.error("Errore dati Injective:",e);}
}
loadData();
setInterval(loadData,60000);

// Animate digits robusto
function animateDigits(element, current, target, decimals = 4) {
    current = Number(current) || 0;
    target = Number(target) || 0;

    if(current.toFixed(decimals) === target.toFixed(decimals)) {
        element.innerHTML = target.toFixed(decimals);
        element.style.color = "#f9fafb";
        return target;
    }

    const step = (target - current) * 0.1;
    const next = current + step;

    const currentStr = current.toFixed(decimals);
    const nextStr = next.toFixed(decimals);
    let html = "";

    for(let i = 0; i < nextStr.length; i++) {
        if(currentStr[i] !== nextStr[i]) {
            const isUp = next > current;
            html += `<span style="color:${isUp ? "#22c55e" : "#ef4444"}">${nextStr[i]}</span>`;
        } else {
            html += `<span style="color:#f9fafb">${nextStr[i]}</span>`;
        }
    }

    element.innerHTML = html;
    return next;
}

// Animazione principale
function animate(){
    if(!dataLoaded) { requestAnimationFrame(animate); return; }

    // esempio: price
    displayedPrice = animateDigits(priceEl, displayedPrice, targetPrice, 4);

    requestAnimationFrame(animate);
}
animate();
