
import { generateSmsAlert } from './geminiService';

/**
 * This service handles the "Actual" delivery of messages.
 * For a production app, you would use an API like Twilio here.
 */

export interface SmsRecipient {
    name: string;
    phoneNumber: string;
}

export const requestSmsPermissions = async () => {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }
    if (Notification.permission !== "denied") {
        await Notification.requestPermission();
    }
};

export const sendActualSms = async (to: SmsRecipient, message: string): Promise<boolean> => {
    // --- REAL WORLD INTEGRATION (e.g. Twilio) ---
    /*
    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + btoa('YOUR_SID:YOUR_AUTH_TOKEN') },
        body: new URLSearchParams({
            'To': to.phoneNumber,
            'From': '+1234567890',
            'Body': message
        })
    });
    return response.ok;
    */

    // --- BROWSER SIMULATION (System Level Popups) ---
    if (Notification.permission === "granted") {
        new Notification(`SMS to ${to.name} (${to.phoneNumber})`, {
            body: message,
            icon: 'https://cdn-icons-png.flaticon.com/512/889/889102.png'
        });
        return true;
    }

    console.log(`[SMS Gateway] To: ${to.phoneNumber} | Msg: ${message}`);
    return true; // Simulate success
};

export const broadcastMilestone = async (
    actorName: string,
    milestone: number,
    earnings: number,
    recipients: SmsRecipient[]
) => {
    const message = await generateSmsAlert(actorName, milestone, earnings);

    const results = await Promise.all(recipients.map(async (r) => {
        const success = await sendActualSms(r, message);
        return { ...r, message, success, timestamp: new Date().toISOString() };
    }));

    return results;
};
