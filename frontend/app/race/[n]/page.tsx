import { notFound } from "next/navigation";
import RaceClient from "@/components/RaceClient";

export function generateStaticParams() {
  return [{ n: "1" }, { n: "2" }, { n: "3" }];
}

export default async function RacePage({ params }: PageProps<"/race/[n]">) {
  const { n } = await params;
  const num = Number(n);
  if (![1, 2, 3].includes(num)) notFound();
  return <RaceClient n={num} />;
}
