import UserController from '@/User/UserController';
import express from 'express';



const userRouter = express.Router();

userRouter
    .post('/messages/webhook', UserController.userWebhook)

export default userRouter;
