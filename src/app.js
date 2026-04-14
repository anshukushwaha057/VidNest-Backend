import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

// middle-ware configure
// CORS allows or restricts cross-origin requests between different domains.
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))


app.use(express.json({ limit: "16kb" }))

app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))

//favicons and images
app.use(express.static("public")) // ../public file

app.use(cookieParser()); // Enable cookie parsing


// router import 
import userRouter from "./routes/user.routes.js"
import subscribeRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"


// routes declaration
app.use("/api/v1/user", userRouter) // prefix
app.use("/api/v1/subscription", subscribeRouter) 
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)



export default app