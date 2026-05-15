require('dotenv').config();

const express=require('express');
const cors=require('cors');

const app=express();

app.use(cors());

app.use(express.json());

const billingRoutes=require('../routes/billing');

app.use('/api/billing',billingRoutes);

app.get('/',(req,res)=>{
res.send('Backend Running');
});

const PORT=process.env.PORT||3000;

app.listen(PORT,()=>{
console.log(`Server running on ${PORT}`);
});
