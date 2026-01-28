let address = localStorage.getItem("inj_address")||"";
let displayedPrice=0,targetPrice=0,price24hOpen=0,price24hLow=0,price24hHigh=0;
let stakeInj=0,displayedStake=0;
let rewardsInj=0,displayedRewards=0;
let availableInj=0,displayedAvailable=0;
let apr=0;

let chart,chartData=[];
const rewardMax=0.05;

const addressInput=document.getElementById("addressInput");
const priceEl=document.getElementById("price");
const price24hEl=document.getElementById("price24h");
const priceBarEl=document.getElementById("priceBar");
const priceLineEl=document.getElementById("priceCurrentLine");
const priceMinEl=document.getElementById("priceMin");
const priceMaxEl=document.getElementById("priceMax");
const priceOpenEl=document.getElementById("priceOpen");

const availableEl=document.getElementById("available");
const availableUsdEl=document.getElementById("availableUsd");

const stakeEl=document.getElementById("stake");
const stakeUsdEl=document.getElementById("stakeUsd");

const rewardsEl=document.getElementById("rewards");
const rewardsUsdEl=document.getElementById("rewardsUsd");
const rewardBarEl=document.getElementById("rewardBar");
const rewardPercentEl=document.getElementById("rewardPercent");

const aprEl=document.getElementById("apr");
const updatedEl=document.getElementById("updated");

addressInput.value=address;
addressInput.onchange=e=>{address=e.target.value.trim();localStorage.setItem("inj_address",address);loadData();};

// Helper
const fetchJSON=async url=>{try{const res=await fetch(url);return await res.json();}catch(e){console.error("Fetch error:",url,e);return{};}};

// Carattere singolo con colore
function setAnimatedNumber(el,oldV,newV,fixed){
  const oldStr=oldV.toFixed(fixed);
  const newStr=newV.toFixed(fixed);
  let html="";
  for(let i=0;i<newStr.length;i++){
    const oldC=oldStr[i]||"";
    const newC=newStr[i];
    let spanClass="";
    if(oldC!==newC){
      if(!isNaN(newC)){
        spanClass=newC>oldC?"up":newC<oldC?"down":"";
      }
    }
    html+=`<span class="${spanClass}">${newC}</span>`;
  }
  el.innerHTML=html;
}

// Load Injective
async function loadData(){
  if(!address) return;
  try{
    const balanceRes=await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance=balanceRes.balances?.find(b=>b.denom==="inj");
    availableInj=injBalance?Number(injBalance.amount)/1e18:0;

    const stakeRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj=stakeRes.delegation_responses?.reduce((sum,d)=>sum+Number(d.balance.amount||0),0)/1e18||0;

    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj=rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;

    const inflationRes=await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded=Number(poolRes.pool?.bonded_tokens||0);
    const notBonded=Number(poolRes.pool?.not_bonded_tokens||0);
    apr=(inflationRes.inflation*(bonded+notBonded)/bonded)*100;

  }catch(e){console.error("Errore caricamento dati Injective:",e);}
}
loadData();setInterval(loadData,60000);

// Price History
async function fetchHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d=await res.json();
    chartData=d.map(c=>+c[4]);
    price24hOpen=+d[0][1];
    price24hLow=Math.min(...chartData);
    price24hHigh=Math.max(...chartData);
    targetPrice=chartData.at(-1);
    drawChart();
  }catch(e){console.error("Errore price history:",e);}
}
fetchHistory();

// Draw Chart
function drawChart(){
  const ctx=document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{type:"line",data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}});
}

// Binance WS
function startWS(){
  const ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>{
    const p=+JSON.parse(e.data).p;
    targetPrice=p;
    if(p>price24hHigh) price24hHigh=p;
    if(p<price24hLow) price24hLow=p;
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// Animate
function animate(){
  // Price
  displayedPrice+= (targetPrice-displayedPrice)*0.2;

  setAnimatedNumber(priceEl,displayedPrice,displayedPrice,4);

  // Delta %
  const delta=((displayedPrice-price24hOpen)/price24hOpen)*100;
  price24hEl.innerText=(delta>0?"▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
  price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");

  // Price bar TradingView-style
  const range=price24hHigh-price24hLow||1;
  const openPercent=(price24hOpen-price24hLow)/range*100;
  const pricePercent=(displayedPrice-price24hLow)/range*100;

  if(displayedPrice>=price24hOpen){
    priceBarEl.style.left=openPercent+"%";
    priceBarEl.style.width=(pricePercent-openPercent)+"%";
    priceBarEl.style.background="#22c55e";
  }else{
    priceBarEl.style.left=pricePercent+"%";
    priceBarEl.style.width=(openPercent-pricePercent)+"%";
    priceBarEl.style.background="#ef4444";
  }

  priceLineEl.style.left=pricePercent+"%";

  // Min / Open / Max
  setAnimatedNumber(priceMinEl,price24hLow,price24hLow,4);
  setAnimatedNumber(priceMaxEl,price24hHigh,price24hHigh,4);
  setAnimatedNumber(priceOpenEl,price24hOpen,price24hOpen,4);

  // Available
  displayedAvailable+=(availableInj-displayedAvailable)*0.1;
  setAnimatedNumber(availableEl,displayedAvailable,displayedAvailable,6);
  setAnimatedNumber(availableUsdEl,displayedAvailable*displayedPrice,displayedAvailable*displayedPrice,2);

  // Stake
  displayedStake+=(stakeInj-displayedStake)*0.1;
  setAnimatedNumber(stakeEl,displayedStake,displayedStake,4);
  setAnimatedNumber(stakeUsdEl,displayedStake*displayedPrice,displayedStake*displayedPrice,2);

  // Rewards
  displayedRewards+=(rewardsInj-displayedRewards)*0.05;
  setAnimatedNumber(rewardsEl,displayedRewards,displayedRewards,6);
  setAnimatedNumber(rewardsUsdEl,displayedRewards*displayedPrice,displayedRewards*displayedPrice,2);

  // Reward bar
  const rewardPercent=Math.min(displayedRewards/rewardMax*100,100);
  rewardBarEl.style.width=rewardPercent+"%";
  rewardPercentEl.innerText=rewardPercent.toFixed(1)+"%";

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // Last Update
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// Aggiorna rewards ogni 3s
setInterval(async ()=>{
  if(!address) return;
  try{
    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj=rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;
  }catch(e){ console.error("Errore aggiornamento rewards:",e);}
},3000);
