import GoogleProvider from "next-auth/providers/google";
import connectToDatabase from "@/lib/mongodb";

const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account.provider === "google") {
        const db = await connectToDatabase();
        const users = db.collection("users");

        if (!user.email) {
          return false;
        }

        const email = user.email.toLowerCase().trim();
        let existingUser = await users.findOne({ email });

        if (!existingUser) {
          const insertResult = await users.insertOne({
            email,
            passwordHash: null,
            encryptedHealthData: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          existingUser = {
            _id: insertResult.insertedId,
            email,
            encryptedHealthData: null,
          };
        }

        user.id = existingUser._id.toString();
        user.encryptedHealthData = existingUser.encryptedHealthData;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        if (user.encryptedHealthData) {
          token.encryptedHealthData = user.encryptedHealthData;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.encryptedHealthData = token.encryptedHealthData;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/",
    error: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
};

export default authOptions;
