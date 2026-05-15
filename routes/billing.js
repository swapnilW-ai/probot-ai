const express=require('express');
const crypto=require('crypto');
const router=express.Router();
const razorpay=require('../api/services/razorpay');
const {createClient}=require('@supabase/supabase-js');

const supabase=createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_PRICES={
starter:100,
growth:299900,
pro:599900
};

router.get('/test',(req,res)=>{

res.json({
success:true,
message:'Billing routes working'
});

});

router.post('/create-order',async(req,res)=>{

try{

const {plan}=req.body;

if(!PLAN_PRICES[plan]){

return res.status(400).json({
success:false,
error:'Invalid plan'
});

}

const order=await razorpay.orders.create({
amount:PLAN_PRICES[plan],
currency:'INR',
receipt:`receipt_${Date.now()}`
});

res.json({
success:true,
order,
key:process.env.RAZORPAY_KEY_ID
});

}catch(err){

console.error(err);

res.status(500).json({
success:false,
error:'Failed to create order'
});

}

});

router.post('/verify',async(req,res)=>{

try{

const {
razorpay_order_id,
razorpay_payment_id,
razorpay_signature,
plan,
agent_id
}=req.body;

const generatedSignature=crypto
.createHmac(
'sha256',
process.env.RAZORPAY_KEY_SECRET
)
.update(
`${razorpay_order_id}|${razorpay_payment_id}`
)
.digest('hex');

if(generatedSignature!==razorpay_signature){

return res.status(400).json({
success:false,
error:'Invalid signature'
});

}

const PLAN_PRICES={
starter:999,
growth:2999,
pro:5999
};

const startDate=new Date();

const endDate=new Date();

endDate.setDate(endDate.getDate()+30);

const {error}=await supabase
.from('subscriptions')
.insert([{
agent_id,
plan_name:plan,
status:'active',
amount:PLAN_PRICES[plan],
start_date:startDate,
end_date:endDate,
razorpay_order_id,
razorpay_payment_id
}]);

if(error){

console.error(error);

return res.status(500).json({
success:false,
error:'DB insert failed'
});

}

res.json({
success:true,
message:'Payment verified and subscription saved'
});

}catch(err){

console.error(err);

res.status(500).json({
success:false,
error:'Verification failed'
});

}

});

router.get('/current/:agentId',async(req,res)=>{

try{

const {agentId}=req.params;

const {data,error}=await supabase
.from('subscriptions')
.select('*')
.eq('agent_id',agentId)
.eq('status','active')
.order('created_at',{ascending:false})
.limit(1)
.single();

if(error){

return res.status(404).json({
success:false,
error:'No subscription found'
});

}

res.json(data);

}catch(err){

console.error(err);

res.status(500).json({
success:false,
error:'Failed to fetch subscription'
});

}

});

module.exports=router;
