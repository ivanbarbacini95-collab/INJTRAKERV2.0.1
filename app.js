// =========================
// --- Variabili iniziali ---
// =========================
let address = localStorage.getItem("inj_address") || "";

// Price
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;

// Stake / Rewards / Available
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;

// APR
let apr = 0;

// Chart
let chart, chartData = [];
let selectedTF = '1d'; // default 24h

// DOM Elements
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

// Timeframe UI
const tfIcon = document.querySelector(".tf-icon");
const tfMenu = document.querySelector(".tf-menu");

// =========================
// --- Helpers ---
// =========================
const fetchJSON = async url => {
  try { 
    const res = await fetch(url); 
    return await res.json(); 
  } catch(e) { 
    console.error("Fetch error:", url, e); 
    return {}; 
  }
};

// =========================
// --- Address Input ---
// =========================
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// =========================
// --- Load Injective Data ---
// =========================
async function loadData(){
  if(!address) return;
  try{
    // BALANCE
    const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balanceRes.balances?.find(b => b.denom==="inj");
    availableInj = injBalance ? Number(injBalance.amount)/1e18 : 0;

    // STAKE
    const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeRes.delegation_responses?.reduce((sum,d)=>sum+Number(d.balance.amount||0),0)/1e18||0;

    // APR
    const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded = Number(poolRes.pool?.bonded_tokens||0);
    const notBonded = Number(poolRes.pool?.not_bonded_tokens||0);
    apr = (inflationRes.inflation*(bonded+notBonded)/bonded)*100;
    
  } catch(e){ console.error("Errore dati Injective:",e);}
}
loadData();
setInterval(loadData,60000);

// =========================
// --- Load Rewards (realtime) ---
// =========================
async function loadRewards() {
  if(!address) return;
  try {
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum, r) => {
      if(!r.reward || r.reward.length === 0) return sum;
      const injReward = r.reward.find(rew => rew.denom==="inj");
      return sum + (injReward ? Number(injReward.amount || 0) : 0);
    }, 0)/1e18 || 0;
  } catch(e){ console.error("Errore rewards:",e); rewardsInj = 0; }
}
loadRewards();
setInterval(loadRewards, 2000);

// =========================
// --- Fetch Price History (Binance) ---
// =========================
async function fetchHistory(tf=selectedTF){
  try{
    const tfMap = {
      '1h':'1h', '3h':'3h', '12h':'12h', '1d':'1d', '1w':'1w', '1M':'1M', '1Y':'1y'
    };
    let limit = 100;
    if(tf==='1h') limit = 60;
    if(tf==='3h') limit = 50;
    if(tf==='12h') limit = 60;
    if(tf==='1d') limit = 96;
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=${tfMap[tf]}&limit=${limit}`);
    const d = await res.json();
    chartData = d.map(c=>+c[4]);
    price24hOpen = +d[0][1];
    price24hLow = Math.min(...chartData);
    price24hHigh = Math.max(...chartData);
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){ console.error("Errore price history:", e);}
}
fetchHistory();

// =========================
// --- Draw Chart ---
// =========================
function drawChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();

  const gradient = ctx.getContext('2d').createLinearGradient(0,0,0,200);
  gradient.addColorStop(0, 'rgba(34,197,94,0.3)');
  gradient.addColorStop(1, 'rgba(34,197,94,0)');

  const lineColor = targetPrice >= price24hOpen ? "#22c55e" : "#ef4444";

  chart = new Chart(ctx,{
    type:"line",
    data:{
      labels: chartData.map((_,i)=>i),
      datasets:[{
        data: chartData,
        borderColor: lineColor,
        backgroundColor: gradient,
        tension:0.3,
        fill:true,
        pointRadius:2,
        pointHoverRadius:6,
        pointBackgroundColor: lineColor
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          enabled:true,
          mode:'nearest',
          intersect:false,
          displayColors:false,
          backgroundColor:"#1e293b",
          titleColor:"#f9fafb",
          bodyColor:"#f9fafb",
          callbacks:{
            label: ctx=>`Price: ${parseFloat(ctx.formattedValue).toFixed(4)}`,
            title: ctx=>`Point #${ctx[0].dataIndex+1}`
          }
        }
      },
      scales:{
        x:{display:true,grid:{color:"#1e293b"},ticks:{color:"#9ca3af"}},
        y:{display:true,grid:{color:"#1e293b"},ticks:{color:"#9ca3af"}}
      }
    }
  });
}

