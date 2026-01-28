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

// DOM
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
const fetchJSON = async url => { try { return await (await fetch(url)).json(); } catch(e){ console.error(e); return {}; } };

// --- Address Input ---
addressInput.value = address;
addressInput.onchange = e => { address = e.target.value.trim(); localStorage.setItem("inj_address", address); loadData(); };

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
  } catch(e){ console.error(e); }
}
loadData();
setInterval(loadData,2000);

// --- Fetch Price History (24h) ---
async function fetchHistory(){
  try{
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24`);
    const d = await res.json();
    chartData = d.map(c=>+c[4]);
    price24hOpen = +d[0][1];
    price24hLow = Math.min(...chartData);
    price24hHigh = Math.max(...chartData);
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){ console.error(e); }
}
fetchHistory();

// --- Draw Chart ---
function drawChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();
  const gradient = ctx.getContext('2d').createLinearGradient(0,0,0,200);
  gradient.addColorStop(0,'rgba(34,197,94,0.3)');
  gradient.addColorStop(1,'rgba(34,197,94,0)');
  const lineColor = targetPrice>=price24hOpen?"#22c55e":"#ef4444";
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
      plugins:{legend:{display:false}},
      scales:{x:{display:true,ticks:{color:"#9ca3af"},grid:{color:"#1e293b"}},
              y:{display:true,ticks:{color:"#9ca3af"},grid:{color:"#1e293b"}}}
    }
  });
}

// --- Binance WS ---
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => { const p=+JSON.parse(e.data).p; targetPrice=p; if(p>price24hHigh) price24hHigh=p; if(p<price24hLow) price24hLow=p; };
  ws.onclose = ()=>setTimeout(startWS,3000);
}
startWS();

// --- Animate Numbers ---
function animate(){
  const lerp = (a,b,f)=>a+(b-a)*f;

  // Price
  const oldPrice = displayedPrice;
  displayedPrice=lerp(displayedPrice,targetPrice,0.1);
  if(Math.abs(displayedPrice-oldPrice)>0.00001){ colorNumber(priceEl,displayedPrice,oldPrice,4);
    const delta=((displayedPrice-price24hOpen)/price24hOpen)*100;
    price24hEl.innerText=(delta>0?"▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
    price24hEl.className="sub "+(delta>0?"up":delta<0?"down":""); }

  // Price bar
  const center=50;
  const percent=Math.min(Math.abs(displayedPrice-price24hOpen)/Math.max(price24hHigh-price24hLow,0.0001)*50,50);
  let linePos=displayedPrice>=price24hOpen?center+percent:center-percent;
  priceBarEl.style.left=`${displayedPrice>=price24hOpen?center:linePos}%`;
  priceBarEl.style.width=`${displayedPrice>=price24hOpen?linePos-center:center-linePos}%`;
  priceBarEl.style.background=displayedPrice>=price24hOpen?"linear-gradient(to right,#22c55e,#10b981)":"linear-gradient(to right,#ef4444,#f87171)";
  priceLineEl.style.left=`${linePos}%`;

  priceMinEl.innerHTML = `<span style="font-size:0.9rem;color:#9ca3af">${price24hLow.toFixed(3)}</span>`;
  priceOpenEl.innerHTML = `<span style="font-size:0.9rem;color:#9ca3af">${price24hOpen.toFixed(3)}</span>`;
  priceMaxEl.innerHTML = `<span style="font-size:0.9rem;color:#9ca3af">${price24hHigh.toFixed(3)}</span>`;

  // Available
  const oldAvailable=displayedAvailable;
  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  colorNumber(availableEl,displayedAvailable,oldAvailable,6);
  availableUsdEl.innerText=(displayedAvailable*displayedPrice).toFixed(2);

  // Stake
  const oldStake=displayedStake;
  displayedStake=lerp(displayedStake,stakeInj,0.1);
  colorNumber(stakeEl,displayedStake,oldStake,4);
  stakeUsdEl.innerText=(displayedStake*displayedPrice).toFixed(2);

  // Rewards
  const oldRewards=displayedRewards;
  displayedRewards=lerp(displayedRewards,rewardsInj,0.1);
  colorNumber(rewardsEl,displayedRewards,oldRewards,7);
  rewardsUsdEl.innerText=(displayedRewards*displayedPrice).toFixed(2);

  const rewardPercent=Math.min(displayedRewards/0.05*100,100);
  rewardBarEl.style.width=rewardPercent+"%";
  rewardPercentEl.innerText=rewardPercent.toFixed(1)+"%";

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // Last update
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// --- Color Number ---
function colorNumber(el,value,oldValue,decimals){
  const newVal=value.toFixed(decimals);
  const oldVal=oldValue.toFixed(decimals);
  let html='';
  for(let i=0;i<newVal.length;i++){
    html+=`<span style="color:${newVal[i]!==oldVal[i]?newVal[i]>oldVal[i]?'#22c55e':'#ef4444':'#f9fafb'}">${newVal[i]}</span>`;
  }
  el.innerHTML=html;
}
