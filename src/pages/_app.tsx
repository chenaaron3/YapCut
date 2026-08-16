import "~/styles/globals.css";

import { SessionProvider } from "next-auth/react";
import {
  Cormorant_Garamond,
  IBM_Plex_Sans,
  JetBrains_Mono,
} from "next/font/google";

import { Toaster } from "~/components/ui/sonner";
import { api } from "~/utils/api";

import type { Session } from "next-auth";
import type { AppType } from "next/app";

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div
        className={`${body.variable} ${display.variable} ${mono.variable} font-sans antialiased`}
      >
        <Component {...pageProps} session={session} />
        <Toaster />
      </div>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
