
export enum WhatsAppMessageType {
  TEXT = 'text',
  STICKER = 'sticker',
  INTERACTIVE = 'interactive'
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
    type: 'button';
    body: {
      text: string;
    };
    action: {
      buttons: WhatsAppInteractiveButton[];
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

