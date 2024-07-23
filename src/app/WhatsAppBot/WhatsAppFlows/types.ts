import { WhatsAppInteractiveMessage } from '@/app/WhatsAppBot/WhatsAppBotType';

export type FlowMode = Required<
    WhatsAppInteractiveMessage['interactive']['action']
>['parameters']['mode'];
