import TicketClient from "./TicketClient";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = await params;
  return <TicketClient slug={id} token={token} />;
}
