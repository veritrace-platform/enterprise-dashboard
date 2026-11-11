import { ShipmentDetailView } from "@/features/shipments";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShipmentDetailView shipmentId={id} />;
}
