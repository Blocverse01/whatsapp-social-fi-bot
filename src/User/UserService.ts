import { INTERNAL_SERVER_ERROR } from "@/constants/status-codes";
import { dbClient } from "@/Db/dbClient"
import { HttpException } from "@/Resources/exceptions/HttpException";
import env from '@/constants/env';
import { createRequestOptions } from "@/Resources/HttpRequest";
import axios from "axios";


class UserService{

    private USER_TABLE = dbClient.User;

   async createUser(phoneNumber : string, displayName : string ) {
       try {
           const user = await this.getUser(phoneNumber);
           if (user) {
                await this.USER_TABLE.create({
                    'phoneNumber': phoneNumber
                });
           } else {
               
           }
       } catch (error) {
            throw new HttpException(INTERNAL_SERVER_ERROR, `User not found`);
       }
   }
    
    async getUser(phoneNumber: string) {
        const record = await this.USER_TABLE
            .filter({ phoneNumber }).getFirst();
        return !!record;
    }

    async markMassageAsRead(businessPhoneNumberId: string) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const data = {
            messaging_product: "whatsapp",
            status: "read",
            message_id: 'ngnnng', // Replace with the actual message ID
        };

        // Create request options with error handling (assuming createRequestOptions doesn't handle errors)
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
             const response = await axios.post(
                `${env.CLOUD_API_URL}${endpoint}`,
                data,
                requestOptions
            );
            console.log("Message marked as read successfully:", response.data); // Handle successful response (optional)
        } catch (error) {
            console.error("Error marking message as read:", error); // Handle errors
        }
    }


}

export default new UserService();