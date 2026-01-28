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

// --- Fetch Price History 24h ---
async function fetchHistory(){
  try{
    const limit = 96; // 15 min candle per 24h
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=${limit}`);
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

// --- Draw Chart ---
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

// --- Binance WS ---
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

// --- Highlight digits changed ---
function colorDigits(newVal, oldVal){
  let res = "";
  const newS = newVal.toString();
  const oldS = (oldVal!==undefined?oldVal:0).toFixed(newS.split(".")[1]?.length||4);

  for(let i=0;i<newS.length;i++){
    const cNew=newS[i], cOld=oldS[i]||"0";
    if(/\d/.test(cNew) && cNew!==cOld){
      res+=`<span style="color:${+newVal>+oldVal?"#22c55e":"#ef4444"}">${cNew}</span>`;
    }else{
      res+=`<span style="color:#f9fafb">${cNew}</span>`;
    }
  }
  return res;
}

// --- Animate Numbers & Bars ---
function animate(){
  const lerp = (a,b,f)=>a+(b-a)*f;

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

  priceMinEl.style.fontSize="0.9rem"; priceMinEl.innerText=price24hLow.toFixed(4);
  priceMaxEl.style.fontSize="0.9rem"; priceMaxEl.innerText=price24hHigh.toFixed(4);
  priceOpenEl.style.fontSize="0.9rem"; priceOpenEl.innerText=price24hOpen.toFixed(4);

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
  rewardPercentEl.innerText=(rewardPercent.toFixed(0))+"%";

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // LAST UPDATE
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
