import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import database from "./database.js";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";

dotenv.config();

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

export const configurePassport = (passport) => {
  passport.use(
    new JwtStrategy(opts, async (jwt_payload, done) => {
      try {
        const db = database.db;
        const user = await db
          .collection("users")
          .findOne({ _id: new ObjectId(jwt_payload.id) });

        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      } catch (err) {
        return done(err, false);
      }
    })
  );
};