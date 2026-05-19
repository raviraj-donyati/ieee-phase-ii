import { NextRequest, NextResponse } from "next/server";
import { databricksFetch } from "@/lib/databricks";

const HOST = process.env.DATABRICKS_HOST!;
const TOKEN = process.env.DATABRICKS_TOKEN!;

export async function POST(req: NextRequest) {
  const { spaceId, conversationId, messageId, content } = await req.json();

  if (!spaceId || !conversationId || !messageId || !content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const res = await databricksFetch(
    `${HOST}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}/comments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      timeoutMs: 10_000,
    }
  );

  if (!res.ok) return NextResponse.json({ error: `Comment failed: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data);
}
