import "~/styles/globals.css";

import { SessionProvider } from "next-auth/react";
import { IBM_Plex_Sans } from "next/font/google";
import { api } from "~/utils/api";

import type { Session } from "next-auth";
import type { AppType } from "next/app";

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div className={`${body.variable} font-sans antialiased`}>
        <Component {...pageProps} session={session} />
      </div>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
