const express=require('express');
const crypto=require('crypto');
const router=express.Router();
const razorpay=require('../api/services/razorpay');

const PLAN_PRICES={
starter:99900,
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
razorpay_signature
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

res.json({
success:true,
message:'Payment verified'
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

const {agentId}=req.params;

res.json({
agentId,
plan_name:'starter',
status:'active',
end_date:'2026-06-15'
});

});

module.exports=router;
