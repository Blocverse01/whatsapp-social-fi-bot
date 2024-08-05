import { WhatsAppInteractiveMessage } from '@/app/WhatsAppBot/WhatsAppBotType';

export type FlowMode = Required<
    WhatsAppInteractiveMessage['interactive']['action']
>['parameters']['mode'];

export type DropdownOption = {
    title: string;
    id: string;
    description?: string;
};
