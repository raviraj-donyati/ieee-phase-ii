import { NextResponse } from "next/server";
import { databricksFetch } from "@/lib/databricks";

export async function GET() {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;

  try {
    const res = await databricksFetch(`${host}/api/2.0/serving-endpoints`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ endpoints: [] });
    }

    const data = await res.json();
    const endpoints = (data.endpoints ?? [])
      .filter((e: { tags?: { key: string; value: string }[] }) =>
        e.tags?.some((t) => t.key === "display_name")
      )
      .map(
        (e: {
          name: string;
          state?: { ready?: string; config_update?: string };
          creator?: string;
          description?: string;
          task?: string;
          creation_timestamp?: number;
          last_updated_timestamp?: number;
          tags?: { key: string; value: string }[];
        }) => ({
          name: e.name,
          display_name: e.tags!.find((t) => t.key === "display_name")!.value,
          state: e.state,
          creator: e.creator,
          description: e.description,
          task: e.task,
          creation_timestamp: e.creation_timestamp,
          last_updated_timestamp: e.last_updated_timestamp,
        })
      );
    return NextResponse.json({ endpoints });
  } catch {
    return NextResponse.json({ endpoints: [] });
  }
}
