export enum WhatsAppMessageType {
    TEXT = 'text',
    STICKER = 'sticker',
    INTERACTIVE = 'interactive',
    // Add more message types here as needed (e.g., IMAGE, VIDEO, AUDIO, etc.)
}

interface WhatsAppMessageBase {
    messaging_product: 'whatsapp';
    recipient_type: 'individual';
    to: string; // Replace with actual phone number type
}

export interface WhatsAppInteractiveButton {
    type: 'reply';
    reply: {
        id: string;
        title: string;
    };
}

export interface WhatsAppInteractiveMessage extends WhatsAppMessageBase {
    type: 'interactive';
    interactive: {
        type: 'button' | 'list';
        body: {
            text: string;
        };
        header?: {
            type: string;
            text: string;
        };
        action: {
            buttons?: WhatsAppInteractiveButton[];
            button?: string;
            sections?: Array<{
                rows: Array<{
                    id: string;
                    title: string;
                    description?: string;
                }>;
            }>;
        };
    };
}

export interface WhatsAppTextMessage extends WhatsAppMessageBase {
    type: WhatsAppMessageType.TEXT;
    text: {
        preview_url: false;
        body: string;
    };
}

export enum BaseInteractiveButtonIds {
    CREATE_WALLET = 'create-wallet',
}

export enum AssetInteractiveButtonIds {
    ETH_BASE = 'eth-base',
    USDC_BASE = 'usdc-base',
    MATIC_POLYGON = 'matic-polygon',
    USDT_POLYGON = 'usdt-polygon',
}

export enum ExploreAssetActions {
    BUY_ASSET = 'buy',
    DEPOSIT = 'deposit',
    WITHDRAW_ASSET = 'withdraw',
    SELL_ASSET = 'sell',
}

export const assetInteractiveButtonsIds = Object.values(AssetInteractiveButtonIds);

export const exploreAssetActions = Object.values(ExploreAssetActions);

const actions = exploreAssetActions.join('|');
const assetIds = assetInteractiveButtonsIds.join('|');

// Create the regex pattern
export const ASSET_ACTION_REGEX_PATTERN = `^(${actions}):(${assetIds})$`;

// Create the regex object
export const ASSET_ACTION_REGEX = new RegExp(ASSET_ACTION_REGEX_PATTERN);

export const RATES_COMMAND = 'rates';

type AssetAction = {
    text: string;
    action: string;
    description: string;
};

export const manageAssetActions: Array<AssetAction> = [
    {
        text: 'Buy With Fiat',
        action: ExploreAssetActions.BUY_ASSET,
        description: 'Buy asset with your local currency',
    },
    {
        text: 'Deposit From Wallet',
        action: ExploreAssetActions.DEPOSIT,
        description: 'Deposit asset from a wallet outside BlocPal',
    },
    {
        text: 'Withdraw To Wallet',
        action: ExploreAssetActions.WITHDRAW_ASSET,
        description: 'Send asset to a wallet outside BlocPal',
    },
    {
        text: 'Withdraw as Fiat',
        action: ExploreAssetActions.SELL_ASSET,
        description: 'Withdraw asset to your local currency',
    },
];

export type InteractiveButtonReplyTypes =
    | 'create-wallet'
    | 'explore-asset'
    | 'demo-withdraw-amount-to-beneficiary';
export type InteractiveListReplyTypes = 'explore-asset-action' | 'demo-withdraw-to-beneficiary';

export type AssetActionRegexGroups = {
    [key in ExploreAssetActions]?: string;
};
