let agentId=null;
//const agentId=localStorage.getItem('agent_id');

async function upgradePlan(plan){
try{
const res=await fetch('/api/billing/create-order',{
method:'POST',
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({plan})
});

const data=await res.json();

if(!data.success){
alert('Failed to create order');
return;
}

const options={
key:data.key,
amount:data.order.amount,
currency:'INR',
name:'PropBot AI',
description:`${plan} Plan`,
order_id:data.order.id,

handler:async function(response){

await verifyPayment(
response,
plan
);

},

theme:{
color:'#121212'
}
};

const razorpay=new Razorpay(options);

razorpay.open();

}catch(err){

console.error(err);
alert('Something went wrong');

}

}

async function verifyPayment(paymentData,plan){

try{

const res=await fetch('/api/billing/verify',{
method:'POST',
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({
agent_id:agentId,
plan,
razorpay_order_id:paymentData.razorpay_order_id,
razorpay_payment_id:paymentData.razorpay_payment_id,
razorpay_signature:paymentData.razorpay_signature
})
});

const data=await res.json();

if(data.success){

alert('Payment Successful');

loadCurrentPlan();

}else{

alert('Payment Verification Failed');

}

}catch(err){

console.error(err);

}

}

async function loadCurrentPlan(){

try{

const res=await fetch(`/api/billing/current/${agentId}`);

const data=await res.json();

if(!data)return;

document.getElementById('currentPlan').innerText=
data.plan_name;

const endDate=new Date(data.end_date);

document.getElementById('renewDate').innerText=
`Renews on ${endDate.toDateString()}`;

}catch(err){

console.error(err);

}

}

(async()=>{

await window.initApp();

agentId=window.currentAgent?.id;

console.log('Agent ID:',agentId);

if(!agentId){
console.error('Agent ID missing');
return;
}

await loadCurrentPlan();

})();
