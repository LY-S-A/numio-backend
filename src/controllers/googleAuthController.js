// // const { OAuth2Client } = require("google-auth-library");
// // const jwt = require("jsonwebtoken");

// // const User = require("../models/User");

// // const client = new OAuth2Client(
// //   process.env.GOOGLE_CLIENT_ID
// // );

// // // Create JWT
// // const createToken = (id) => {
// //   return jwt.sign(
// //     { id },
// //     process.env.JWT_SECRET,
// //     {
// //       expiresIn: "7d",
// //     }
// //   );
// // };

// // // Google Login
// // exports.googleLogin = async (req, res) => {
// //   try {
// //     const { token } = req.body;

// //     if (!token) {
// //       return res.status(400).json({
// //         message: "Google token is required.",
// //       });
// //     }

// //     // Verify Google Token
// //     const ticket = await client.verifyIdToken({
// //       idToken: token,
// //       audience: process.env.GOOGLE_CLIENT_ID,
// //     });

// //     const payload = ticket.getPayload();

// //     const {
// //       email,
// //       name,
// //       picture,
// //       email_verified,
// //     } = payload;

// //     if (!email_verified) {
// //       return res.status(401).json({
// //         message: "Google email is not verified.",
// //       });
// //     }

// //     // Find existing user
// //     let user = await User.findOne({ email });

// //     // Create user if doesn't exist
// //     if (!user) {
// //       let username = name
// //         .toLowerCase()
// //         .replace(/\s+/g, "");

// //       // Ensure username is unique
// //       let exists = await User.findOne({
// //         username,
// //       });

// //       if (exists) {
// //         username =
// //           username +
// //           Math.floor(
// //             1000 + Math.random() * 9000
// //           );
// //       }

// //       user = await User.create({
// //         username,
// //         email,
// //         password: "",
// //         verified: true,
// //       });
// //     }

// //     const jwtToken = createToken(user._id);

// //     res.status(200).json({
// //       message: "Google login successful.",
// //       token: jwtToken,
// //       user: {
// //         id: user._id,
// //         username: user.username,
// //         email: user.email,
// //         wallet: user.wallet,
// //         verified: user.verified,
// //         role: user.role,
// //       },
// //     });
// //   } catch (err) {
// //     console.error(err);

// //     res.status(500).json({
// //       message: "Google authentication failed.",
// //     });
// //   }
// // };

// const { OAuth2Client } = require("google-auth-library");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const client = new OAuth2Client(
//   process.env.GOOGLE_CLIENT_ID
// );

// const createToken = (id) => {
//   return jwt.sign(
//     { id },
//     process.env.JWT_SECRET,
//     {
//       expiresIn: "7d",
//     }
//   );
// };

// exports.googleLogin = async (req, res) => {
//   try {
//     const { token } = req.body;

//     if (!token) {
//       return res.status(400).json({
//         message: "Google token is required.",
//       });
//     }

//     const ticket = await client.verifyIdToken({
//       idToken: token,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const payload = ticket.getPayload();

//     const { email, email_verified } = payload;

//     if (!email_verified) {
//       return res.status(401).json({
//         message: "Google account is not verified.",
//       });
//     }

//     // Only allow existing users
//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         message:
//           "No account found with this Google email. Please register first.",
//       });
//     }

//     const jwtToken = createToken(user._id);

//     res.status(200).json({
//       message: "Login successful.",
//       token: jwtToken,
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//         wallet: user.wallet,
//         verified: user.verified,
//         role: user.role,
//       },
//     });
//   } catch (err) {
//     console.error(err);

//     res.status(500).json({
//       message: "Google authentication failed.",
//     });
//   }
// };

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

const createToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

exports.googleLogin = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        message: "Authorization code is required.",
      });
    }

    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { email, email_verified } = payload;

    if (!email_verified) {
      return res.status(401).json({
        message: "Google account is not verified.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message:
          "No account found with this Google email. Please register first.",
      });
    }

    const jwtToken = createToken(user._id);

    res.status(200).json({
      message: "Login successful.",
      token: jwtToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        wallet: user.wallet,
        verified: user.verified,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Google authentication failed.",
    });
  }
};
