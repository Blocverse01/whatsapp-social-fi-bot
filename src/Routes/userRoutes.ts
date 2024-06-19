import UserController from '@/User/UserController';
import express from 'express';



const userRouter = express.Router();

userRouter
    .post('/messages/webhook', UserController.userWebhook)
    .get('/messages/webhook', UserController.userWebHookVerification)

export default userRouter;
