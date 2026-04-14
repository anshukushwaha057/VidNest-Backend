import mongoose from "mongoose";
import {DB_NAME} from '../constants.js'


const connectDB = async ()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected : DB Host : ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MONGODB connection FAILED", error);
        process.exit(1) // process reference
    }
}

export default connectDB;




/* import express from 'express'
;(async()=>{
    try {
      await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`) 
      app.on('error',(error)=>{
        console.log("Error", error);
        throw error 
      }) 

      app.listen(process.env.PORT,()=>{
        console.log(`app listening on port http://localhost:${process.env.PORT}`)
      })

    } catch (error) {
        console.error("ERROR", error)
    }
})() */