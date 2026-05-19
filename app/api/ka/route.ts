import { NextResponse } from "next/server";
import { databricksFetch } from "@/lib/databricks";

export async function GET() {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;

  const res = await databricksFetch(`${host}/api/2.1/knowledge-assistants`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch KA list" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
