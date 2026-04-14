import dotenv from 'dotenv'
import connectDB from "./db/index.js";
import app from './app.js';

const PORT = process.env.PORT || 8000;

dotenv.config({
    path: "./.env"
})

connectDB()
.then(()=>{
        app.listen(PORT, ()=>{
            console.log(`server started on port http://localhost:${PORT}`)
        })
        
})
.catch((err)=>{
    console.log("MongoDB connection failed !! ", err)
})