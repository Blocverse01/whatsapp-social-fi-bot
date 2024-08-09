import { PHONE_NUMBER_IDS } from '@/config/whatsAppPhoneNumbers';
import { FlowMode } from '@/app/WhatsAppBot/WhatsAppFlows/types';

type PhoneNumberId = (typeof PHONE_NUMBER_IDS)[keyof typeof PHONE_NUMBER_IDS];

type Flows = 'ONRAMP' | 'OFFRAMP' | 'TRANSFER' | 'ADD_BENEFICIARY';

type FlowConfigs = {
    [key in Flows]: {
        [key in PhoneNumberId]: {
            flowId: string;
            flowMode: FlowMode;
        }; // WA_PHONE_NUMBER_ID -> Flow ID, Flow Mode
    };
};

const flowConfigs: FlowConfigs = {
    ONRAMP: {
        [PHONE_NUMBER_IDS.TEST_PHONE_NUMBER_ID]: {
            flowId: '457607423727887',
            flowMode: 'draft',
        },
        [PHONE_NUMBER_IDS.AMARA_FROM_AZZA_PHONE_NUMBER_ID]: {
            flowId: '',
            flowMode: 'draft',
        },
    },
    OFFRAMP: {
        [PHONE_NUMBER_IDS.TEST_PHONE_NUMBER_ID]: {
            flowId: '1011245846972252',
            flowMode: 'draft',
        },
        [PHONE_NUMBER_IDS.AMARA_FROM_AZZA_PHONE_NUMBER_ID]: {
            flowId: '',
            flowMode: 'draft',
        },
    },
    TRANSFER: {
        [PHONE_NUMBER_IDS.TEST_PHONE_NUMBER_ID]: {
            flowId: '464881709776668',
            flowMode: 'draft',
        },
        [PHONE_NUMBER_IDS.AMARA_FROM_AZZA_PHONE_NUMBER_ID]: {
            flowId: '',
            flowMode: 'draft',
        },
    },
    ADD_BENEFICIARY: {
        [PHONE_NUMBER_IDS.TEST_PHONE_NUMBER_ID]: {
            flowId: '482861261039877',
            flowMode: 'published',
        },
        [PHONE_NUMBER_IDS.AMARA_FROM_AZZA_PHONE_NUMBER_ID]: {
            flowId: '',
            flowMode: 'draft',
        },
    },
};

export const getFlowConfig = (flow: Flows, phoneNumberId: PhoneNumberId) => {
    return flowConfigs[flow][phoneNumberId];
};
