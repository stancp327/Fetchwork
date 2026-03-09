const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');
const { assignDefaultPlan } = require('../utils/billingUtils');
const { canonicalizeEmail, getGoogleProfileEmail } = require('../utils/authIdentity');

function configurePassport() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: (process.env.RENDER_EXTERNAL_URL || "https://fetchwork-1.onrender.com") + "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile?.id;
        const emailCanonical = getGoogleProfileEmail(profile);
        if (!googleId || !emailCanonical) {
          return done(new Error('Google profile missing required identity fields'), null);
        }

        let user = await User.findOne({ googleId });
        if (user) return done(null, user);

        try {
          user = await User.findOneAndUpdate(
            { emailCanonical },
            {
              $set: {
                googleId,
                email: emailCanonical,
                emailCanonical,
                isVerified: true,
                isEmailVerified: true,
                verificationLevel: 'email',
                lastLogin: new Date(),
              },
              $setOnInsert: {
                firstName: profile?.name?.givenName || '',
                lastName: profile?.name?.familyName || '',
              },
              $addToSet: {
                providers: 'google',
                badges: 'email_verified',
              }
            },
            { upsert: true, new: true }
          );
        } catch (e) {
          if (e?.code === 11000) {
            user = await User.findOne({ $or: [{ googleId }, { emailCanonical }] });
          } else {
            throw e;
          }
        }

        if (!user) return done(new Error('Failed to resolve Google user'), null);

        assignDefaultPlan(user._id, 'freelancer').catch(() => {});
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));
  } else {
    console.warn('⚠️ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "/api/auth/facebook/callback",
      profileFields: ['id', 'emails', 'name']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ facebookId: profile.id });
        
        if (user) {
          return done(null, user);
        }
        
        if (profile.emails && profile.emails[0]) {
          const emailCanonical = canonicalizeEmail(profile.emails[0].value);
          user = await User.findOne({ emailCanonical });
          if (user) {
            await User.updateOne(
              { _id: user._id },
              { 
                $set: { facebookId: profile.id },
                $addToSet: { providers: 'facebook' }
              }
            );
            user.facebookId = profile.id;
            return done(null, user);
          }
        }
        
        const facebookEmail = profile.emails ? canonicalizeEmail(profile.emails[0].value) : '';
        user = new User({
          facebookId: profile.id,
          email: facebookEmail,
          emailCanonical: facebookEmail,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          isVerified: true,
          providers: ['facebook']
        });
        
        await user.save();
        assignDefaultPlan(user._id, 'freelancer').catch(() => {});
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));
  } else {
    console.warn('⚠️ Facebook OAuth not configured - missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET');
  }

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

module.exports = configurePassport;
