import Chat from "../components/Chat";
import PerformanceChart from "../components/PerformanceChart";
import WhiteBox from "../components/WhiteBox";

export default function Home() {
  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">QuantGenesis</h1>
      <Chat />
      <PerformanceChart />
      <WhiteBox />
    </main>
  );
}