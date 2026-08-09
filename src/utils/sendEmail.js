// const sgMail = require("@sendgrid/mail");

// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const sendEmail = async ({
//   to,
//   subject,
//   html,
// }) => {
//   try {
//     await sgMail.send({
//       to,
//       from: process.env.EMAIL_FROM,
//       subject,
//       html,
//     });

//     return true;
//   } catch (error) {
//     console.error(
//       "SendGrid Error:",
//       error.response?.body || error.message
//     );

//     throw new Error("Failed to send email.");
//   }
// };

// module.exports = sendEmail;

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({
    to,
    subject,
    html,
}) => {
    try {
        await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html,
        });

        return true;
    } catch (error) {
        console.error(
            "Resend Error:",
            error?.message || error
        );

        throw new Error("Failed to send email.");
    }
};

module.exports = sendEmail;