// =========================
// --- Binance WS ---
// =========================
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => {
    const p=+JSON.parse(e.data).p;
    targetPrice=p;
    if(p>price24hHigh) price24hHigh=p;
    if(p<price24hLow) price24hLow=p;
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// =========================
// --- Animate Numbers & Bars ---
// =========================
function animate(){
  const lerp = (a,b,f)=>a+(b-a)*f;

  const setValueWithColor = (el, oldVal, newVal, decimals=4)=>{
    const diff = newVal - oldVal;
    if(Math.abs(diff)>0.00001){
      el.innerText = newVal.toFixed(decimals);
      el.style.color = diff>0 ? "#22c55e" : "#ef4444";
    } else {
      el.style.color = "";
    }
  };

  // --- PRICE ---
  const oldPrice = displayedPrice;
  displayedPrice = lerp(displayedPrice,targetPrice,0.1);
  setValueWithColor(priceEl, oldPrice, displayedPrice,4);

  const delta = ((displayedPrice-price24hOpen)/price24hOpen)*100;
  price24hEl.innerText=(delta>0?"▲ ":"▼ ") + Math.abs(delta).toFixed(2)+"%";
  price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");

  // Barra prezzo
  const center=50;
  const percent=Math.min(Math.abs(displayedPrice-price24hOpen)/Math.max(price24hHigh-price24hLow,0.0001)*50,50);
  let linePos;
  if(displayedPrice>=price24hOpen){
    linePos=center+percent;
    priceBarEl.style.left=`${center}%`;
    priceBarEl.style.width=`${linePos-center}%`;
    priceBarEl.style.background="linear-gradient(to right,#22c55e,#10b981)";
  } else{
    linePos=center-percent;
    priceBarEl.style.left=`${linePos}%`;
    priceBarEl.style.width=`${center-linePos}%`;
    priceBarEl.style.background="linear-gradient(to right,#ef4444,#f87171)";
  }
  priceLineEl.style.left=`${linePos}%`;

  priceMinEl.innerText=price24hLow.toFixed(4);
  priceMaxEl.innerText=price24hHigh.toFixed(4);
  priceOpenEl.innerText=price24hOpen.toFixed(4);

  // --- AVAILABLE ---
  const oldAvailable = displayedAvailable;
  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  setValueWithColor(availableEl, oldAvailable, displayedAvailable,6);
  availableUsdEl.innerText=(displayedAvailable*displayedPrice).toFixed(2);

  // --- STAKE ---
  const oldStake = displayedStake;
  displayedStake=lerp(displayedStake,stakeInj,0.1);
  setValueWithColor(stakeEl, oldStake, displayedStake,4);
  stakeUsdEl.innerText=(displayedStake*displayedPrice).toFixed(2);

  // --- REWARDS ---
  const oldRewards = displayedRewards;
  displayedRewards=lerp(displayedRewards,rewardsInj,0.05);
  setValueWithColor(rewardsEl, oldRewards, displayedRewards,4);
  rewardsUsdEl.innerText=(displayedRewards*displayedPrice).toFixed(2);

  const rewardPercent = Math.min(displayedRewards / 0.05 * 100, 100);
  rewardBarEl.style.width = rewardPercent+"%";
  rewardPercentEl.innerText = rewardPercent.toFixed(0)+"%";

  // --- APR ---
  aprEl.innerText=apr.toFixed(2)+"%";

  // --- LAST UPDATE ---
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// =========================
// --- Timeframe Menu ---
// =========================
tfIcon.addEventListener("click",()=>{ tfMenu.style.display=tfMenu.style.display==="flex"?"none":"flex"; });
tfMenu.querySelectorAll("div").forEach(el=>{
  el.addEventListener("click",()=>{
    selectedTF=el.dataset.tf;
    tfMenu.querySelectorAll("div").forEach(d=>d.classList.remove("active"));
    el.classList.add("active");
    fetchHistory(selectedTF);
  });
});
