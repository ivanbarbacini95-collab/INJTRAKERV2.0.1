// -----------------------------
// Injective Dashboard Realtime Slot-Machine
// -----------------------------

let address = localStorage.getItem("inj_address") || "";

// Variabili display
let displayedPrice = 0, targetPrice = 0;
let price24hOpen = 0, price24hLow = Infinity, price24hHigh = -Infinity;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

// Chart
let chart, chartData = [];

// Elementi DOM
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
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

// -----------------------------
// Helper fetch JSON
// -----------------------------
const fetchJSON = async url => {
    try { const res = await fetch(url); return await res.json(); }
    catch(e) { console.error("Fetch error:", url, e); return {}; }
};

// -----------------------------
// Input Address
// -----------------------------
addressInput.value = address;
addressInput.onchange = e => {
    address = e.target.value.trim();
    localStorage.setItem("inj_address", address);
    loadData();
};

// -----------------------------
// Load data Injective
// -----------------------------
async function loadData() {
    if(!address) return;
    try {
        const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
        const injBalance = balanceRes.balances?.find(b => b.denom === "inj");
        availableInj = injBalance ? Number(injBalance.amount)/1e18 : 0;

        const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
        stakeInj = stakeRes.delegation_responses?.reduce((sum,d)=>sum+Number(d.balance.amount||0),0)/1e18||0;

        const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
        rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;

        const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
        const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
        const bonded = Number(poolRes.pool?.bonded_tokens||0);
        const notBonded = Number(poolRes.pool?.not_bonded_tokens||0);
        apr = (inflationRes.inflation*(bonded+notBonded)/bonded)*100;

    } catch(e){ console.error("Errore dati Injective:", e);}
}
loadData();
setInterval(loadData, 60000); // aggiorna blockchain ogni minuto

// -----------------------------
// Init 24h price (apertura, min, max)
// -----------------------------
async function initPrice24h() {
    try {
        const res = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1m&limit=1440");
        const data = await res.json();
        price24hOpen = parseFloat(data[0][1]);
        price24hLow = Math.min(...data.map(c => parseFloat(c[3])));
        price24hHigh = Math.max(...data.map(c => parseFloat(c[2])));
    } catch(e){ console.error("Errore initPrice24h:", e); }
}
initPrice24h();

// Reset giornaliero min/max e apertura
setInterval(() => {
    const now = new Date();
    if(now.getUTCHours() === 0 && now.getUTCMinutes() === 0){
        initPrice24h();
    }
}, 60000);

// -----------------------------
// Price WebSocket Binance
// -----------------------------
function startWS(){
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
    ws.onmessage = e => { 
        const data = JSON.parse(e.data);
        const p = parseFloat(data.p);
        targetPrice = p;

        if(!price24hOpen) price24hOpen = p;

        if(p < price24hLow) price24hLow = p;
        if(p > price24hHigh) price24hHigh = p;
    };
    ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// -----------------------------
// Animate cifra-slot machine
// -----------------------------
function animate(){
    function animateDigits(el, current, target, decimals=4, flashDuration=300){
        const curStr = current.toFixed(decimals);
        const tgtStr = target.toFixed(decimals);
        let result = "";
        for(let i=0;i<tgtStr.length;i++){
            if(curStr[i] === tgtStr[i]) result += curStr[i];
            else {
                result += tgtStr[i];
                el.classList.add(target>current?"up":"down");
                setTimeout(()=>el.classList.remove("up"), flashDuration);
                setTimeout(()=>el.classList.remove("down"), flashDuration);
            }
        }
        el.innerText = result;
        return parseFloat(result);
    }

    // --- PRICE ---
    displayedPrice = animateDigits(priceEl, displayedPrice, targetPrice, 4);
    const delta = ((displayedPrice - price24hOpen)/price24hOpen)*100;
    price24hEl.innerText = (delta>=0?"▲ ":"▼ ") + Math.abs(delta).toFixed(2) + "%";
    price24hEl.className = "sub "+(delta>0?"up":delta<0?"down":"");

    // Barra price con apertura al centro
    const center=50;
    let percent=0, linePos=center;
    if(displayedPrice >= price24hOpen){
        percent = Math.min((displayedPrice - price24hOpen)/(price24hHigh - price24hOpen)*50,50);
        linePos = center + percent;
        priceBarEl.style.left = `${center}%`;
        priceBarEl.style.width = `${linePos - center}%`;
        priceBarEl.style.background = "linear-gradient(to right,#22c55e,#10b981)";
    } else {
        percent = Math.min((price24hOpen - displayedPrice)/(price24hOpen - price24hLow)*50,50);
        linePos = center - percent;
        priceBarEl.style.left = `${linePos}%`;
        priceBarEl.style.width = `${center - linePos}%`;
        priceBarEl.style.background = "linear-gradient(to right,#ef4444,#f87171)";
    }
    priceLineEl.style.left = `${linePos}%`;
    priceMinEl.innerText = price24hLow.toFixed(4);
    priceMaxEl.innerText = price24hHigh.toFixed(4);
    priceOpenEl.innerText = price24hOpen.toFixed(4);

    // --- AVAILABLE ---
    displayedAvailable = animateDigits(availableEl, displayedAvailable, availableInj, 6);
    availableUsdEl.innerText = (displayedAvailable * displayedPrice).toFixed(2);

    // --- STAKE ---
    displayedStake = animateDigits(stakeEl, displayedStake, stakeInj, 4);
    stakeUsdEl.innerText = (displayedStake * displayedPrice).toFixed(2);

    // --- REWARDS ---
    displayedRewards = animateDigits(rewardsEl, displayedRewards, rewardsInj, 6);
    rewardsUsdEl.innerText = (displayedRewards * displayedPrice).toFixed(2);
    const rewardPercent = Math.min(displayedRewards/0.1*100,100);
    rewardBarEl.style.width = rewardPercent + "%";
    rewardPercentEl.innerText = rewardPercent.toLocaleString('it-IT',{minimumFractionDigits:2, maximumFractionDigits:2})+"%";

    // --- APR ---
    aprEl.innerText = apr.toFixed(2) + "%";

    // --- LAST UPDATE ---
    updatedEl.innerText = "Last Update: "+new Date().toLocaleTimeString();

    requestAnimationFrame(animate);
}
animate();
