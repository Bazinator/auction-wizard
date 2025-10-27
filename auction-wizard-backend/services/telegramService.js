const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat_id = process.env.TELEGRAM_CHAT_ID;

const sendSniperNotification = async (item, type) => {
  try {
    const message = `🎯 *Sniped an Item!*\n\n` +
      `We found a *${item.name}* ${type === 'auction' ? 'in an auction' : 'on the market'}!\n\n` +
      ` *Price:* $${item.price}\n` +
      ` *Float:* ${item.float.toFixed(4)}\n` +
      ` *Buff Price:* $${item.buffPrice}\n` +
      ` *Potential Profit:* $${(item.buffPrice - item.price).toFixed(2)}\n\n` +
      ` *Type:* ${type.charAt(0).toUpperCase() + type.slice(1)} Listing`;

    const sendMessageUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = await axios.post(sendMessageUrl, {
      chat_id: chat_id,
      text: message,
      parse_mode: 'Markdown'
    });

    if (response.status === 200) {
      console.log(`Notification sent for ${item.name}`);
    } else {
      console.error('Failed to send notification:', response.data);
    }
  } catch (error) {
    console.error('Error sending telegram notification:', error.message);
  }
};

module.exports = { sendSniperNotification };
