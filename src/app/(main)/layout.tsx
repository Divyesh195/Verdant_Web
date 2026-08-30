import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="mx-auto max-w-site px-4 py-8 md:px-6 md:py-10 animate-fade-in">{children}</section>
  </div>
);

export default Layout;
