import { NextResponse } from "next/server";
import { databricksFetch } from "@/lib/databricks";

export async function GET() {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;

  try {
    const res = await databricksFetch(`${host}/api/2.0/genie/spaces`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ spaces: [] });

    const data = await res.json();
    return NextResponse.json({ spaces: data.spaces ?? [] });
  } catch {
    return NextResponse.json({ spaces: [] });
  }
}
