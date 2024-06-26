import express from 'express';
import whatsappBotRoutes from './whatsappBotRoutes';
import sumSubRoutes from '@/Routes/sumSubRoutes';

const apiRoutes = express.Router().use('/users', whatsappBotRoutes).use('/sum-sub', sumSubRoutes);

export default apiRoutes;
