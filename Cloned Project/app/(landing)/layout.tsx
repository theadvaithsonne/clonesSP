import Header from "@/components/shared/Header";
import Footer from "@/components/landing/Footer";

export default function landingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={""}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
