import express from 'express'
import whatsappBotRoutes from "./whatsappBotRoutes";


const apiRoutes = express.Router()
    .use("/users", whatsappBotRoutes)
   

export default apiRoutes;