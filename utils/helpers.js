// Utility functions for the application

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
function validatePhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.startsWith('62') && cleanPhone.length >= 10 && cleanPhone.length <= 15;
}

/**
 * Format phone number to standard format
 * @param {string} phone - Phone number to format
 * @returns {string} - Formatted phone number
 */
function formatPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('62')) {
        return cleanPhone;
    } else if (cleanPhone.startsWith('0')) {
        return '62' + cleanPhone.substring(1);
    } else {
        return '62' + cleanPhone;
    }
}

/**
 * Personalize message with contact data
 * @param {string} message - Template message
 * @param {Object} contact - Contact data
 * @returns {string} - Personalized message
 */
function personalizeMessage(message, contact) {
    let personalized = message;
    
    // Replace placeholders with contact data
    if (contact.name) {
        personalized = personalized.replace(/{{name}}/g, contact.name);
        personalized = personalized.replace(/{{nama}}/g, contact.name); // Indonesian variant
    }
    
    if (contact.company) {
        personalized = personalized.replace(/{{company}}/g, contact.company);
        personalized = personalized.replace(/{{perusahaan}}/g, contact.company); // Indonesian variant
    }
    
    if (contact.phone) {
        personalized = personalized.replace(/{{phone}}/g, contact.phone);
    }
    
    return personalized;
}

/**
 * Generate random delay between min and max
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {number} - Random delay
 */
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
