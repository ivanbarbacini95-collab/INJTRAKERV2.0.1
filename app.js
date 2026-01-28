// --- Variabili iniziali ---
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

// --- Helpers ---
const fetchJSON = async url => {
  try { const res = await fetch(url); return await res.json(); } 
  catch(e){ console.error("Fetch error:", url,e); return {}; }
};

// --- Address Input ---
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// --- Load Injective Data ---
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
    apr = (inflationRes.inflation*(bonded+notBonded)/bonded)*100;
  } catch(e){ console.error("Errore dati Injective:",e);}
}
loadData();
setInterval(loadData,60000);

// --- Fetch Price History (Binance, candlestick) ---
async function fetchHistory(tf=selectedTF){
  const tfMap = { '1h':'1h', '12h':'12h', '1d':'1d', '1w':'1w', '1M':'1M' };
  let limit = 100;
  if(tf==='1h') limit=100;
  if(tf==='12h') limit=90;
  if(tf==='1d') limit=60;
  if(tf==='1w') limit=52;
  if(tf==='1M') limit=12;

  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=${tfMap[tf]}&limit=${limit}`);
    const d = await res.json();

    // Formato candlestick
    chartData = d.map(c => ({
      x: new Date(c[0]),
      o: +c[1],
      h: +c[2],
      l: +c[3],
      c: +c[4]
    }));

    price24hOpen = chartData[0].o;
    price24hLow  = Math.min(...chartData.map(c=>c.l));
    price24hHigh = Math.max(...chartData.map(c=>c.h));
    targetPrice  = chartData.at(-1).c;

    drawCandlestickChart();
  } catch(e){ console.error("Errore price history:", e); }
}
fetchHistory();

// --- Draw Candlestick Chart ---
function drawCandlestickChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'candlestick',
    data: { datasets:[{ label:'INJ/USDT', data: chartData,
      color:{ up:'#22c55e', down:'#ef4444', unchanged:'#9ca3af' } }] },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{ mode:'nearest', intersect:false },
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ type:'time', time:{ unit:selectedTF }, ticks:{ color:'#9ca3af' }, grid:{ color:'#1e293b' } },
        y:{ ticks:{ color:'#9ca3af' }, grid:{ color:'#1e293b' } }
      }
    }
  });
}

// --- Binance WS ---
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => {
    const trade = JSON.parse(e.data);
    targetPrice = +trade.p;

    // aggiorniamo candela corrente
    const last = chartData.at(-1);
    if(last){
      last.h = Math.max(last.h, targetPrice);
      last.l = Math.min(last.l, targetPrice);
      last.c = targetPrice;
    }
  };
  ws.onclose = ()=>setTimeout(startWS,3000);
}
startWS();

// --- Animate Numbers & Bars ---
function animate(){
  const lerp=(a,b,f)=>a+(b-a)*f;

  // PRICE
  const oldPrice = displayedPrice;
  displayedPrice=lerp(displayedPrice,targetPrice,0.1);
  if(Math.abs(displayedPrice-oldPrice)>0.00001){
    priceEl.innerHTML=colorDigits(displayedPrice.toFixed(4), oldPrice);
    const delta=((displayedPrice-price24hOpen)/price24hOpen)*100;
    price24hEl.innerText=(delta>0?"▲ ":"▼ ") + Math.abs(delta).toFixed(2)+"%";
    price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");
  }

  // BARRA PREZZO
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

  // AVAILABLE
  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  availableEl.innerHTML=colorDigits(displayedAvailable.toFixed(6), displayedAvailable-0.000001);
  availableUsdEl.innerText=(displayedAvailable*displayedPrice).toFixed(2);

  // STAKE
  displayedStake=lerp(displayedStake,stakeInj,0.1);
  stakeEl.innerHTML=colorDigits(displayedStake.toFixed(4), displayedStake-0.0001);
  stakeUsdEl.innerText=(displayedStake*displayedPrice).toFixed(2);

  // REWARDS
  displayedRewards=lerp(displayedRewards,rewardsInj,0.05);
  rewardsEl.innerHTML=colorDigits(displayedRewards.toFixed(7), displayedRewards-0.0000001);
  rewardsUsdEl.innerText=(displayedRewards*displayedPrice).toFixed(2);

  const rewardPercent = Math.min(displayedRewards/0.05*100,100);
  rewardBarEl.style.width=rewardPercent+"%";
  rewardPercentEl.innerText=(rewardPercent.toFixed(1))+"%";

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // LAST UPDATE
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// --- Colora solo i numeri cambiati ---
function colorDigits(newVal, oldVal){
  let result="";
  const newStr=newVal.toString(), oldStr=(oldVal||0).toFixed(newStr.split(".")[1]?.length||4);
  for(let i=0;i<newStr.length;i++){
    const c=newStr[i];
    const oldC=oldStr[i]||"";
    if(c!==oldC && /\d/.test(c)){
      const up=+newVal>+oldVal;
      result+=`<span style="color:${up?"#22c55e":"#ef4444"}">${c}</span>`;
    } else result+=c;
  }
  return result;
}

// --- Timeframe Menu ---
tfIcon.addEventListener("click",()=>{ tfMenu.style.display=tfMenu.style.display==="flex"?"none":"flex"; });
tfMenu.querySelectorAll("div").forEach(el=>{
  el.addEventListener("click",()=>{
    selectedTF=el.dataset.tf;
    tfMenu.querySelectorAll("div").forEach(d=>d.classList.remove("active"));
    el.classList.add("active");
    fetchHistory(selectedTF);
  });
});

// --- Aggiorna rewards ogni 2 secondi ---
setInterval(loadData,2000);
