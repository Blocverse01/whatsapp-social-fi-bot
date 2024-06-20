import { createRequestOptions } from '@/Resources/HttpRequest';
import { WhatsAppInteractiveButton, WhatsAppInteractiveMessage } from './WhatsAppBotType';
import axios, { isAxiosError } from 'axios';
import env from '@/constants/env';
import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { HttpException } from '@/Resources/exceptions/HttpException';
import UserService from '@/User/UserService';
import logger from '@/Resources/logger';
import {UserAssetItem } from '@/User/userSchema';
import { BankBeneficiary, MobileMoneyBeneficiary, UsersBeneficiaries } from '@/app/FiatRamp/fiatRampSchema';

class WhatsAppBotService {
    public static async sendWhatsappMessage(method: string, endpoint: string, data: object) {
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
            const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );

            logger.info('Message sent successfully');
        } catch (error) {
            let message = 'Failed to send message';

            if (isAxiosError(error)) {
                logger.error('Error sending message', { errorResponse: error.response });
                message = error.response?.data?.message;
            }

            throw new HttpException(INTERNAL_SERVER_ERROR, message);
        }
    }

    public static async listWalletAddressMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string,
        walletAssets: Array<UserAssetItem>,
        accountType: string
    ) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const text =
            accountType === 'new_account'
                ? `Congrats ${displayName}, welcome aboard 🎉\n\nWe've created decentralized wallets for you. It's like opening a digital piggy bank! 🐷💰.\n\nClick on an asset to display the wallet address and balance`
                : `Click on an asset to display the wallet address and balance`;

        const walletAssetsButton: WhatsAppInteractiveButton[] = walletAssets
            .map((asset) => ({
                type: 'reply' as const,
                reply: {
                    id: asset.listItemId,
                    title: asset.name,
                },
            }))
            .slice(0, 2);

        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: text,
                },
                action: {
                    buttons: walletAssetsButton,
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    public static async listBeneficiaryMessage(
        businessPhoneNumberId: string,
        recipient: string,
        usersBeneficiaries: UsersBeneficiaries,
        assetId : string
    ) {

        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;

        const interactiveMessageList = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "interactive",
            interactive: {
                type: "list",
                body : {
                    text : "Select a beneficiary by clicking the button below."
                },
                header: {
                    type: "text",
                    text: "Choose a Beneficiary"
                },
                action: {
                button: "Beneficiaries",
                    sections: [
                        {
                                rows: usersBeneficiaries.map((beneficiary) => {
                                    let title: string;
                                    let description: string;

                                    if ((beneficiary as MobileMoneyBeneficiary).firstName) {
                                        const mobileMoneyBeneficiaryCast = beneficiary as MobileMoneyBeneficiary;
                                        title = `${mobileMoneyBeneficiaryCast.firstName} ${mobileMoneyBeneficiaryCast.lastName}`
                                        description = `Mobile Number: ${mobileMoneyBeneficiaryCast.firstName}`
                                    } else {
                                        const bankBeneficiaryCast = beneficiary as BankBeneficiary;
                                        title = `${bankBeneficiaryCast.accountName}`
                                        description = `Bank Name: ${bankBeneficiaryCast.bankName} \nAccount Number: ${bankBeneficiaryCast.accountNumber}`
                                    }
                                        return {
                                        id: `${assetId}|beneficiaryId:${beneficiary.id}`,
                                        title: title,
                                        description : description
                                    }
                            })
                        }
                    ]
                }
            }
        }

        await this.sendWhatsappMessage(method, endpoint, interactiveMessageList);
    }

    public static async walletDetailsMessage(
        businessPhoneNumberId: string,
        recipient: string,
        userAssetInfo: {
            usdDisplayBalance: string;
            tokenBalance: string;
            walletAddress: string;
            listItemId: string;
            assetName: string;
            assetNetwork: string;
        }
    ) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const {
            usdDisplayBalance,
            tokenBalance,
            walletAddress,
            listItemId,
            assetName,
            assetNetwork,
        } = userAssetInfo;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `${assetName} Balance 💰: ${usdDisplayBalance} \n Wallet Address: ${walletAddress}`,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: `buy:${listItemId}`,
                                title: 'Deposit to wallet',
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `sell:${listItemId}`,
                                title: 'Withdraw to bank',
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `transfer:${listItemId}`,
                                title: 'Transfer',
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    public static async createWalletMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string
    ) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `Hi ${displayName}! Ready to get started? Let us create a wallet for you.`,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'create-wallet',
                                title: "Let's go 🚀",
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    public static async markMassageAsRead(businessPhoneNumberId: string, messageId: string) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const data = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId, // Replace with the actual message ID
        };

        // Create request options with error handling (assuming createRequestOptions doesn't handle errors)
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
            const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );
            console.log('Message marked as read successfully:', response.data); // Handle successful response (optional)
        } catch (error) {
            console.error('Error marking message as read:', error); // Handle errors
        }
    }

    public static async selectAmountMessage(
        businessPhoneNumberId: string,
        recipient: string,
        beneficiaryId : string
    ) {
        
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `How much would you like to withdraw?`,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: `${beneficiaryId}|amount:2`,
                                title: "$2",
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `${beneficiaryId}|amount:5`,
                                title: "$5",
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `${beneficiaryId}|amount:10`,
                                title: "$10",
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    async walletCreationConfirmationMassage() {}

    public static async isMessageProcessed(messageId: string) {
        try {
            const data = await UserService.getUserByMessageId(messageId);
            return !!data;
        } catch (error) {
            console.error('Error checking processed messages:', error);
        }
    }

    // Function to mark message as processed
    public static async markMessageProcessed(messageId: string): Promise<void> {
        try {
            const data = await UserService.markMessageProcessed(messageId);
        } catch (error) {
            console.error('Error marking message as processed:', error);
        }
    }
}

export default WhatsAppBotService;
