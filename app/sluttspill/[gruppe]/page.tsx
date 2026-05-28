import { GRUPPER } from "@/lib/vm-data";
import Klient from "./klient";

export function generateStaticParams() {
  return GRUPPER.map((g) => ({ gruppe: g.id }));
}

export const dynamicParams = false;

export default function Side() {
  return <Klient />;
}
