import express from 'express';
import whatsappBotRoutes from './whatsappBotRoutes';
import sumSubRoutes from '@/Routes/sumSubRoutes';
import fiatRampRoutes from '@/Routes/fiatRampRoutes';

const apiRoutes = express
    .Router()
    .use('/whatsapp', whatsappBotRoutes)
    .use('/sum-sub', sumSubRoutes)
    .use('/fiat-ramp', fiatRampRoutes);

export default apiRoutes;
