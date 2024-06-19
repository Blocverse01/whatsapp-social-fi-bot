import express from 'express'
import userRouter from "./userRoutes";


const apiRoutes = express.Router()
    .use("/users", userRouter)
   

export default apiRoutes;