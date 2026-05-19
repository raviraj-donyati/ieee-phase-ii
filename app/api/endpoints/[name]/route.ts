import { NextRequest, NextResponse } from "next/server";
import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const res = await databricksFetch(`${HOST}/api/2.0/serving-endpoints/${name}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: `Endpoint not found: ${res.status}` }, { status: res.status });

  const data = await res.json();
  return NextResponse.json({
    name: data.name,
    state: data.state,
    creator: data.creator,
    description: data.description,
    task: data.task,
    creation_timestamp: data.creation_timestamp,
    last_updated_timestamp: data.last_updated_timestamp,
  });
}
