let address = localStorage.getItem("inj_address") || "";

let targetPrice = 0, displayedPrice = 0;
let price24hOpen = 0, price24hLow = 0, price24hHigh = 0;

let availableInj = 0, stakeInj = 0, rewardsInj = 0;
let displayedAvailable = 0, displayedStake = 0, displayedRewards = 0;
let apr = 0;

let chart, chartData = [], ws;

const $ = id => document.getElementById(id);
const lerp = (a,b,f)=>a+(b-a)*f;

// COLOR NUMBERS
function colorNumber(el, n, o, d){
  const ns=n.toFixed(d), os=o.toFixed(d);
  el.innerHTML=[...ns].map((c,i)=>
    c!==os[i]
      ? `<span style="color:${n>o?'#22c55e':'#ef4444'}">${c}</span>`
      : `<span>${c}</span>`
  ).join("");
}

// FETCH JSON
async function fetchJSON(url){
  try{ return await (await fetch(url)).json(); }
  catch{ return {}; }
}

// STATUS INDICATOR
const setStatus = (online)=>{
  const s = $("statusIndicator");
  if(online){
    s.className = "status online";
    s.querySelector(".text").textContent = "Online";
  } else {
    s.className = "status offline";
    s.querySelector(".text").textContent = "Offline";
  }
};

// ADDRESS INPUT
$("addressInput").value = address;
$("addressInput").onchange = e=>{
  address=e.target.value.trim();
  localStorage.setItem("inj_address",address);
  loadAccount();
};

// LOAD ACCOUNT DATA
async function loadAccount(){
  if(!address) return;

  const [b,s,r,i] = await Promise.all([
    fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`),
    fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`),
    fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`),
    fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`)
  ]);

  availableInj = (b.balances?.find(x=>x.denom==="inj")?.amount||0)/1e18;
  stakeInj = (s.delegation_responses||[])
    .reduce((a,d)=>a+Number(d.balance.amount),0)/1e18;

  rewardsInj = (r.rewards||[])
    .reduce((a,v)=>a+v.reward.reduce((s,x)=>s+Number(x.amount),0),0)/1e18;

  apr = Number(i.inflation||0)*100;
}
loadAccount();
setInterval(loadAccount,60000);

// FETCH 24H HISTORY
async function fetchHistory(){
  const d = await fetchJSON(
    "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=5m&limit=288"
  ); // 24h / 5min = 288
  chartData = d.map(c=>+c[4]);
  price24hOpen = +d[0][1];
  price24hLow = Math.min(...chartData);
  price24hHigh = Math.max(...chartData);
  targetPrice = chartData.at(-1);
  if(!chart) initChart();
}
fetchHistory();
setInterval(fetchHistory, 300000); // ogni 5 minuti

// INIT CHART
function initChart(){
  const ctx=$("priceChart").getContext("2d");
  chart=new Chart(ctx,{
    type:"line",
    data:{labels:Array(chartData.length).fill(""),
      datasets:[{data:chartData,borderColor:"#22c55e",
        backgroundColor:"rgba(34,197,94,0.2)",
        fill:true,pointRadius:0,tension:0.3}]},
    options:{responsive:true,maintainAspectRatio:false,
      animation:false,plugins:{legend:{display:false}},
      scales:{x:{display:false},y:{ticks:{color:"#9ca3af"}}}}
  });
}
function updateChart(p){
  if(!chart) return;
  chart.data.datasets[0].data.push(p);
  chart.data.datasets[0].data.shift();
  chart.update("none");
}

// WEBSOCKET
function startWS(){
  if(ws) ws.close();
  ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");

  ws.onopen = () => setStatus(true);

  ws.onmessage = e=>{
    const p=+JSON.parse(e.data).p;
    targetPrice=p;
    price24hHigh=Math.max(price24hHigh,p);
    price24hLow=Math.min(price24hLow,p);
    updateChart(p);
  };

  ws.onclose=()=>{
    setStatus(false);
    setTimeout(startWS,3000);
  };

  ws.onerror=()=>{
    setStatus(false);
    ws.close();
  };
}
startWS();

// ANIMATION LOOP
function animate(){
  // PRICE
  const old=displayedPrice;
  displayedPrice=lerp(displayedPrice,targetPrice,0.1);
  colorNumber($("price"),displayedPrice,old,4);

  const d=((displayedPrice-price24hOpen)/price24hOpen)*100;
  $("price24h").textContent=`${d>0?"▲":"▼"} ${Math.abs(d).toFixed(2)}%`;
  $("price24h").className="sub "+(d>0?"up":"down");

  $("priceMin").textContent=price24hLow.toFixed(3);
  $("priceOpen").textContent=price24hOpen.toFixed(3);
  $("priceMax").textContent=price24hHigh.toFixed(3);

  // PRICE BAR - linea gialla trascina la barra
const priceRange = price24hHigh - price24hLow;
const centerPercent = ((price24hOpen - price24hLow)/priceRange) * 100; // posizione centrale
const currentPercent = ((displayedPrice - price24hLow)/priceRange) * 100;

if(displayedPrice >= price24hOpen){
  // prezzo sopra apertura -> barra verde dalla apertura alla linea gialla
  $("priceLine").style.left = currentPercent + "%";
  $("priceLine").style.background = "#facc15";

  $("priceBar").style.left = centerPercent + "%";
  $("priceBar").style.width = (currentPercent - centerPercent) + "%";
  $("priceBar").style.background = "linear-gradient(to right, #22c55e, #10b981)";
} else {
  // prezzo sotto apertura -> barra rossa dalla apertura alla linea gialla
  $("priceLine").style.left = currentPercent + "%";
  $("priceLine").style.background = "#f87171";

  $("priceBar").style.left = currentPercent + "%";
  $("priceBar").style.width = (centerPercent - currentPercent) + "%";
  $("priceBar").style.background = "linear-gradient(to left, #ef4444, #f87171)";
}

  // AVAILABLE
  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  colorNumber($("available"),displayedAvailable,availableInj,6);
  $("availableUsd").textContent=`≈ $${(displayedAvailable*displayedPrice).toFixed(2)}`;

  // STAKE
  displayedStake=lerp(displayedStake,stakeInj,0.1);
  colorNumber($("stake"),displayedStake,stakeInj,4);
  $("stakeUsd").textContent=`≈ $${(displayedStake*displayedPrice).toFixed(2)}`;

  // REWARDS
  displayedRewards=lerp(displayedRewards,rewardsInj,0.1);
  colorNumber($("rewards"),displayedRewards,rewardsInj,7);
  $("rewardsUsd").textContent=`≈ $${(displayedRewards*displayedPrice).toFixed(2)}`;

  $("rewardBar").style.width=Math.min(displayedRewards/0.05*100,100)+"%";
  $("rewardPercent").textContent=(displayedRewards/0.05*100).toFixed(1)+"%";

  // APR
  $("apr").textContent=apr.toFixed(2)+"%";

  // LAST UPDATE
  $("updated").textContent="Last update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
