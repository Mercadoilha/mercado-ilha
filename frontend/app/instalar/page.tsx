import type { Metadata } from "next";
import InstalarClient from "../../components/InstalarClient";

export const metadata: Metadata = {
  title: "Instalar App — Mercado Ilha",
};

export default function InstalarPage() {
  return <InstalarClient />;
}
