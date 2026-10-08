const { sendContactMessage } = require('../services/emailService');

async function submitContactMessage(req, res) {
  try {
    const mailResult = await sendContactMessage(req.body);
    return res.json({
      success: true,
      message: 'Your message was sent to our support team.',
      messageId: mailResult.messageId,
    });
  } catch (error) {
    console.error('[ContactController] Contact email delivery failed:', error);
    return res.status(502).json({
      success: false,
      error: 'We could not send your message right now. Please try again later or email support directly.',
    });
  }
}

module.exports = { submitContactMessage };
